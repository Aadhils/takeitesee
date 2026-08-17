import { isSupabaseConfigured } from '../lib/supabase/config';

export type BackendMode = 'development' | 'production';

/** Production is authoritative once real Supabase configuration is present; otherwise the app fails closed to the local development fallback. */
export function getBackendMode(): BackendMode {
  return isSupabaseConfigured() ? 'production' : 'development';
}

export function getRequiredProductionConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : '',
    !supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : '',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Production backend is not configured. Missing: ${missing.join(', ')}`);
  return { supabaseUrl, supabaseAnonKey };
}

export function assertProductionBackendConfigured() {
  if (getBackendMode() !== 'production') throw new Error('Production backend operations are disabled until Supabase configuration (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) is present.');
  return getRequiredProductionConfig();
}
