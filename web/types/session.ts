/**
 * Session Domain Types
 *
 * Defines canonical session management types.
 * Sessions represent authenticated user connections over time.
 * This module defines the data model for sessions but does NOT implement session handling.
 */

import type { EntityId } from './entities';
import type { AuthProvider } from './auth';

/**
 * Session status - current operational state
 */
export type SessionStatus =
  | 'active' // valid, can be used
  | 'expired' // TTL exceeded
  | 'invalidated' // user logged out or admin revoked
  | 'refreshed' // moved to new session via refresh
  | 'revoked'; // manually revoked by admin

/**
 * Session entity - canonical session record
 * Represents an authenticated user's connection
 * Sessions are created on login and invalidated on logout
 */
export interface Session {
  id: EntityId;
  user_id: EntityId;
  auth_provider: AuthProvider;
  status: SessionStatus;
  // Token information
  access_token_hash?: string; // hash of JWT or session token
  refresh_token_hash?: string; // hash of refresh token
  // Timestamps
  created_at: Date;
  last_activity_at: Date;
  expires_at: Date;
  invalidated_at?: Date;
  // Location and user agent
  ip_address_hash: string;
  user_agent_hash: string;
  // Metadata
  device_name?: string; // user-provided device identifier
  device_id?: string; // device fingerprint
  is_mobile: boolean;
}

/**
 * Session refresh - track session refresh events
 * Refresh tokens are used to create new access tokens without re-authenticating
 */
export interface SessionRefresh {
  id: EntityId;
  session_id: EntityId;
  old_access_token_hash?: string;
  new_access_token_hash: string;
  refresh_token_hash?: string;
  ip_address_hash: string;
  user_agent_hash: string;
  success: boolean;
  failure_reason?: string;
  created_at: Date;
}

/**
 * Session revocation - record of why session was invalidated
 */
export interface SessionRevocation {
  id: EntityId;
  session_id: EntityId;
  revoked_by_user_id?: EntityId; // user who revoked, or null if system
  revocation_reason: 'user_logout' | 'admin_revoke' | 'security_event' | 'password_change' | 'mfa_reset' | 'account_suspended' | 'other';
  revoked_at: Date;
}

/**
 * Client session state - what a client receives after login
 * This is what the frontend keeps and sends with requests
 * IMPORTANT: Server must validate this on every request
 */
export interface ClientSessionState {
  user_id: EntityId;
  session_id: EntityId;
  access_token: string; // JWT or opaque token
  refresh_token?: string; // optional, for refresh flow
  token_type: 'Bearer' | 'Session';
  expires_in_seconds: number;
  // User metadata (convenience only, never trusted for auth)
  email?: string;
  phone?: string;
  user_roles?: string[]; // for UI purposes only, always verified server-side
}

/**
 * Session context - what server extracts from session
 * Used for authorization checks
 * Server must retrieve and validate this from auth provider on every request
 */
export interface SessionContext {
  user_id: EntityId;
  session_id: EntityId;
  auth_provider: AuthProvider;
  authenticated_at: Date;
  last_activity_at: Date;
  expires_at: Date;
  ip_address_hash: string;
  user_agent_hash: string;
  is_valid: boolean;
}

/**
 * Multi-session tracking - user may have multiple active sessions
 * Useful for "log out from all devices" or security monitoring
 */
export interface UserSessionList {
  user_id: EntityId;
  active_sessions: Session[];
  total_sessions: number;
  max_concurrent_sessions: number;
}

/**
 * Session timeout configuration
 * Determines how long sessions remain valid
 */
export interface SessionTimeoutConfig {
  access_token_ttl_seconds: number; // how long access token is valid (typically 15-60 min)
  refresh_token_ttl_seconds: number; // how long refresh token is valid (typically days/weeks)
  absolute_timeout_seconds: number; // max session lifetime regardless of activity (typically days)
  inactivity_timeout_seconds: number; // logout after N seconds of inactivity (typically hours)
}

/**
 * Session security policy - defines how sessions are secured
 */
export interface SessionSecurityPolicy {
  // Token handling
  use_httponly_cookies: boolean; // never expose token to JS
  use_secure_cookies: boolean; // HTTPS only
  use_same_site_cookies: boolean; // CSRF protection
  // Session validation
  verify_ip_address_match: boolean; // reject if IP changes
  verify_user_agent_match: boolean; // reject if user agent changes
  allow_concurrent_sessions: boolean; // multiple devices OK
  max_concurrent_sessions: number; // max devices per user
  // Refresh policy
  rotation_on_refresh: boolean; // issue new refresh token each time
  refresh_token_reuse_allowed: boolean; // allow reusing refresh token
  // Activity tracking
  track_last_activity: boolean; // update last_activity_at on every request
  inactivity_logout_enabled: boolean; // auto-logout after inactivity
}

/**
 * IMPORTANT SESSION SECURITY NOTES:
 *
 * 1. Session tokens must be handled securely:
 *    - Never log full tokens
 *    - Store hashes only in database
 *    - Use HttpOnly, Secure, SameSite cookies for web clients
 *
 * 2. Session validation must happen server-side:
 *    - Always verify against server state
 *    - Never trust client claims about session validity
 *    - Check expiration, revocation status, IP match
 *
 * 3. Refresh tokens are long-lived:
 *    - Must be stored securely (separate from access token)
 *    - Should support rotation (new refresh token on each refresh)
 *    - Consider shorter lifetime for high-risk accounts
 *
 * 4. Session termination:
 *    - Support explicit logout (user-initiated)
 *    - Support admin revocation (security incidents)
 *    - Support automatic expiration (timeout)
 *    - Consider "log out all sessions" for password changes
 *
 * 5. Session fingerprinting:
 *    - Store IP address and user agent hashes
 *    - Can detect session hijacking if IP/UA suddenly changes
 *    - Balance security vs. mobile users with changing IPs
 */
