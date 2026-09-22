import { headers } from 'next/headers';
import { createSupabaseServerClient, getSupabaseAuthenticatedUser } from '../../lib/supabase/server';

async function resolveCustomerRequest(request?: Request) {
  if (request) return request;

  const authorization = (await headers()).get('authorization')?.trim() ?? '';
  if (!authorization) return undefined;

  return new Request('https://takeitesee.local', {
    headers: { authorization },
  });
}

export async function requireCustomerSupabase(request?: Request) {
  const effectiveRequest = await resolveCustomerRequest(request);
  const supabase = await createSupabaseServerClient(effectiveRequest);
  const { data: { user }, error } = await getSupabaseAuthenticatedUser(supabase, effectiveRequest);
  if (error || !user) throw new Error('Authentication required.');
  return { supabase, user };
}
