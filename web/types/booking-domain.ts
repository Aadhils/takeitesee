import type { Currency, EntityId } from './entities';
import type { ServiceOwner } from './ownership';

export type CustomerBookingId = EntityId;
export type CustomerBookingStatus = 'pending' | 'confirmed' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
export type CustomerPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';
export type CustomerAttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
export type CustomerCloseoutState = 'open' | 'awaiting_customer' | 'support_open' | 'eligible_to_close' | 'closed';

export interface CustomerBooking {
  bookingId: CustomerBookingId;
  bookingReference: string;
  idempotencyKey: string;
  customerId: EntityId;
  serviceId: EntityId;
  providerId: EntityId;
  providerType: ServiceOwner['owner_type'];
  providerName?: string;
  serviceName: string;
  customerName: string;
  customerContactReference?: string;
  bookingDate: string;
  startTime: string;
  timezone: string;
  durationMinutes: number;
  location: string;
  customerNotes?: string;
  basePrice: number;
  currency: Currency;
  paymentStatus: CustomerPaymentStatus;
  status: CustomerBookingStatus;
  attendanceOutcome?: CustomerAttendanceOutcome;
  closeoutState?: CustomerCloseoutState;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDraft {
  idempotencyKey: string;
  customerId: EntityId;
  serviceId: EntityId;
  providerId: EntityId;
  providerType: ServiceOwner['owner_type'];
  serviceName: string;
  customerName: string;
  customerContactReference?: string;
  bookingDate: string;
  startTime: string;
  timezone: string;
  durationMinutes: number;
  location: string;
  customerNotes?: string;
  basePrice: number;
  currency: Currency;
}
