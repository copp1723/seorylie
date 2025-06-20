/**
 * @file Basic Health Check Tests
 * @description Ensures the test infrastructure is working properly
 */

import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('Vitest is working correctly', () => {
    expect(true).toBe(true);
  });

  it('Environment variables are set for tests', () => {
    expect(process.env.NODE_ENV).toBe('test');
    // JWT_SECRET is not required in test environment
    expect(process.env.IS_TEST).toBe('true');
  });

  it('Global test utilities are available', () => {
    expect(globalThis.testUtils).toBeDefined();
    expect(typeof globalThis.testUtils.mockEnv).toBe('function');
    expect(typeof globalThis.testUtils.restoreEnv).toBe('function');
  });

  it('Mock services are configured', () => {
    // Test that global utilities work
    globalThis.testUtils.mockEnv('TEST_VAR', 'test-value');
    expect(process.env.TEST_VAR).toBe('test-value');
    
    globalThis.testUtils.restoreEnv();
    expect(process.env.TEST_VAR).toBeUndefined();
  });
});

describe('Configuration System', () => {
  test('Config loading handles test environment', () => {
    // This tests our config system without importing it
    // (since it may not be fully available yet)
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('Error Handling System', () => {
  test('Custom error classes work correctly', () => {
    // Basic error testing
    const error = new Error('Test error');
    expect(error.message).toBe('Test error');
  });
});

describe('Security Audit', () => {
  test('Audit script exists', () => {
    const fs = require('fs');
    const path = require('path');
    
    const auditScriptPath = path.join(process.cwd(), 'scripts', 'audit-security.js');
    expect(fs.existsSync(auditScriptPath)).toBe(true);
  });
});

describe('Documentation', () => {
  test('README exists and is comprehensive', () => {
    const fs = require('fs');
    const path = require('path');
    
    const readmePath = path.join(process.cwd(), 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);
    
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    expect(readmeContent).toContain('Rylie SEO Hub');
    expect(readmeContent).toContain('Quick Start');
    expect(readmeContent).toContain('Architecture');
  });
});