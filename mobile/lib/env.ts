const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const mobileEnv = {
  apiBaseUrl: trimTrailingSlashes(
    process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://www.takeitesee.com',
  ),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '',
  supabasePublishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '',
};

export function requireSupabaseMobileEnv() {
  if (!mobileEnv.supabaseUrl || !mobileEnv.supabasePublishableKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  return {
    url: mobileEnv.supabaseUrl,
    publishableKey: mobileEnv.supabasePublishableKey,
  };
}
