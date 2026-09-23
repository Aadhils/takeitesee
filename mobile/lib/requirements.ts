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
