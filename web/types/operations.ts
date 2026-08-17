/**
 * Provider and business operational summary contracts.
 *
 * These are read-model shapes only. They do not calculate analytics or query
 * persistence, and financial values use the canonical money representation.
 */

import type { BookingId, BookingStatus } from './booking';
import type { ServiceId } from './catalog';
import type { EntityId } from './entities';
import type { Money } from './money';
import type { PaymentStatus } from './payment';
import type { ProviderReference } from './ownership';

export interface OperationalPeriod {
  starts_at: Date;
  ends_at: Date;
  timezone: string;
}

export interface BookingOperationalCounts {
  completed: number;
  cancelled: number;
  pending: number;
  total: number;
}

export interface RevenueAggregateReference {
  captured: Money;
  refunded: Money;
  net: Money;
  payment_statuses_included: readonly PaymentStatus[];
}

export interface RatingSummary {
  average_rating?: number;
  rating_count: number;
  distribution: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
}

export interface ServicePerformanceSummary {
  service_id: ServiceId;
  booking_counts: BookingOperationalCounts;
  rating: RatingSummary;
}

export interface ProviderOperationalSummary {
  provider: ProviderReference;
  period: OperationalPeriod;
  booking_counts: BookingOperationalCounts;
  revenue: RevenueAggregateReference;
  rating: RatingSummary;
  review_count: number;
  service_performance: readonly ServicePerformanceSummary[];
}

export interface BusinessOperationalSummary extends ProviderOperationalSummary {
  business_id: EntityId;
}

export interface OperationalSummaryQuery {
  owner_id: EntityId;
  period: OperationalPeriod;
  booking_statuses?: readonly BookingStatus[];
  service_ids?: readonly ServiceId[];
}

export interface OperationalSummaryRepository {
  get_provider_summary(query: OperationalSummaryQuery): Promise<ProviderOperationalSummary>;
  get_business_summary(query: OperationalSummaryQuery): Promise<BusinessOperationalSummary>;
}

export interface OperationalSummaryGeneratedEvent {
  id: EntityId;
  summary_type: 'provider' | 'business';
  owner_id: EntityId;
  period: OperationalPeriod;
  source_booking_ids: readonly BookingId[];
  generated_at: Date;
}
