import { InventoryTestSuite } from './tests/inventory-management-test.ts';

console.log('🚀 Starting Inventory Management Testing Suite');

const testSuite = new InventoryTestSuite();
testSuite.runAllTests().catch(console.error);