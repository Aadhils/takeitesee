/**
 * Booking Lifecycle Types
 *
 * Canonical booking state machine and lifecycle models
 * Tied to provider action, payment state, and refund/dispute logic
 */

import type { EntityId } from './entities';
import type { Money } from './money';
import type { ProviderReference } from './ownership';

/**
 * Booking lifecycle states
 * Captures the entire lifecycle from request to closure
 */
export type BookingStatus =
  | 'draft' // customer creating booking
  | 'submitted' // submitted for provider review
  | 'pending_provider_acceptance' // waiting for provider response
  | 'accepted' // provider accepted
  | 'scheduled' // scheduled/confirmed
  | 'in_progress' // service in progress
  | 'awaiting_completion' // waiting for completion confirmation
  | 'completed' // service completed
  | 'payment_pending' // payment pending
  | 'payment_confirmed' // payment confirmed
  | 'paid' // payment received
  | 'cancelled' // booking cancelled
  | 'refunded' // refund issued
  | 'disputed' // under dispute
  | 'closed'; // final state

/**
 * Allowed booking state transitions
 * Enforces safe progression through booking lifecycle
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ['submitted'],
  submitted: ['pending_provider_acceptance'],
  pending_provider_acceptance: ['accepted', 'cancelled'],
  accepted: ['scheduled'],
  scheduled: ['in_progress'],
  in_progress: ['awaiting_completion'],
  awaiting_completion: ['completed'],
  completed: ['payment_pending'],
  payment_pending: ['payment_confirmed'],
  payment_confirmed: ['paid'],
  paid: ['refunded', 'disputed'],
  cancelled: ['refunded', 'closed'],
  refunded: ['closed'],
  disputed: ['paid', 'refunded', 'closed'],
  closed: [],
};

/**
 * Validate booking state transition
 */
export function isAllowedBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Booking entity - finalized service order or booking
 */
export interface Booking {
  id: EntityId;
  customer_id: EntityId;
  service_id: EntityId;
  requirement_id?: EntityId;
  provider: ProviderReference; // discriminated union - professional or business
  booking_reference: string; // unique reference for customer
  status: BookingStatus;
  subtotal_amount: Money;
  tax_amount: Money;
  platform_fee_amount: Money;
  provider_payout_amount: Money;
  scheduled_start_at: Date;
  scheduled_end_at: Date;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  deleted_at?: Date;
}

/**
 * Booking status change reason codes
 */
export type BookingStatusChangeReason =
  | 'customer_request'
  | 'provider_request'
  | 'admin_action'
  | 'system_action'
  | 'payment_completed'
  | 'payment_failed'
  | 'refund_processed'
  | 'dispute_resolved'
  | 'cancellation_policy'
  | 'service_completion'
  | 'other';

/**
 * Booking status history - append-only timeline
 */
export interface BookingStatusHistory {
  id: EntityId;
  booking_id: EntityId;
  previous_status: BookingStatus;
  new_status: BookingStatus;
  changed_by_user_id: EntityId;
  reason_code: BookingStatusChangeReason;
  notes?: string;
  created_at: Date;
}

/**
 * Requirement entity - customer posted service request
 */
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

/**
 * Response entity - provider response to a requirement
 */
export interface Response {
  id: EntityId;
  requirement_id: EntityId;
  provider: ProviderReference; // professional or business
  message: string;
  proposed_price: Money;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: Date;
  updated_at: Date;
}

/**
 * Booking gate rules
 * Safety constraints on booking state transitions
 */
export interface BookingGateRules {
  // A booking cannot enter payment-confirmed without valid payment record
  payment_confirmed_requires_valid_payment_record: true;

  // A booking cannot be completed without provider acceptance and schedule
  completed_requires_acceptance_and_schedule: true;

  // Cancellation or failure triggers refund path but doesn't bypass ledger rules
  cancellation_triggers_refund_path: true;

  // Dispute freezes settlement until resolution
  dispute_freezes_settlement: true;
}

/**
 * Service completion confirmation
 */
export interface ServiceCompletionConfirmation {
  booking_id: EntityId;
  confirmed_by: EntityId; // customer or provider
  completion_notes?: string;
  confirmed_at: Date;
}

/**
 * Cancellation policy types
 */
export type CancellationPolicyType =
  | 'full_refund_anytime'
  | 'refund_until_scheduled'
  | 'refund_with_penalty'
  | 'no_refund_after_accepted';

/**
 * Cancellation outcome
 */
export interface CancellationOutcome {
  booking_id: EntityId;
  cancelled_by: EntityId;
  cancellation_reason: string;
  policy_applied: CancellationPolicyType;
  refund_amount: Money;
  status: 'pending' | 'refund_issued' | 'no_refund';
  cancelled_at: Date;
}
