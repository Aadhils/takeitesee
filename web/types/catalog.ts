/**
 * Service and Catalog Foundation
 *
 * Provider-agnostic contracts for catalog lifecycle, availability, and
 * server-side catalog access. Booking and payment workflows remain separate.
 */

import type {
  CatalogPublication,
  Category,
  EntityId,
  LocalizedText,
  Locale,
  Service,
  ServiceStatus,
} from './entities';
import type { ServicePricing } from './money';
import type { ServiceOwner } from './ownership';

export type ServiceId = EntityId;
export type CategoryId = EntityId;

export type ServiceLifecycleStatus = ServiceStatus;
export type CatalogVisibilityState = CatalogPublication['state'];

export const SERVICE_STATUS_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  draft: ['active', 'deleted'],
  active: ['paused', 'archived', 'suspended', 'deleted'],
  paused: ['active', 'archived', 'deleted'],
  archived: [],
  suspended: ['active', 'archived', 'deleted'],
  deleted: [],
};

export function isAllowedServiceStatusTransition(
  from: ServiceStatus,
  to: ServiceStatus
): boolean {
  return SERVICE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface ServiceStatusHistoryEntry {
  id: EntityId;
  service_id: ServiceId;
  previous_status: ServiceStatus;
  new_status: ServiceStatus;
  changed_by_user_id: EntityId;
  reason: string;
  created_at: Date;
}

export interface ServiceAvailability {
  mode: 'always_available' | 'on_request' | 'scheduled';
  timezone?: string;
  weekly_windows?: AvailabilityWindow[];
  blackout_periods?: AvailabilityBlackout[];
}

export interface AvailabilityWindow {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
}

export interface AvailabilityBlackout {
  starts_at: Date;
  ends_at: Date;
  reason?: string;
}

export interface ServiceCatalogRecord extends Service {
  owner: ServiceOwner;
  availability?: ServiceAvailability;
}

export interface CategoryCatalogRecord extends Category {
  description?: LocalizedText;
}

export interface ServiceCatalogFilters {
  category_id?: CategoryId;
  owner_type?: ServiceOwner['owner_type'];
  status?: ServiceStatus;
  visibility?: CatalogVisibilityState;
  locale?: Locale;
}

export interface ServiceCatalogRepository {
  get_service(service_id: ServiceId): Promise<ServiceCatalogRecord | null>;
  list_services(filters?: ServiceCatalogFilters): Promise<ServiceCatalogRecord[]>;
  save_service(service: ServiceCatalogRecord): Promise<ServiceCatalogRecord>;
  get_category(category_id: CategoryId): Promise<CategoryCatalogRecord | null>;
  list_categories(parent_category_id?: CategoryId): Promise<CategoryCatalogRecord[]>;
}

export interface CatalogAuditEvent {
  event_type:
    | 'service_created'
    | 'service_updated'
    | 'service_status_changed'
    | 'service_publication_changed'
    | 'category_created'
    | 'category_updated';
  resource_type: 'service' | 'category';
  resource_id: EntityId;
  actor_user_id: EntityId;
  occurred_at: Date;
  previous_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  reason?: string;
}

export interface CatalogAuditWriter {
  append(event: CatalogAuditEvent): Promise<void>;
}

export interface ServiceDraftInput {
  category_id: CategoryId;
  service_name: LocalizedText;
  slug: string;
  description: LocalizedText;
  pricing: ServicePricing;
  availability?: ServiceAvailability;
}