import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

import { normalizeSupabaseUrl } from './utils';

/**
 * Admin Supabase client with service-role key.
 * ONLY use in server-only contexts: webhooks, recovery endpoints, background tasks.
 * This client bypasses RLS — use with extreme caution.
 */
export function createAdminClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  const supabaseUrl = normalizeSupabaseUrl(rawUrl);

  return createClient<Database>(supabaseUrl, serviceRoleKey.trim(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
