import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PricingBasis = 'per_occurrence' | 'whole_requirement';
type ProposalRow = {
  id: string;
  proposal_reference: string;
  requirement_id: string;
  service_id: string;
  amount_minor: number;
  currency: 'INR' | 'USD';
  pricing_basis: PricingBasis;
  message: string;
  estimated_start_date: string | null;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'declined';
  submitted_at: string;
  decided_at: string | null;
};
type ProposalRecord = Record<string, unknown> & { id?: unknown; status?: unknown };
type MarketplacePayload = { leads?: unknown[]; proposals?: ProposalRecord[] };

export async function GET(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_provider_requirement_leads');
    if (error) throw new Error(error.message);

    const marketplace = data && typeof data === 'object' && !Array.isArray(data)
      ? data as MarketplacePayload
      : {};
    const proposals = Array.isArray(marketplace.proposals) ? marketplace.proposals : [];
    const acceptedProposalIds = proposals
      .filter((proposal) => proposal.status === 'accepted')
      .map((proposal) => String(proposal.id ?? '').trim())
      .filter(Boolean);

    let enrichedProposals = proposals;
    if (acceptedProposalIds.length) {
      const { data: conversations, error: conversationError } = await supabase
        .from('marketplace_conversations')
        .select('id,proposal_id')
        .eq('provider_user_id', session.user_id)
        .in('proposal_id', acceptedProposalIds);

      if (!conversationError) {
        const conversationByProposal = new Map(
          (conversations ?? []).map((conversation) => [String(conversation.proposal_id), String(conversation.id)]),
        );
        enrichedProposals = proposals.map((proposal) => ({
          ...proposal,
          conversation_id: conversationByProposal.get(String(proposal.id ?? '')) ?? null,
        }));
      }
    }

    return NextResponse.json({
      marketplace: {
        ...marketplace,
        leads: Array.isArray(marketplace.leads) ? marketplace.leads : [],
        proposals: enrichedProposals,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider leads.' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', session.user_id)
      .in('event_type', ['provider_requirement_match', 'requirement_proposal_accepted'])
      .is('read_at', null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to mark provider leads as seen.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const body = await request.json() as {
      requirement_id?: string;
      service_id?: string;
      amount_minor?: number;
      pricing_basis?: PricingBasis;
      message?: string;
      estimated_start_date?: string | null;
    };
    if (!body.requirement_id || !body.service_id || !Number.isInteger(body.amount_minor) || Number(body.amount_minor) <= 0) {
      return NextResponse.json({ error: 'Requirement, matching service and positive proposal amount are required.' }, { status: 400 });
    }
    const pricingBasis: PricingBasis = body.pricing_basis === 'whole_requirement' ? 'whole_requirement' : 'per_occurrence';
    const message = body.message?.trim() ?? '';
    if (message.length < 20 || message.length > 2000) {
      return NextResponse.json({ error: 'Proposal message must be 20 to 2000 characters.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('provider_submit_requirement_proposal', {
      target_requirement_id: body.requirement_id,
      target_service_id: body.service_id,
      target_amount_minor: body.amount_minor,
      target_message: message,
      target_estimated_start_date: body.estimated_start_date || null,
      target_pricing_basis: pricingBasis,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Proposal could not be submitted.');
    return NextResponse.json({ proposal: data as ProposalRow }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal could not be submitted.';
    const status = /authentication|provider account|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
