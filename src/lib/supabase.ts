/**
 * Supabase client — only initialised when env vars are present.
 * In guest/offline mode, `supabase` is null and all callers fall back to localStorage.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}
