/**
 * Supabase Client - Backend version (Node.js / Express)
 *
 * Reads SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY from process.env.
 * These are set by start-supabase.sh and exported to /etc/zshenv.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Admin client — bypasses RLS. Backend-only.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || 'http://localhost:8000';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
