-- TakeItSee production foundation schema.
-- Apply through a migration tool in the deployment environment.
-- No payment provider credentials or secrets belong in this file.

create extension if not exists pgcrypto;

create type platform_role as enum ('customer', 'professional', 'business', 'admin');
create type provider_type as enum ('professional', 'business');
create type booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled');
create type payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  role platform_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  default_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete restrict,
  headline text,
  description text,
  service_area text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete restrict,
  name text not null,
  description text,
  location text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  provider_type provider_type not null,
  professional_id uuid references professional_profiles(id) on delete restrict,
  business_id uuid references businesses(id) on delete restrict,
  name text not null,
  description text not null,
  location text,
  duration_minutes integer not null check (duration_minutes > 0),
  base_price numeric(12, 2) not null check (base_price >= 0),
  currency text not null check (currency in ('INR', 'USD')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider_type = 'professional' and professional_id is not null and business_id is null) or (provider_type = 'business' and business_id is not null and professional_id is null))
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  idempotency_key text not null unique,
  customer_id uuid not null references users(id) on delete restrict,
  service_id uuid not null references services(id) on delete restrict,
  provider_type provider_type not null,
  professional_id uuid references professional_profiles(id) on delete restrict,
  business_id uuid references businesses(id) on delete restrict,
  service_name_snapshot text not null,
  booking_date date not null,
  start_time time not null,
  timezone text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  location text not null,
  customer_notes text,
  quoted_price numeric(12, 2) not null check (quoted_price >= 0),
  currency text not null check (currency in ('INR', 'USD')),
  status booking_status not null default 'pending',
  payment_status payment_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider_type = 'professional' and professional_id is not null and business_id is null) or (provider_type = 'business' and business_id is not null and professional_id is null))
);

create table booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  from_status booking_status,
  to_status booking_status not null,
  changed_by uuid not null references users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);

create index bookings_customer_id_idx on bookings(customer_id);
create index bookings_service_id_idx on bookings(service_id);
create index bookings_status_idx on bookings(status);
create index booking_status_history_booking_id_idx on booking_status_history(booking_id);
