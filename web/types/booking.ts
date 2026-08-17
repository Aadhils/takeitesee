/**
 * Booking and workflow foundation.
 *
 * Booking lifecycle is deliberately separate from payment lifecycle. Payment
 * records remain the source of truth for payment state, while this module
 * models service commitment, scheduling, completion, and operational outcomes.
 */

import type { AuthorizationContext } from './authorization';
import type { ServiceId } from './catalog';
import type { EntityId, Locale } from './entities';
import type { Money } from './money';
import type { Dispute, PaymentStatus, Refund } from './payment';
import type { ProviderReference } from './ownership';

export type BookingId = EntityId;

/** Booking lifecycle states, excluding payment states. */
export type BookingStatus =
  | 'draft'
  | 'requested'
  | 'provider_review'
  | 'rejected'
  | 'accepted'
  | 'reschedule_requested'
  | 'scheduled'
  | 'in_progress'
  | 'completion_pending'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'refund_pending'
  | 'closed';

/** Payment and dispute changes are represented by their own references. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ['requested', 'cancelled'],
  requested: ['provider_review', 'cancelled'],
  provider_review: ['accepted', 'rejected', 'reschedule_requested', 'cancelled'],
  rejected: ['closed'],
  accepted: ['scheduled', 'reschedule_requested', 'cancelled'],
  reschedule_requested: ['accepted', 'scheduled', 'cancelled'],
  scheduled: ['in_progress', 'reschedule_requested', 'cancelled', 'no_show'],
  in_progress: ['completion_pending', 'no_show'],
  completion_pending: ['completed', 'no_show'],
  completed: ['refund_pending', 'closed'],
  cancelled: ['refund_pending', 'closed'],
  no_show: ['refund_pending', 'closed'],
  refund_pending: ['closed'],
  closed: [],
};

export function isAllowedBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export class InvalidBookingTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Booking transition is not allowed: ${from} -> ${to}`);
    this.name = 'InvalidBookingTransitionError';
  }
}

/** Validates the lifecycle edge and rejects duplicate or forbidden transitions. */
export function assertAllowedBookingTransition(
  from: BookingStatus,
  to: BookingStatus
): void {
  if (from === to || !isAllowedBookingTransition(from, to)) {
    throw new InvalidBookingTransitionError(from, to);
  }
}

export function canStartBooking(booking: Pick<Booking, 'status' | 'schedule'>): boolean {
  return (
    booking.status === 'scheduled' &&
    booking.schedule !== undefined &&
    isAllowedBookingTransition(booking.status, 'in_progress')
  );
}

export function canCompleteBooking(
  booking: Pick<Booking, 'status' | 'schedule' | 'completion'>
): boolean {
  return (
    booking.status === 'completion_pending' &&
    booking.schedule !== undefined &&
    booking.completion?.status === 'confirmed' &&
    isAllowedBookingTransition(booking.status, 'completed')
  );
}

export type BookingRequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface BookingRequest {
  id: EntityId;
  booking_id: BookingId;
  requested_by_customer_id: EntityId;
  requested_at: Date;
  status: BookingRequestStatus;
  message?: string;
  locale?: Locale;
}

export type ProviderResponseStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'reschedule_proposed'
  | 'withdrawn';

export interface ProviderBookingResponse {
  id: EntityId;
  booking_id: BookingId;
  provider: ProviderReference;
  status: ProviderResponseStatus;
  message?: string;
  proposed_schedule?: BookingSchedule;
  responded_at?: Date;
  created_at: Date;
}

export interface BookingSchedule {
  starts_at: Date;
  ends_at: Date;
  timezone: string;
}

export type RescheduleStatus = 'proposed' | 'accepted' | 'declined' | 'withdrawn';

export interface RescheduleProposal {
  id: EntityId;
  booking_id: BookingId;
  proposed_by_user_id: EntityId;
  proposed_schedule: BookingSchedule;
  reason?: string;
  status: RescheduleStatus;
  created_at: Date;
  resolved_at?: Date;
}

export type CancellationStatus = 'requested' | 'approved' | 'rejected' | 'completed';

export type CancellationReason =
  | 'customer_request'
  | 'provider_request'
  | 'provider_failure'
  | 'schedule_conflict'
  | 'policy'
  | 'admin_action'
  | 'other';

export interface CancellationRequest {
  id: EntityId;
  booking_id: BookingId;
  requested_by_user_id: EntityId;
  reason: CancellationReason;
  notes?: string;
  status: CancellationStatus;
  requested_at: Date;
  resolved_at?: Date;
}

export type CompletionStatus = 'pending' | 'confirmed' | 'rejected';

export interface ServiceCompletion {
  id: EntityId;
  booking_id: BookingId;
  confirmed_by_user_id?: EntityId;
  status: CompletionStatus;
  notes?: string;
  confirmed_at?: Date;
}

export type NoShowParty = 'customer' | 'provider';

export interface NoShowRecord {
  id: EntityId;
  booking_id: BookingId;
  reported_by_user_id: EntityId;
  absent_party: NoShowParty;
  reason?: string;
  created_at: Date;
}

/** Operational dispute linkage; the authoritative dispute lifecycle is in payment.ts. */
export interface BookingDisputeReference {
  dispute: Dispute;
  freezes_settlement: true;
}

/** Payment status is observed here, never changed by booking transitions. */
export interface BookingPaymentReference {
  payment_record_id: EntityId;
  status: PaymentStatus;
}

export interface Booking {
  id: BookingId;
  customer_id: EntityId;
  service_id: ServiceId;
  requirement_id?: EntityId;
  provider: ProviderReference;
  booking_reference: string;
  status: BookingStatus;
  schedule?: BookingSchedule;
  quoted_amount: Money;
  payment?: BookingPaymentReference;
  dispute?: BookingDisputeReference;
  refund?: BookingRefundReference;
  cancellation?: CancellationRequest;
  completion?: ServiceCompletion;
  no_show?: NoShowRecord;
  notes?: string;
  metadata?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  deleted_at?: Date;
}

export type BookingStatusChangeReason =
  | 'customer_request'
  | 'provider_response'
  | 'reschedule'
  | 'schedule_reached'
  | 'service_started'
  | 'completion_confirmation'
  | 'no_show_reported'
  | 'cancellation_policy'
  | 'refund_required'
  | 'admin_action'
  | 'system_action'
  | 'other';

/** Append-only booking lifecycle timeline. */
export interface BookingStatusHistory {
  id: EntityId;
  booking_id: BookingId;
  previous_status: BookingStatus;
  new_status: BookingStatus;
  changed_by_user_id: EntityId;
  reason_code: BookingStatusChangeReason;
  idempotency_key: string;
  notes?: string;
  created_at: Date;
}

export type BookingAction =
  | 'create'
  | 'accept'
  | 'reject'
  | 'propose_reschedule'
  | 'respond_to_reschedule'
  | 'cancel'
  | 'start'
  | 'confirm_completion'
  | 'report_no_show'
  | 'request_refund';

/** Server-side policy input; client-supplied ownership must never be trusted. */
export interface BookingAuthorizationRequest {
  context: AuthorizationContext;
  booking_id: BookingId;
  action: BookingAction;
}

export interface BookingAuthorizationService {
  authorize(request: BookingAuthorizationRequest): Promise<boolean>;
}

export interface BookingRepository {
  get_booking(booking_id: BookingId): Promise<Booking | null>;
  save_booking(booking: Booking): Promise<Booking>;
  append_status_history(entry: BookingStatusHistory): Promise<void>;
  list_status_history(booking_id: BookingId): Promise<readonly BookingStatusHistory[]>;
}

export type BookingAuditEventType =
  | 'booking_created'
  | 'booking_status_changed'
  | 'provider_responded'
  | 'reschedule_proposed'
  | 'cancellation_requested'
  | 'completion_recorded'
  | 'no_show_recorded'
  | 'dispute_linked';

export interface BookingAuditEvent {
  id: EntityId;
  event_type: BookingAuditEventType;
  booking_id: BookingId;
  actor_user_id: EntityId;
  occurred_at: Date;
  reason?: string;
  previous_state?: Record<string, unknown>;
  next_state?: Record<string, unknown>;
}

export interface BookingAuditWriter {
  append(event: BookingAuditEvent): Promise<void>;
}

export interface BookingGateRules {
  provider_acceptance_required_before_schedule: true;
  provider_acceptance_required_before_start: true;
  schedule_required_before_start: true;
  completion_confirmation_required_before_complete: true;
  payment_state_does_not_advance_booking_state: true;
  dispute_freezes_settlement: true;
  every_transition_requires_unique_idempotency_key: true;
}

/** Existing requirement domain retained here because requirements can create bookings. */
export interface Requirement {
  id: EntityId;
  customer_id: EntityId;
  category_id: EntityId;
  title: string;
  description: string;
  budget_min: Money;
  budget_max?: Money;
  location_id?: EntityId;
  status: 'draft' | 'published' | 'closed' | 'deleted';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Response {
  id: EntityId;
  requirement_id: EntityId;
  provider: ProviderReference;
  message: string;
  proposed_price: Money;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: Date;
  updated_at: Date;
}

/** Refund decisions remain owned by the canonical payment/refund domain. */
export interface BookingRefundReference {
  refund: Refund;
  required_before_closure: boolean;
}
