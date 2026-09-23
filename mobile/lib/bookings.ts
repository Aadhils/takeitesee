import { apiFetch } from './api';
import { supabase } from './supabase';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
export type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
export type CloseoutState = 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed';

export type BookingProvider = {
  provider_type: 'professional' | 'business';
  provider_id: string;
  professional_id?: string;
  business_id?: string;
};

export type CustomerBooking = {
  id: string;
  booking_reference: string;
  customer_id: string;
  service_id: string;
  provider: BookingProvider;
  provider_name?: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  customer_notes?: string;
  quoted_price: number;
  currency: 'INR' | 'USD';
  status: BookingStatus;
  attendance_outcome?: AttendanceOutcome;
  closeout_state?: CloseoutState;
  closed_at?: string;
  created_at: string;
  updated_at: string;
};

export type ProviderBookingHistoryEntry = {
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  reason?: string;
  created_at: string;
};

export type ProviderBooking = {
  id: string;
  booking_reference: string;
  customer_id: string;
  service_id: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  customer_notes?: string;
  quoted_price: number;
  currency: 'INR' | 'USD';
  status: BookingStatus;
  provider_type: 'professional' | 'business';
  provider_id: string;
  provider_name: string;
  created_at: string;
  updated_at: string;
  history: ProviderBookingHistoryEntry[];
  attendance_outcome: AttendanceOutcome;
  closeout_state?: CloseoutState;
  closed_at?: string;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

export async function fetchCustomerBookings() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ bookings: CustomerBooking[] }>('/api/bookings', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchCustomerBooking(bookingId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ booking: CustomerBooking }>(`/api/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchProviderBookings() {
  const accessToken = await currentAccessToken();
  return apiFetch<{ bookings: ProviderBooking[] }>('/api/provider/bookings', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchProviderBooking(bookingId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ booking: ProviderBooking }>(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'GET',
    accessToken,
  });
}

export function formatBookingMoney(amount: number, currency: 'INR' | 'USD') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatBookingTime(startTime: string) {
  return startTime ? startTime.slice(0, 5) : 'Flexible';
}

export function formatBookingStatus(status: string) {
  return status.replaceAll('_', ' ');
}
