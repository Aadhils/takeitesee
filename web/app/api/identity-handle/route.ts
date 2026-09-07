import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../server/auth/session';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type HandleContext = 'customer' | 'provider';

type OwnedIdentity = {
  identity_type: 'customer' | 'professional' | 'business';
  identity_id: string;
};

function requestedContext(request: Request): HandleContext {
  const value = new URL(request.url).searchParams.get('context');
  if (value !== 'customer' && value !== 'provider') throw new Error('Invalid identity context.');
  return value;
}

async function ownedIdentity(request: Request, context: HandleContext): Promise<OwnedIdentity> {
  const supabase = await createSupabaseServerClient();

  if (context === 'customer') {
    const session = await productionAuthProvider.requireCustomer(request);
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('user_id', session.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Customer profile is required before claiming a handle.');
    return { identity_type: 'customer', identity_id: String(data.id) };
  }

  const session = await productionAuthProvider.requireProvider(request);
  if (session.roles.includes('professional')) {
    const { data, error } = await supabase
      .from('professional_profiles')
      .select('id')
      .eq('user_id', session.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Professional profile is required before claiming a handle.');
    return { identity_type: 'professional', identity_id: String(data.id) };
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', session.user_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Business profile is required before claiming a handle.');
  return { identity_type: 'business', identity_id: String(data.id) };
}

export async function GET(request: Request) {
  try {
    const context = requestedContext(request);
    const identity = await ownedIdentity(request, context);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('identity_handles')
      .select('handle')
      .eq('identity_type', identity.identity_type)
      .eq('identity_id', identity.identity_id)
      .eq('is_current', true)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return NextResponse.json({
      context,
      identity_type: identity.identity_type,
      handle: data?.handle ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load identity handle.' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = requestedContext(request);
    await ownedIdentity(request, context);
    const body = await request.json() as { handle?: string };
    if (typeof body.handle !== 'string' || !body.handle.trim()) throw new Error('Handle is required.');

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('set_my_identity_handle', {
      target_context: context,
      requested_handle: body.handle,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ result: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save identity handle.' }, { status: 400 });
  }
}
