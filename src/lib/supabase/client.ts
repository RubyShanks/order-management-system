import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { normalizeSupabaseUrl } from './utils';

export function createClient() {
  return createBrowserClient<Database>(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  );
}
