import db from '../db';
import { vehicles, type InsertVehicle } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

export async function processTsvInventory(
  filePath: string,
  dealershipId: number
): Promise<{ success: boolean; stats: { added: number; updated: number; errors: number; deactivated: number } }> {
  const stats = { added: 0, updated: 0, errors: 0, deactivated: 0 };
  const processedVins = new Set<string>();

  try {
    logger.info('Starting inventory import', { dealershipId, filePath });

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split('\t').map(header => header.trim());

    // Process each vehicle in the import
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = line.split('\t');
        const vehicleData: Record<string, string> = {};

        headers.forEach((header, index) => {
          if (index < values.length) {
            vehicleData[header] = values[index];
          }
        });

        const vehicle = mapDealershipTsvToVehicle(vehicleData, dealershipId);
        
        if (!vehicle.vin) {
          logger.warn('Skipping vehicle without VIN', { line: i });
          stats.errors++;
          continue;
        }

        processedVins.add(vehicle.vin);

        // Check if vehicle already exists
        const existingVehicle = await db
          .select()
          .from(vehicles)
          .where(and(
            eq(vehicles.dealershipId, dealershipId),
            eq(vehicles.vin, vehicle.vin)
          ))
          .limit(1);

        if (existingVehicle.length > 0) {
          // Update existing vehicle with lastSeen timestamp
          await db
            .update(vehicles)
            .set({
              ...vehicle,
              isActive: true,
              lastSeen: new Date(),
              updated_at: new Date()
            })
            .where(and(
              eq(vehicles.dealershipId, dealershipId),
              eq(vehicles.vin, vehicle.vin)
            ));
          
          stats.updated++;
        } else {
          // Create new vehicle
          await db.insert(vehicles).values({
            ...vehicle,
            isActive: true,
            lastSeen: new Date()
          });
          
          stats.added++;
        }

      } catch (error) {
        logger.error(`Error processing line ${i}`, { error, line: i });
        stats.errors++;
      }
    }

    // Mark vehicles not in this import as inactive (after 30 days of not being seen)
    stats.deactivated = await markMissingVehiclesInactive(dealershipId, processedVins);

    logger.info('Inventory import completed', { 
      dealershipId, 
      stats,
      processedVehicles: processedVins.size
    });

    return { success: true, stats };
  } catch (error) {
    logger.error('Error processing TSV file', { error, dealershipId, filePath });
    return { success: false, stats };
  }
}

/**
 * Mark vehicles that haven't been seen in recent imports as inactive
 */
async function markMissingVehiclesInactive(
  dealershipId: number, 
  processedVins: Set<string>
): Promise<number> {
  try {
    // Convert VINs to array for SQL query
    const vinsArray = Array.from(processedVins);
    
    // Find vehicles that are currently active but weren't in this import
    // and haven't been seen for more than 30 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await db
      .update(vehicles)
      .set({
        isActive: false,
        updated_at: new Date()
      })
      .where(and(
        eq(vehicles.dealershipId, dealershipId),
        eq(vehicles.isActive, true),
        sql`${vehicles.vin} NOT IN (${vinsArray.map(vin => `'${vin}'`).join(',') || 'NULL'})`,
        sql`${vehicles.lastSeen} < ${cutoffDate.toISOString()}`
      ))
      .returning({ id: vehicles.id });

    logger.info('Marked vehicles as inactive', {
      dealershipId,
      deactivatedCount: result.length,
      cutoffDate
    });

    return result.length;
  } catch (error) {
    logger.error('Error marking missing vehicles inactive', { error, dealershipId });
    return 0;
  }
}

function mapDealershipTsvToVehicle(data: Record<string, string>, dealershipId: number): InsertVehicle {
  // Parse price values
  const salePrice = parseFloat(data.Price?.replace(/[$,]/g, '') || '0') * 100; // Convert to cents
  const msrp = parseFloat(data['Formatted Price']?.replace(/[$,]/g, '') || '0') * 100; // Convert to cents

  return {
    dealershipId,
    vin: data.VIN || '',
    stockNumber: data.stock_number || '',
    make: data.Make || '',
    model: data.Model || '',
    year: parseInt(data.Year || '0', 10),
    trim: data.Trim || '',
    bodyStyle: data.Type || '',
    extColor: data.Color || '',
    intColor: '',
    mileage: parseInt(data.Mileage || '0', 10),
    engine: '',
    transmission: data.Transmission || '',
    drivetrain: data.Drivetrain || '',
    fuelType: data['Fuel Type'] || '',
    fuelEconomy: null,
    msrp: msrp || null,
    salePrice: salePrice || null,
    status: data.Condition?.toLowerCase() === 'new' ? 'new' : 'used',
    certified: false,
    description: data.Description || data.Title || '',
    features: [],
    images: data['Image URL'] ? [data['Image URL']] : [],
    videoUrl: null
  };
}

export async function processInventoryEmail(
  attachmentContent: string,
  dealershipId: number,
  tempFilePath?: string
): Promise<{ success: boolean; stats: { added: number; updated: number; errors: number; deactivated: number } }> {
  const filePath = tempFilePath || path.join(process.cwd(), `temp_inventory_${Date.now()}.tsv`);

  try {
    fs.writeFileSync(filePath, attachmentContent);
    const result = await processTsvInventory(filePath, dealershipId);

    if (!tempFilePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return result;
  } catch (error) {
    logger.error('Error processing inventory email', { error, dealershipId });
    if (!tempFilePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return {
      success: false,
      stats: { added: 0, updated: 0, errors: 0, deactivated: 0 }
    };
  }
}

/**
 * Create a scheduled job to clean up stale inventory
 */
export async function createInventoryCleanupJob(): Promise<void> {
  try {
    // This would typically be implemented with a job scheduler like node-cron
    // For now, we'll create a function that can be called manually or via cron
    logger.info('Inventory cleanup job would be scheduled here');
  } catch (error) {
    logger.error('Failed to create inventory cleanup job', { error });
  }
}

/**
 * Manual cleanup function to mark old vehicles as inactive
 */
export async function cleanupStaleInventory(dealershipId?: number): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

    let whereCondition = and(
      eq(vehicles.isActive, true),
      sql`${vehicles.lastSeen} < ${cutoffDate.toISOString()}`
    );

    if (dealershipId) {
      whereCondition = and(
        eq(vehicles.dealershipId, dealershipId),
        eq(vehicles.isActive, true),
        sql`${vehicles.lastSeen} < ${cutoffDate.toISOString()}`
      );
    }

    const result = await db
      .update(vehicles)
      .set({
        isActive: false,
        updated_at: new Date()
      })
      .where(whereCondition)
      .returning({ id: vehicles.id, dealershipId: vehicles.dealershipId });

    logger.info('Cleanup completed', {
      deactivatedCount: result.length,
      cutoffDate,
      dealershipId
    });

    return result.length;
  } catch (error) {
    logger.error('Failed to cleanup stale inventory', { error, dealershipId });
    return 0;
  }
}