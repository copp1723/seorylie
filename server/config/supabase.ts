/**
 * Temporary Supabase stub - Replace with proper PostgreSQL/Drizzle implementation
 * This file exists only to make the build pass while we migrate away from Supabase
 */

// Mock supabase client for build compatibility
export const supabase = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: new Error('Supabase not configured') }),
    getSession: () => Promise.resolve({ data: { session: null }, error: new Error('Supabase not configured') })
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
      })
    }),
    insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
        })
      })
    })
  }),
  channel: () => ({
    unsubscribe: () => Promise.resolve()
  })
};

export const supabaseAdmin = supabase;
export const supabaseClient = supabase;
export default supabase;

