import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ requirementId: string; proposalId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { requirementId, proposalId } = await context.params;
    const body = await request.json() as { decision?: 'accept' | 'decline' };
    if (!body.decision || !['accept', 'decline'].includes(body.decision)) {
      return NextResponse.json({ error: 'A valid proposal decision is required.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: proposalOwner, error: ownerError } = await supabase
      .from('requirement_proposals')
      .select('id,requirement_id,customer_requirements!inner(customer_id)')
      .eq('id', proposalId)
      .eq('requirement_id', requirementId)
      .maybeSingle();
    if (ownerError) throw new Error(ownerError.message);
    if (!proposalOwner) return NextResponse.json({ error: 'Proposal was not found.' }, { status: 404 });
    const relation = Array.isArray(proposalOwner.customer_requirements) ? proposalOwner.customer_requirements[0] : proposalOwner.customer_requirements;
    if (!relation || relation.customer_id !== session.user_id) return NextResponse.json({ error: 'You can manage proposals only for your own requirement.' }, { status: 403 });

    const { data, error } = await supabase.rpc('customer_decide_requirement_proposal', {
      target_proposal_id: proposalId,
      target_decision: body.decision,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Proposal decision could not be saved.');
    return NextResponse.json({ proposal: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal decision could not be saved.';
    const status = /authentication|own requirement|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
