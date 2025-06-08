/**
 * This script sets up Row-Level Security (RLS) policies in PostgreSQL
 * to enforce proper isolation between dealerships in our multi-tenant system.
 *
 * Run with: npx tsx scripts/setup-rls-policies.ts
 */

import { db } from "../server/db";
import { logger } from "../server/logger";

async function setupRLSPolicies() {
  logger.info(
    "Setting up Row-Level Security (RLS) policies for multi-tenancy...",
  );

  try {
    // Enable RLS on all tenant tables
    await db.execute(`
      -- Enable RLS on dealership tables
      ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;
      ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE dealership_variables ENABLE ROW LEVEL SECURITY;
      ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE prompt_tests ENABLE ROW LEVEL SECURITY;
      ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE magic_link_invitations ENABLE ROW LEVEL SECURITY;
    `);

    logger.info("RLS enabled on all tenant tables");

    // Create RLS policies for dealerships table
    await db.execute(`
      -- Super admins can see and manage all dealerships
      CREATE POLICY dealerships_super_admin ON dealerships
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Dealership admins and regular users can only see their own dealership
      CREATE POLICY dealerships_dealership_users ON dealerships
        USING (id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (false); -- They cannot modify dealership records
    `);

    // Create RLS policies for users table
    await db.execute(`
      -- Super admins can see and manage all users
      CREATE POLICY users_super_admin ON users
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Dealership admins can only see and manage users from their dealership
      CREATE POLICY users_dealership_admin ON users
        USING (
          current_setting('app.current_user_role') = 'dealership_admin' AND
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        )
        WITH CHECK (
          current_setting('app.current_user_role') = 'dealership_admin' AND
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        );
      
      -- Regular users can only see users from their dealership, but not modify them
      CREATE POLICY users_dealership_users ON users
        USING (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (false);
      
      -- All users can see and update their own record
      CREATE POLICY users_self ON users
        USING (id = CAST(current_setting('app.current_user_id') AS INTEGER))
        WITH CHECK (id = CAST(current_setting('app.current_user_id') AS INTEGER));
    `);

    // Create RLS policies for system_prompts table
    await db.execute(`
      -- Super admins can see and manage all prompts
      CREATE POLICY prompts_super_admin ON system_prompts
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Users can only see and manage prompts from their dealership
      CREATE POLICY prompts_dealership_users ON system_prompts
        USING (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER));
    `);

    // Create RLS policies for dealership_variables table
    await db.execute(`
      -- Super admins can see and manage all variables
      CREATE POLICY variables_super_admin ON dealership_variables
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Users can only see and manage variables from their dealership
      CREATE POLICY variables_dealership_users ON dealership_variables
        USING (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER));
    `);

    // Create RLS policies for vehicles table
    await db.execute(`
      -- Super admins can see and manage all vehicles
      CREATE POLICY vehicles_super_admin ON vehicles
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Users can only see and manage vehicles from their dealership
      CREATE POLICY vehicles_dealership_users ON vehicles
        USING (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER));
    `);

    // Create RLS policies for customers table
    await db.execute(`
      -- Super admins can see and manage all customers
      CREATE POLICY customers_super_admin ON customers
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Users can only see and manage customers from their dealership
      CREATE POLICY customers_dealership_users ON customers
        USING (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER));
    `);

    // Create RLS policies for conversations table
    await db.execute(`
      -- Super admins can see and manage all conversations
      CREATE POLICY conversations_super_admin ON conversations
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Users can only see and manage conversations from their dealership
      CREATE POLICY conversations_dealership_users ON conversations
        USING (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER));
    `);

    // Create RLS policies for messages table
    // Messages don't have a direct dealership_id, so we need to reference the conversation
    await db.execute(`
      -- Super admins can see and manage all messages
      CREATE POLICY messages_super_admin ON messages
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Users can only see and manage messages from their dealership's conversations
      CREATE POLICY messages_dealership_users ON messages
        USING (
          EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_id
            AND conversations.dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_id
            AND conversations.dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
          )
        );
    `);

    // Create RLS policies for prompt_tests table
    await db.execute(`
      -- Super admins can see and manage all prompt tests
      CREATE POLICY tests_super_admin ON prompt_tests
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Users can only see and manage prompt tests from their dealership
      CREATE POLICY tests_dealership_users ON prompt_tests
        USING (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER))
        WITH CHECK (dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER));
    `);

    // Create RLS policies for activity_logs table
    await db.execute(`
      -- Super admins can see all activity logs
      CREATE POLICY logs_super_admin ON activity_logs
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Dealership admins can only see logs from their dealership
      CREATE POLICY logs_dealership_admin ON activity_logs
        USING (
          current_setting('app.current_user_role') IN ('dealership_admin', 'manager') AND
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        )
        WITH CHECK (
          current_setting('app.current_user_role') IN ('dealership_admin', 'manager') AND
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        );
      
      -- Regular users can only see their own logs
      CREATE POLICY logs_user_own ON activity_logs
        USING (
          user_id = CAST(current_setting('app.current_user_id') AS INTEGER) AND
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        )
        WITH CHECK (false); -- They cannot modify logs
    `);

    // Create RLS policies for magic_link_invitations table
    await db.execute(`
      -- Super admins can see and manage all invitations
      CREATE POLICY invitations_super_admin ON magic_link_invitations
        USING (current_setting('app.current_user_role') = 'super_admin')
        WITH CHECK (current_setting('app.current_user_role') = 'super_admin');
      
      -- Dealership admins can only see and manage invitations for their dealership
      CREATE POLICY invitations_dealership_admin ON magic_link_invitations
        USING (
          current_setting('app.current_user_role') IN ('dealership_admin', 'manager') AND
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        )
        WITH CHECK (
          current_setting('app.current_user_role') IN ('dealership_admin', 'manager') AND
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        );
      
      -- Regular users cannot manage invitations
      CREATE POLICY invitations_dealership_users ON magic_link_invitations
        USING (
          dealership_id = CAST(current_setting('app.current_user_dealership_id') AS INTEGER)
        )
        WITH CHECK (false);
    `);

    logger.info("RLS policies created successfully");

    // Create a function to set the app context variables
    await db.execute(`
      CREATE OR REPLACE FUNCTION set_tenant_context(user_id INTEGER, user_role TEXT, dealership_id INTEGER)
      RETURNS VOID AS $$
      BEGIN
        PERFORM set_config('app.current_user_id', user_id::TEXT, false);
        PERFORM set_config('app.current_user_role', user_role, false);
        PERFORM set_config('app.current_user_dealership_id', dealership_id::TEXT, false);
      END;
      $$ LANGUAGE plpgsql;
    `);

    logger.info("Created tenant context function");

    logger.info("RLS setup completed successfully");
  } catch (error) {
    logger.error("Error setting up RLS policies:", error);
    throw error;
  }
}

// Run the script if executed directly
if (require.main === module) {
  setupRLSPolicies()
    .then(() => {
      logger.info("RLS policies setup completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Failed to setup RLS policies:", error);
      process.exit(1);
    });
}

export { setupRLSPolicies };
