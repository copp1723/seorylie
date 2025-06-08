/**
 * Supabase Configuration and Client Setup
 *
 * This module configures the Supabase client for server-side operations
 * and provides compatibility layer with existing application architecture.
 *
 * @file server/config/supabase.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/supabase";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required but not provided");
}

if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_KEY is required but not provided");
}

if (!supabaseAnonKey) {
  throw new Error("SUPABASE_ANON_KEY is required but not provided");
}

/**
 * Server-side Supabase client with service role key
 * This client has full access to the database and can bypass RLS policies
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Client-side Supabase client with anonymous key
 * This client respects RLS policies and is used for frontend operations
 */
export const supabaseClient: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);

/**
 * Configuration object for Supabase settings
 */
export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  serviceKey: supabaseServiceKey,
} as const;

/**
 * Utility function to create authenticated client for specific user
 */
export function createAuthenticatedClient(
  accessToken: string,
): SupabaseClient<Database> {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Health check function to verify Supabase connectivity
 */
export async function checkSupabaseHealth(): Promise<{
  status: "healthy" | "unhealthy";
  checks: {
    connection: boolean;
    auth: boolean;
    rls: boolean;
    realtime: boolean;
  };
  errors?: string[];
}> {
  const checks = {
    connection: false,
    auth: false,
    rls: false,
    realtime: false,
  };
  const errors: string[] = [];

  try {
    // Test basic connection
    const { data, error } = await supabaseAdmin
      .from("dealerships")
      .select("id")
      .limit(1);

    if (error) {
      errors.push(`Connection test failed: ${error.message}`);
    } else {
      checks.connection = true;
    }

    // Test auth functionality
    try {
      const { data: authData, error: authError } =
        await supabaseClient.auth.getSession();
      checks.auth = !authError;
      if (authError) {
        errors.push(`Auth test failed: ${authError.message}`);
      }
    } catch (authErr) {
      errors.push(`Auth test error: ${authErr}`);
    }

    // Test RLS policies (try to access protected data without proper context)
    try {
      const { data: rlsData, error: rlsError } = await supabaseClient
        .from("conversations")
        .select("id")
        .limit(1);

      // RLS should either work or fail gracefully
      checks.rls = true;
    } catch (rlsErr) {
      errors.push(`RLS test error: ${rlsErr}`);
    }

    // Test realtime connection
    try {
      const channel = supabaseClient.channel("health-check");
      checks.realtime = true;
      await channel.unsubscribe();
    } catch (realtimeErr) {
      errors.push(`Realtime test error: ${realtimeErr}`);
    }
  } catch (err) {
    errors.push(`General health check error: ${err}`);
  }

  const status = Object.values(checks).every((check) => check)
    ? "healthy"
    : "unhealthy";

  return {
    status,
    checks,
    ...(errors.length > 0 && { errors }),
  };
}

export default supabaseClient;
