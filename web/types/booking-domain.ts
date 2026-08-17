import type { Currency, EntityId } from './entities';
import type { ServiceOwner } from './ownership';

export type CustomerBookingId = EntityId;
export type CustomerBookingStatus = 'pending' | 'confirmed' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
export type CustomerPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';

export interface CustomerBooking {
  bookingId: CustomerBookingId;
  bookingReference: string;
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
  paymentStatus: CustomerPaymentStatus;
  status: CustomerBookingStatus;
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
