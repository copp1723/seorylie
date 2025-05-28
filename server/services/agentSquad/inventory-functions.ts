import db from '../../db';
import { vehicles } from '../../../shared/schema';
import { eq, and, like, gte, lte, inArray, sql } from 'drizzle-orm';
import logger from '../../utils/logger';

export interface VehicleSearchParams {
  dealershipId: number;
  make?: string;
  model?: string;
  year?: number;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxMileage?: number;
  bodyStyle?: string;
  fuelType?: string;
  status?: string;
  certified?: boolean;
  limit?: number;
}

export interface VehicleSearchResult {
  id: number;
  vin: string;
  stockNumber: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  bodyStyle: string;
  mileage: number;
  salePrice: number;
  msrp: number;
  status: string;
  certified: boolean;
  description: string;
  images: string[];
  extColor: string;
  fuelType: string;
  transmission: string;
}

/**
 * Search vehicle inventory with comprehensive filtering
 */
export async function searchInventory(params: VehicleSearchParams): Promise<{
  success: boolean;
  vehicles: VehicleSearchResult[];
  total: number;
  filters_applied: string[];
  error?: string;
}> {
  try {
    logger.info('Searching inventory with params', { params });

    const filtersApplied: string[] = [];
    let query = db.select().from(vehicles)
      .where(and(
        eq(vehicles.dealershipId, params.dealershipId),
        eq(vehicles.isActive, true)
      ));

    // Build dynamic where conditions
    const conditions = [
      eq(vehicles.dealershipId, params.dealershipId),
      eq(vehicles.isActive, true)
    ];

    if (params.make) {
      conditions.push(like(vehicles.make, `%${params.make}%`));
      filtersApplied.push(`make: ${params.make}`);
    }

    if (params.model) {
      conditions.push(like(vehicles.model, `%${params.model}%`));
      filtersApplied.push(`model: ${params.model}`);
    }

    if (params.year) {
      conditions.push(eq(vehicles.year, params.year));
      filtersApplied.push(`year: ${params.year}`);
    }

    if (params.minYear) {
      conditions.push(gte(vehicles.year, params.minYear));
      filtersApplied.push(`min year: ${params.minYear}`);
    }

    if (params.maxYear) {
      conditions.push(lte(vehicles.year, params.maxYear));
      filtersApplied.push(`max year: ${params.maxYear}`);
    }

    if (params.minPrice) {
      const minPriceCents = params.minPrice * 100; // Convert to cents
      conditions.push(gte(vehicles.salePrice, minPriceCents));
      filtersApplied.push(`min price: $${params.minPrice}`);
    }

    if (params.maxPrice) {
      const maxPriceCents = params.maxPrice * 100; // Convert to cents
      conditions.push(lte(vehicles.salePrice, maxPriceCents));
      filtersApplied.push(`max price: $${params.maxPrice}`);
    }

    if (params.maxMileage) {
      conditions.push(lte(vehicles.mileage, params.maxMileage));
      filtersApplied.push(`max mileage: ${params.maxMileage}`);
    }

    if (params.bodyStyle) {
      conditions.push(like(vehicles.bodyStyle, `%${params.bodyStyle}%`));
      filtersApplied.push(`body style: ${params.bodyStyle}`);
    }

    if (params.fuelType) {
      conditions.push(like(vehicles.fuelType, `%${params.fuelType}%`));
      filtersApplied.push(`fuel type: ${params.fuelType}`);
    }

    if (params.status) {
      conditions.push(eq(vehicles.status, params.status));
      filtersApplied.push(`status: ${params.status}`);
    }

    if (params.certified !== undefined) {
      conditions.push(eq(vehicles.certified, params.certified));
      filtersApplied.push(`certified: ${params.certified}`);
    }

    // Execute search with all conditions
    const results = await db.select().from(vehicles)
      .where(and(...conditions))
      .orderBy(vehicles.year, vehicles.salePrice)
      .limit(params.limit || 20);

    // Format results for AI consumption
    const formattedVehicles: VehicleSearchResult[] = results.map(vehicle => ({
      id: vehicle.id,
      vin: vehicle.vin,
      stockNumber: vehicle.stockNumber || '',
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      trim: vehicle.trim || '',
      bodyStyle: vehicle.bodyStyle || '',
      mileage: vehicle.mileage || 0,
      salePrice: Math.round((vehicle.salePrice || 0) / 100), // Convert back to dollars
      msrp: Math.round((vehicle.msrp || 0) / 100),
      status: vehicle.status || 'Available',
      certified: vehicle.certified || false,
      description: vehicle.description || '',
      images: vehicle.images || [],
      extColor: vehicle.extColor || '',
      fuelType: vehicle.fuelType || '',
      transmission: vehicle.transmission || ''
    }));

    logger.info('Inventory search completed', {
      dealershipId: params.dealershipId,
      resultsCount: formattedVehicles.length,
      filtersApplied
    });

    return {
      success: true,
      vehicles: formattedVehicles,
      total: formattedVehicles.length,
      filters_applied: filtersApplied
    };

  } catch (error) {
    logger.error('Inventory search failed', { error, params });
    return {
      success: false,
      vehicles: [],
      total: 0,
      filters_applied: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get detailed vehicle information by VIN or ID
 */
export async function getVehicleDetails(
  dealershipId: number,
  identifier: string
): Promise<{
  success: boolean;
  vehicle?: VehicleSearchResult;
  error?: string;
}> {
  try {
    logger.info('Getting vehicle details', { dealershipId, identifier });

    // Try to find by VIN first, then by ID
    const isNumericId = /^\d+$/.test(identifier);
    
    let vehicle;
    if (isNumericId) {
      const results = await db.select().from(vehicles)
        .where(and(
          eq(vehicles.dealershipId, dealershipId),
          eq(vehicles.id, parseInt(identifier)),
          eq(vehicles.isActive, true)
        ))
        .limit(1);
      vehicle = results[0];
    } else {
      const results = await db.select().from(vehicles)
        .where(and(
          eq(vehicles.dealershipId, dealershipId),
          eq(vehicles.vin, identifier.toUpperCase()),
          eq(vehicles.isActive, true)
        ))
        .limit(1);
      vehicle = results[0];
    }

    if (!vehicle) {
      return {
        success: false,
        error: `Vehicle not found with identifier: ${identifier}`
      };
    }

    const formattedVehicle: VehicleSearchResult = {
      id: vehicle.id,
      vin: vehicle.vin,
      stockNumber: vehicle.stockNumber || '',
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      trim: vehicle.trim || '',
      bodyStyle: vehicle.bodyStyle || '',
      mileage: vehicle.mileage || 0,
      salePrice: Math.round((vehicle.salePrice || 0) / 100),
      msrp: Math.round((vehicle.msrp || 0) / 100),
      status: vehicle.status || 'Available',
      certified: vehicle.certified || false,
      description: vehicle.description || '',
      images: vehicle.images || [],
      extColor: vehicle.extColor || '',
      fuelType: vehicle.fuelType || '',
      transmission: vehicle.transmission || ''
    };

    return {
      success: true,
      vehicle: formattedVehicle
    };

  } catch (error) {
    logger.error('Get vehicle details failed', { error, dealershipId, identifier });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get inventory summary statistics
 */
export async function getInventorySummary(dealershipId: number): Promise<{
  success: boolean;
  summary?: {
    total_vehicles: number;
    new_vehicles: number;
    used_vehicles: number;
    certified_vehicles: number;
    average_price: number;
    price_range: { min: number; max: number };
    makes_available: string[];
    most_common_make: string;
  };
  error?: string;
}> {
  try {
    logger.info('Getting inventory summary', { dealershipId });

    // Get basic counts and statistics
    const summaryQuery = await db.select({
      total: sql<number>`count(*)::int`,
      newCount: sql<number>`count(*) filter (where status = 'new')::int`,
      usedCount: sql<number>`count(*) filter (where status = 'used')::int`,
      certifiedCount: sql<number>`count(*) filter (where certified = true)::int`,
      avgPrice: sql<number>`avg(sale_price)::int`,
      minPrice: sql<number>`min(sale_price)::int`,
      maxPrice: sql<number>`max(sale_price)::int`
    })
    .from(vehicles)
    .where(and(
      eq(vehicles.dealershipId, dealershipId),
      eq(vehicles.isActive, true)
    ));

    // Get available makes
    const makesQuery = await db.selectDistinct({ make: vehicles.make })
      .from(vehicles)
      .where(and(
        eq(vehicles.dealershipId, dealershipId),
        eq(vehicles.isActive, true)
      ))
      .orderBy(vehicles.make);

    // Get most common make
    const mostCommonMakeQuery = await db.select({
      make: vehicles.make,
      count: sql<number>`count(*)::int`
    })
    .from(vehicles)
    .where(and(
      eq(vehicles.dealershipId, dealershipId),
      eq(vehicles.isActive, true)
    ))
    .groupBy(vehicles.make)
    .orderBy(sql`count(*) desc`)
    .limit(1);

    const stats = summaryQuery[0] || {
      total: 0,
      newCount: 0,
      usedCount: 0,
      certifiedCount: 0,
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0
    };
    const makes = makesQuery.map(m => m.make);
    const mostCommonMake = mostCommonMakeQuery[0]?.make || '';

    const summary = {
      total_vehicles: stats.total,
      new_vehicles: stats.newCount,
      used_vehicles: stats.usedCount,
      certified_vehicles: stats.certifiedCount,
      average_price: Math.round((stats.avgPrice || 0) / 100),
      price_range: {
        min: Math.round((stats.minPrice || 0) / 100),
        max: Math.round((stats.maxPrice || 0) / 100)
      },
      makes_available: makes,
      most_common_make: mostCommonMake
    };

    logger.info('Inventory summary completed', { dealershipId, summary });

    return {
      success: true,
      summary
    };

  } catch (error) {
    logger.error('Get inventory summary failed', { error, dealershipId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Function definitions for Agent Squad OpenAI function calling
 */
export const inventoryFunctionDefinitions = [
  {
    name: 'searchInventory',
    description: 'Search vehicle inventory based on customer criteria like make, model, price range, etc.',
    parameters: {
      type: 'object',
      properties: {
        make: {
          type: 'string',
          description: 'Vehicle make (e.g., Honda, Toyota, Ford)'
        },
        model: {
          type: 'string', 
          description: 'Vehicle model (e.g., Civic, Camry, F-150)'
        },
        year: {
          type: 'integer',
          description: 'Specific year for the vehicle'
        },
        minYear: {
          type: 'integer',
          description: 'Minimum year for vehicle search'
        },
        maxYear: {
          type: 'integer',
          description: 'Maximum year for vehicle search'
        },
        minPrice: {
          type: 'integer',
          description: 'Minimum price in dollars'
        },
        maxPrice: {
          type: 'integer',
          description: 'Maximum price in dollars'
        },
        maxMileage: {
          type: 'integer',
          description: 'Maximum mileage for vehicle search'
        },
        bodyStyle: {
          type: 'string',
          description: 'Vehicle body style (e.g., sedan, SUV, truck, hatchback)'
        },
        fuelType: {
          type: 'string',
          description: 'Fuel type (e.g., gasoline, hybrid, electric)'
        },
        certified: {
          type: 'boolean',
          description: 'Whether to search only certified pre-owned vehicles'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 20)'
        }
      },
      required: []
    }
  },
  {
    name: 'getVehicleDetails',
    description: 'Get detailed information about a specific vehicle by VIN or ID',
    parameters: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'Vehicle VIN number or database ID'
        }
      },
      required: ['identifier']
    }
  },
  {
    name: 'getInventorySummary',
    description: 'Get summary statistics about the dealership inventory',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];