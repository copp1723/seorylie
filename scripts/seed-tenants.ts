/*
 * Seed script for multi-tenant RBAC model (Slice-1)
 *
 * Creates:
 *   1. SEO Werks root tenant (type = super)
 *   2. Sample agency tenant (Velocity SEO)
 *   3. Sample dealer tenant (Demo Dealer) under the agency
 *   4. Users for each tenant with appropriate role
 *
 * Usage (local):
 *   npx ts-node scripts/seed-tenants.ts
 * or npm run seed:tenants if you add a script alias.
 */

import { db } from "../server/db";
import {
  tenants,
  users,
  Tenant,
  User,
} from "../server/models/schema";
import { sql, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function ensureTenant(name: string, parentId: string | null = null) {
  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, name))
    .limit(1);
  if (existing.length) return existing[0];

  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const [tenant] = await db
    .insert(tenants)
    .values({
      id: uuidv4(),
      name,
      slug,
      parentId,
      brand: parentId ? null : { theme: "default" },
    })
    .returning();
  return tenant as Tenant;
}

async function ensureUser(
  email: string,
  role: "super" | "agency" | "dealer",
  tenantId: string,
) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length) return existing[0];

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: email.split("@")[0],
      role,
      tenantId,
      isActive: true,
    })
    .returning();
  return user as User;
}

async function main() {
  console.log("🌱  Seeding multi-tenant data…");
  await db.execute(sql`BEGIN`);
  try {
    // 1. SEO Werks (root)
    const seoWerks = await ensureTenant("SEO Werks");
    await ensureUser("super@seowerks.io", "super", seoWerks.id);

    // 2. Sample agency
    const velocitySeo = await ensureTenant("Velocity SEO", seoWerks.id);
    await ensureUser("admin@velocityseo.com", "agency", velocitySeo.id);

    // 3. Sample dealer under agency
    const demoDealer = await ensureTenant("Demo Dealer", velocitySeo.id);
    await ensureUser("demo@dealer.com", "dealer", demoDealer.id);

    await db.execute(sql`COMMIT`);
    console.log("✅  Seed complete");
  } catch (err) {
    await db.execute(sql`ROLLBACK`);
    console.error("❌  Seed failed", err);
    process.exit(1);
  }
}

main();
