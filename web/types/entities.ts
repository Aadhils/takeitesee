/**
 * Canonical Entity Types
 *
 * Defines the fundamental entity and ID types for TakeItEsee.
 * These are the source of truth for all core domain entities.
 */

import type { ServicePricing } from './money';

/**
 * UUID-based unique identifier
 * All entities use UUID v4 for distributed ID generation
 */
export type EntityId = string & { readonly brand: 'EntityId' };

export function createEntityId(id: string): EntityId {
  // Basic UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
  return id as EntityId;
}

/**
 * User account and identity entity
 * Represents a human user account in the system
 */
export interface User {
  id: EntityId;
  email: string;
  phone?: string;
  auth_provider: 'email' | 'phone' | 'oauth';
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  email_verified: boolean;
  phone_verified: boolean;
  preferred_locale: Locale;
  content_locale: Locale;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  last_login_at?: Date;
}

/**
 * User profile - public/shared profile metadata
 * One profile row per user
 */
export interface UserProfile {
  id: EntityId;
  user_id: EntityId;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  locale_preference: Locale;
  content_locale: Locale;
  created_at: Date;
  updated_at: Date;
}

/**
 * Professional profile - professional identity and operating profile
 * One active professional profile per user
 */
export interface ProfessionalProfile {
  id: EntityId;
  user_id: EntityId;
  headline: string;
  summary?: string;
  experience_years?: number;
  service_radius_km?: number;
  availability_mode: 'full_time' | 'part_time' | 'project_based' | 'unavailable';
  status: 'active' | 'inactive' | 'suspended';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Business entity - business identity and operational profile
 */
export interface Business {
  id: EntityId;
  owner_user_id: EntityId;
  business_name: string;
  legal_name: string;
  business_type: 'sole_proprietor' | 'partnership' | 'pvt_limited' | 'llp' | 'ngo';
  gstin?: string;
  registration_number?: string;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Customer profile - customer-specific metadata
 */
export interface CustomerProfile {
  id: EntityId;
  user_id: EntityId;
  preferred_service_regions?: string[];
  default_address_id?: EntityId;
  created_at: Date;
  updated_at: Date;
}

/**
 * Service entity - service catalog record
 * Service ownership is defined in professional_service_ownership or business_service_ownership
 * Exactly one ownership mapping per service
 */
export interface Service {
  id: EntityId;
  category_id: EntityId;
  service_name: LocalizedText;
  slug: string;
  description: LocalizedText;
  pricing: ServicePricing;
  duration_minutes?: number;
  status: ServiceStatus;
  publication: CatalogPublication;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

/**
 * Service ownership mapping for professional-owned services
 * Exactly one per service
 */
export interface ProfessionalServiceOwnership {
  id: EntityId;
  service_id: EntityId;
  professional_id: EntityId;
  created_at: Date;
}

/**
 * Service ownership mapping for business-owned services
 * Exactly one per service
 */
export interface BusinessServiceOwnership {
  id: EntityId;
  service_id: EntityId;
  business_id: EntityId;
  created_at: Date;
}

/**
 * Category entity - service taxonomy
 */
export interface Category {
  id: EntityId;
  name: LocalizedText;
  slug: string;
  parent_category_id?: EntityId;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Localized catalog content. The default locale must always have a value.
 */
export interface LocalizedText {
  default_locale: Locale;
  values: Partial<Record<Locale, string>>;
}

export type ServiceStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived'
  | 'suspended'
  | 'deleted';

export type CatalogPublication =
  | { state: 'unpublished' }
  | { state: 'published'; published_at: Date; published_by: EntityId }
  | { state: 'hidden'; hidden_at: Date; hidden_by: EntityId; reason: string };

/**
 * Address entity - customer, professional, and business addresses
 */
export interface Address {
  id: EntityId;
  owner_type: 'user' | 'professional' | 'business' | 'customer';
  owner_id: EntityId;
  address_type: 'home' | 'work' | 'service' | 'billing';
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
  is_primary: boolean;
  created_at: Date;
  updated_at?: Date;
}

/**
 * Supported currency codes
 */
export type Currency = 'INR' | 'USD'; // Extensible for future

/**
 * Supported locale/language codes
 */
export type Locale = 'en' | 'ta' | 'hi' | 'ml';
