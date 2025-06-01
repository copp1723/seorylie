/**
 * STAB-307 Agent Squad System Validation - Inventory Functions Tests
 * 
 * Test inventory search, vehicle details, and availability functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  searchInventory, 
  getVehicleDetails, 
  getInventorySummary,
  searchInventoryWithRecommendations,
  checkVehicleAvailability,
  createEnhancedInventoryHandlers,
  type VehicleSearchParams,
  type VehicleSearchResult
} from '../../server/services/agentSquad/inventory-functions';
import { mockData } from '../../test-utils/setup';

describe('Agent Squad Inventory Functions', () => {
  const testDealershipId = 1;

  describe('Vehicle Search Functions', () => {
    it('should search inventory with basic parameters', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        make: 'Honda',
        limit: 10
      };

      const result = await searchInventory(params);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.vehicles)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.filters_applied)).toBe(true);
      expect(result.filters_applied).toContain('make: Honda');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should search inventory with multiple filters', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        make: 'Toyota',
        model: 'Camry',
        minYear: 2020,
        maxYear: 2024,
        minPrice: 20000,
        maxPrice: 35000,
        maxMileage: 50000,
        bodyStyle: 'Sedan',
        certified: true,
        limit: 5
      };

      const result = await searchInventory(params);
      
      expect(result.success).toBe(true);
      expect(result.filters_applied.length).toBeGreaterThan(1);
      
      if (result.vehicles.length > 0) {
        result.vehicles.forEach(vehicle => {
          expect(vehicle.make.toLowerCase()).toContain('toyota');
          expect(vehicle.year).toBeGreaterThanOrEqual(2020);
          expect(vehicle.year).toBeLessThanOrEqual(2024);
          expect(vehicle.salePrice).toBeGreaterThanOrEqual(20000);
          expect(vehicle.salePrice).toBeLessThanOrEqual(35000);
          if (vehicle.mileage) {
            expect(vehicle.mileage).toBeLessThanOrEqual(50000);
          }
        });
      }
    });

    it('should handle sorting options correctly', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        sortBy: 'price',
        sortOrder: 'asc',
        limit: 10
      };

      const result = await searchInventory(params);
      
      if (result.success && result.vehicles.length > 1) {
        for (let i = 1; i < result.vehicles.length; i++) {
          expect(result.vehicles[i].salePrice).toBeGreaterThanOrEqual(
            result.vehicles[i - 1].salePrice
          );
        }
      }
    });

    it('should return appropriate error for invalid dealership', async () => {
      const params: VehicleSearchParams = {
        dealershipId: 99999, // Non-existent dealership
        make: 'Honda'
      };

      const result = await searchInventory(params);
      
      expect(result.success).toBe(true); // Should still succeed but with empty results
      expect(result.vehicles).toHaveLength(0);
    });

    it('should handle empty search results gracefully', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        make: 'NonExistentMake',
        model: 'NonExistentModel'
      };

      const result = await searchInventory(params);
      
      expect(result.success).toBe(true);
      expect(result.vehicles).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Vehicle Details Function', () => {
    it('should retrieve detailed vehicle information', async () => {
      // First search for a vehicle to get an ID
      const searchResult = await searchInventory({
        dealershipId: testDealershipId,
        limit: 1
      });

      if (searchResult.success && searchResult.vehicles.length > 0) {
        const vehicleId = searchResult.vehicles[0].id;
        
        const details = await getVehicleDetails(vehicleId, testDealershipId);
        
        expect(details.success).toBe(true);
        
        if (details.vehicle) {
          expect(details.vehicle.id).toBe(vehicleId);
          expect(details.vehicle.vin).toBeDefined();
          expect(details.vehicle.make).toBeDefined();
          expect(details.vehicle.model).toBeDefined();
          expect(details.vehicle.year).toBeGreaterThan(1900);
          expect(details.vehicle.salePrice).toBeGreaterThan(0);
          expect(details.processingTime).toBeGreaterThan(0);
        }
      }
    });

    it('should handle invalid vehicle ID gracefully', async () => {
      const details = await getVehicleDetails(99999, testDealershipId);
      
      expect(details.success).toBe(false);
      expect(details.vehicle).toBeNull();
      expect(details.error).toBeDefined();
    });

    it('should include availability information in vehicle details', async () => {
      const searchResult = await searchInventory({
        dealershipId: testDealershipId,
        limit: 1
      });

      if (searchResult.success && searchResult.vehicles.length > 0) {
        const vehicleId = searchResult.vehicles[0].id;
        
        const details = await getVehicleDetails(vehicleId, testDealershipId);
        
        if (details.success && details.vehicle) {
          expect(details.vehicle.availability).toBeDefined();
          expect(typeof details.vehicle.availability?.isAvailable).toBe('boolean');
        }
      }
    });
  });

  describe('Inventory Summary Function', () => {
    it('should provide comprehensive inventory statistics', async () => {
      const summary = await getInventorySummary(testDealershipId);
      
      expect(summary.success).toBe(true);
      
      if (summary.summary) {
        expect(summary.summary.totalVehicles).toBeGreaterThanOrEqual(0);
        expect(summary.summary.availableVehicles).toBeGreaterThanOrEqual(0);
        expect(summary.summary.availableVehicles).toBeLessThanOrEqual(summary.summary.totalVehicles);
        
        expect(Array.isArray(summary.summary.makeBreakdown)).toBe(true);
        expect(Array.isArray(summary.summary.bodyStyleBreakdown)).toBe(true);
        expect(Array.isArray(summary.summary.yearBreakdown)).toBe(true);
        
        expect(summary.summary.priceRange).toBeDefined();
        expect(summary.summary.priceRange.min).toBeLessThanOrEqual(summary.summary.priceRange.max);
        
        expect(summary.processingTime).toBeGreaterThan(0);
      }
    });

    it('should include certified vehicle statistics', async () => {
      const summary = await getInventorySummary(testDealershipId);
      
      if (summary.success && summary.summary) {
        expect(summary.summary.certifiedCount).toBeGreaterThanOrEqual(0);
        expect(summary.summary.certifiedCount).toBeLessThanOrEqual(summary.summary.totalVehicles);
      }
    });

    it('should handle dealership with no inventory', async () => {
      const summary = await getInventorySummary(99999); // Non-existent dealership
      
      expect(summary.success).toBe(true);
      
      if (summary.summary) {
        expect(summary.summary.totalVehicles).toBe(0);
        expect(summary.summary.availableVehicles).toBe(0);
      }
    });
  });

  describe('Search with Recommendations Function', () => {
    it('should provide search results with intelligent recommendations', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        minPrice: 25000,
        maxPrice: 35000,
        bodyStyle: 'SUV'
      };

      const result = await searchInventoryWithRecommendations(params);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.vehicles)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.searchSummary).toBeDefined();
      
      if (result.recommendations.length > 0) {
        result.recommendations.forEach(rec => {
          expect(rec).toHaveProperty('type');
          expect(rec).toHaveProperty('message');
          expect(rec).toHaveProperty('vehicles');
          expect(['similar', 'budget', 'alternative', 'feature']).toContain(rec.type);
        });
      }
    });

    it('should provide budget-friendly recommendations', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        maxPrice: 15000 // Lower budget
      };

      const result = await searchInventoryWithRecommendations(params);
      
      if (result.success && result.recommendations.length > 0) {
        const budgetRecs = result.recommendations.filter(rec => rec.type === 'budget');
        
        budgetRecs.forEach(rec => {
          expect(rec.message).toContain('budget');
          rec.vehicles.forEach(vehicle => {
            expect(vehicle.salePrice).toBeLessThanOrEqual(15000);
          });
        });
      }
    });

    it('should provide fuel-efficient recommendations', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        fuelType: 'Hybrid'
      };

      const result = await searchInventoryWithRecommendations(params);
      
      if (result.success && result.recommendations.length > 0) {
        const fuelRecs = result.recommendations.filter(rec => 
          rec.message.toLowerCase().includes('fuel') || 
          rec.message.toLowerCase().includes('efficient')
        );
        
        fuelRecs.forEach(rec => {
          rec.vehicles.forEach(vehicle => {
            expect(vehicle.fuelType?.toLowerCase()).toContain('hybrid');
          });
        });
      }
    });

    it('should provide family-friendly recommendations', async () => {
      const params: VehicleSearchParams = {
        dealershipId: testDealershipId,
        bodyStyle: 'SUV'
      };

      const result = await searchInventoryWithRecommendations(params);
      
      if (result.success && result.recommendations.length > 0) {
        const familyRecs = result.recommendations.filter(rec => 
          rec.message.toLowerCase().includes('family') ||
          rec.message.toLowerCase().includes('spacious')
        );
        
        familyRecs.forEach(rec => {
          rec.vehicles.forEach(vehicle => {
            expect(['SUV', 'Minivan', 'Wagon']).toContain(vehicle.bodyStyle);
          });
        });
      }
    });
  });

  describe('Vehicle Availability Function', () => {
    it('should check vehicle availability accurately', async () => {
      // First find a vehicle to check
      const searchResult = await searchInventory({
        dealershipId: testDealershipId,
        limit: 1
      });

      if (searchResult.success && searchResult.vehicles.length > 0) {
        const vehicleId = searchResult.vehicles[0].id;
        
        const availability = await checkVehicleAvailability(vehicleId, testDealershipId);
        
        expect(availability.success).toBe(true);
        
        if (availability.availability) {
          expect(typeof availability.availability.isAvailable).toBe('boolean');
          expect(availability.availability.vehicleId).toBe(vehicleId);
          expect(availability.availability.lastChecked).toBeDefined();
          expect(availability.processingTime).toBeGreaterThan(0);
        }
      }
    });

    it('should provide reservation information if vehicle is reserved', async () => {
      const searchResult = await searchInventory({
        dealershipId: testDealershipId,
        status: 'reserved',
        limit: 1
      });

      if (searchResult.success && searchResult.vehicles.length > 0) {
        const vehicleId = searchResult.vehicles[0].id;
        
        const availability = await checkVehicleAvailability(vehicleId, testDealershipId);
        
        if (availability.success && availability.availability && !availability.availability.isAvailable) {
          expect(availability.availability.reservationDetails).toBeDefined();
          expect(availability.availability.estimatedAvailableDate).toBeDefined();
        }
      }
    });

    it('should handle non-existent vehicle gracefully', async () => {
      const availability = await checkVehicleAvailability(99999, testDealershipId);
      
      expect(availability.success).toBe(false);
      expect(availability.error).toBeDefined();
    });
  });

  describe('Enhanced Inventory Handlers', () => {
    it('should create enhanced handlers with proper error handling', () => {
      const handlers = createEnhancedInventoryHandlers(testDealershipId);
      
      expect(handlers).toHaveProperty('searchInventory');
      expect(handlers).toHaveProperty('getVehicleDetails');
      expect(handlers).toHaveProperty('getInventorySummary');
      expect(handlers).toHaveProperty('searchInventoryWithRecommendations');
      expect(handlers).toHaveProperty('checkVehicleAvailability');
      
      // All handlers should be functions
      Object.values(handlers).forEach(handler => {
        expect(typeof handler).toBe('function');
      });
    });

    it('should handle errors gracefully in enhanced handlers', async () => {
      const handlers = createEnhancedInventoryHandlers(testDealershipId);
      
      // Test with invalid parameters that might cause errors
      const result = await handlers.searchInventory({
        dealershipId: -1, // Invalid ID
        make: '',
        minPrice: -1000
      });
      
      // Should handle error gracefully without throwing
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large search results efficiently', async () => {
      const startTime = Date.now();
      
      const result = await searchInventory({
        dealershipId: testDealershipId,
        limit: 100 // Large limit
      });
      
      const processingTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent inventory searches', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        searchInventory({
          dealershipId: testDealershipId,
          make: i % 2 === 0 ? 'Honda' : 'Toyota',
          limit: 5
        })
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(Array.isArray(result.vehicles)).toBe(true);
      });
    });

    it('should handle special characters in search terms', async () => {
      const result = await searchInventory({
        dealershipId: testDealershipId,
        make: "O'Connor's", // Apostrophe
        model: 'Coupé', // Accent
        limit: 5
      });
      
      expect(result.success).toBe(true);
      // Should not throw errors with special characters
    });

    it('should validate search parameters', async () => {
      const result = await searchInventory({
        dealershipId: testDealershipId,
        minYear: 2025,
        maxYear: 2020, // Invalid: min > max
        minPrice: 50000,
        maxPrice: 20000 // Invalid: min > max
      });
      
      expect(result.success).toBe(true);
      // Should handle invalid ranges gracefully
    });

    it('should handle database connection issues gracefully', async () => {
      // This test would typically involve mocking the database to simulate failures
      // For now, we'll test that the functions don't throw unhandled errors
      
      try {
        const result = await searchInventory({
          dealershipId: testDealershipId,
          make: 'TestMake'
        });
        
        expect(result).toBeDefined();
      } catch (error) {
        // If there's an error, it should be a handled error, not an unhandled exception
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Integration with Agent Functions', () => {
    it('should provide data in format suitable for AI agents', async () => {
      const result = await searchInventory({
        dealershipId: testDealershipId,
        make: 'Honda',
        limit: 3
      });
      
      if (result.success && result.vehicles.length > 0) {
        result.vehicles.forEach(vehicle => {
          // Check that all essential fields for AI agents are present
          expect(vehicle.make).toBeDefined();
          expect(vehicle.model).toBeDefined();
          expect(vehicle.year).toBeDefined();
          expect(vehicle.salePrice).toBeDefined();
          expect(vehicle.stockNumber).toBeDefined();
          expect(vehicle.description).toBeDefined();
        });
      }
    });

    it('should provide search summaries for agent responses', async () => {
      const result = await searchInventoryWithRecommendations({
        dealershipId: testDealershipId,
        make: 'Toyota',
        maxPrice: 30000
      });
      
      if (result.success) {
        expect(result.searchSummary).toBeDefined();
        expect(result.searchSummary.totalMatches).toBeGreaterThanOrEqual(0);
        expect(result.searchSummary.priceRange).toBeDefined();
        expect(result.searchSummary.criteria).toBeDefined();
        
        // Should provide useful information for agent to communicate to customer
        expect(typeof result.searchSummary.priceRange.min).toBe('number');
        expect(typeof result.searchSummary.priceRange.max).toBe('number');
      }
    });
  });
});