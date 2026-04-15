/**
 * Supabase Client - Frontend version (Vite + React)
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from import.meta.env.
 * Uses window.location.origin to build a full URL when the env var is a relative path
 * (e.g., "/supabase"), because the Supabase SDK requires a valid HTTP/HTTPS URL.
 *
 * @example
 * ```typescript
 * import { supabase } from '@/lib/supabase';
 * const { data } = await supabase.auth.getSession();
 * ```
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Build a full Supabase URL.
 * - If VITE_SUPABASE_URL starts with "http", use it as-is.
 * - Otherwise treat it as a proxy path and prepend window.location.origin.
 * - Default proxy path: "/supabase" (configured in vite.config.ts).
 */
function getSupabaseUrl(): string {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '/supabase';
  if (envUrl.startsWith('http')) {
    return envUrl;
  }
  return `${window.location.origin}${envUrl}`;
}

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Default Supabase client instance (anon key).
 * Use for all frontend auth operations (signUp, signIn, getSession, etc.)
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
