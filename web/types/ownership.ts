/**
 * Canonical Ownership and Role Model
 *
 * TakeItEsee has exactly one authoritative ownership and role model.
 * Authoritative sources of truth:
 * - users: canonical account identity
 * - user_profiles: public/shared profile metadata
 * - role_assignments: authoritative RBAC and scope
 * - professional_profiles: professional identity
 * - businesses: business identity
 * - business_staff: business membership and scoped roles
 */

import type { EntityId, Locale } from './entities';

/**
 * Core platform roles
 * Each user can have multiple roles through role_assignments
 */
export type PlatformRole =
  | 'customer'
  | 'professional'
  | 'business_owner'
  | 'business_staff'
  | 'admin'
  | 'super_admin'
  | 'service_role'; // internal system use only

/**
 * Scope types for role assignments
 * Defines the boundary of a role's authority
 */
export type RoleScopeType =
  | 'global' // platform-wide scope (admin, super_admin)
  | 'user' // personal/account scope (customer, professional)
  | 'professional_profile' // professional identity scope
  | 'business' // business scope
  | 'service'; // service/listing scope

/**
 * Role assignment entity - authoritative RBAC and scope
 * This is the canonical source of truth for user role and permission scope
 * No competing role tables may be used as authoritative sources
 */
export interface RoleAssignment {
  id: EntityId;
  user_id: EntityId;
  role: PlatformRole;
  scope_type: RoleScopeType;
  scope_id?: EntityId; // populated for scoped roles
  granted_by: EntityId; // admin or system user who granted this role
  granted_at: Date;
  revoked_at?: Date;
  is_active: boolean;
  created_at: Date;
}

/**
 * Business staff membership and scoped roles
 * Binds a user to a business with specific role and permissions
 * Must work in conjunction with role_assignments
 */
export type BusinessStaffRole =
  | 'owner' // full business control
  | 'manager' // operational management
  | 'staff' // limited operational access
  | 'viewer'; // read-only access

export interface BusinessStaff {
  id: EntityId;
  business_id: EntityId;
  user_id: EntityId;
  staff_role: BusinessStaffRole;
  status: 'active' | 'inactive' | 'removed';
  invited_by: EntityId;
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Service ownership discriminated union
 * A service is owned by exactly one entity: either a professional or a business
 */
export type ServiceOwner = ProfessionalServiceOwner | BusinessServiceOwner;

export interface ProfessionalServiceOwner {
  owner_type: 'professional';
  owner_id: EntityId; // professional_profile id
  professional_id: EntityId;
}

export interface BusinessServiceOwner {
  owner_type: 'business';
  owner_id: EntityId; // business id
  business_id: EntityId;
}

/**
 * Provider discrimination for bookings and payments
 * A provider is either a professional or a business
 * This avoids the unsafe "professional_id or business_id" pattern
 */
export type ProviderReference = ProfessionalProvider | BusinessProvider;

export interface ProfessionalProvider {
  provider_type: 'professional';
  provider_id: EntityId; // professional_profile id
  professional_id: EntityId;
}

export interface BusinessProvider {
  provider_type: 'business';
  provider_id: EntityId; // business id
  business_id: EntityId;
}

/**
 * Helper to discriminate provider type
 */
export function isProfessionalProvider(provider: ProviderReference): provider is ProfessionalProvider {
  return provider.provider_type === 'professional';
}

export function isBusinessProvider(provider: ProviderReference): provider is BusinessProvider {
  return provider.provider_type === 'business';
}
