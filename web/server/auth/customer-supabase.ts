import { createSupabaseServerClient, getSupabaseAuthenticatedUser } from '../../lib/supabase/server';

export async function requireCustomerSupabase(request?: Request) {
  const supabase = await createSupabaseServerClient(request);
  const { data: { user }, error } = await getSupabaseAuthenticatedUser(supabase, request);
  if (error || !user) throw new Error('Authentication required.');
  return { supabase, user };
}
