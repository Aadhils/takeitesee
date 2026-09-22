import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function getBearerAccessToken(request?: Request) {
  const authorization = request?.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const token = match?.[1]?.trim() ?? '';
  return token || null;
}

export async function createSupabaseServerClient(request?: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase server configuration is missing.');

  const bearerAccessToken = getBearerAccessToken(request);
  if (bearerAccessToken) {
    return createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${bearerAccessToken}`,
        },
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

export async function getSupabaseAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  request?: Request,
) {
  const bearerAccessToken = getBearerAccessToken(request);
  return supabase.auth.getUser(bearerAccessToken ?? undefined);
}
