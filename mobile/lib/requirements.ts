import { apiFetch } from './api';
import { supabase } from './supabase';

export type RequirementCatalogItem = {
  id: string;
  name: string;
  code: string;
};

export type RequirementLocation = RequirementCatalogItem & {
  timezone?: string | null;
};

export type RequirementCatalog = {
  categories: RequirementCatalogItem[];
  locations: RequirementLocation[];
};

export type CreatedRequirement = {
  id: string;
  reference: string;
  title: string;
  status: string;
};

export type CustomerRequirementSummary = {
  id: string;
  reference: string;
  category_id: string;
  category_name: string;
  location_id: string;
  location_name: string;
  title: string;
  description: string;
  service_mode: 'onsite' | 'remote' | 'either';
  budget_type: 'fixed' | 'range' | 'negotiable';
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: 'INR' | 'USD';
  needed_by: string | null;
  preferred_start_time: string | null;
  expected_duration_minutes: number | null;
  schedule_pattern: 'one_time' | 'recurring';
  status: 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
  published_at: string;
  accepted_proposal_id: string | null;
  proposal_count: number | null;
  submitted_proposal_count: number | null;
  unread_proposal_count: number | null;
  latest_proposal_reference: string | null;
  latest_proposal_at: string | null;
  latest_unread_proposal_reference: string | null;
};

export type RequirementDetailRow = {
  id: string;
  requirement_reference: string;
  title: string;
  description: string;
  service_mode: string;
  budget_type: 'fixed' | 'range' | 'negotiable';
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: 'INR' | 'USD';
  needed_by: string | null;
  preferred_start_time: string | null;
  expected_duration_minutes: number | null;
  schedule_pattern: 'one_time' | 'recurring';
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_interval: number | null;
  recurrence_count: number | null;
  recurrence_weekdays: number[] | null;
  status: 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled';
  published_at: string;
  accepted_proposal_id: string | null;
  platform_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
  platform_locations?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export type RequirementProposal = {
  id: string;
  proposal_reference: string;
  provider_display_name: string;
  provider_type: 'business' | 'professional';
  service_id: string;
  service_name: string;
  amount_minor: number;
  currency: 'INR' | 'USD';
  pricing_basis: 'per_occurrence' | 'whole_requirement';
  message: string;
  estimated_start_date: string | null;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'declined';
  submitted_at: string;
  decided_at: string | null;
  provider_marketplace_status?: 'eligible' | 'ineligible' | 'unavailable';
  provider_profile_href?: string | null;
};

export type RequirementDetailResponse = {
  requirement: RequirementDetailRow;
  events: Array<{
    id: string;
    event_type: 'created' | 'status_changed';
    from_status: string | null;
    to_status: string;
    created_at: string;
  }>;
  proposals: RequirementProposal[];
  conversation_id: string | null;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export async function fetchRequirementCatalog() {
  const accessToken = await currentAccessToken();
  return apiFetch<RequirementCatalog>('/api/requirements/catalog', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchCustomerRequirements() {
  const accessToken = await currentAccessToken();
  return apiFetch<{
    requirements: CustomerRequirementSummary[];
    proposal_attention_status: 'ready' | 'unavailable';
  }>('/api/requirements', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchCustomerRequirementDetail(requirementId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<RequirementDetailResponse>(`/api/requirements/${encodeURIComponent(requirementId)}`, {
    method: 'GET',
    accessToken,
  });
}

export async function decideCustomerRequirementProposal(
  requirementId: string,
  proposalId: string,
  decision: 'accept' | 'decline',
) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ proposal: unknown }>(
    `/api/requirements/${encodeURIComponent(requirementId)}/proposals/${encodeURIComponent(proposalId)}`,
    {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({ decision }),
    },
  );
}

export async function createOneTimeRequirement(input: {
  idempotencyKey: string;
  categoryId: string;
  locationId: string;
  title: string;
  description: string;
}) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ requirement: CreatedRequirement }>('/api/requirements', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      category_id: input.categoryId,
      location_id: input.locationId,
      title: input.title.trim(),
      description: input.description.trim(),
      service_mode: 'either',
      budget_type: 'negotiable',
      currency: 'INR',
      schedule_pattern: 'one_time',
      recurrence_frequency: null,
      recurrence_interval: null,
      recurrence_count: null,
      recurrence_weekdays: null,
    }),
  });
}

export function requirementRelationName(
  value: RequirementDetailRow['platform_categories'] | RequirementDetailRow['platform_locations'],
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name || '';
}

export function formatRequirementMoney(minor: number, currency: 'INR' | 'USD') {
  const amount = minor / 100;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function providerParamsFromProfileHref(href: string | null | undefined) {
  if (!href) return null;
  const professional = href.match(/^\/professionals\/([^/?#]+)$/);
  if (professional) {
    return { providerType: 'professional' as const, providerId: decodeURIComponent(professional[1]) };
  }
  const business = href.match(/^\/businesses\/([^/?#]+)$/);
  if (business) {
    return { providerType: 'business' as const, providerId: decodeURIComponent(business[1]) };
  }
  return null;
}
