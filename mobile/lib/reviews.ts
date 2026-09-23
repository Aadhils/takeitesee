import { apiFetch } from './api';
import { supabase } from './supabase';

export type CustomerReview = {
  id: string;
  booking_id: string;
  service_id: string;
  rating: number;
  comment: string | null;
  status: string;
  provider_response: string | null;
  provider_responded_at: string | null;
  created_at: string;
};

export type ProviderReview = {
  id: string;
  booking_id: string;
  service_id: string;
  service_name: string;
  rating: number;
  comment: string;
  provider_response: string;
  provider_responded_at: string | null;
  provider_response_updated_at: string | null;
  created_at: string;
};

export type ProviderReviewSummary = {
  total: number;
  average: number;
  counts: Record<number, number>;
  five_star_share: number;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export async function fetchCustomerReviews() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ reviews: CustomerReview[] }>('/api/reviews', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchProviderReviews() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ reviews: ProviderReview[]; summary: ProviderReviewSummary }>('/api/provider/reviews', {
    method: 'GET',
    accessToken,
  });
}

export function stars(rating: number) {
  const normalized = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(normalized)}${'☆'.repeat(5 - normalized)}`;
}
