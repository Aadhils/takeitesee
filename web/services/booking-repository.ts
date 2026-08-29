import type { BookingDraft, CustomerBooking, CustomerBookingId } from '../types/booking-domain';
import type { ProductionBooking } from '../types/production-domain';
import { isSupabaseConfigured } from '../lib/supabase/config';

const storageKey = 'takeitesee.customerBookings';
const bookingDraftKey = 'takeitesee.bookingDraft';

function readBookings(): CustomerBooking[] { if (typeof window === 'undefined') return []; try { const value = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(value) ? value as CustomerBooking[] : []; } catch { return []; } }
function writeBookings(bookings: CustomerBooking[]) { try { window.localStorage.setItem(storageKey, JSON.stringify(bookings)); } catch {} }
function createId() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function createReference(date: string) { const compactDate = date.replace(/-/g, '').slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, ''); return `TIS-${compactDate}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }

export function saveBookingDraft(draft: BookingDraft) { try { window.localStorage.setItem(bookingDraftKey, JSON.stringify(draft)); } catch {} }
export function getBookingDraft(): BookingDraft | undefined { if (typeof window === 'undefined') return undefined; try { const value = JSON.parse(window.localStorage.getItem(bookingDraftKey) ?? 'null'); return value && typeof value === 'object' ? value as BookingDraft : undefined; } catch { return undefined; } }
export function clearBookingDraft() { try { window.localStorage.removeItem(bookingDraftKey); } catch {} }

export function createBooking(draft: BookingDraft): CustomerBooking {
  const existing = readBookings().find((booking) => booking.idempotencyKey === draft.idempotencyKey);
  if (existing) return existing;
  const now = new Date().toISOString();
  const booking: CustomerBooking = { ...draft, bookingId: createId() as CustomerBookingId, bookingReference: createReference(draft.bookingDate), status: 'pending', paymentStatus: 'unpaid', createdAt: now, updatedAt: now };
  writeBookings([booking, ...readBookings()]); clearBookingDraft(); return booking;
}

export async function createBookingThroughConfiguredRepository(draft: BookingDraft): Promise<CustomerBooking> {
  if (!isSupabaseConfigured()) return createBooking(draft);
  const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_id: draft.serviceId, provider_id: draft.providerId, provider_type: draft.providerType, service_name: draft.serviceName, booking_date: draft.bookingDate, start_time: draft.startTime, timezone: draft.timezone, duration_minutes: draft.durationMinutes, location: draft.location, customer_notes: draft.customerNotes, quoted_price: draft.basePrice / 100, currency: draft.currency, idempotency_key: draft.idempotencyKey }) });
  const payload = await response.json() as { booking?: ProductionBooking; error?: string };
  if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Booking could not be created.');
  return fromProductionBooking({ ...payload.booking, created_at: new Date(payload.booking.created_at), updated_at: new Date(payload.booking.updated_at) });
}

function fromProductionBooking(booking: ProductionBooking): CustomerBooking {
  return { bookingId: booking.id, bookingReference: booking.booking_reference, idempotencyKey: '', customerId: booking.customer_id, serviceId: booking.service_id, providerId: booking.provider.provider_id, providerType: booking.provider.provider_type, providerName: booking.provider_name, serviceName: booking.service_name, customerName: '', bookingDate: booking.booking_date, startTime: booking.start_time, timezone: booking.timezone, durationMinutes: booking.duration_minutes, location: booking.location, customerNotes: booking.customer_notes, basePrice: Math.round(Number(booking.quoted_price) * 100), currency: booking.currency, paymentStatus: booking.payment_status === 'paid' ? 'paid' : booking.payment_status, status: booking.status, createdAt: booking.created_at.toISOString(), updatedAt: booking.updated_at.toISOString() };
}

export async function getBookingThroughConfiguredRepository(bookingId: CustomerBookingId) {
  if (!isSupabaseConfigured()) return getBookingById(bookingId);
  const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`);
  if (response.status === 404) return undefined;
  const payload = await response.json() as { booking?: ProductionBooking; error?: string };
  if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to load booking.');
  return fromProductionBooking({ ...payload.booking, created_at: new Date(payload.booking.created_at), updated_at: new Date(payload.booking.updated_at) });
}

export async function getBookingsThroughConfiguredRepository(customerId: string) {
  if (!isSupabaseConfigured()) return getBookingsForCustomer(customerId);
  const response = await fetch('/api/bookings'); const payload = await response.json() as { bookings?: ProductionBooking[]; error?: string };
  if (!response.ok || !payload.bookings) throw new Error(payload.error ?? 'Unable to load bookings.');
  return payload.bookings.map((booking) => fromProductionBooking({ ...booking, created_at: new Date(booking.created_at), updated_at: new Date(booking.updated_at) }));
}

export async function cancelBookingThroughConfiguredRepository(bookingId: CustomerBookingId, reason: string) {
  if (!isSupabaseConfigured()) return cancelBooking(bookingId);
  const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled', reason }) });
  const payload = await response.json() as { booking?: ProductionBooking; error?: string };
  if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to cancel booking.');
  return fromProductionBooking({ ...payload.booking, created_at: new Date(payload.booking.created_at), updated_at: new Date(payload.booking.updated_at) });
}

export async function rescheduleBookingThroughConfiguredRepository(bookingId: CustomerBookingId, bookingDate: string, startTime: string) {
  if (!isSupabaseConfigured()) return rescheduleBooking(bookingId, bookingDate, startTime);
  const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rescheduled', booking_date: bookingDate, start_time: startTime }) });
  const payload = await response.json() as { booking?: ProductionBooking; error?: string };
  if (!response.ok || !payload.booking) throw new Error(payload.error ?? 'Unable to reschedule booking.');
  return fromProductionBooking({ ...payload.booking, created_at: new Date(payload.booking.created_at), updated_at: new Date(payload.booking.updated_at) });
}

export function getBookingById(bookingId: CustomerBookingId) { return readBookings().find((booking) => booking.bookingId === bookingId); }
export function getBookingsForCustomer(customerId: string) { return readBookings().filter((booking) => booking.customerId === customerId); }
export function cancelBooking(bookingId: CustomerBookingId) { const bookings = readBookings(); const index = bookings.findIndex((booking) => booking.bookingId === bookingId); if (index < 0 || ['completed', 'cancelled'].includes(bookings[index].status)) return undefined; const updated = { ...bookings[index], status: 'cancelled' as const, updatedAt: new Date().toISOString() }; bookings[index] = updated; writeBookings(bookings); return updated; }
export function rescheduleBooking(bookingId: CustomerBookingId, bookingDate: string, startTime: string) { const bookings = readBookings(); const index = bookings.findIndex((booking) => booking.bookingId === bookingId); if (index < 0 || ['completed', 'cancelled'].includes(bookings[index].status)) return undefined; const updated = { ...bookings[index], bookingDate, startTime, status: 'rescheduled' as const, updatedAt: new Date().toISOString() }; bookings[index] = updated; writeBookings(bookings); return updated; }
