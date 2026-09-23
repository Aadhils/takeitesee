import { apiFetch } from './api';
import { supabase } from './supabase';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
export type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
export type CloseoutState = 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed';
export type ProviderBookingAction = 'accept' | 'decline';

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

export type BookingAvailabilitySlot = {
  time: string;
  available: boolean;
  reason?: string;
};

export type BookingAvailabilityDay = {
  date: string;
  label: string;
  slots: BookingAvailabilitySlot[];
};

export type BookingAvailability = {
  mode: 'always_available' | 'on_request' | 'scheduled';
  timezone: string;
  duration_minutes: number;
  days: BookingAvailabilityDay[];
};

export type CreateCustomerBookingInput = {
  service_id: string;
  provider_id: string;
  provider_type: 'professional' | 'business';
  booking_date: string;
  time_label: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  quoted_price: number;
  currency: 'INR' | 'USD';
  idempotency_key: string;
  service_name: string;
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

export type ProviderAttendanceResult = {
  booking_id: string;
  attendance_outcome: AttendanceOutcome;
};

export type CustomerCompletionResult = {
  booking_id: string;
  attendance_outcome: AttendanceOutcome;
};

async function currentAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  return token;
}

function validateReason(reason: string) {
  const normalized = reason.trim();
  if (normalized.length < 3) throw new Error('Please enter a reason of at least 3 characters.');
  if (normalized.length > 500) throw new Error('Reason must be 500 characters or fewer.');
  return normalized;
}

function validateAttendanceNote(note: string) {
  const normalized = note.trim();
  if (normalized.length > 1000) throw new Error('No-show details must be 1000 characters or fewer.');
  return normalized;
}

export function bookingTimeTo24Hour(label: string) {
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return label;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = match[3].toUpperCase();
  if (suffix === 'AM' && hour === 12) hour = 0;
  if (suffix === 'PM' && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, '0')}:${minute}:00`;
}

export function isCurrentBookingSlot(booking: CustomerBooking, date: string, timeLabel: string) {
  return booking.booking_date === date && booking.start_time.slice(0, 5) === bookingTimeTo24Hour(timeLabel).slice(0, 5);
}

export async function fetchServiceBookingAvailability(serviceId: string) {
  if (!serviceId.trim()) throw new Error('Service is required.');
  return apiFetch<BookingAvailability>(`/api/services/${encodeURIComponent(serviceId)}/availability`, {
    method: 'GET',
  });
}

export async function createCustomerBooking(input: CreateCustomerBookingInput) {
  if (!input.service_id || !input.provider_id) throw new Error('Service and provider are required.');
  if (!input.booking_date || !input.time_label) throw new Error('Choose an available date and time.');
  if (!input.location.trim()) throw new Error('Service location is required.');
  if (!input.idempotency_key.trim()) throw new Error('Booking request key is required.');

  const accessToken = await currentAccessToken();
  return apiFetch<{ booking: CustomerBooking }>('/api/bookings', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      service_id: input.service_id,
      provider_id: input.provider_id,
      provider_type: input.provider_type,
      booking_date: input.booking_date,
      start_time: bookingTimeTo24Hour(input.time_label),
      timezone: input.timezone,
      duration_minutes: input.duration_minutes,
      location: input.location,
      quoted_price: input.quoted_price,
      currency: input.currency,
      idempotency_key: input.idempotency_key,
      service_name: input.service_name,
    }),
  });
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

export async function fetchCustomerBookingAvailability(bookingId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<BookingAvailability>(`/api/bookings/${encodeURIComponent(bookingId)}/availability`, {
    method: 'GET',
    accessToken,
  });
}

export async function cancelCustomerBooking(bookingId: string, reason: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<{ booking: CustomerBooking }>(`/api/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({
      status: 'cancelled',
      reason: validateReason(reason),
    }),
  });
}

export async function rescheduleCustomerBooking(
  bookingId: string,
  bookingDate: string,
  timeLabel: string,
  reason: string,
) {
  if (!bookingDate || !timeLabel) throw new Error('Choose a new date and time.');
  const accessToken = await currentAccessToken();
  return apiFetch<{ booking: CustomerBooking }>(`/api/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({
      status: 'rescheduled',
      booking_date: bookingDate,
      start_time: bookingTimeTo24Hour(timeLabel),
      reason: validateReason(reason),
    }),
  });
}

export async function confirmCustomerServiceCompletion(bookingId: string) {
  const accessToken = await currentAccessToken();
  return apiFetch<CustomerCompletionResult>(`/api/bookings/${encodeURIComponent(bookingId)}/attendance`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ action: 'confirm_completion' }),
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

export async function transitionProviderBooking(
  bookingId: string,
  action: ProviderBookingAction,
  reason?: string,
) {
  const accessToken = await currentAccessToken();
  const body = action === 'decline'
    ? { action, reason: validateReason(reason ?? '') }
    : { action };

  return apiFetch<{ booking: ProviderBooking }>(`/api/provider/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function reportProviderCustomerNoShow(bookingId: string, note = '') {
  const accessToken = await currentAccessToken();
  const normalizedNote = validateAttendanceNote(note);
  return apiFetch<ProviderAttendanceResult>(`/api/provider/bookings/${encodeURIComponent(bookingId)}/attendance`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      action: 'report_customer_no_show',
      note: normalizedNote || undefined,
    }),
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
