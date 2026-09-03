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

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireProvider(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_provider_requirement_leads');
    if (error) throw new Error(error.message);
    return NextResponse.json({ marketplace: data ?? { leads: [], proposals: [] } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load provider leads.' }, { status: 401 });
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
