import { db } from '../../db';
import { vehicles } from '../../../shared/schema';
import { eq, and, like, gte, lte, sql } from 'drizzle-orm';
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
  sortBy?: 'price' | 'year' | 'mileage' | 'make';
  sortOrder?: 'asc' | 'desc';
  features?: string[];
  drivetrainType?: string;
  exteriorColor?: string;
  interiorColor?: string;
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
  features?: string[];
  mpgCity?: number;
  mpgHighway?: number;
  drivetrainType?: string;
  engineSize?: string;
  doors?: number;
  passengers?: number;
  interiorColor?: string;
  availability?: {
    isAvailable: boolean;
    reservedUntil?: string;
    estimatedDelivery?: string;
  };
}

/**
 * Search vehicle inventory with comprehensive filtering
 */
export async function searchInventory(params: VehicleSearchParams): Promise<{
  success: boolean;
  vehicles: VehicleSearchResult[];
  total: number;
  filters_applied: string[];
  processingTime?: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    logger.info('Searching inventory with params', { params });

    const filtersApplied: string[] = [];

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

    if (params.exteriorColor) {
      conditions.push(like(vehicles.extColor, `%${params.exteriorColor}%`));
      filtersApplied.push(`exterior color: ${params.exteriorColor}`);
    }

    if (params.drivetrainType) {
      conditions.push(like(vehicles.drivetrain, `%${params.drivetrainType}%`));
      filtersApplied.push(`drivetrain: ${params.drivetrainType}`);
    }

    // Determine sort order
    let orderByClause;
    const sortBy = params.sortBy || 'year';
    const sortOrder = params.sortOrder || 'desc';
    
    switch (sortBy) {
      case 'price':
        orderByClause = sortOrder === 'asc' ? vehicles.salePrice : sql`${vehicles.salePrice} DESC`;
        break;
      case 'mileage':
        orderByClause = sortOrder === 'asc' ? vehicles.mileage : sql`${vehicles.mileage} DESC`;
        break;
      case 'make':
        orderByClause = sortOrder === 'asc' ? vehicles.make : sql`${vehicles.make} DESC`;
        break;
      default:
        orderByClause = sortOrder === 'asc' ? vehicles.year : sql`${vehicles.year} DESC`;
    }

    // Execute search with all conditions
    const results = await db.select().from(vehicles)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(params.limit || 20);

    // Format results for AI consumption with enhanced details
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
      transmission: vehicle.transmission || '',
      mpgCity: vehicle.mpgCity || undefined,
      mpgHighway: vehicle.mpgHighway || undefined,
      drivetrainType: vehicle.drivetrain || undefined,
      engineSize: vehicle.engineSize || undefined,
      doors: vehicle.doors || undefined,
      passengers: vehicle.passengers || undefined,
      interiorColor: vehicle.intColor || undefined,
      features: vehicle.features || [],
      availability: {
        isAvailable: vehicle.status === 'Available',
        reservedUntil: vehicle.reservedUntil || undefined,
        estimatedDelivery: vehicle.estimatedDelivery || undefined
      }
    }));

    logger.info('Inventory search completed', {
      dealershipId: params.dealershipId,
      resultsCount: formattedVehicles.length,
      filtersApplied
    });

    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      vehicles: formattedVehicles,
      total: formattedVehicles.length,
      filters_applied: filtersApplied,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Inventory search failed', { error, params, processingTime });
    return {
      success: false,
      vehicles: [],
      total: 0,
      filters_applied: [],
      processingTime,
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
  processingTime?: number;
  error?: string;
}> {
  const startTime = Date.now();
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
      transmission: vehicle.transmission || '',
      mpgCity: vehicle.mpgCity || undefined,
      mpgHighway: vehicle.mpgHighway || undefined,
      drivetrainType: vehicle.drivetrain || undefined,
      engineSize: vehicle.engineSize || undefined,
      doors: vehicle.doors || undefined,
      passengers: vehicle.passengers || undefined,
      interiorColor: vehicle.intColor || undefined,
      features: vehicle.features || [],
      availability: {
        isAvailable: vehicle.status === 'Available',
        reservedUntil: vehicle.reservedUntil || undefined,
        estimatedDelivery: vehicle.estimatedDelivery || undefined
      }
    };

    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      vehicle: formattedVehicle,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Get vehicle details failed', { error, dealershipId, identifier, processingTime });
    return {
      success: false,
      processingTime,
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

    const stats = summaryQuery[0];
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
 * Enhanced function handlers for Agent Squad with real-time capabilities
 */
export const createEnhancedInventoryHandlers = (defaultDealershipId?: number) => ({
  searchInventory: async (params: any, context?: any) => {
    try {
      const dealershipId = context?.dealershipId || defaultDealershipId;
      if (!dealershipId) {
        throw new Error('Dealership ID required for inventory search');
      }

      logger.info('Enhanced function call: searchInventory', { params, dealershipId });
      
      const result = await searchInventory({
        dealershipId,
        ...params
      });

      return JSON.stringify(result);
    } catch (error) {
      logger.error('searchInventory function failed', { error, params });
      return JSON.stringify({ 
        success: false, 
        vehicles: [],
        total: 0,
        filters_applied: [],
        error: 'Unable to search inventory at this time. Please try again or contact our team for assistance.' 
      });
    }
  },

  getVehicleDetails: async (params: any, context?: any) => {
    try {
      const dealershipId = context?.dealershipId || defaultDealershipId;
      if (!dealershipId) {
        throw new Error('Dealership ID required for vehicle details');
      }

      logger.info('Enhanced function call: getVehicleDetails', { params, dealershipId });

      const result = await getVehicleDetails(dealershipId, params.identifier);
      return JSON.stringify(result);
    } catch (error) {
      logger.error('getVehicleDetails function failed', { error, params });
      return JSON.stringify({ 
        success: false, 
        error: 'Unable to get vehicle details at this time. Please provide the VIN or vehicle ID and try again.' 
      });
    }
  },

  getInventorySummary: async (params: any, context?: any) => {
    try {
      const dealershipId = context?.dealershipId || defaultDealershipId;
      if (!dealershipId) {
        throw new Error('Dealership ID required for inventory summary');
      }

      logger.info('Enhanced function call: getInventorySummary', { params, dealershipId });

      const result = await getInventorySummary(dealershipId);
      return JSON.stringify(result);
    } catch (error) {
      logger.error('getInventorySummary function failed', { error, params });
      return JSON.stringify({ 
        success: false, 
        error: 'Unable to get inventory summary at this time. Please try again later.' 
      });
    }
  },

  searchInventoryWithRecommendations: async (params: any, context?: any) => {
    try {
      const dealershipId = context?.dealershipId || defaultDealershipId;
      if (!dealershipId) {
        throw new Error('Dealership ID required for inventory search with recommendations');
      }

      logger.info('Enhanced function call: searchInventoryWithRecommendations', { params, dealershipId });

      const result = await searchInventoryWithRecommendations({
        dealershipId,
        ...params
      });

      return JSON.stringify(result);
    } catch (error) {
      logger.error('searchInventoryWithRecommendations function failed', { error, params });
      return JSON.stringify({ 
        success: false, 
        vehicles: [],
        recommendations: {
          bestValue: [],
          mostFuelEfficient: [],
          familyFriendly: [],
          bestForBudget: []
        },
        total: 0,
        filters_applied: [],
        error: 'Unable to search inventory with recommendations at this time. Please try a basic search or contact our team.' 
      });
    }
  },

  checkVehicleAvailability: async (params: any, context?: any) => {
    try {
      const dealershipId = context?.dealershipId || defaultDealershipId;
      if (!dealershipId) {
        throw new Error('Dealership ID required for vehicle availability check');
      }

      if (!params.vehicleId) {
        throw new Error('Vehicle ID is required to check availability');
      }

      logger.info('Enhanced function call: checkVehicleAvailability', { params, dealershipId });

      const result = await checkVehicleAvailability(dealershipId, params.vehicleId);
      return JSON.stringify(result);
    } catch (error) {
      logger.error('checkVehicleAvailability function failed', { error, params });
      return JSON.stringify({ 
        success: false, 
        error: 'Unable to check vehicle availability at this time. Please provide a valid vehicle ID or contact our team.' 
      });
    }
  }
})

/**
 * Advanced inventory search with smart recommendations
 */
export async function searchInventoryWithRecommendations(
  params: VehicleSearchParams & {
    budget?: number;
    familySize?: number;
    primaryUse?: 'commuting' | 'family' | 'recreation' | 'work';
    fuelEfficiencyImportant?: boolean;
    reliabilityImportant?: boolean;
  }
): Promise<{
  success: boolean;
  vehicles: VehicleSearchResult[];
  recommendations: {
    bestValue: VehicleSearchResult[];
    mostFuelEfficient: VehicleSearchResult[];
    familyFriendly: VehicleSearchResult[];
    bestForBudget: VehicleSearchResult[];
  };
  total: number;
  filters_applied: string[];
  error?: string;
}> {
  try {
    logger.info('Advanced inventory search with recommendations', { params });

    // First get basic search results
    const basicSearch = await searchInventory(params);
    if (!basicSearch.success) {
      return {
        ...basicSearch,
        recommendations: {
          bestValue: [],
          mostFuelEfficient: [],
          familyFriendly: [],
          bestForBudget: []
        }
      };
    }

    const allVehicles = basicSearch.vehicles;
    
    // Generate smart recommendations
    const recommendations = {
      bestValue: allVehicles
        .filter(v => v.msrp > 0 && v.salePrice > 0)
        .sort((a, b) => ((b.msrp - b.salePrice) / b.msrp) - ((a.msrp - a.salePrice) / a.msrp))
        .slice(0, 3),
      
      mostFuelEfficient: allVehicles
        .filter(v => v.mpgCity && v.mpgHighway)
        .sort((a, b) => ((b.mpgCity || 0) + (b.mpgHighway || 0)) - ((a.mpgCity || 0) + (a.mpgHighway || 0)))
        .slice(0, 3),
      
      familyFriendly: allVehicles
        .filter(v => (v.passengers || 0) >= 5 || v.bodyStyle?.toLowerCase().includes('suv') || v.bodyStyle?.toLowerCase().includes('minivan'))
        .sort((a, b) => (b.passengers || 0) - (a.passengers || 0))
        .slice(0, 3),
      
      bestForBudget: params.budget 
        ? allVehicles
          .filter(v => v.salePrice <= params.budget!)
          .sort((a, b) => a.salePrice - b.salePrice)
          .slice(0, 3)
        : []
    };

    return {
      success: true,
      vehicles: allVehicles,
      recommendations,
      total: allVehicles.length,
      filters_applied: basicSearch.filters_applied
    };

  } catch (error) {
    logger.error('Advanced inventory search failed', { error, params });
    return {
      success: false,
      vehicles: [],
      recommendations: {
        bestValue: [],
        mostFuelEfficient: [],
        familyFriendly: [],
        bestForBudget: []
      },
      total: 0,
      filters_applied: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Real-time inventory availability check
 */
export async function checkVehicleAvailability(
  dealershipId: number,
  vehicleId: number
): Promise<{
  success: boolean;
  availability?: {
    isAvailable: boolean;
    status: string;
    location?: string;
    reservedUntil?: string;
    lastUpdated: string;
    canScheduleTestDrive: boolean;
    estimatedDelivery?: string;
  };
  error?: string;
}> {
  try {
    logger.info('Checking real-time vehicle availability', { dealershipId, vehicleId });

    const results = await db.select({
      id: vehicles.id,
      status: vehicles.status,
      isActive: vehicles.isActive,
      reservedUntil: vehicles.reservedUntil,
      location: vehicles.location,
      lastUpdated: vehicles.updatedAt,
      estimatedDelivery: vehicles.estimatedDelivery
    })
    .from(vehicles)
    .where(and(
      eq(vehicles.dealershipId, dealershipId),
      eq(vehicles.id, vehicleId)
    ))
    .limit(1);

    if (results.length === 0) {
      return {
        success: false,
        error: 'Vehicle not found'
      };
    }

    const vehicle = results[0];
    const isAvailable = vehicle.isActive && vehicle.status === 'Available';
    const isReserved = vehicle.reservedUntil && new Date(vehicle.reservedUntil) > new Date();

    return {
      success: true,
      availability: {
        isAvailable: isAvailable && !isReserved,
        status: vehicle.status || 'Unknown',
        location: vehicle.location || 'On lot',
        reservedUntil: isReserved ? vehicle.reservedUntil : undefined,
        lastUpdated: vehicle.lastUpdated?.toISOString() || new Date().toISOString(),
        canScheduleTestDrive: isAvailable && !isReserved,
        estimatedDelivery: vehicle.estimatedDelivery
      }
    };

  } catch (error) {
    logger.error('Vehicle availability check failed', { error, dealershipId, vehicleId });
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
    description: 'Search vehicle inventory based on customer criteria like make, model, price range, etc. Returns detailed vehicle information including features, availability, and specifications.',
    parameters: {
      type: 'object',
      properties: {
        make: {
          type: 'string',
          description: 'Vehicle make (e.g., Honda, Toyota, Ford, BMW, Mercedes-Benz)'
        },
        model: {
          type: 'string', 
          description: 'Vehicle model (e.g., Civic, Camry, F-150, Accord, Corolla)'
        },
        year: {
          type: 'integer',
          description: 'Specific year for the vehicle'
        },
        minYear: {
          type: 'integer',
          description: 'Minimum year for vehicle search (e.g., 2020 for newer vehicles)'
        },
        maxYear: {
          type: 'integer',
          description: 'Maximum year for vehicle search (e.g., 2024 for current models)'
        },
        minPrice: {
          type: 'integer',
          description: 'Minimum price in dollars (e.g., 15000 for $15,000)'
        },
        maxPrice: {
          type: 'integer',
          description: 'Maximum price in dollars (e.g., 35000 for $35,000)'
        },
        maxMileage: {
          type: 'integer',
          description: 'Maximum mileage for vehicle search (e.g., 50000 for low-mileage vehicles)'
        },
        bodyStyle: {
          type: 'string',
          description: 'Vehicle body style (e.g., sedan, SUV, truck, hatchback, coupe, convertible, wagon)'
        },
        fuelType: {
          type: 'string',
          description: 'Fuel type (e.g., gasoline, hybrid, electric, diesel, flex-fuel)'
        },
        certified: {
          type: 'boolean',
          description: 'Whether to search only certified pre-owned vehicles (true for CPO only)'
        },
        sortBy: {
          type: 'string',
          enum: ['price', 'year', 'mileage', 'make'],
          description: 'Sort results by price, year, mileage, or make'
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order: asc for ascending, desc for descending'
        },
        exteriorColor: {
          type: 'string',
          description: 'Exterior color preference (e.g., white, black, silver, red, blue)'
        },
        drivetrainType: {
          type: 'string',
          description: 'Drivetrain type (e.g., FWD, AWD, 4WD, RWD)'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 20, max: 50)'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'getVehicleDetails',
    description: 'Get comprehensive detailed information about a specific vehicle including features, specifications, availability, and pricing',
    parameters: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'Vehicle VIN number or database ID to lookup specific vehicle details'
        }
      },
      required: ['identifier'] as string[]
    }
  },
  {
    name: 'getInventorySummary',
    description: 'Get comprehensive summary statistics about the dealership inventory including counts, pricing, and available makes',
    parameters: {
      type: 'object',
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'searchInventoryWithRecommendations',
    description: 'Advanced inventory search that provides personalized vehicle recommendations based on customer needs and preferences',
    parameters: {
      type: 'object',
      properties: {
        make: {
          type: 'string',
          description: 'Vehicle make preference'
        },
        model: {
          type: 'string',
          description: 'Vehicle model preference'
        },
        budget: {
          type: 'integer',
          description: 'Customer budget in dollars for personalized recommendations'
        },
        familySize: {
          type: 'integer',
          description: 'Number of people who will regularly use the vehicle'
        },
        primaryUse: {
          type: 'string',
          enum: ['commuting', 'family', 'recreation', 'work'],
          description: 'Primary intended use of the vehicle'
        },
        fuelEfficiencyImportant: {
          type: 'boolean',
          description: 'Whether fuel efficiency is a priority for the customer'
        },
        reliabilityImportant: {
          type: 'boolean',
          description: 'Whether reliability is a priority for the customer'
        },
        minPrice: {
          type: 'integer',
          description: 'Minimum acceptable price'
        },
        maxPrice: {
          type: 'integer',
          description: 'Maximum acceptable price'
        },
        maxMileage: {
          type: 'integer',
          description: 'Maximum acceptable mileage'
        },
        bodyStyle: {
          type: 'string',
          description: 'Preferred body style'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'checkVehicleAvailability',
    description: 'Check real-time availability status of a specific vehicle including reservation status and test drive availability',
    parameters: {
      type: 'object',
      properties: {
        vehicleId: {
          type: 'integer',
          description: 'Database ID of the vehicle to check availability for'
        }
      },
      required: ['vehicleId'] as string[]
    }
  }
];