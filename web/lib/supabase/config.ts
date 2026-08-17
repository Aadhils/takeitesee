/** True when real Supabase Auth/session should be authoritative instead of the local development fallback. */
export function isSupabaseConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_TAKEITSEE_BACKEND_MODE === 'development') return false;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
