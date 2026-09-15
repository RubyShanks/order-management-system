import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Admin Supabase client with service-role key.
 * ONLY use in server-only contexts: webhooks, recovery endpoints, background tasks.
 * This client bypasses RLS — use with extreme caution.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
