-- Phase 10A: SaaS ecosystem control plane foundation
-- Additive only: does not modify existing customer/provider/booking behavior.
-- Requires 20260825_phase10_00_super_admin_role.sql.

create type application_status as enum ('draft', 'active', 'paused', 'retired');
create type location_type as enum ('country', 'state', 'city', 'zone');
create type admin_scope_type as enum ('platform', 'application', 'location', 'category', 'service');

create table platform_applications (
  id uuid primary key default gen_random_uuid(), code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,62}$'), name text not null, description text,
  status application_status not null default 'draft', sort_order integer not null default 0, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table platform_locations (
  id uuid primary key default gen_random_uuid(), parent_id uuid references platform_locations(id) on delete restrict, type location_type not null, code text not null, name text not null,
  country_code text, timezone text, active boolean not null default true, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(parent_id,type,code)
);
create table application_locations (
  application_id uuid not null references platform_applications(id) on delete cascade, location_id uuid not null references platform_locations(id) on delete cascade,
  enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(application_id,location_id)
);
create table platform_categories (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references platform_applications(id) on delete cascade, parent_id uuid references platform_categories(id) on delete restrict,
  code text not null, name text not null, description text, active boolean not null default true, sort_order integer not null default 0, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(application_id,code)
);
create table service_ecosystem_scope (
  service_id uuid primary key references services(id) on delete cascade, application_id uuid not null references platform_applications(id) on delete restrict,
  category_id uuid references platform_categories(id) on delete restrict, location_id uuid references platform_locations(id) on delete restrict, enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table admin_memberships (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete restrict, active boolean not null default true, created_by uuid references users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id)
);
create table admin_scopes (
  id uuid primary key default gen_random_uuid(), admin_membership_id uuid not null references admin_memberships(id) on delete cascade, scope_type admin_scope_type not null,
  application_id uuid references platform_applications(id) on delete cascade, location_id uuid references platform_locations(id) on delete cascade,
  category_id uuid references platform_categories(id) on delete cascade, service_id uuid references services(id) on delete cascade,
  can_view boolean not null default true, can_manage boolean not null default false, created_by uuid references users(id) on delete restrict, created_at timestamptz not null default now(),
  check ((scope_type='platform' and application_id is null and location_id is null and category_id is null and service_id is null)
    or (scope_type='application' and application_id is not null and location_id is null and category_id is null and service_id is null)
    or (scope_type='location' and location_id is not null and category_id is null and service_id is null)
    or (scope_type='category' and category_id is not null and service_id is null)
    or (scope_type='service' and service_id is not null))
);
create table admin_audit_log (
  id bigint generated always as identity primary key, actor_user_id uuid references users(id) on delete set null, action text not null, resource_type text not null, resource_id text,
  application_id uuid references platform_applications(id) on delete set null, location_id uuid references platform_locations(id) on delete set null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index platform_locations_parent_idx on platform_locations(parent_id);
create index application_locations_location_idx on application_locations(location_id);
create index platform_categories_application_idx on platform_categories(application_id);
create index platform_categories_parent_idx on platform_categories(parent_id);
create index service_ecosystem_application_idx on service_ecosystem_scope(application_id);
create index service_ecosystem_category_idx on service_ecosystem_scope(category_id);
create index service_ecosystem_location_idx on service_ecosystem_scope(location_id);
create index admin_scopes_membership_idx on admin_scopes(admin_membership_id);
create index admin_scopes_application_idx on admin_scopes(application_id);
create index admin_scopes_location_idx on admin_scopes(location_id);
create index admin_audit_actor_idx on admin_audit_log(actor_user_id);
create index admin_audit_created_idx on admin_audit_log(created_at desc);
alter table platform_applications enable row level security;
alter table platform_locations enable row level security;
alter table application_locations enable row level security;
alter table platform_categories enable row level security;
alter table service_ecosystem_scope enable row level security;
alter table admin_memberships enable row level security;
alter table admin_scopes enable row level security;
alter table admin_audit_log enable row level security;
