import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ proposalId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireProvider(request);
    const { proposalId } = await context.params;
    const body = await request.json().catch(() => ({})) as { action?: string };
    if (body.action !== 'withdraw') return NextResponse.json({ error: 'Only proposal withdrawal is supported.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('provider_withdraw_requirement_proposal', { target_proposal_id: proposalId }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Proposal could not be withdrawn.');
    return NextResponse.json({ proposal: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal could not be withdrawn.';
    const status = /authentication|own proposal|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
