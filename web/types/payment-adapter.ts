/**
 * Provider-Agnostic Payment Adapter Contracts
 *
 * Defines the provider abstraction layer that allows multiple payment providers
 * (Cashfree as India-first preferred, with potential for Razorpay or others)
 * without hard-coupling core logic to any single provider.
 *
 * The architecture ensures:
 * - Cashfree is preferred for India operations but not required
 * - Payment logic is decoupled from provider implementation
 * - Settlement is provider-managed and not directly coupled to payment capture
 * - Provider-specific data is normalized into standard domain models
 */

import type { EntityId, Currency } from './entities';
import type { Money } from './money';

/**
 * Payment provider identification and configuration
 */
export interface PaymentProvider {
  id: EntityId;
  code: 'cashfree' | 'razorpay' | string; // extensible for future providers
  name: string;
  is_active: boolean;
  is_default: boolean; // is this the default provider for a region
  settlement_model: 'provider_managed' | 'platform_managed';
  country_code: string; // e.g., 'IN' for India
  supported_currencies: Currency[];
  config_version: string;
  created_at: Date;
  updated_at?: Date;
}

/**
 * Payment provider settlement models
 */
export type SettlementModel =
  | 'provider_managed' // provider manages settlement and payout
  | 'platform_managed'; // platform manages settlement and payout

/**
 * Payment adapter interface - provider-agnostic contract
 * All provider implementations must conform to this interface
 */
export interface IPaymentAdapter {
  /**
   * Provider identifier
   */
  provider_code: string;

  /**
   * Initialize a payment/checkout intent
   * Creates a payment intent on the provider and returns checkout URL/token
   */
  initiate_checkout(params: CheckoutInitParams): Promise<CheckoutInitResponse>;

  /**
   * Verify payment status with provider
   * Queries provider for latest payment status
   */
  verify_payment(params: PaymentVerificationParams): Promise<PaymentVerificationResponse>;

  /**
   * Process a refund request
   */
  process_refund(params: RefundParams): Promise<RefundResponse>;

  /**
   * Parse and validate a webhook event from provider
   */
  parse_webhook_event(payload: unknown, signature: string): Promise<WebhookEventParsed>;

  /**
   * Verify provider webhook signature
   */
  verify_webhook_signature(payload: unknown, signature: string): Promise<boolean>;

  /**
   * Get provider-specific payment method list
   */
  get_payment_methods(): Promise<PaymentMethodInfo[]>;

  /**
   * Provider-specific payout/settlement details (if supported)
   */
  get_settlement_details?(params: SettlementQueryParams): Promise<SettlementDetails>;
}

/**
 * Checkout initialization parameters
 * Normalized input that all providers must accept
 */
export interface CheckoutInitParams {
  idempotency_key: string; // unique per checkout attempt
  customer_id: EntityId;
  booking_id: EntityId;
  amount: Money;
  customer_email: string;
  customer_phone: string;
  customer_name: string;
  order_reference: string; // booking reference
  redirect_url: string; // post-payment return URL
  metadata?: Record<string, string>; // provider-specific metadata
  locale?: string;
}

/**
 * Checkout response from provider
 */
export interface CheckoutInitResponse {
  provider_transaction_id: string;
  checkout_url?: string; // for redirect flow
  checkout_token?: string; // for hosted payment form
  expires_at: Date;
  payment_method_options?: PaymentMethodInfo[]; // available methods for this checkout
  provider_response: unknown; // raw provider response for debugging
}

/**
 * Payment verification parameters
 */
export interface PaymentVerificationParams {
  provider_transaction_id: string;
  provider_payment_id?: string;
  idempotency_key: string;
}

/**
 * Payment verification response
 */
export interface PaymentVerificationResponse {
  provider_payment_id: string;
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';
  amount: Money;
  payment_method: PaymentMethodType;
  created_at: Date;
  captured_at?: Date;
  failed_at?: Date;
  failure_code?: string;
  failure_message?: string;
  provider_response: unknown; // raw provider response
}

/**
 * Refund parameters
 */
export interface RefundParams {
  provider_payment_id: string;
  refund_amount?: Money; // undefined = full refund
  idempotency_key: string;
  reason?: string;
}

/**
 * Refund response
 */
export interface RefundResponse {
  provider_refund_id: string;
  provider_payment_id: string;
  refund_amount: Money;
  status: 'initiated' | 'processed' | 'failed';
  refunded_at?: Date;
  failure_code?: string;
  failure_message?: string;
  provider_response: unknown;
}

/**
 * Webhook event parsed from provider
 * Normalized from provider-specific format to domain model
 */
export interface WebhookEventParsed {
  provider_event_id: string; // unique provider event ID for idempotency
  provider_event_type: string; // e.g., 'payment.success', 'refund.completed'
  domain_event_type: DomainWebhookEventType;
  provider_payment_id: string;
  booking_id?: EntityId;
  customer_id?: EntityId;
  amount?: Money;
  status: string;
  created_at: Date;
  metadata?: Record<string, unknown>;
  raw_payload: unknown; // raw provider payload for audit
}

/**
 * Domain-level webhook event types
 * Providers must map their events to these standard types
 */
export type DomainWebhookEventType =
  | 'payment_authorized'
  | 'payment_captured'
  | 'payment_failed'
  | 'refund_initiated'
  | 'refund_completed'
  | 'settlement_completed'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'other';

/**
 * Payment method info
 */
export interface PaymentMethodInfo {
  type: PaymentMethodType;
  display_name: string;
  is_available: boolean;
  description?: string;
  icon_url?: string;
}

export type PaymentMethodType =
  | 'credit_card'
  | 'debit_card'
  | 'net_banking'
  | 'upi'
  | 'wallet'
  | 'emi';

/**
 * Settlement query parameters
 */
export interface SettlementQueryParams {
  provider_payment_id: string;
  settlement_period_start?: Date;
  settlement_period_end?: Date;
}

/**
 * Settlement details from provider
 */
export interface SettlementDetails {
  provider_settlement_id: string;
  status: 'pending' | 'settled' | 'failed';
  gross_amount: Money;
  settlement_amount: Money;
  settlement_fee?: Money;
  settled_at?: Date;
  settling_into?: {
    bank_account_last_4: string;
    account_holder_name: string;
  };
  provider_response: unknown;
}

/**
 * Provider webhook event storage
 * Durable log for webhook ingestion and reconciliation
 */
export interface WebhookEvent {
  id: EntityId;
  provider_id: EntityId;
  provider_event_type: string;
  provider_event_id: string;
  raw_payload: unknown;
  signature_verified: boolean;
  processing_status: 'pending' | 'processed' | 'failed' | 'skipped';
  idempotency_key: string;
  processed_at?: Date;
  failure_reason?: string;
  created_at: Date;
}

/**
 * Provider adapter factory
 * Returns appropriate adapter for given provider code
 */
export interface IPaymentAdapterFactory {
  get_adapter(provider_code: string): Promise<IPaymentAdapter | null>;
  get_default_adapter(): Promise<IPaymentAdapter>;
  list_active_adapters(): Promise<IPaymentAdapter[]>;
}

/**
 * Important design constraints for adapters:
 *
 * 1. No provider-specific assumptions in core domain
 *    - Provider-specific fields must be in metadata, not core fields
 *    - Provider implementation must map to standard contracts only
 *
 * 2. Idempotency is mandatory
 *    - Every operation must have unique idempotency key
 *    - Duplicate requests must be detected and rejected without side effects
 *
 * 3. Webhook deduplication required
 *    - Use provider_event_id + transaction reference for deduplication
 *    - Duplicate events must not create multiple financial records
 *
 * 4. Signature verification required
 *    - All webhooks must be verified before processing
 *    - Unverified payloads must be rejected or quarantined
 *
 * 5. Provider failures must not silently mutate state
 *    - Provider errors must trigger explicit reconciliation workflow
 *    - System must enter reconciliation state when provider data is inconsistent
 *
 * 6. Settlement is provider-managed by default
 *    - Payment capture and settlement are separate events
 *    - Provider manages settlement execution, platform records result
 */
