/**
 * Server-Side Authentication and Authorization Service Interfaces
 *
 * Defines the contracts for server-side auth/authz services.
 * These interfaces are for future implementation in API routes and server functions.
 * This module does NOT implement actual authentication or authorization.
 *
 * CRITICAL PRINCIPLE:
 * All authentication and authorization must be evaluated server-side.
 * Client-supplied information is never trusted as authoritative.
 */

import type { EntityId } from './entities';
import type { AuthProvider, AuthAttemptResult, AuthState } from './auth';
import type { SessionContext, ClientSessionState } from './session';
import type { AuthorizationContext, AuthorizationDecision, ResourceType, AuthorizationAction } from './authorization';
import type { RoleAssignment } from './ownership';

/**
 * Server auth context - what server-side knows about current request
 * Extracted from session/auth provider and validated against DB
 */
export interface ServerAuthContext {
  user_id: EntityId;
  session_id: EntityId;
  auth_provider: AuthProvider;
  authenticated_at: Date;
  session_expires_at: Date;
  is_valid: boolean;
}

/**
 * Authentication service interface
 * Handles login, logout, and credential verification
 * (Not implemented; for future Supabase Auth integration)
 */
export interface IAuthenticationService {
  /**
   * Verify authentication from request (extract and validate session)
   */
  verify_request_auth(request: {
    headers: Record<string, string>;
    cookies?: Record<string, string>;
  }): Promise<ServerAuthContext | null>;

  /**
   * Validate session is still active
   */
  validate_session(session_id: EntityId): Promise<boolean>;

  /**
   * Get session context for authorization checks
   */
  get_session_context(session_id: EntityId): Promise<SessionContext | null>;

  /**
   * Logout - invalidate session
   */
  logout(session_id: EntityId): Promise<boolean>;

  /**
   * Refresh session - get new tokens
   */
  refresh_session(refresh_token: string): Promise<ClientSessionState | null>;
}

/**
 * User service interface
 * Manages user profile and account data
 */
export interface IUserService {
  /**
   * Get user by ID
   */
  get_user(user_id: EntityId): Promise<{
    id: EntityId;
    email: string;
    phone?: string;
    status: string;
  } | null>;

  /**
   * Get user profile
   */
  get_user_profile(user_id: EntityId): Promise<{
    id: EntityId;
    user_id: EntityId;
    display_name: string;
  } | null>;

  /**
   * Get user's roles (from database)
   */
  get_user_roles(user_id: EntityId): Promise<RoleAssignment[]>;

  /**
   * Get user by email
   */
  get_user_by_email(email: string): Promise<{ id: EntityId; email: string } | null>;
}

/**
 * Authorization service interface
 * Determines if actions are allowed
 */
export interface IAuthorizationService {
  /**
   * Check if user can perform action on resource
   */
  can_perform(
    user_id: EntityId,
    resource_id: EntityId,
    resource_type: ResourceType,
    action: AuthorizationAction
  ): Promise<AuthorizationDecision>;

  /**
   * Check and throw if not authorized
   */
  require_permission(
    user_id: EntityId,
    resource_id: EntityId,
    resource_type: ResourceType,
    action: AuthorizationAction
  ): Promise<void>;

  /**
   * Get user's authorization context
   */
  get_authorization_context(user_id: EntityId): Promise<AuthorizationContext>;

  /**
   * Check if user owns resource
   */
  owns_resource(user_id: EntityId, resource_id: EntityId, resource_type: ResourceType): Promise<boolean>;

  /**
   * Check if user is admin
   */
  is_admin(user_id: EntityId): Promise<boolean>;

  /**
   * Check if user is super_admin
   */
  is_super_admin(user_id: EntityId): Promise<boolean>;
}

/**
 * Role service interface
 * Manages role assignments
 */
export interface IRoleService {
  /**
   * Get user's active roles
   */
  get_user_roles(user_id: EntityId): Promise<RoleAssignment[]>;

  /**
   * Check if user has specific role
   */
  has_role(user_id: EntityId, role: string, scope_id?: EntityId): Promise<boolean>;

  /**
   * Get roles for resource scope
   */
  get_scoped_roles(user_id: EntityId, scope_type: string): Promise<RoleAssignment[]>;

  /**
   * Grant role to user (admin only)
   */
  grant_role(
    user_id: EntityId,
    role: string,
    granted_by: EntityId,
    scope_type?: string,
    scope_id?: EntityId
  ): Promise<RoleAssignment>;

  /**
   * Revoke role from user (admin only)
   */
  revoke_role(user_id: EntityId, role_assignment_id: EntityId, revoked_by: EntityId): Promise<boolean>;
}

/**
 * Business staff service interface
 * Manages business membership and scoped roles
 */
export interface IBusinessStaffService {
  /**
   * Get user's business memberships
   */
  get_user_businesses(user_id: EntityId): Promise<{ business_id: EntityId; role: string }[]>;

  /**
   * Check if user is staff of business
   */
  is_business_staff(user_id: EntityId, business_id: EntityId): Promise<boolean>;

  /**
   * Get user's role in business
   */
  get_business_role(user_id: EntityId, business_id: EntityId): Promise<string | null>;

  /**
   * Add user to business (owner/manager only)
   */
  add_staff(business_id: EntityId, user_id: EntityId, role: string, invited_by: EntityId): Promise<void>;

  /**
   * Remove user from business
   */
  remove_staff(business_id: EntityId, user_id: EntityId, removed_by: EntityId): Promise<void>;
}

/**
 * Verification service interface
 * Manages identity and payment eligibility verification
 */
export interface IVerificationService {
  /**
   * Check if user has verified email
   */
  is_email_verified(user_id: EntityId): Promise<boolean>;

  /**
   * Check if user has verified phone
   */
  is_phone_verified(user_id: EntityId): Promise<boolean>;

  /**
   * Get verification status
   */
  get_verification_status(user_id: EntityId): Promise<{
    email_verified: boolean;
    phone_verified: boolean;
    identity_verified: boolean;
  }>;

  /**
   * Check payment eligibility
   */
  is_payment_eligible(entity_id: EntityId, entity_type: string): Promise<boolean>;

  /**
   * Check trust verification status
   */
  is_trust_verified(entity_id: EntityId, entity_type: string): Promise<boolean>;
}

/**
 * Audit service interface
 * Logs security and operational events
 */
export interface IAuditService {
  /**
   * Log authorization decision
   */
  log_authorization_decision(
    user_id: EntityId,
    resource_id: EntityId,
    resource_type: ResourceType,
    action: AuthorizationAction,
    allowed: boolean,
    reason?: string
  ): Promise<void>;

  /**
   * Log authentication event
   */
  log_auth_event(
    user_id: EntityId,
    event_type: string,
    success: boolean,
    ip_address?: string,
    user_agent?: string
  ): Promise<void>;

  /**
   * Log admin action
   */
  log_admin_action(
    admin_id: EntityId,
    action_type: string,
    resource_type: ResourceType,
    resource_id: EntityId,
    old_values?: Record<string, unknown>,
    new_values?: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Composition of all auth/authz services
 * Typical usage pattern for dependency injection
 */
export interface IAuthServices {
  auth: IAuthenticationService;
  user: IUserService;
  authorization: IAuthorizationService;
  roles: IRoleService;
  business_staff: IBusinessStaffService;
  verification: IVerificationService;
  audit: IAuditService;
}

/**
 * Server-side middleware interface for auth/authz
 * Pattern for Next.js middleware or route handlers
 */
export interface IAuthMiddleware {
  /**
   * Extract and validate auth from request
   */
  extract_auth(request: {
    headers: Record<string, string>;
    cookies?: Record<string, string>;
  }): Promise<ServerAuthContext | null>;

  /**
   * Check authorization and attach context to request
   */
  check_authorization(
    context: ServerAuthContext,
    resource_id: EntityId,
    resource_type: ResourceType,
    action: AuthorizationAction
  ): Promise<void>;
}

/**
 * Error types for auth/authz failures
 */
export class AuthenticationError extends Error {
  constructor(message: string, public code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public code: string = 'AUTHZ_ERROR') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class SessionError extends Error {
  constructor(message: string, public code: string = 'SESSION_ERROR') {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * IMPORTANT SERVICE IMPLEMENTATION NOTES:
 *
 * These are SERVICE INTERFACES ONLY. No actual implementation in this codebase.
 * Future implementation will:
 *
 * 1. Use Supabase Auth for authentication provider
 * 2. Query Supabase Postgres for role_assignments and ownership verification
 * 3. Use RLS policies for per-row authorization
 * 4. Store audit logs in append-only audit_logs table
 *
 * Key principles to follow when implementing:
 * - Always verify on server, never trust client
 * - Check DB state, don't use cached client state
 * - Log authorization failures for security monitoring
 * - Use parameterized queries to prevent SQL injection
 * - Validate all inputs before DB operations
 * - Apply rate limiting to auth endpoints
 * - Hash sensitive data before logging/storing
 */
