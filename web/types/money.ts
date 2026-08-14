/**
 * Money and Currency Types
 *
 * Defines canonical money amount and currency representation
 * following the approved architecture.
 */

import type { Currency } from './entities';

/**
 * Money amount with currency
 * Represents a monetary value in a specific currency
 */
export interface Money {
  amount: number; // in smallest unit (e.g., paise for INR, cents for USD)
  currency: Currency;
}

/**
 * Safe money amount constructor
 * Validates that amount is a non-negative integer
 */
export function createMoney(amount: number, currency: Currency): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money amount must be an integer, got ${amount}`);
  }
  if (amount < 0) {
    throw new Error(`Money amount cannot be negative, got ${amount}`);
  }
  return { amount, currency };
}

/**
 * Money formatter for display
 */
export function formatMoney(money: Money): string {
  const divisor = money.currency === 'INR' ? 100 : 100;
  const decimalAmount = (money.amount / divisor).toFixed(2);
  return `${money.currency} ${decimalAmount}`;
}

/**
 * Pricing model for services
 */
export type PricingModel = 'fixed' | 'hourly' | 'negotiable';

/**
 * Service pricing
 */
export interface ServicePricing {
  base_price: Money;
  pricing_model: PricingModel;
  duration_minutes?: number; // for hourly pricing
}

/**
 * Commission types and rules
 */
export type CommissionType = 'percentage' | 'fixed' | 'hybrid' | 'tiered';

/**
 * Commission rule - data-driven, deterministic, and versioned
 */
export interface CommissionRule {
  id: string;
  name: string;
  rule_type: CommissionType;
  scope_type: CommissionScopeType;
  scope_id?: string; // provider_id, category_id, service_id, etc.
  category_id?: string;
  provider_id?: string;
  percentage_rate?: number; // 0-100
  fixed_amount?: Money;
  tier_definition?: CommissionTier[];
  promotional_flag: boolean;
  effective_from: Date;
  effective_to?: Date;
  status: 'active' | 'inactive';
  created_by: string;
  created_at: Date;
  priority?: number; // higher = higher precedence
}

/**
 * Scope types for commission rules
 */
export type CommissionScopeType =
  | 'global' // platform-wide default
  | 'provider' // provider-specific
  | 'category' // category-specific
  | 'service' // service-specific
  | 'professional' // professional-specific
  | 'business'; // business-specific

/**
 * Commission tier for tiered rules
 */
export interface CommissionTier {
  min_value: number;
  max_value?: number;
  rate: number; // percentage or absolute
}

/**
 * Commission rule version - immutable snapshot
 * Essential for audit trail and historical accuracy
 */
export interface CommissionRuleVersion {
  id: string;
  commission_rule_id: string;
  version: number;
  rule_payload: CommissionRule;
  created_by: string;
  created_at: Date;
}

/**
 * Commission calculation basis
 * How the commission was computed
 */
export type CommissionCalculationBasis = 'gross_amount' | 'net_amount' | 'service_fee';

/**
 * Transaction commission - selected rule version and computed commission
 * This captures the rule at processing time and never mutates
 */
export interface TransactionCommission {
  id: string;
  booking_id: string;
  payment_record_id: string;
  commission_rule_id: string;
  commission_rule_version_id: string;
  calculation_basis: CommissionCalculationBasis;
  percentage_rate?: number;
  fixed_amount?: Money;
  computed_amount: Money;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: Date;
}

/**
 * Commission precedence evaluation result
 * Deterministic result of applying precedence rules
 */
export interface CommissionPrecedenceResult {
  selected_rule_id: string;
  selected_rule_version_id: string;
  reason: string; // why this rule was selected
  precedence_level: number; // 1-6 (1=promotional, 6=fallback)
}
