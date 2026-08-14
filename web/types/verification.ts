/**
 * Verification Domain Types
 *
 * Canonical verification model
 * Payment eligibility and platform trust are separate and must never be conflated
 */

import type { EntityId } from './entities';

/**
 * Entity types that can be verified or have eligibility status
 */
export type VerifiableEntityType =
  | 'user'
  | 'professional_profile'
  | 'business'
  | 'service';

/**
 * Payment eligibility status type
 * States whether a user/business is allowed to receive payments
 * Subject to onboarding and legal/compliance approval
 */
export type PaymentEligibilityStatusType =
  | 'pending_verification' // not yet verified
  | 'verified_eligible' // eligible to receive payments
  | 'verified_ineligible' // verified but not eligible
  | 'under_review' // under review
  | 'suspended' // temporarily suspended
  | 'permanently_ineligible'; // permanently not eligible

/**
 * Payment eligibility record
 */
export interface PaymentEligibilityRecord {
  id: EntityId;
  entity_type: VerifiableEntityType;
  entity_id: EntityId;
  provider_id?: EntityId; // payment provider (e.g., Cashfree)
  status: PaymentEligibilityStatusType;
  checked_at: Date;
  expires_at?: Date; // re-verification required
  reason_code?: string;
  created_at: Date;
  updated_at?: Date;
}

/**
 * Trust verification types
 * Platform-managed identity and business verification
 */
export type VerificationType =
  | 'identity' // personal ID verification
  | 'phone' // phone number verification
  | 'email' // email verification
  | 'address' // address verification
  | 'business_registration' // business registration verification
  | 'tax_id' // tax ID (GSTIN, PAN) verification
  | 'bank_account' // bank account ownership verification
  | 'service_quality'; // service quality verification

/**
 * Verification status
 */
export type VerificationStatus =
  | 'pending' // not yet reviewed
  | 'verified' // verified and approved
  | 'rejected' // verification failed
  | 'expired' // verification expired, re-verification required
  | 'under_review'; // currently under review

/**
 * Trust verification record - canonical verification status
 * Separate from payment eligibility status
 * Evidence and review history are separate from current status
 */
export interface TrustVerificationRecord {
  id: EntityId;
  entity_type: VerifiableEntityType;
  entity_id: EntityId;
  verification_type: VerificationType;
  status: VerificationStatus;
  evidence_reference?: string; // reference to stored evidence
  reviewed_by?: EntityId; // admin who reviewed
  reviewed_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at?: Date;
  expires_at?: Date; // re-verification required
}

/**
 * Verification evidence storage reference
 * Evidence is stored separately from the verification record
 */
export interface VerificationEvidence {
  id: EntityId;
  verification_record_id: EntityId;
  evidence_type: string; // document type, e.g., 'passport', 'driving_license'
  storage_reference: string; // reference to secured storage
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: EntityId;
  created_at: Date;
}

/**
 * Verification audit trail
 * Immutable record of all verification decisions and changes
 */
export interface VerificationAuditEntry {
  id: EntityId;
  verification_record_id: EntityId;
  previous_status: VerificationStatus;
  new_status: VerificationStatus;
  actor_user_id: EntityId; // admin who made the change
  reason: string;
  notes?: string;
  created_at: Date;
}

/**
 * Verification result
 */
export interface VerificationResult {
  record_id: EntityId;
  entity_type: VerifiableEntityType;
  entity_id: EntityId;
  verification_type: VerificationType;
  status: VerificationStatus;
  is_verified: boolean;
  verified_at?: Date;
  expires_at?: Date;
}

/**
 * Verification request
 * Initiated when a user/business needs verification
 */
export interface VerificationRequest {
  id: EntityId;
  entity_type: VerifiableEntityType;
  entity_id: EntityId;
  verification_type: VerificationType;
  status: 'requested' | 'submitted' | 'under_review' | 'completed' | 'cancelled';
  requested_at: Date;
  submitted_at?: Date;
  completed_at?: Date;
  completed_by?: EntityId;
  result?: VerificationResult;
}

/**
 * Professional verification checklist
 * Items required for a professional to operate on platform
 */
export interface ProfessionalVerificationChecklist {
  professional_id: EntityId;
  identity_verified: boolean;
  phone_verified: boolean;
  email_verified: boolean;
  service_quality_verified: boolean;
  is_ready_to_accept_bookings: boolean;
  is_ready_to_receive_payments: boolean;
  all_verified_at?: Date;
}

/**
 * Business verification checklist
 * Items required for a business to operate on platform
 */
export interface BusinessVerificationChecklist {
  business_id: EntityId;
  business_registration_verified: boolean;
  tax_id_verified: boolean;
  address_verified: boolean;
  owner_identity_verified: boolean;
  bank_account_verified: boolean;
  is_ready_to_accept_bookings: boolean;
  is_ready_to_receive_payments: boolean;
  all_verified_at?: Date;
}

/**
 * Important rule:
 * Verification evidence is stored separately from current operational status.
 * Status changes are recorded in append-only audit history.
 * No duplicate status fields on professional_profiles or businesses are used
 * as operational source of truth.
 */
