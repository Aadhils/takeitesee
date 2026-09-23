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

export async function fetchCustomerReviewForBooking(bookingId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ review: CustomerReview | null }>(`/api/reviews?bookingId=${encodeURIComponent(bookingId)}`, {
    method: 'GET',
    accessToken,
  });
}

export async function submitCustomerReview(input: { bookingId: string; rating: number; comment: string }) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('Choose a rating from 1 to 5 stars.');
  }
  const comment = input.comment.trim().slice(0, 1000);
  const accessToken = await currentAccessToken();
  return apiFetch<{ review: CustomerReview }>('/api/reviews', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      booking_id: input.bookingId,
      rating: input.rating,
      comment,
    }),
  });
}

export async function fetchProviderReviews() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ reviews: ProviderReview[]; summary: ProviderReviewSummary }>('/api/provider/reviews', {
    method: 'GET',
    accessToken,
  });
}

export async function saveProviderReviewResponse(reviewId: string, response: string) {
  const normalized = response.trim();
  if (normalized.length < 3 || normalized.length > 1000) {
    throw new Error('Response must be 3 to 1000 characters.');
  }
  const accessToken = await currentAccessToken();
  return apiFetch<{ review: unknown }>('/api/provider/reviews', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ review_id: reviewId, response: normalized }),
  });
}

export function stars(rating: number) {
  const normalized = Math.max(0, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(normalized)}${'☆'.repeat(5 - normalized)}`;
}
