import { describe, expect, it } from 'vitest';
import { schemaVersions, v1Schema, v2Schema, SchemaVersions } from '../db/schema-versions';

describe('Schema Versioning Framework', () => {
  it('should export schema versions object with v1 and v2 properties', () => {
    expect(schemaVersions).toBeDefined();
    expect(typeof schemaVersions).toBe('object');
    expect(schemaVersions.v1).toBeDefined();
    expect(schemaVersions.v2).toBeDefined();
    expect(typeof schemaVersions.v1).toBe('object');
    expect(typeof schemaVersions.v2).toBe('object');
  });

  it('should export individual v1 and v2 schemas for direct imports', () => {
    expect(v1Schema).toBeDefined();
    expect(v2Schema).toBeDefined();
    expect(v1Schema).toBe(schemaVersions.v1);
    expect(v2Schema).toBe(schemaVersions.v2);
  });

  it('should have v1 and v2 vehicles tables that are distinct', () => {
    expect(schemaVersions.v1.vehicles).toBeDefined();
    expect(schemaVersions.v2.vehicles).toBeDefined();
    expect(schemaVersions.v1.vehicles).not.toBe(schemaVersions.v2.vehicles);
    
    // Check that they have different names or configurations
    expect(schemaVersions.v1.vehicles._.name).toBe('vehicles');
    expect(schemaVersions.v2.vehicles._.name).toBe('vehicles');
    
    // They should be different objects even with the same table name
    expect(schemaVersions.v1.vehicles).not.toEqual(schemaVersions.v2.vehicles);
  });

  it('should have v2.vehicles with additional fields that v1.vehicles does not have', () => {
    const v1VehicleColumns = Object.keys(schemaVersions.v1.vehicles._.columns);
    const v2VehicleColumns = Object.keys(schemaVersions.v2.vehicles._.columns);
    
    // V2 should have more columns than V1
    expect(v2VehicleColumns.length).toBeGreaterThan(v1VehicleColumns.length);
    
    // Check for specific enhanced fields in V2
    const enhancedFields = [
      'operationMode',
      'aiConfig',
      'leadScore',
      'lifecycleStage',
      'lastInteractionAt',
      'viewCount',
      'inquiryCount',
      'testDriveCount',
      'recommendationScore',
      'customAttributes'
    ];
    
    enhancedFields.forEach(field => {
      expect(v2VehicleColumns).toContain(field);
      expect(v1VehicleColumns).not.toContain(field);
    });
  });

  it('should have v2.dealerships with enhanced fields that v1.dealerships does not have', () => {
    const v1DealershipColumns = Object.keys(schemaVersions.v1.dealerships._.columns);
    const v2DealershipColumns = Object.keys(schemaVersions.v2.dealerships._.columns);
    
    // Check for specific enhanced fields in V2 dealerships
    const enhancedFields = [
      'operationMode',
      'aiConfig',
      'agentConfig',
      'leadRouting'
    ];
    
    enhancedFields.forEach(field => {
      expect(v2DealershipColumns).toContain(field);
      expect(v1DealershipColumns).not.toContain(field);
    });
  });

  it('should have different indexes for v1 and v2 vehicles tables', () => {
    const v1Indexes = Object.keys(schemaVersions.v1.vehicles._.indexes);
    const v2Indexes = Object.keys(schemaVersions.v2.vehicles._.indexes);
    
    // V2 should have additional indexes
    expect(v2Indexes.length).toBeGreaterThan(v1Indexes.length);
    
    // Check for specific v2-only indexes
    expect(v2Indexes).toContain('lifecycleIdx');
    expect(v2Indexes).toContain('operationModeIdx');
    expect(v1Indexes).not.toContain('lifecycleIdx');
    expect(v1Indexes).not.toContain('operationModeIdx');
  });

  it('should contain all required table definitions in both versions', () => {
    const requiredTables = ['users', 'conversations', 'dealerships', 'vehicles'];
    
    requiredTables.forEach(table => {
      expect(schemaVersions.v1).toHaveProperty(table);
      expect(schemaVersions.v2).toHaveProperty(table);
    });
  });

  it('should maintain shared tables as references to the same object', () => {
    // Users and conversations should be the same reference in both versions
    expect(schemaVersions.v1.users).toBe(schemaVersions.v2.users);
    expect(schemaVersions.v1.conversations).toBe(schemaVersions.v2.conversations);
  });

  it('should have the correct TypeScript type definition', () => {
    // This is a type test that will be checked at compile time
    const testType: SchemaVersions = {
      v1: {
        users: schemaVersions.v1.users,
        conversations: schemaVersions.v1.conversations,
        dealerships: schemaVersions.v1.dealerships,
        vehicles: schemaVersions.v1.vehicles
      },
      v2: {
        users: schemaVersions.v2.users,
        conversations: schemaVersions.v2.conversations,
        dealerships: schemaVersions.v2.dealerships,
        vehicles: schemaVersions.v2.vehicles
      }
    };
    
    // Runtime check that our test type matches the actual schema
    expect(Object.keys(testType.v1)).toEqual(Object.keys(schemaVersions.v1));
    expect(Object.keys(testType.v2)).toEqual(Object.keys(schemaVersions.v2));
  });
});
