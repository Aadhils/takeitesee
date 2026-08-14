/**
 * Payment Lifecycle Types
 *
 * Canonical payment state machine and idempotency contracts
 * Defines allowed states and transitions for payment records
 */

import type { BookingId } from './booking';
import type { Currency, EntityId } from './entities';
import type { Money } from './money';

export type PaymentId = EntityId;
export type PaymentAmount = Money;

/**
 * Payment lifecycle states - canonical payment state machine
 * Payment state is the single source of truth for payment status
 */
export type PaymentStatus =
  | 'pending' // initial state, not yet sent to provider
  | 'initiated' // payment request sent to provider
  | 'authorized' // provider authorized the payment
  | 'captured' // payment captured/completed
  | 'failed' // payment failed
  | 'cancelled' // payment was cancelled before capture
  | 'partially_refunded' // partial refund issued
  | 'refunded' // full refund issued
  | 'disputed' // customer raised a dispute
  | 'settled' // settlement completed
  | 'closed'; // final terminal state

/**
 * Allowed transitions for payment state machine
 * Enforces safe progression through payment lifecycle
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['initiated'],
  initiated: ['authorized', 'failed', 'cancelled'],
  authorized: ['captured', 'failed'],
  captured: ['partially_refunded', 'refunded', 'disputed', 'settled'],
  failed: [],
  cancelled: [],
  partially_refunded: ['refunded', 'disputed'],
  refunded: ['closed'],
  disputed: ['settled', 'closed'],
  settled: ['closed'],
  closed: [],
};

/**
 * Validate payment state transition
 */
export function isAllowedPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Payment method types
 */
export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'net_banking'
  | 'upi'
  | 'wallet'
  | 'emi';

export type PaymentMethodType = PaymentMethod;

export type PaymentProviderCode = string & { readonly brand: 'PaymentProviderCode' };

export function createPaymentProviderCode(code: string): PaymentProviderCode {
  if (code.trim().length === 0) {
    throw new Error('Payment provider code cannot be empty');
  }
  return code as PaymentProviderCode;
}

export interface PaymentProvider {
  id: EntityId;
  code: PaymentProviderCode;
  name: string;
  settlement_model: 'provider_managed' | 'platform_managed';
  country_code: string;
  supported_currencies: Currency[];
  is_active: boolean;
  is_default: boolean;
  config_version: string;
  created_at: Date;
  updated_at?: Date;
}

export interface PaymentFailure {
  status: 'failed';
  failed_at: Date;
  reason_code: string;
  reason_message?: string;
  is_retryable: boolean;
}

export interface PaymentCancellation {
  status: 'cancelled';
  cancelled_at: Date;
  reason_code: 'customer_request' | 'provider_request' | 'timeout' | 'system_action' | 'other';
  reason?: string;
}

/**
 * Payment record - canonical payment lifecycle source of truth
 * This is the single authoritative record for payment status
 * No financial movement occurs without a related ledger entry
 */
export interface PaymentRecord {
  id: PaymentId;
  booking_id: BookingId;
  customer_id: EntityId;
  provider: PaymentProviderReference;
  provider_transaction_reference?: ProviderTransactionReference;
  payment_method: PaymentMethod;
  amount: PaymentAmount;
  currency: Currency;
  status: PaymentStatus;
  failure?: PaymentFailure;
  cancellation?: PaymentCancellation;
  initiated_at?: Date;
  authorized_at?: Date;
  captured_at?: Date;
  refunded_at?: Date;
  created_at: Date;
  updated_at: Date;
  idempotency_key: string; // unique per operation to prevent duplicates
}

export interface PaymentProviderReference {
  provider_id: EntityId;
  provider_code: PaymentProviderCode;
}

export interface ProviderTransactionReference {
  transaction_id?: string;
  payment_id?: string;
  order_id?: string;
}

/**
 * Payment attempt - underlying technical attempts for a payment
 * Multiple attempts may exist for a single payment_record
 */
export interface PaymentAttempt {
  id: EntityId;
  payment_record_id: EntityId;
  attempt_number: number;
  provider_operation: 'authorize' | 'capture' | 'refund' | 'payout' | 'settlement';
  idempotency_key: string; // unique per provider operation
  request_hash: string; // hash of request to detect duplicates
  response_code?: string;
  status: 'pending' | 'success' | 'failed' | 'duplicate';
  error_message?: string;
  created_at: Date;
}

/**
 * Payment failure information
 */
export interface PaymentFailureInfo {
  status: 'failed';
  failed_at: Date;
  reason_code: string;
  reason_message: string;
  is_retryable: boolean;
}

/**
 * Refund types
 */
export type RefundType = 'full' | 'partial';

/**
 * Refund record
 */
export interface Refund {
  id: EntityId;
  booking_id: EntityId;
  payment_record_id: EntityId;
  requested_by_user_id: EntityId;
  refund_type: RefundType;
  reason_code: string;
  amount: Money;
  status: 'requested' | 'approved' | 'processed' | 'rejected' | 'cancelled';
  policy_version: string;
  approved_by?: EntityId;
  created_at: Date;
  processed_at?: Date;
}

/**
 * Dispute types
 */
export type DisputeType = 'chargeback' | 'quality_issue' | 'non_delivery' | 'other';

/**
 * Dispute status
 */
export type DisputeStatus = 'raised' | 'acknowledged' | 'under_review' | 'resolved' | 'closed';

/**
 * Dispute record
 */
export interface Dispute {
  id: EntityId;
  booking_id: EntityId;
  payment_record_id: EntityId;
  raised_by_user_id: EntityId;
  dispute_type: DisputeType;
  status: DisputeStatus;
  evidence_reference?: string;
  summary: string;
  resolution?: string;
  resolved_by?: EntityId;
  created_at: Date;
  resolved_at?: Date;
}

/**
 * Ledger entry type - append-only financial history
 */
export type LedgerEntryType =
  | 'payment_capture' // payment captured
  | 'payment_refund' // refund issued
  | 'commission_debit' // commission charged
  | 'settlement_credit' // provider settlement
  | 'payout_debit' // payout issued
  | 'dispute_hold' // dispute hold on funds
  | 'dispute_release' // dispute release
  | 'adjustment'; // manual adjustment

/**
 * Ledger entry direction
 */
export type LedgerDirection = 'credit' | 'debit';

/**
 * Ledger entry - canonical append-only financial history
 * Essential for audit trail and financial reconciliation
 * No updates/deletes except explicit adjustments
 */
export interface LedgerEntry {
  id: EntityId;
  booking_id?: EntityId;
  payment_record_id?: EntityId;
  settlement_id?: EntityId;
  payout_event_id?: EntityId;
  refund_id?: EntityId;
  dispute_id?: EntityId;
  entry_type: LedgerEntryType;
  direction: LedgerDirection;
  amount: Money;
  balance_before: Money;
  balance_after: Money;
  actor_user_id?: EntityId;
  provider_event_id?: string;
  notes?: string;
  created_at: Date;
}

/**
 * Ledger invariants - MUST be true for every ledger entry
 */
export interface LedgerInvariant {
  // Every monetary event must have a corresponding ledger entry
  every_financial_movement_has_ledger_entry: true;

  // Every payout is tied to approved settlement
  every_payout_has_settlement: true;

  // Every commission has versioned rule reference
  every_commission_has_versioned_rule: true;

  // Every refund references payment or partial-payment
  every_refund_has_payment_reference: true;

  // Balance must never go negative without adjustment
  available_balance_never_negative_without_adjustment: true;

  // Every state transition has audit entry
  every_transition_has_audit_entry: true;
}
