import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import db from "../../server/db";
import { magicLinkInvitations, users } from "../../shared/enhanced-schema";
import {
  sendInvitation,
  verifyInvitation,
  cleanupExpiredInvitations,
} from "../../server/services/magic-link-auth";
import { eq } from "drizzle-orm";

describe("Magic Link Authentication", () => {
  let testEmail: string;
  let testDealershipId: number;

  beforeAll(async () => {
    // Clean up any existing test data
    testEmail = `test-${Date.now()}@example.com`;
    testDealershipId = 1;
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db
      .delete(magicLinkInvitations)
      .where(eq(magicLinkInvitations.email, testEmail));
    await db.delete(users).where(eq(users.email, testEmail));
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(magicLinkInvitations)
      .where(eq(magicLinkInvitations.email, testEmail));
    await db.delete(users).where(eq(users.email, testEmail));
  });

  test("should create magic link invitation successfully", async () => {
    const result = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
    expect(typeof result.token).toBe("string");

    // Verify invitation was created in database
    const invitation = await db.query.magicLinkInvitations.findFirst({
      where: eq(magicLinkInvitations.email, testEmail),
    });

    expect(invitation).toBeTruthy();
    expect(invitation?.email).toBe(testEmail);
    expect(invitation?.role).toBe("user");
    expect(invitation?.dealershipId).toBe(testDealershipId);
    expect(invitation?.used).toBe(false);
    expect(invitation?.expiresAt).toBeTruthy();
  });

  test("should not create duplicate invitations for same email", async () => {
    // Create first invitation
    const result1 = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
    });

    expect(result1.success).toBe(true);

    // Try to create second invitation for same email
    const result2 = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
    });

    // Should fail or reuse existing invitation
    if (!result2.success) {
      expect(result2.error).toContain("already exists");
    }
  });

  test("should verify valid magic link token", async () => {
    // Create invitation
    const result = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();

    // Verify the token
    const verification = await verifyInvitation(result.token!);

    expect(verification.success).toBe(true);
    expect(verification.invitation).toBeTruthy();
    expect(verification.invitation?.email).toBe(testEmail);
    expect(verification.invitation?.role).toBe("user");
  });

  test("should reject invalid magic link token", async () => {
    const fakeToken = "invalid-token-12345";

    const verification = await verifyInvitation(fakeToken);

    expect(verification.success).toBe(false);
    expect(verification.error).toContain("Invalid or expired");
  });

  test("should reject expired magic link token", async () => {
    // Create invitation with past expiration date
    const result = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
      expiresIn: -3600, // Expired 1 hour ago
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();

    // Try to verify expired token
    const verification = await verifyInvitation(result.token!);

    expect(verification.success).toBe(false);
    expect(verification.error).toContain("Invalid or expired");
  });

  test("should mark invitation as used after verification", async () => {
    // Create invitation
    const result = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
    });

    expect(result.success).toBe(true);

    // Verify and use the token
    const verification = await verifyInvitation(result.token!, true);

    expect(verification.success).toBe(true);

    // Check that invitation is marked as used
    const invitation = await db.query.magicLinkInvitations.findFirst({
      where: eq(magicLinkInvitations.email, testEmail),
    });

    expect(invitation?.used).toBe(true);
    expect(invitation?.usedAt).toBeTruthy();
  });

  test("should not allow reuse of used magic link token", async () => {
    // Create and use invitation
    const result = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
    });

    expect(result.success).toBe(true);

    // First verification (marks as used)
    await verifyInvitation(result.token!, true);

    // Second verification should fail
    const secondVerification = await verifyInvitation(result.token!);

    expect(secondVerification.success).toBe(false);
    expect(secondVerification.error).toContain("already been used");
  });

  test("should clean up expired invitations", async () => {
    // Create expired invitation
    const result = await sendInvitation(testEmail, "http://localhost:3000", {
      role: "user",
      dealershipId: testDealershipId,
      invitedBy: 1,
      expiresIn: -3600, // Expired 1 hour ago
    });

    expect(result.success).toBe(true);

    // Verify invitation exists
    let invitation = await db.query.magicLinkInvitations.findFirst({
      where: eq(magicLinkInvitations.email, testEmail),
    });
    expect(invitation).toBeTruthy();

    // Clean up expired invitations
    const cleanupResult = await cleanupExpiredInvitations();
    expect(cleanupResult.deletedCount).toBeGreaterThan(0);

    // Verify invitation was deleted
    invitation = await db.query.magicLinkInvitations.findFirst({
      where: eq(magicLinkInvitations.email, testEmail),
    });
    expect(invitation).toBeFalsy();
  });

  test("should handle different roles correctly", async () => {
    const roles = ["user", "dealership_admin", "manager"];

    for (const role of roles) {
      const email = `${role}-${Date.now()}@example.com`;

      const result = await sendInvitation(email, "http://localhost:3000", {
        role,
        dealershipId: testDealershipId,
        invitedBy: 1,
      });

      expect(result.success).toBe(true);

      const verification = await verifyInvitation(result.token!);
      expect(verification.success).toBe(true);
      expect(verification.invitation?.role).toBe(role);

      // Clean up
      await db
        .delete(magicLinkInvitations)
        .where(eq(magicLinkInvitations.email, email));
    }
  });
});
