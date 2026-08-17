/**
 * Security, data protection, and RLS-readiness foundation.
 *
 * These contracts describe server-side policy inputs and immutable security
 * records. They do not implement authentication, persistence, or RLS SQL.
 */

import type {
  AuthorizationAction,
  AuthorizationContext,
  AuthorizationDecision,
  ResourceType,
} from './authorization';
import type { EntityId } from './entities';
import type { PlatformRole, RoleAssignment, RoleScopeType } from './ownership';

export type SecurityActor = AuthorizationContext;
export type Permission = AuthorizationAction;

export type ProtectedResourceType =
  | ResourceType
  | 'notification'
  | 'verification_evidence'
  | 'file_upload'
  | 'operational_summary';

export type ResourceScope =
  | { scope_type: 'user'; scope_id: EntityId }
  | { scope_type: 'professional_profile'; scope_id: EntityId }
  | { scope_type: 'business'; scope_id: EntityId }
  | { scope_type: 'service'; scope_id: EntityId }
  | { scope_type: 'booking'; scope_id: EntityId }
  | { scope_type: 'global' };

export type ResourceOwnership =
  | { owner_type: 'user'; owner_id: EntityId }
  | { owner_type: 'professional'; owner_id: EntityId }
  | { owner_type: 'business'; owner_id: EntityId }
  | { owner_type: 'system'; owner_id: EntityId };

export interface ProtectedResource {
  resource_type: ProtectedResourceType;
  resource_id: EntityId;
  scope: ResourceScope;
  ownership?: ResourceOwnership;
}

export type SecurityDenialReason =
  | 'unauthenticated'
  | 'default_deny'
  | 'missing_role'
  | 'missing_scope'
  | 'ownership_mismatch'
  | 'resource_not_found'
  | 'resource_suspended'
  | 'sensitive_data_restricted'
  | 'admin_boundary'
  | 'verification_required'
  | 'policy_conflict'
  | 'integrity_failure';

export interface SecurityFailure {
  code: SecurityDenialReason;
  message: string;
  resource_type?: ProtectedResourceType;
  resource_id?: EntityId;
}

export interface SecurityAuthorizationRequest {
  actor: SecurityActor | null;
  resource: ProtectedResource;
  action: Permission;
  required_scope?: RoleScopeType;
}

export interface SecurityAuthorizationDecision extends AuthorizationDecision {
  allowed: boolean;
  evaluated_server_side: true;
  default_deny_applied: boolean;
  actor_id?: EntityId;
  failure?: SecurityFailure;
}

export interface SecurityPolicyEvaluator {
  evaluate(request: SecurityAuthorizationRequest): Promise<SecurityAuthorizationDecision>;
}

export interface OwnershipCheck {
  resource: ProtectedResource;
  actor_id: EntityId;
  ownership_matches: boolean;
  checked_server_side: true;
}

export interface ScopeCheck {
  actor_id: EntityId;
  required_scope: ResourceScope;
  assignments: readonly RoleAssignment[];
  scope_matches: boolean;
}

export type SensitiveDataClassification =
  | 'public'
  | 'internal'
  | 'personal'
  | 'sensitive_personal'
  | 'financial'
  | 'authentication_secret'
  | 'verification_evidence';

export interface SensitiveFieldPolicy {
  field_name: string;
  classification: SensitiveDataClassification;
  readable_by: readonly PlatformRole[];
  writable_by: readonly PlatformRole[];
  redact_in_logs: boolean;
  encrypt_at_rest: boolean;
}

export interface DataAccessPolicy {
  resource_type: ProtectedResourceType;
  default_effect: 'deny';
  fields: readonly SensitiveFieldPolicy[];
  requires_server_authorization: true;
  requires_audit_event: boolean;
}

export type RetentionBasis = 'legal' | 'regulatory' | 'security' | 'operational' | 'user_request';

export interface RetentionPolicy {
  policy_id: string;
  resource_type: ProtectedResourceType;
  retain_for_days: number;
  basis: RetentionBasis;
  deletion_mode: 'hard_delete' | 'anonymize' | 'archive';
  legal_hold_supported: boolean;
  review_at?: Date;
}

export type SecurityEventType =
  | 'authorization_allowed'
  | 'authorization_denied'
  | 'admin_action'
  | 'moderation_action'
  | 'role_scope_changed'
  | 'sensitive_data_accessed'
  | 'file_security_checked'
  | 'webhook_integrity_checked'
  | 'retention_action';

export interface ImmutableSecurityEvent {
  id: EntityId;
  event_type: SecurityEventType;
  actor_user_id?: EntityId;
  resource_type: ProtectedResourceType;
  resource_id: EntityId;
  action: Permission;
  occurred_at: Date;
  outcome: 'allowed' | 'denied' | 'recorded';
  reason?: string;
  previous_state?: Readonly<Record<string, unknown>>;
  next_state?: Readonly<Record<string, unknown>>;
  correlation_id: string;
  integrity_hash: string;
}

export interface SecurityEventWriter {
  append(event: ImmutableSecurityEvent): Promise<void>;
}

export interface AdministrativeActionContext {
  actor: SecurityActor;
  target: ProtectedResource;
  action: 'approve' | 'reject' | 'suspend' | 'restore' | 'delete' | 'manage';
  justification: string;
  requires_elevated_role: true;
  audit_event_required: true;
}

export interface ModerationActionContext {
  actor: SecurityActor;
  target: ProtectedResource;
  action: 'approve' | 'reject' | 'hide' | 'remove' | 'restore';
  reason: string;
  audit_event_required: true;
}

export interface FileSecurityMetadata {
  file_id: EntityId;
  owner_id: EntityId;
  classification: SensitiveDataClassification;
  mime_type: string;
  size_bytes: number;
  content_hash: string;
  storage_reference: string;
  malware_scan_status: 'pending' | 'clean' | 'quarantined' | 'failed';
  uploaded_at: Date;
  expires_at?: Date;
}

export interface FileSecurityPolicy {
  allowed_mime_types: readonly string[];
  max_size_bytes: number;
  require_content_hash: true;
  require_malware_scan: true;
  require_signed_access: true;
}

export interface WebhookIntegrityMetadata {
  provider_id: EntityId;
  event_id: string;
  transaction_reference?: string;
  signature_verified: boolean;
  idempotency_key: string;
  payload_hash: string;
  received_at: Date;
  processing_status: 'quarantined' | 'accepted' | 'rejected' | 'duplicate';
}

export interface RlsPolicyMetadata {
  policy_id: string;
  resource_type: ProtectedResourceType;
  action: Permission;
  effect: 'allow' | 'deny';
  applies_to_roles: readonly PlatformRole[];
  required_scope?: RoleScopeType;
  ownership_required: boolean;
  server_context_required: true;
  audit_required: boolean;
  description: string;
}

export interface RlsPolicyRegistry {
  get_policy(resource_type: ProtectedResourceType, action: Permission): Promise<RlsPolicyMetadata | null>;
  list_policies(resource_type: ProtectedResourceType): Promise<readonly RlsPolicyMetadata[]>;
}

export interface SecurityAuditQuery {
  actor_user_id?: EntityId;
  resource_type?: ProtectedResourceType;
  resource_id?: EntityId;
  event_type?: SecurityEventType;
  starts_at?: Date;
  ends_at?: Date;
}

export interface SecurityAuditRepository {
  list_events(query: SecurityAuditQuery): Promise<readonly ImmutableSecurityEvent[]>;
}

export const DEFAULT_SECURITY_EFFECT: 'deny' = 'deny';
export const SECURITY_AUDIT_IS_APPEND_ONLY: true = true;
