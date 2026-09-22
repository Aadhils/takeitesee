import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

export async function getSupabaseRequestAccessToken(request?: Request) {
  const authorization = request?.headers.get('authorization') ?? (await headers()).get('authorization');
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? '';
  return token || null;
}

export async function createSupabaseServerClient(
  request?: Request,
  accessTokenOverride?: string | null,
): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase server configuration is missing.');

  const accessToken = accessTokenOverride === undefined
    ? await getSupabaseRequestAccessToken(request)
    : accessTokenOverride;

  if (accessToken) {
    return createClient(url, anonKey, {
      accessToken: async () => accessToken,
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot always write cookies; middleware refreshes sessions.
        }
      },
    },
  });
}
