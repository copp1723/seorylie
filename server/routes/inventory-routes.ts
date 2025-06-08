import express from "express";
import { db } from "../db";
import { vehicles } from "../../shared/schema";
import { eq, and, gte, lte, ilike, or, desc, asc } from "drizzle-orm";
import { searchInventory } from "../services/inventory-functions";
import { processTsvInventory } from "../services/inventory-import";
import multer from "multer";
import { z } from "zod";

// Simple auth middleware for testing
const requireAuth = (req: any, res: any, next: any) => {
  // In development/testing, allow bypass or use mock session
  if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  ) {
    req.session = req.session || {};
    req.session.user = req.session.user || { dealershipId: 1 };
  }

  if (!req.session?.user?.dealershipId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  next();
};

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Vehicle validation schema matching database schema
const VehicleSchema = z.object({
  dealershipId: z.number(),
  vin: z.string().min(17).max(17),
  stockNumber: z.string().optional(),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 2),
  trim: z.string().optional(),
  bodyStyle: z.string().optional(),
  extColor: z.string().optional(),
  intColor: z.string().optional(),
  mileage: z.number().min(0).optional(),
  engine: z.string().optional(),
  transmission: z.string().optional(),
  drivetrain: z.string().optional(),
  fuelType: z.string().optional(),
  fuelEconomy: z.number().optional(),
  msrp: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  condition: z.string().default("new"),
  exteriorColor: z.string().optional(),
  interiorColor: z.string().optional(),
  status: z.string().default("Available"),
  certified: z.boolean().default(false),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  categoryTags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

// GET /api/vehicles - Get all vehicles with filtering
router.get("/vehicles", requireAuth, async (req, res) => {
  try {
    const {
      make,
      model,
      year,
      minPrice,
      maxPrice,
      condition,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const dealershipId = req.session.user?.dealershipId;
    if (!dealershipId) {
      return res.status(401).json({ error: "Dealership context required" });
    }

    const searchParams = {
      dealershipId,
      make: make as string,
      model: model as string,
      year: year ? parseInt(year as string) : undefined,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      condition: condition as string,
      status: status as string,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await searchInventory(searchParams);

    res.json({
      vehicles: result.vehicles,
      pagination: {
        page: searchParams.page,
        limit: searchParams.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / searchParams.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

// GET /api/vehicles/:id - Get single vehicle
router.get("/vehicles/:id", requireAuth, async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const dealershipId = req.session.user?.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: "Dealership context required" });
    }

    const vehicle = await db
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.dealershipId, dealershipId),
        ),
      )
      .limit(1);

    if (vehicle.length === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({
      ...vehicle[0],
      images: [], // Vehicle images functionality can be added later
    });
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    res.status(500).json({ error: "Failed to fetch vehicle" });
  }
});

// POST /api/vehicles - Create new vehicle
router.post("/vehicles", requireAuth, async (req, res) => {
  try {
    const dealershipId = req.session.user?.dealershipId;
    if (!dealershipId) {
      return res.status(401).json({ error: "Dealership context required" });
    }

    const validatedData = VehicleSchema.parse({
      ...req.body,
      dealershipId,
    });

    // Check for duplicate VIN
    const existingVehicle = await db
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.vin, validatedData.vin),
          eq(vehicles.dealershipId, dealershipId),
        ),
      )
      .limit(1);

    if (existingVehicle.length > 0) {
      return res
        .status(400)
        .json({ error: "Vehicle with this VIN already exists" });
    }

    const [newVehicle] = await db
      .insert(vehicles)
      .values(validatedData)
      .returning();

    res.status(201).json(newVehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating vehicle:", error);
    res.status(500).json({ error: "Failed to create vehicle" });
  }
});

// PUT /api/vehicles/:id - Update vehicle
router.put("/vehicles/:id", requireAuth, async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const dealershipId = req.session.user?.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: "Dealership context required" });
    }

    // Verify vehicle exists and belongs to dealership
    const existingVehicle = await db
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.dealershipId, dealershipId),
        ),
      )
      .limit(1);

    if (existingVehicle.length === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.dealershipId;
    delete updateData.createdAt;

    const validatedData = VehicleSchema.partial().parse(updateData);

    // Check for duplicate VIN if VIN is being updated
    if (validatedData.vin && validatedData.vin !== existingVehicle[0].vin) {
      const duplicateVin = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.vin, validatedData.vin),
            eq(vehicles.dealershipId, dealershipId),
          ),
        )
        .limit(1);

      if (duplicateVin.length > 0) {
        return res
          .status(400)
          .json({ error: "Vehicle with this VIN already exists" });
      }
    }

    const [updatedVehicle] = await db
      .update(vehicles)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.dealershipId, dealershipId),
        ),
      )
      .returning();

    res.json(updatedVehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating vehicle:", error);
    res.status(500).json({ error: "Failed to update vehicle" });
  }
});

// DELETE /api/vehicles/:id - Delete vehicle
router.delete("/vehicles/:id", requireAuth, async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const dealershipId = req.session.user?.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: "Dealership context required" });
    }

    // Verify vehicle exists and belongs to dealership
    const existingVehicle = await db
      .select()
      .from(vehicles)
      .where(
        and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.dealershipId, dealershipId),
        ),
      )
      .limit(1);

    if (existingVehicle.length === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Delete vehicle
    await db
      .delete(vehicles)
      .where(
        and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.dealershipId, dealershipId),
        ),
      );

    res.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    res.status(500).json({ error: "Failed to delete vehicle" });
  }
});

// POST /api/vehicles/import - Import vehicles from TSV/CSV
router.post(
  "/vehicles/import",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const dealershipId = req.session.user?.dealershipId;
      if (!dealershipId) {
        return res.status(401).json({ error: "Dealership context required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const result = await processTsvInventory(fileContent, dealershipId);

      res.json({
        message: "Import completed",
        stats: result,
      });
    } catch (error) {
      console.error("Error importing vehicles:", error);
      res.status(500).json({ error: "Failed to import vehicles" });
    }
  },
);

export default router;
