/**
 * Comprehensive Inventory Management Testing Suite
 * Tests all inventory-related functionality including UI, API, and import features
 * Dependencies: Database Health (#7), Frontend Component Rendering (#10)
 */

import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  timestamp: string;
  errorDetails?: any;
}

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
}

interface Vehicle {
  id?: string;
  dealershipId?: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  mileage: number;
  price: number;
  condition: 'new' | 'used' | 'certified';
  exteriorColor?: string;
  interiorColor?: string;
  transmission?: string;
  engineType?: string;
  fuelType?: string;
  drivetrain?: string;
  description?: string;
  features?: string[];
  status?: 'available' | 'sold' | 'pending';
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

class InventoryTestSuite {
  private baseUrl: string;
  private results: TestResult[] = [];
  private createdVehicleIds: string[] = [];
  private authHeaders: any = {};

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  private log(message: string, level: 'INFO' | 'ERROR' | 'SUCCESS' = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'ERROR' ? '❌' : level === 'SUCCESS' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  private addResult(testName: string, status: 'PASS' | 'FAIL' | 'WARNING', details: string, errorDetails?: any) {
    this.results.push({
      testName,
      status,
      details,
      timestamp: new Date().toISOString(),
      errorDetails
    });

    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    this.log(`${emoji} ${testName}: ${details}`, status === 'FAIL' ? 'ERROR' : 'SUCCESS');
  }

  private async makeRequest(method: string, endpoint: string, data?: any, headers?: any): Promise<AxiosResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method,
      url,
      data,
      headers: { ...this.authHeaders, ...headers },
      validateStatus: () => true // Don't throw on error status codes
    };

    return axios(config);
  }

  private generateTestVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
    const baseVin = '1HGBH41JXMN10958';
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return {
      vin: `${baseVin.slice(0, -3)}${randomSuffix}`,
      make: 'Honda',
      model: 'Civic',
      year: 2022,
      trim: 'EX',
      mileage: 25000,
      price: 22500,
      condition: 'used',
      exteriorColor: 'Blue',
      interiorColor: 'Black',
      transmission: 'CVT',
      engineType: '2.0L I4',
      fuelType: 'Gasoline',
      drivetrain: 'FWD',
      description: 'Well-maintained vehicle with full service history',
      features: ['Bluetooth', 'Backup Camera', 'Apple CarPlay'],
      status: 'available',
      isActive: true,
      ...overrides
    };
  }

  private generateMalformedTsv(): string {
    return `vin	make	model	year	mileage	price	condition
INVALID_VIN	Toyota	Camry	2020	30000	25000	used
1HGBH41JXMN109582	Honda	Civic	INVALID_YEAR	40000	20000	used
1HGBH41JXMN109583	Ford	F-150	2021	-1000	30000	new
1HGBH41JXMN109584	Chevrolet	Silverado	2022	50000	-5000	used`;
  }

  private generateValidTsv(): string {
    return `vin	make	model	year	trim	mileage	price	condition	exteriorColor	description
1HGBH41JXMN109585	Toyota	Camry	2021	LE	15000	24000	used	Silver	Excellent condition sedan
1HGBH41JXMN109586	Honda	Accord	2022	Sport	8000	26500	used	Black	Low mileage sports sedan
1HGBH41JXMN109587	Ford	F-150	2023	XLT	5000	35000	new	White	Brand new pickup truck
1HGBH41JXMN109588	Chevrolet	Malibu	2020	LT	45000	18500	used	Red	Reliable family car`;
  }

  // Test 1: UI Component Validation
  async testInventoryUIComponents(): Promise<void> {
    try {
      this.log('Testing inventory UI components...');

      // Test main inventory page exists
      const inventoryPageResponse = await this.makeRequest('GET', '/');
      if (inventoryPageResponse.status === 200) {
        this.addResult(
          'Inventory Page Access',
          'PASS',
          'Main inventory page accessible'
        );
      } else {
        this.addResult(
          'Inventory Page Access',
          'FAIL',
          `Failed to access inventory page: ${inventoryPageResponse.status}`
        );
      }

      // Test if inventory components exist by checking static files
      const componentsToCheck = [
        '/client/src/pages/inventory.tsx',
        '/client/src/components/inventory/VehicleCard.tsx',
        '/client/src/components/inventory/VehicleList.tsx'
      ];

      for (const componentPath of componentsToCheck) {
        const fullPath = path.join(process.cwd(), componentPath);
        if (fs.existsSync(fullPath)) {
          this.addResult(
            `Component Exists: ${path.basename(componentPath)}`,
            'PASS',
            `Component file found at ${componentPath}`
          );
        } else {
          this.addResult(
            `Component Missing: ${path.basename(componentPath)}`,
            'FAIL',
            `Component file not found at ${componentPath}`
          );
        }
      }

    } catch (error) {
      this.addResult(
        'UI Components Test',
        'FAIL',
        'Failed to test UI components',
        error
      );
    }
  }

  // Test 2: Search and Filter Functionality
  async testSearchAndFilterFunctionality(): Promise<void> {
    try {
      this.log('Testing search and filter functionality...');

      // Create test vehicle first
      const testVehicle = this.generateTestVehicle({
        make: 'SearchTest',
        model: 'FilterModel',
        year: 2023,
        price: 25000
      });

      const createResponse = await this.makeRequest('POST', '/api/vehicles', testVehicle);
      if (createResponse.status === 201) {
        const createdVehicle = createResponse.data;
        this.createdVehicleIds.push(createdVehicle.id);

        // Test search by make
        const searchByMake = await this.makeRequest('GET', '/api/vehicles?make=SearchTest');
        if (searchByMake.status === 200 && searchByMake.data.vehicles?.length > 0) {
          this.addResult(
            'Search by Make',
            'PASS',
            `Found ${searchByMake.data.vehicles.length} vehicles with make 'SearchTest'`
          );
        } else {
          this.addResult(
            'Search by Make',
            'FAIL',
            'Failed to search vehicles by make'
          );
        }

        // Test filter by year
        const filterByYear = await this.makeRequest('GET', '/api/vehicles?year=2023');
        if (filterByYear.status === 200) {
          this.addResult(
            'Filter by Year',
            'PASS',
            `Found ${filterByYear.data.vehicles?.length || 0} vehicles for year 2023`
          );
        } else {
          this.addResult(
            'Filter by Year',
            'FAIL',
            'Failed to filter vehicles by year'
          );
        }

        // Test price range filter
        const priceFilter = await this.makeRequest('GET', '/api/vehicles?minPrice=20000&maxPrice=30000');
        if (priceFilter.status === 200) {
          this.addResult(
            'Price Range Filter',
            'PASS',
            `Found ${priceFilter.data.vehicles?.length || 0} vehicles in price range $20,000-$30,000`
          );
        } else {
          this.addResult(
            'Price Range Filter',
            'FAIL',
            'Failed to filter vehicles by price range'
          );
        }

        // Test condition filter
        const conditionFilter = await this.makeRequest('GET', '/api/vehicles?condition=used');
        if (conditionFilter.status === 200) {
          this.addResult(
            'Condition Filter',
            'PASS',
            `Found ${conditionFilter.data.vehicles?.length || 0} used vehicles`
          );
        } else {
          this.addResult(
            'Condition Filter',
            'FAIL',
            'Failed to filter vehicles by condition'
          );
        }

        // Test text search
        const textSearch = await this.makeRequest('GET', '/api/vehicles?search=FilterModel');
        if (textSearch.status === 200) {
          this.addResult(
            'Text Search',
            'PASS',
            `Text search returned ${textSearch.data.vehicles?.length || 0} results`
          );
        } else {
          this.addResult(
            'Text Search',
            'FAIL',
            'Failed to perform text search'
          );
        }

      } else {
        this.addResult(
          'Search Filter Setup',
          'FAIL',
          'Failed to create test vehicle for search/filter testing'
        );
      }

    } catch (error) {
      this.addResult(
        'Search and Filter Test',
        'FAIL',
        'Failed to test search and filter functionality',
        error
      );
    }
  }

  // Test 3: Vehicle Details Page
  async testVehicleDetailsPage(): Promise<void> {
    try {
      this.log('Testing vehicle details page...');

      // Create test vehicle with comprehensive data
      const testVehicle = this.generateTestVehicle({
        description: 'Comprehensive test vehicle with all details',
        features: ['GPS', 'Heated Seats', 'Sunroof', 'Premium Audio']
      });

      const createResponse = await this.makeRequest('POST', '/api/vehicles', testVehicle);
      if (createResponse.status === 201) {
        const createdVehicle = createResponse.data;
        this.createdVehicleIds.push(createdVehicle.id);

        // Test getting vehicle details
        const detailsResponse = await this.makeRequest('GET', `/api/vehicles/${createdVehicle.id}`);
        if (detailsResponse.status === 200) {
          const vehicleDetails = detailsResponse.data;
          
          // Verify all required fields are present
          const requiredFields = ['vin', 'make', 'model', 'year', 'price', 'mileage', 'condition'];
          const missingFields = requiredFields.filter(field => !vehicleDetails[field]);
          
          if (missingFields.length === 0) {
            this.addResult(
              'Vehicle Details Complete',
              'PASS',
              'All required vehicle details are present'
            );
          } else {
            this.addResult(
              'Vehicle Details Complete',
              'FAIL',
              `Missing required fields: ${missingFields.join(', ')}`
            );
          }

          // Verify features array
          if (Array.isArray(vehicleDetails.features) && vehicleDetails.features.length > 0) {
            this.addResult(
              'Vehicle Features Display',
              'PASS',
              `Vehicle features loaded: ${vehicleDetails.features.join(', ')}`
            );
          } else {
            this.addResult(
              'Vehicle Features Display',
              'WARNING',
              'Vehicle features not properly loaded'
            );
          }

          // Test images array (even if empty)
          if (Array.isArray(vehicleDetails.images)) {
            this.addResult(
              'Vehicle Images Structure',
              'PASS',
              `Images array present with ${vehicleDetails.images.length} images`
            );
          } else {
            this.addResult(
              'Vehicle Images Structure',
              'FAIL',
              'Images array not properly structured'
            );
          }

        } else {
          this.addResult(
            'Vehicle Details Access',
            'FAIL',
            `Failed to access vehicle details: ${detailsResponse.status}`
          );
        }

        // Test non-existent vehicle
        const nonExistentResponse = await this.makeRequest('GET', '/api/vehicles/non-existent-id');
        if (nonExistentResponse.status === 404) {
          this.addResult(
            'Non-existent Vehicle Handling',
            'PASS',
            'Properly returns 404 for non-existent vehicle'
          );
        } else {
          this.addResult(
            'Non-existent Vehicle Handling',
            'FAIL',
            `Expected 404, got ${nonExistentResponse.status}`
          );
        }

      } else {
        this.addResult(
          'Vehicle Details Setup',
          'FAIL',
          'Failed to create test vehicle for details testing'
        );
      }

    } catch (error) {
      this.addResult(
        'Vehicle Details Test',
        'FAIL',
        'Failed to test vehicle details page',
        error
      );
    }
  }

  // Test 4: CRUD API Operations
  async testCRUDOperations(): Promise<void> {
    try {
      this.log('Testing CRUD API operations...');

      // CREATE Test
      const newVehicle = this.generateTestVehicle();
      const createResponse = await this.makeRequest('POST', '/api/vehicles', newVehicle);
      
      if (createResponse.status === 201) {
        const createdVehicle = createResponse.data;
        this.createdVehicleIds.push(createdVehicle.id);
        this.addResult(
          'CREATE Vehicle',
          'PASS',
          `Vehicle created successfully with ID: ${createdVehicle.id}`
        );

        // READ Test
        const readResponse = await this.makeRequest('GET', `/api/vehicles/${createdVehicle.id}`);
        if (readResponse.status === 200) {
          this.addResult(
            'READ Vehicle',
            'PASS',
            'Vehicle retrieved successfully'
          );
        } else {
          this.addResult(
            'READ Vehicle',
            'FAIL',
            `Failed to read vehicle: ${readResponse.status}`
          );
        }

        // UPDATE Test
        const updateData = { price: 24000, mileage: 26000 };
        const updateResponse = await this.makeRequest('PUT', `/api/vehicles/${createdVehicle.id}`, updateData);
        if (updateResponse.status === 200) {
          const updatedVehicle = updateResponse.data;
          if (updatedVehicle.price === 24000 && updatedVehicle.mileage === 26000) {
            this.addResult(
              'UPDATE Vehicle',
              'PASS',
              'Vehicle updated successfully with correct values'
            );
          } else {
            this.addResult(
              'UPDATE Vehicle',
              'FAIL',
              'Vehicle updated but values are incorrect'
            );
          }
        } else {
          this.addResult(
            'UPDATE Vehicle',
            'FAIL',
            `Failed to update vehicle: ${updateResponse.status}`
          );
        }

        // DELETE Test
        const deleteResponse = await this.makeRequest('DELETE', `/api/vehicles/${createdVehicle.id}`);
        if (deleteResponse.status === 200) {
          this.addResult(
            'DELETE Vehicle',
            'PASS',
            'Vehicle deleted successfully'
          );

          // Verify deletion
          const verifyDeleteResponse = await this.makeRequest('GET', `/api/vehicles/${createdVehicle.id}`);
          if (verifyDeleteResponse.status === 404) {
            this.addResult(
              'DELETE Verification',
              'PASS',
              'Vehicle properly removed from database'
            );
            // Remove from cleanup list since it's already deleted
            this.createdVehicleIds = this.createdVehicleIds.filter(id => id !== createdVehicle.id);
          } else {
            this.addResult(
              'DELETE Verification',
              'FAIL',
              'Vehicle still exists after deletion'
            );
          }
        } else {
          this.addResult(
            'DELETE Vehicle',
            'FAIL',
            `Failed to delete vehicle: ${deleteResponse.status}`
          );
        }

      } else {
        this.addResult(
          'CREATE Vehicle',
          'FAIL',
          `Failed to create vehicle: ${createResponse.status}`,
          createResponse.data
        );
      }

    } catch (error) {
      this.addResult(
        'CRUD Operations Test',
        'FAIL',
        'Failed to test CRUD operations',
        error
      );
    }
  }

  // Test 5: Request/Response Format Validation
  async testRequestResponseFormats(): Promise<void> {
    try {
      this.log('Testing request/response formats...');

      // Test invalid data scenarios
      const invalidVehicleData = [
        { vin: 'SHORT', make: 'Test', model: 'Test', year: 2023, mileage: 0, price: 25000, condition: 'used' },
        { vin: '1HGBH41JXMN109999', make: '', model: 'Test', year: 2023, mileage: 0, price: 25000, condition: 'used' },
        { vin: '1HGBH41JXMN109998', make: 'Test', model: 'Test', year: 1800, mileage: 0, price: 25000, condition: 'used' },
        { vin: '1HGBH41JXMN109997', make: 'Test', model: 'Test', year: 2023, mileage: -100, price: 25000, condition: 'used' },
        { vin: '1HGBH41JXMN109996', make: 'Test', model: 'Test', year: 2023, mileage: 0, price: -1000, condition: 'used' }
      ];

      for (const [index, invalidData] of invalidVehicleData.entries()) {
        const response = await this.makeRequest('POST', '/api/vehicles', invalidData);
        if (response.status === 400) {
          this.addResult(
            `Invalid Data Rejection ${index + 1}`,
            'PASS',
            'API properly rejects invalid vehicle data'
          );
        } else {
          this.addResult(
            `Invalid Data Rejection ${index + 1}`,
            'FAIL',
            `API should reject invalid data but returned ${response.status}`
          );
        }
      }

      // Test response format
      const validVehicle = this.generateTestVehicle();
      const createResponse = await this.makeRequest('POST', '/api/vehicles', validVehicle);
      
      if (createResponse.status === 201) {
        const vehicle = createResponse.data;
        this.createdVehicleIds.push(vehicle.id);

        // Verify response structure
        const expectedFields = ['id', 'vin', 'make', 'model', 'year', 'price', 'mileage', 'condition', 'createdAt'];
        const presentFields = expectedFields.filter(field => vehicle[field] !== undefined);
        
        if (presentFields.length === expectedFields.length) {
          this.addResult(
            'Response Format Validation',
            'PASS',
            'API response contains all expected fields'
          );
        } else {
          const missingFields = expectedFields.filter(field => vehicle[field] === undefined);
          this.addResult(
            'Response Format Validation',
            'FAIL',
            `Missing fields in response: ${missingFields.join(', ')}`
          );
        }

        // Test pagination format
        const listResponse = await this.makeRequest('GET', '/api/vehicles');
        if (listResponse.status === 200 && listResponse.data.pagination) {
          const pagination = listResponse.data.pagination;
          const paginationFields = ['page', 'limit', 'total', 'totalPages'];
          const paginationValid = paginationFields.every(field => pagination[field] !== undefined);
          
          if (paginationValid) {
            this.addResult(
              'Pagination Format',
              'PASS',
              'Pagination structure is correct'
            );
          } else {
            this.addResult(
              'Pagination Format',
              'FAIL',
              'Pagination structure is incomplete'
            );
          }
        } else {
          this.addResult(
            'Pagination Format',
            'FAIL',
            'Pagination not present in list response'
          );
        }
      }

    } catch (error) {
      this.addResult(
        'Request/Response Format Test',
        'FAIL',
        'Failed to test request/response formats',
        error
      );
    }
  }

  // Test 6: Import Functionality
  async testImportFunctionality(): Promise<void> {
    try {
      this.log('Testing import functionality...');

      // Test valid TSV import
      const validTsv = this.generateValidTsv();
      const validFormData = new FormData();
      validFormData.append('file', Buffer.from(validTsv), {
        filename: 'valid_inventory.tsv',
        contentType: 'text/tab-separated-values'
      });

      const validImportResponse = await this.makeRequest(
        'POST',
        '/api/vehicles/import',
        validFormData,
        validFormData.getHeaders()
      );

      if (validImportResponse.status === 200) {
        const importStats = validImportResponse.data.stats;
        this.addResult(
          'Valid TSV Import',
          'PASS',
          `Import successful: ${importStats.added} added, ${importStats.updated} updated, ${importStats.errors} errors`
        );
      } else {
        this.addResult(
          'Valid TSV Import',
          'FAIL',
          `Import failed with status: ${validImportResponse.status}`,
          validImportResponse.data
        );
      }

      // Test malformed TSV import
      const malformedTsv = this.generateMalformedTsv();
      const malformedFormData = new FormData();
      malformedFormData.append('file', Buffer.from(malformedTsv), {
        filename: 'malformed_inventory.tsv',
        contentType: 'text/tab-separated-values'
      });

      const malformedImportResponse = await this.makeRequest(
        'POST',
        '/api/vehicles/import',
        malformedFormData,
        malformedFormData.getHeaders()
      );

      if (malformedImportResponse.status === 200) {
        const importStats = malformedImportResponse.data.stats;
        if (importStats.errors > 0) {
          this.addResult(
            'Malformed TSV Handling',
            'PASS',
            `Import properly handled malformed data: ${importStats.errors} errors detected`
          );
        } else {
          this.addResult(
            'Malformed TSV Handling',
            'WARNING',
            'Import did not detect errors in malformed data'
          );
        }
      } else {
        this.addResult(
          'Malformed TSV Handling',
          'FAIL',
          `Malformed import failed with status: ${malformedImportResponse.status}`
        );
      }

      // Test no file upload
      const noFileResponse = await this.makeRequest('POST', '/api/vehicles/import');
      if (noFileResponse.status === 400) {
        this.addResult(
          'No File Upload Handling',
          'PASS',
          'API properly rejects request without file'
        );
      } else {
        this.addResult(
          'No File Upload Handling',
          'FAIL',
          `Expected 400 for no file, got ${noFileResponse.status}`
        );
      }

    } catch (error) {
      this.addResult(
        'Import Functionality Test',
        'FAIL',
        'Failed to test import functionality',
        error
      );
    }
  }

  // Test 7: Edge Cases
  async testEdgeCases(): Promise<void> {
    try {
      this.log('Testing edge cases...');

      // Test duplicate VIN
      const vehicle1 = this.generateTestVehicle({ vin: '1HGBH41JXMN109001' });
      const vehicle2 = this.generateTestVehicle({ vin: '1HGBH41JXMN109001' });

      const create1Response = await this.makeRequest('POST', '/api/vehicles', vehicle1);
      if (create1Response.status === 201) {
        this.createdVehicleIds.push(create1Response.data.id);

        const create2Response = await this.makeRequest('POST', '/api/vehicles', vehicle2);
        if (create2Response.status === 400) {
          this.addResult(
            'Duplicate VIN Prevention',
            'PASS',
            'API properly prevents duplicate VIN creation'
          );
        } else {
          this.addResult(
            'Duplicate VIN Prevention',
            'FAIL',
            'API allowed duplicate VIN creation'
          );
        }
      }

      // Test maximum field lengths
      const maxFieldVehicle = this.generateTestVehicle({
        description: 'A'.repeat(1000), // Very long description
        features: Array(50).fill('Feature') // Many features
      });

      const maxFieldResponse = await this.makeRequest('POST', '/api/vehicles', maxFieldVehicle);
      if (maxFieldResponse.status === 201) {
        this.createdVehicleIds.push(maxFieldResponse.data.id);
        this.addResult(
          'Maximum Field Length Handling',
          'PASS',
          'API handles maximum field lengths correctly'
        );
      } else {
        this.addResult(
          'Maximum Field Length Handling',
          'WARNING',
          'API may have field length restrictions'
        );
      }

      // Test empty inventory search
      const emptySearchResponse = await this.makeRequest('GET', '/api/vehicles?make=NonExistentMake');
      if (emptySearchResponse.status === 200 && emptySearchResponse.data.vehicles.length === 0) {
        this.addResult(
          'Empty Search Results',
          'PASS',
          'API properly handles searches with no results'
        );
      } else {
        this.addResult(
          'Empty Search Results',
          'FAIL',
          'API does not properly handle empty search results'
        );
      }

      // Test very large result sets (pagination)
      const largeResultResponse = await this.makeRequest('GET', '/api/vehicles?limit=1000');
      if (largeResultResponse.status === 200) {
        this.addResult(
          'Large Result Set Handling',
          'PASS',
          `API handles large result requests: ${largeResultResponse.data.vehicles?.length || 0} results`
        );
      } else {
        this.addResult(
          'Large Result Set Handling',
          'FAIL',
          'API fails with large result set requests'
        );
      }

    } catch (error) {
      this.addResult(
        'Edge Cases Test',
        'FAIL',
        'Failed to test edge cases',
        error
      );
    }
  }

  // Test 8: Multi-dealership Context
  async testMultiDealershipContext(): Promise<void> {
    try {
      this.log('Testing multi-dealership context and data isolation...');

      // This test would require proper authentication setup
      // For now, we'll test that the API requires authentication
      const noAuthResponse = await this.makeRequest('GET', '/api/vehicles');
      
      if (noAuthResponse.status === 401) {
        this.addResult(
          'Authentication Required',
          'PASS',
          'API properly requires authentication for vehicle access'
        );
      } else if (noAuthResponse.status === 200) {
        this.addResult(
          'Authentication Required',
          'WARNING',
          'API allows unauthenticated access (may be test environment)'
        );
      } else {
        this.addResult(
          'Authentication Required',
          'FAIL',
          `Unexpected response for unauthenticated request: ${noAuthResponse.status}`
        );
      }

      // Test dealership context in responses
      if (noAuthResponse.status === 200 && noAuthResponse.data.vehicles) {
        const vehicles = noAuthResponse.data.vehicles;
        const hasDealershipId = vehicles.every((vehicle: any) => vehicle.dealershipId);
        
        if (hasDealershipId) {
          this.addResult(
            'Dealership Context in Data',
            'PASS',
            'All vehicles include dealership context'
          );
        } else {
          this.addResult(
            'Dealership Context in Data',
            'FAIL',
            'Some vehicles missing dealership context'
          );
        }
      }

    } catch (error) {
      this.addResult(
        'Multi-dealership Context Test',
        'FAIL',
        'Failed to test multi-dealership context',
        error
      );
    }
  }

  // Cleanup created test data
  async cleanup(): Promise<void> {
    this.log('Cleaning up test data...');
    
    for (const vehicleId of this.createdVehicleIds) {
      try {
        await this.makeRequest('DELETE', `/api/vehicles/${vehicleId}`);
      } catch (error) {
        this.log(`Failed to cleanup vehicle ${vehicleId}`, 'ERROR');
      }
    }
    
    this.log('Cleanup completed');
  }

  // Generate comprehensive test report
  generateReport(): void {
    const stats: TestStats = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARNING').length
    };

    const successRate = ((stats.passed / stats.total) * 100).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('INVENTORY MANAGEMENT TESTING REPORT');
    console.log('='.repeat(80));
    console.log(`📊 Test Summary:`);
    console.log(`   Total Tests: ${stats.total}`);
    console.log(`   ✅ Passed: ${stats.passed}`);
    console.log(`   ❌ Failed: ${stats.failed}`);
    console.log(`   ⚠️  Warnings: ${stats.warnings}`);
    console.log(`   📈 Success Rate: ${successRate}%`);
    console.log('\n');

    // Group results by test category
    const categories = {
      'UI Components': this.results.filter(r => r.testName.includes('Component') || r.testName.includes('Page')),
      'Search & Filter': this.results.filter(r => r.testName.includes('Search') || r.testName.includes('Filter')),
      'CRUD Operations': this.results.filter(r => r.testName.includes('CREATE') || r.testName.includes('READ') || r.testName.includes('UPDATE') || r.testName.includes('DELETE')),
      'API Validation': this.results.filter(r => r.testName.includes('Format') || r.testName.includes('Validation') || r.testName.includes('Response')),
      'Import Features': this.results.filter(r => r.testName.includes('Import') || r.testName.includes('TSV')),
      'Edge Cases': this.results.filter(r => r.testName.includes('Edge') || r.testName.includes('Duplicate') || r.testName.includes('Maximum')),
      'Security & Context': this.results.filter(r => r.testName.includes('Auth') || r.testName.includes('Dealership'))
    };

    for (const [category, categoryResults] of Object.entries(categories)) {
      if (categoryResults.length > 0) {
        console.log(`\n📋 ${category}:`);
        categoryResults.forEach(result => {
          const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
          console.log(`   ${emoji} ${result.testName}: ${result.details}`);
        });
      }
    }

    // Show failed tests with error details
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      console.log('\n🔍 Failed Test Details:');
      failedTests.forEach(test => {
        console.log(`\n   ❌ ${test.testName}:`);
        console.log(`      Details: ${test.details}`);
        if (test.errorDetails) {
          console.log(`      Error: ${JSON.stringify(test.errorDetails, null, 2)}`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('📝 RECOMMENDATIONS:');
    console.log('='.repeat(80));

    if (stats.failed === 0) {
      console.log('🎉 All tests passed! Inventory management system is functioning correctly.');
    } else {
      console.log('🔧 Please address the failed tests above to ensure full functionality.');
    }

    if (stats.warnings > 0) {
      console.log('⚠️  Review warning items for potential improvements.');
    }

    console.log('\n📈 NEXT STEPS:');
    console.log('• Run integration tests with actual frontend components');
    console.log('• Test with production-like data volumes');
    console.log('• Verify image upload and display functionality');
    console.log('• Test email-based TSV import processing');
    console.log('• Validate real-time UI updates after CRUD operations');

    // Save detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: stats,
      successRate: parseFloat(successRate),
      results: this.results,
      recommendations: failedTests.length === 0 ? 'All tests passed' : 'Address failed tests',
      nextSteps: [
        'Run integration tests with actual frontend components',
        'Test with production-like data volumes',
        'Verify image upload and display functionality',
        'Test email-based TSV import processing',
        'Validate real-time UI updates after CRUD operations'
      ]
    };

    const reportPath = path.join(process.cwd(), 'inventory-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  }

  // Main test runner
  async runAllTests(): Promise<void> {
    this.log('🚀 Starting Comprehensive Inventory Management Testing Suite');
    this.log('Dependencies: Database Health (#7), Frontend Component Rendering (#10)');
    
    try {
      // Run all test suites
      await this.testInventoryUIComponents();
      await this.testSearchAndFilterFunctionality();
      await this.testVehicleDetailsPage();
      await this.testCRUDOperations();
      await this.testRequestResponseFormats();
      await this.testImportFunctionality();
      await this.testEdgeCases();
      await this.testMultiDealershipContext();

      // Cleanup test data
      await this.cleanup();

      // Generate final report
      this.generateReport();

    } catch (error) {
      this.log('❌ Test suite failed with critical error', 'ERROR');
      console.error(error);
    }
  }
}

// Export for use in other test files
export { InventoryTestSuite, Vehicle, TestResult };