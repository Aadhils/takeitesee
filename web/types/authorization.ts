/**
 * Authorization and Policy Types
 *
 * Defines server-side authorization policy interfaces and decision models.
 * This is the foundation for authorization checks using roles and resource ownership.
 *
 * CRITICAL: All authorization must be evaluated SERVER-SIDE.
 * Client-supplied role/ownership information is NEVER trusted.
 */

import type { EntityId } from './entities';
import type {
  BusinessStaff,
  PlatformRole,
  RoleScopeType,
  RoleAssignment,
} from './ownership';

/**
 * Authorization action - what the user is trying to do
 */
export type AuthorizationAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'publish'
  | 'unpublish'
  | 'manage'
  | 'admin'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'refund'
  | 'suspend'
  | 'restore';

/**
 * Resource type - what the user is acting on
 */
export type ResourceType =
  | 'user'
  | 'user_profile'
  | 'professional_profile'
  | 'business'
  | 'business_staff'
  | 'service'
  | 'category'
  | 'requirement'
  | 'response'
  | 'booking'
  | 'payment_record'
  | 'refund'
  | 'dispute'
  | 'review'
  | 'role_assignment'
  | 'verification_record'
  | 'audit_log'
  | 'admin_action';

/**
 * Authorization context - what we know about the user and their request
 * Used to make authorization decisions
 */
export interface AuthorizationContext {
  user_id: EntityId;
  roles: PlatformRole[];
  role_assignments: RoleAssignment[];
  business_staff_memberships?: BusinessStaff[];
  is_admin: boolean;
  is_super_admin: boolean;
  authenticated_at: Date;
  session_id: EntityId;
}

/**
 * Authorization decision - result of policy evaluation
 */
export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
  required_role?: PlatformRole;
  required_scope?: RoleScopeType;
  applied_policy?: string;
}

/**
 * Policy predicate - function that evaluates authorization
 * Returns true if policy allows the action
 */
export type PolicyPredicate = (
  context: AuthorizationContext,
  resource_id: EntityId,
  resource_type: ResourceType,
  action: AuthorizationAction
) => Promise<boolean>;

/**
 * Policy rule - explicit authorization rule
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  resource_type: ResourceType;
  action: AuthorizationAction;
  applies_to_roles: PlatformRole[];
  scope_type?: RoleScopeType;
  condition?: PolicyCondition;
  allow: boolean; // true to allow, false to deny
  priority: number; // higher priority rules evaluated first
}

/**
 * Policy condition - additional constraint on rule
 */
export interface PolicyCondition {
  type: 'ownership' | 'scope_match' | 'role_hierarchy' | 'custom';
  description: string;
  evaluate: (context: AuthorizationContext, resource_id: EntityId) => Promise<boolean>;
}

/**
 * Authorization policy engine interface
 * Determines if an action is allowed
 */
export interface IAuthorizationPolicyEngine {
  /**
   * Evaluate if an action is authorized
   */
  is_authorized(
    context: AuthorizationContext,
    resource_id: EntityId,
    resource_type: ResourceType,
    action: AuthorizationAction
  ): Promise<AuthorizationDecision>;

  /**
   * Check authorization and throw if not allowed
   */
  require_authorization(
    context: AuthorizationContext,
    resource_id: EntityId,
    resource_type: ResourceType,
    action: AuthorizationAction
  ): Promise<void>;

  /**
   * Get list of actions allowed for a resource
   */
  allowed_actions(
    context: AuthorizationContext,
    resource_id: EntityId,
    resource_type: ResourceType
  ): Promise<AuthorizationAction[]>;
}

/**
 * Ownership predicate - check if user owns a resource
 * Base policy for most resources
 */
export interface OwnershipPredicate {
  resource_id: EntityId;
  owner_id: EntityId;
  owner_type: 'user' | 'professional' | 'business';
}

/**
 * Scope predicate - check if user has scope
 * Used for scoped roles like business_staff
 */
export interface ScopePredicate {
  resource_id: EntityId;
  required_scope_type: RoleScopeType;
  required_scope_id: EntityId;
}

/**
 * Role hierarchy predicate - check role level
 * Used for admin/super_admin access
 */
export interface RoleHierarchyPredicate {
  required_role: PlatformRole;
  current_role: PlatformRole;
  is_allowed: boolean; // computed based on hierarchy
}

/**
 * Default deny principle - authorization defaults to deny
 * Policies must explicitly allow actions
 */
export const DEFAULT_DENY_POLICY = 'deny by default unless explicitly allowed';

/**
 * Common authorization rules by resource type
 * Define base policies for each resource
 * This is a partial example; full implementation requires all resource types
 */
export const AUTHORIZATION_RULES_EXAMPLE: Partial<Record<ResourceType, PolicyRule[]>> = {
  user: [
    {
      id: 'user_read_own',
      name: 'User can read own profile',
      description: 'Authenticated user can read their own user record',
      resource_type: 'user',
      action: 'read',
      applies_to_roles: ['customer', 'professional', 'business_owner', 'business_staff'],
      scope_type: 'user',
      allow: true,
      priority: 100,
    },
    {
      id: 'admin_read_any_user',
      name: 'Admin can read any user',
      description: 'Admin role can read any user record',
      resource_type: 'user',
      action: 'read',
      applies_to_roles: ['admin', 'super_admin'],
      allow: true,
      priority: 90,
    },
  ],
  professional_profile: [
    {
      id: 'professional_manage_own',
      name: 'Professional can manage own profile',
      description: 'Professional can update their own profile',
      resource_type: 'professional_profile',
      action: 'update',
      applies_to_roles: ['professional'],
      scope_type: 'professional_profile',
      allow: true,
      priority: 100,
    },
  ],
  business: [
    {
      id: 'business_owner_manage',
      name: 'Business owner can manage business',
      description: 'Business owner can update and manage their business',
      resource_type: 'business',
      action: 'manage',
      applies_to_roles: ['business_owner'],
      scope_type: 'business',
      allow: true,
      priority: 100,
    },
    {
      id: 'business_manager_limited',
      name: 'Business manager has limited access',
      description: 'Business manager can view and update operational data',
      resource_type: 'business',
      action: 'update',
      applies_to_roles: ['business_staff'],
      scope_type: 'business',
      allow: true,
      priority: 80,
    },
  ],
  booking: [
    {
      id: 'customer_view_own_booking',
      name: 'Customer can view own booking',
      description: 'Customer can read bookings they created',
      resource_type: 'booking',
      action: 'read',
      applies_to_roles: ['customer'],
      allow: true,
      priority: 100,
    },
    {
      id: 'professional_view_assigned_booking',
      name: 'Professional can view assigned booking',
      description: 'Professional can read bookings assigned to them',
      resource_type: 'booking',
      action: 'read',
      applies_to_roles: ['professional'],
      allow: true,
      priority: 100,
    },
  ],
  payment_record: [
    {
      id: 'customer_view_own_payment',
      name: 'Customer can view own payment',
      description: 'Customer can read payment records they created',
      resource_type: 'payment_record',
      action: 'read',
      applies_to_roles: ['customer'],
      allow: true,
      priority: 100,
    },
    {
      id: 'admin_view_all_payments',
      name: 'Admin can view all payments',
      description: 'Admin can read all payment records for reconciliation',
      resource_type: 'payment_record',
      action: 'read',
      applies_to_roles: ['admin', 'super_admin'],
      allow: true,
      priority: 90,
    },
  ],
  audit_log: [
    {
      id: 'admin_read_audit',
      name: 'Admin can read audit logs',
      description: 'Admin role only can read audit logs',
      resource_type: 'audit_log',
      action: 'read',
      applies_to_roles: ['admin', 'super_admin'],
      allow: true,
      priority: 100,
    },
  ],
  // Default deny for unlisted resource/action combinations
} as const;

/**
 * CRITICAL AUTHORIZATION PRINCIPLES:
 *
 * 1. Default Deny
 *    - Unless explicitly allowed by policy, deny the action
 *    - Safer than default allow with blacklist
 *
 * 2. Server-Side Evaluation Only
 *    - Never evaluate authorization on client
 *    - Always evaluate on server for every request
 *    - Never trust client role/ownership claims
 *
 * 3. Ownership Verification
 *    - When checking ownership, query database to verify
 *    - Never use client-supplied owner_id
 *    - Cross-check against role_assignments and resource ownership tables
 *
 * 4. Scope Validation
 *    - For scoped roles (e.g., business_staff), verify scope_id matches
 *    - Check both role_assignments and resource scope constraints
 *
 * 5. Admin Override
 *    - Admin/super_admin may have elevated permissions
 *    - But even admins must follow append-only and financial constraints
 *    - Admin actions must be logged in audit_logs
 *
 * 6. Role Hierarchy
 *    - super_admin > admin > business_owner/professional > staff > customer
 *    - But each role has specific permissions, not blanket escalation
 *    - Don't assume higher role = all lower role permissions
 *
 * 7. Audit Trail
 *    - Every authorization decision should be logged in audit_logs
 *    - Failed authorization attempts should be recorded
 *    - Admin actions especially must be logged
 *
 * 8. Least Privilege
 *    - Grant minimum necessary permissions
 *    - Use scoped roles where possible
 *    - Regularly audit and revoke unnecessary permissions
 */

