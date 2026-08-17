-- TakeItSee Supabase production foundation.
-- Run this migration in Supabase SQL Editor or through Supabase CLI migrations.
-- It assumes Supabase Auth owns identities in auth.users.

create extension if not exists pgcrypto;

do $$ begin create type public.platform_role as enum ('customer', 'professional', 'business', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.provider_type as enum ('professional', 'business'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded'); exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role public.platform_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  default_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete restrict,
  headline text,
  description text,
  service_area text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  description text,
  location text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  provider_type public.provider_type not null,
  professional_id uuid references public.professional_profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
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

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  idempotency_key text not null unique,
  customer_id uuid not null references public.users(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  provider_type public.provider_type not null,
  professional_id uuid references public.professional_profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  service_name_snapshot text not null,
  booking_date date not null,
  start_time time not null,
  timezone text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  location text not null,
  customer_notes text,
  quoted_price numeric(12, 2) not null check (quoted_price >= 0),
  currency text not null check (currency in ('INR', 'USD')),
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider_type = 'professional' and professional_id is not null and business_id is null) or (provider_type = 'business' and business_id is not null and professional_id is null))
);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  changed_by uuid not null references public.users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_customer_id_idx on public.bookings(customer_id);
create index if not exists bookings_service_id_idx on public.bookings(service_id);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists booking_status_history_booking_id_idx on public.booking_status_history(booking_id);

create or replace function public.handle_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email, phone, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), new.email, new.raw_user_meta_data ->> 'phone', 'customer')
  on conflict (id) do update set email = excluded.email, updated_at = now();
  insert into public.customer_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_auth_user_created();

create or replace function public.cancel_owned_booking(target_booking_id uuid, cancel_reason text default null)
returns public.bookings language plpgsql security invoker set search_path = public as $$
declare updated_booking public.bookings;
declare previous_status public.booking_status;
begin
  select status into previous_status from public.bookings where id = target_booking_id and customer_id = auth.uid();
  update public.bookings set status = 'cancelled', updated_at = now()
  where id = target_booking_id and customer_id = auth.uid() and status in ('pending', 'confirmed', 'rescheduled')
  returning * into updated_booking;
  if updated_booking.id is null then raise exception 'Booking not found or cannot be cancelled'; end if;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, reason)
  values (updated_booking.id, previous_status, 'cancelled', auth.uid(), cancel_reason);
  return updated_booking;
end;
$$;

alter table public.users enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users for select to authenticated using (id = auth.uid());
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists customer_profiles_self on public.customer_profiles;
create policy customer_profiles_self on public.customer_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select to anon, authenticated using (active = true);
drop policy if exists professionals_public_read on public.professional_profiles;
create policy professionals_public_read on public.professional_profiles for select to anon, authenticated using (true);
drop policy if exists businesses_public_read on public.businesses;
create policy businesses_public_read on public.businesses for select to anon, authenticated using (true);
drop policy if exists bookings_select_owned on public.bookings;
create policy bookings_select_owned on public.bookings for select to authenticated using (customer_id = auth.uid());
drop policy if exists bookings_insert_owned on public.bookings;
create policy bookings_insert_owned on public.bookings for insert to authenticated with check (customer_id = auth.uid());
drop policy if exists history_select_owned on public.booking_status_history;
create policy history_select_owned on public.booking_status_history for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid()));

grant execute on function public.cancel_owned_booking(uuid, text) to authenticated;
