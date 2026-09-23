import { apiFetch } from './api';
import { supabase } from './supabase';

export type ProviderRequirementLead = {
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
  published_at: string;
  category_name: string;
  location_name: string;
  matching_service_id: string;
  already_proposed: boolean;
};

export type ProviderRequirementProposal = {
  id: string;
  proposal_reference: string;
  requirement_id: string;
  service_id: string;
  amount_minor: number;
  currency: 'INR' | 'USD';
  pricing_basis: 'per_occurrence' | 'whole_requirement';
  message: string;
  estimated_start_date: string | null;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'declined';
  submitted_at: string;
  decided_at: string | null;
  requirement_reference: string;
  requirement_title: string;
  requirement_status: string;
  category_name: string;
  location_name: string;
  conversation_id?: string | null;
};

export type ProviderRequirementMarketplace = {
  leads: ProviderRequirementLead[];
  proposals: ProviderRequirementProposal[];
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Provider authentication required.');
  return token;
}

export async function fetchProviderRequirementLeads() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ marketplace: ProviderRequirementMarketplace }>('/api/provider/requirement-leads', {
    method: 'GET',
    accessToken,
  });
}

export async function markProviderRequirementLeadsSeen() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ ok: true }>('/api/provider/requirement-leads', {
    method: 'PATCH',
    accessToken,
  });
}

export async function submitOneTimeRequirementProposal(input: {
  requirementId: string;
  serviceId: string;
  amountMinor: number;
  message: string;
  estimatedStartDate?: string | null;
}) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ proposal: ProviderRequirementProposal }>('/api/provider/requirement-leads', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      requirement_id: input.requirementId,
      service_id: input.serviceId,
      amount_minor: input.amountMinor,
      pricing_basis: 'per_occurrence',
      message: input.message.trim(),
      estimated_start_date: input.estimatedStartDate || null,
    }),
  });
}

export function formatProviderLeadMoney(minor: number | null, currency: 'INR' | 'USD') {
  if (minor == null) return '';
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
