import type { Currency, EntityId } from './entities';
import type { PlatformRole, ProviderReference } from './ownership';

export type ProductionBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
export type ProductionPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface CustomerProfileRecord {
  id: EntityId;
  user_id: EntityId;
  phone?: string;
  default_location?: string;
  created_at: Date;
  updated_at: Date;
}

export interface BusinessRecord {
  id: EntityId;
  owner_user_id: EntityId;
  name: string;
  description?: string;
  location?: string;
  verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProfessionalRecord {
  id: EntityId;
  user_id: EntityId;
  headline?: string;
  description?: string;
  service_area?: string;
  verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceRecord {
  id: EntityId;
  provider: ProviderReference;
  name: string;
  description: string;
  location?: string;
  duration_minutes: number;
  base_price: number;
  currency: Currency;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductionBooking {
  id: EntityId;
  booking_reference: string;
  customer_id: EntityId;
  service_id: EntityId;
  provider: ProviderReference;
  service_name: string;
  booking_date: string;
  start_time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  customer_notes?: string;
  quoted_price: number;
  currency: Currency;
  status: ProductionBookingStatus;
  payment_status: ProductionPaymentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface BookingStatusHistoryRecord {
  id: EntityId;
  booking_id: EntityId;
  from_status?: ProductionBookingStatus;
  to_status: ProductionBookingStatus;
  changed_by: EntityId;
  reason?: string;
  created_at: Date;
}

export interface ServerCustomerSession {
  user_id: EntityId;
  roles: readonly PlatformRole[];
  expires_at: Date;
}
