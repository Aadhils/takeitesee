import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomerSupabase } from '../../../../server/auth/customer-supabase';

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
type RequirementCatalog = {
  categories?: Array<{ id: string; name: string; code: string }>;
  locations?: Array<{ id: string; name: string; code: string; timezone?: string | null }>;
};

function fallbackProposalContext(proposal: ProposalRecord, status: MarketplaceEligibility) {
  return {
    ...proposal,
    provider_marketplace_status: status,
    provider_profile_href: null,
  };
}

function hydrateRequirementTaxonomy(requirement: Record<string, unknown>, catalogValue: unknown) {
  const catalog = (catalogValue ?? {}) as RequirementCatalog;
  const categoryId = String(requirement.category_id ?? '');
  const locationId = String(requirement.location_id ?? '');
  const category = catalog.categories?.find((row) => row.id === categoryId) ?? null;
  const location = catalog.locations?.find((row) => row.id === locationId) ?? null;
  return {
    ...requirement,
    platform_categories: category
      ? { name: category.name, code: category.code }
      : requirement.platform_categories,
    platform_locations: location
      ? { name: location.name, code: location.code, timezone: location.timezone ?? null }
      : requirement.platform_locations,
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
    return proposals.map((proposal) => fallbackProposalContext(proposal, 'unavailable'));
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await requireCustomerSupabase();
    const { requirementId } = await context.params;
    const [
      { data: requirement, error },
      { data: events, error: eventError },
      { data: proposals, error: proposalError },
      { data: conversation, error: conversationError },
      { data: catalog, error: catalogError },
    ] = await Promise.all([
      supabase
        .from('customer_requirements')
        .select('id,requirement_reference,customer_id,category_id,location_id,title,description,service_mode,budget_type,budget_min_minor,budget_max_minor,currency,needed_by,preferred_start_time,expected_duration_minutes,schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,recurrence_weekdays,status,published_at,closed_at,awarded_at,accepted_proposal_id,created_at,updated_at,platform_categories(name,code),platform_locations(name,code,timezone)')
        .eq('id', requirementId)
        .eq('customer_id', user.id)
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
        .eq('customer_id', user.id)
        .maybeSingle(),
      supabase.rpc('get_customer_requirement_catalog'),
    ]);
    if (error) throw new Error(error.message);
    if (!requirement) return NextResponse.json({ error: 'Requirement was not found.' }, { status: 404 });
    if (eventError) throw new Error(eventError.message);
    if (proposalError) throw new Error(proposalError.message);
    const enrichedProposals = await enrichProposalMarketplaceContext(proposals ?? []);
    const hydratedRequirement = hydrateRequirementTaxonomy(
      requirement as unknown as Record<string, unknown>,
      catalogError ? null : catalog,
    );
    return NextResponse.json({
      requirement: hydratedRequirement,
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
    const { supabase } = await requireCustomerSupabase();
    const { requirementId } = await context.params;
    const body = await request.json() as { status?: Status };
    if (!body.status || !['open', 'paused', 'fulfilled', 'cancelled'].includes(body.status)) {
      return NextResponse.json({ error: 'A valid requirement status is required.' }, { status: 400 });
    }
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
