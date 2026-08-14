/**
 * Authentication Domain Types
 *
 * Defines canonical authentication provider-agnostic types.
 * These are planning types for future auth implementation, not active authentication.
 *
 * Important: This module defines the types for authentication flow,
 * but does NOT implement actual authentication or live provider integration.
 */

import type { EntityId, Locale } from './entities';

/**
 * Authentication providers - supported identity sources
 * Initially planning for provider-agnostic abstraction
 */
export type AuthProvider =
  | 'email_password' // email + password
  | 'phone_otp' // phone + OTP
  | 'oauth_google' // Google OAuth
  | 'oauth_github'; // future expansion

/**
 * Authentication state - current auth state of a session
 */
export type AuthState =
  | 'unauthenticated' // no active session
  | 'authenticating' // auth in progress
  | 'authenticated' // valid session active
  | 'mfa_pending' // awaiting MFA completion
  | 'session_expired' // session expired, requires refresh
  | 'suspended' // user account suspended
  | 'locked'; // account locked (too many failed attempts)

/**
 * Identity credential types - what the user proved
 */
export type CredentialType =
  | 'email_password'
  | 'phone_otp'
  | 'oauth_token'
  | 'refresh_token';

/**
 * Authentication credential - proven identity
 * This is what the user successfully authenticated with
 * Not stored in application code; stored only in auth provider
 */
export interface AuthCredential {
  type: CredentialType;
  provider: AuthProvider;
  verified_at: Date;
  expires_at?: Date;
  metadata?: Record<string, unknown>; // provider-specific data
}

/**
 * Authenticated user identity - the user proven by auth provider
 * This is the canonical link between session and user account
 */
export interface AuthenticatedIdentity {
  user_id: EntityId;
  auth_provider: AuthProvider;
  provider_user_id?: string; // OAuth user ID, email, etc.
  email?: string;
  phone?: string;
  email_verified: boolean;
  phone_verified: boolean;
  authenticated_at: Date;
  last_authentication_at: Date;
  is_mfa_enabled: boolean;
  locale?: Locale;
}

/**
 * Password requirements for email/password provider
 * (Deferred: actual password handling not yet implemented)
 */
export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  expiration_days?: number;
  max_attempts_before_lockout: number;
  lockout_duration_minutes: number;
}

/**
 * Authentication attempt result
 * Represents outcome of a login/signup attempt
 */
export interface AuthAttemptResult {
  success: boolean;
  state: AuthState;
  user_id?: EntityId;
  session_token?: string;
  error_code?: string;
  error_message?: string;
  mfa_required?: boolean;
  account_locked?: boolean;
  attempted_at: Date;
}

/**
 * Account status - current operational state
 */
export type AccountStatus =
  | 'active' // normal, can login
  | 'inactive' // user created but not yet activated
  | 'suspended' // temporarily suspended by admin
  | 'deactivated' // user initiated deactivation
  | 'deleted'; // soft delete, no longer accessible

/**
 * Authentication event - audit trail for auth changes
 */
export type AuthEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_changed'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'email_verified'
  | 'phone_verified'
  | 'account_locked'
  | 'account_unlocked'
  | 'account_suspended'
  | 'account_activated'
  | 'oauth_connected'
  | 'oauth_disconnected'
  | 'session_created'
  | 'session_invalidated'
  | 'session_refreshed'
  | 'other';

export interface AuthEvent {
  id: EntityId;
  user_id: EntityId;
  event_type: AuthEventType;
  auth_provider: AuthProvider;
  ip_address_hash: string;
  user_agent_hash: string;
  success: boolean;
  reason_code?: string;
  created_at: Date;
}

/**
 * Email verification token - deferred implementation
 * (Not implemented; for future email-based verification)
 */
export interface EmailVerificationToken {
  user_id: EntityId;
  token_hash: string;
  email: string;
  expires_at: Date;
  used_at?: Date;
}

/**
 * Password reset token - deferred implementation
 * (Not implemented; for future password reset flows)
 */
export interface PasswordResetToken {
  user_id: EntityId;
  token_hash: string;
  expires_at: Date;
  used_at?: Date;
  created_at: Date;
}
