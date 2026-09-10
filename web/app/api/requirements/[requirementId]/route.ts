import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ requirementId: string }> };
type Status = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
type MarketplaceEligibility = 'eligible' | 'ineligible' | 'unavailable';
type ProposalRecord = Record<string, unknown> & { service_id?: unknown };
type PublicServiceRow = {
  id: string;
  provider_type: 'professional' | 'business';
  professional_id: string | null;
  business_id: string | null;
};

function fallbackProposalContext(proposal: ProposalRecord, status: MarketplaceEligibility) {
  return {
    ...proposal,
    provider_marketplace_status: status,
    provider_profile_href: null,
  };
}

async function enrichProposalMarketplaceContext(value: unknown) {
  const proposals = Array.isArray(value)
    ? value.filter((proposal): proposal is ProposalRecord => Boolean(proposal) && typeof proposal === 'object')
    : [];
  if (!proposals.length) return [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return proposals.map((proposal) => fallbackProposalContext(proposal, 'unavailable'));

  const serviceIds = Array.from(new Set(
    proposals.map((proposal) => String(proposal.service_id ?? '').trim()).filter(Boolean),
  ));
  if (!serviceIds.length) return proposals.map((proposal) => fallbackProposalContext(proposal, 'unavailable'));

  try {
    const publicSupabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const services = new Map<string, PublicServiceRow>();
    const chunkSize = 200;
    for (let start = 0; start < serviceIds.length; start += chunkSize) {
      const { data, error } = await publicSupabase
        .from('services')
        .select('id,provider_type,professional_id,business_id')
        .in('id', serviceIds.slice(start, start + chunkSize));
      if (error) throw new Error(error.message);
      for (const row of data ?? []) services.set(String(row.id), row as PublicServiceRow);
    }

    return proposals.map((proposal) => {
      const service = services.get(String(proposal.service_id ?? ''));
      if (!service) return fallbackProposalContext(proposal, 'ineligible');
      const profileId = service.provider_type === 'business' ? service.business_id : service.professional_id;
      const providerProfileHref = profileId
        ? `/${service.provider_type === 'business' ? 'businesses' : 'professionals'}/${encodeURIComponent(profileId)}`
        : null;
      return {
        ...proposal,
        provider_marketplace_status: 'eligible' as const,
        provider_profile_href: providerProfileHref,
      };
    });
  } catch {
    // Public eligibility context is advisory UI data. A transient anon/RLS read failure
    // must not hide the customer's requirement; the accept RPC independently rechecks
    // Provider/service eligibility before awarding.
    return proposals.map((proposal) => fallbackProposalContext(proposal, 'unavailable'));
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const supabase = await createSupabaseServerClient();
    const [
      { data: requirement, error },
      { data: events, error: eventError },
      { data: proposals, error: proposalError },
      { data: conversation, error: conversationError },
    ] = await Promise.all([
      supabase
        .from('customer_requirements')
        .select('id,requirement_reference,customer_id,category_id,location_id,title,description,service_mode,budget_type,budget_min_minor,budget_max_minor,currency,needed_by,preferred_start_time,expected_duration_minutes,schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,recurrence_weekdays,status,published_at,closed_at,awarded_at,accepted_proposal_id,created_at,updated_at,platform_categories(name,code),platform_locations(name,code,timezone)')
        .eq('id', requirementId)
        .eq('customer_id', session.user_id)
        .maybeSingle(),
      supabase
        .from('customer_requirement_events')
        .select('id,event_type,from_status,to_status,created_at')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: true }),
      supabase.rpc('get_customer_requirement_proposals', { target_requirement_id: requirementId }),
      supabase
        .from('marketplace_conversations')
        .select('id,proposal_id,status')
        .eq('requirement_id', requirementId)
        .eq('customer_id', session.user_id)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    if (!requirement) return NextResponse.json({ error: 'Requirement was not found.' }, { status: 404 });
    if (eventError) throw new Error(eventError.message);
    if (proposalError) throw new Error(proposalError.message);
    const enrichedProposals = await enrichProposalMarketplaceContext(proposals ?? []);
    return NextResponse.json({
      requirement,
      events: events ?? [],
      proposals: enrichedProposals,
      conversation_id: conversationError ? null : conversation?.id ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requirement.' }, { status: 401 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await productionAuthProvider.requireCustomer(request);
    const { requirementId } = await context.params;
    const body = await request.json() as { status?: Status };
    if (!body.status || !['open', 'paused', 'fulfilled', 'cancelled'].includes(body.status)) {
      return NextResponse.json({ error: 'A valid requirement status is required.' }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('customer_update_requirement_status', {
      target_requirement_id: requirementId,
      target_status: body.status,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Requirement could not be updated.');
    return NextResponse.json({ requirement: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Requirement could not be updated.';
    const status = /authentication|own requirement|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
