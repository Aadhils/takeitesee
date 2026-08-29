import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('list_provider_trust_overview');
    if (error) throw new Error(error.message);
    return NextResponse.json({ providers: Array.isArray(data) ? data : [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider trust overview.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const input = await request.json() as {
      provider_type?: 'professional' | 'business';
      provider_id?: string;
      action?: 'require_reverification' | 'suspend' | 'restore';
      reason?: string;
    };
    if (!input.provider_type || !input.provider_id || !input.action) {
      return NextResponse.json({ error: 'Provider and trust action are required.' }, { status: 400 });
    }
    const reason = input.reason?.trim() ?? '';
    if (reason.length < 3) return NextResponse.json({ error: 'A clear trust action reason is required.' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('set_provider_trust_state', {
      target_provider_type: input.provider_type,
      target_provider_id: input.provider_id,
      target_action: input.action,
      action_reason: reason,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ trust: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider trust action failed.' }, { status: 400 });
  }
}
