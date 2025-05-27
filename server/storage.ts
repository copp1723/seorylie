/**
 * Simple storage abstraction layer
 * This provides basic database operations for the services that need them
 */

import db from './db';
import { dealerships, vehicles } from '../shared/schema';
import { eq } from 'drizzle-orm';

export const storage = {
  async getDealerships() {
    try {
      return await db.select().from(dealerships);
    } catch (error) {
      console.error('Error fetching dealerships:', error);
      return [];
    }
  },

  async getVehicleByVin(vin: string) {
    try {
      const results = await db.select().from(vehicles).where(eq(vehicles.vin, vin)).limit(1);
      return results[0] || null;
    } catch (error) {
      console.error('Error fetching vehicle by VIN:', error);
      return null;
    }
  },

  async createVehicle(vehicleData: any) {
    try {
      const results = await db.insert(vehicles).values(vehicleData).returning();
      return results[0];
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  },

  async updateVehicle(vehicleId: number, vehicleData: any) {
    try {
      const results = await db.update(vehicles)
        .set(vehicleData)
        .where(eq(vehicles.id, vehicleId))
        .returning();
      return results[0];
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  }
};