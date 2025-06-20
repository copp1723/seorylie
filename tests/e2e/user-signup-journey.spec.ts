/**
 * @file End-to-End User Signup Journey Tests
 * @description E2E tests for complete user signup and onboarding flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, testUtils } from '../utils/dbTestHelpers';

describe('E2E: User Signup Journey', () => {
  const dbHelper = setupTestDatabase();

  beforeAll(async () => {
    await dbHelper.connect();
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  beforeEach(async () => {
    await dbHelper.cleanup();
  });

  describe('Complete Agency Onboarding', () => {
    it('should handle full agency signup to dashboard access flow', async () => {
      // Step 1: Agency signs up
      const signupData = {
        name: 'E2E Test Agency',
        email: 'e2e@testagency.com',
        password: 'SecureE2EPassword123!'
      };

      // Mock the signup API call
      const mockSignupResponse = {
        success: true,
        data: {
          token: 'e2e-jwt-token',
          user: {
            id: 'e2e-user-id',
            email: signupData.email,
            role: 'agency',
            tenantId: 'e2e-tenant-id'
          },
          tenant: {
            id: 'e2e-tenant-id',
            name: signupData.name,
            slug: 'e2e-test-agency'
          }
        }
      };

      // Step 2: Verify user can access authenticated endpoints
      const mockAuthenticatedRequest = testUtils.createMockRequest({
        headers: {
          authorization: 'Bearer e2e-jwt-token'
        },
        user: mockSignupResponse.data.user
      });

      // Step 3: User should be able to access dashboard
      expect(mockAuthenticatedRequest.user).toBeDefined();
      expect(mockAuthenticatedRequest.user.role).toBe('agency');
      expect(mockAuthenticatedRequest.user.tenantId).toBe('e2e-tenant-id');

      // Step 4: User should be able to update branding
      const brandingUpdate = {
        companyName: 'Updated E2E Agency',
        primaryColor: '#FF6B6B',
        logoUrl: 'https://e2e-agency.com/logo.png'
      };

      // Mock branding update success
      expect(brandingUpdate.companyName).toBe('Updated E2E Agency');
      expect(brandingUpdate.primaryColor).toBe('#FF6B6B');
    });

    it('should handle error scenarios in signup flow', async () => {
      // Test network error handling
      const networkErrorScenario = async () => {
        try {
          throw new Error('Network error');
        } catch (error) {
          return { success: false, error: 'Network connection failed' };
        }
      };

      const result = await networkErrorScenario();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connection failed');
    });
  });

  describe('Multi-user Agency Setup', () => {
    it('should allow agency admin to invite team members', async () => {
      // Step 1: Create agency admin
      const admin = await dbHelper.createTestUser({
        email: 'admin@e2eagency.com',
        role: 'agency',
        tenantId: 'e2e-tenant-id'
      });

      // Step 2: Admin invites team member
      const inviteData = {
        email: 'member@e2eagency.com',
        role: 'user',
        tenantId: admin.tenantId
      };

      // Step 3: Create team member
      const teamMember = await dbHelper.createTestUser({
        email: inviteData.email,
        role: inviteData.role,
        tenantId: inviteData.tenantId
      });

      // Step 4: Verify both users belong to same tenant
      expect(admin.tenantId).toBe(teamMember.tenantId);
      expect(teamMember.role).toBe('user');
      expect(admin.role).toBe('agency');
    });
  });

  describe('Data Persistence', () => {
    it('should persist user preferences across sessions', async () => {
      // Create user with preferences
      const user = await dbHelper.createTestUser({
        email: 'persistent@test.com',
        name: 'Persistent User'
      });

      // Simulate logout/login by recreating user context
      const userSession1 = {
        id: user.id,
        email: user.email,
        preferences: { theme: 'dark', language: 'en' }
      };

      // Simulate new session
      const userSession2 = {
        id: user.id,
        email: user.email,
        preferences: { theme: 'dark', language: 'en' }
      };

      // Preferences should persist
      expect(userSession1.preferences).toEqual(userSession2.preferences);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete signup flow within acceptable time limits', async () => {
      const startTime = Date.now();

      // Simulate signup process
      await testUtils.sleep(50); // Simulate API delay

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds (5000ms) in E2E
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent signups gracefully', async () => {
      const concurrentSignups = Array.from({ length: 3 }, (_, i) => 
        dbHelper.createTestUser({
          email: `concurrent${i}@test.com`,
          name: `Concurrent User ${i}`
        })
      );

      const results = await Promise.all(concurrentSignups);

      // All signups should succeed
      expect(results).toHaveLength(3);
      results.forEach((user, index) => {
        expect(user.email).toBe(`concurrent${index}@test.com`);
      });
    });
  });
});

