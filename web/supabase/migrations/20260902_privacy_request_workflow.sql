-- Phase 18: customer privacy-request workflow (non-finance).
--
-- This migration provides a guarded request-and-review path for access,
-- correction, and deletion requests. It does not delete accounts or mutate
-- bookings, payments, refunds, payouts, settlements, recovery, Cashfree, or
-- any other finance state.

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  request_type text not null check (request_type in ('access', 'correction', 'deletion')),
  details text not null check (char_length(btrim(details)) between 10 and 2000),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'awaiting_information', 'completed', 'declined')),
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint privacy_requests_resolution_state_check check (
    (status in ('completed', 'declined') and resolved_at is not null)
    or
    (status not in ('completed', 'declined') and resolved_at is null)
  )
);

create index if not exists privacy_requests_user_id_idx
  on public.privacy_requests(user_id);

create index if not exists privacy_requests_status_created_at_idx
  on public.privacy_requests(status, created_at desc);

create unique index if not exists privacy_requests_one_active_type_per_user_idx
  on public.privacy_requests(user_id, request_type)
  where status in ('submitted', 'in_review', 'awaiting_information');

alter table public.privacy_requests enable row level security;

revoke all on table public.privacy_requests from public, anon, authenticated;
grant select on table public.privacy_requests to authenticated;
grant insert (user_id, request_type, details) on table public.privacy_requests to authenticated;
grant update (status, review_note, reviewed_by, updated_at, resolved_at) on table public.privacy_requests to authenticated;
grant all on table public.privacy_requests to service_role;

drop policy if exists privacy_requests_read_own_or_super_admin on public.privacy_requests;
create policy privacy_requests_read_own_or_super_admin
  on public.privacy_requests
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_super_admin()
  );

drop policy if exists privacy_requests_customer_submit on public.privacy_requests;
create policy privacy_requests_customer_submit
  on public.privacy_requests
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
    and review_note is null
    and reviewed_by is null
    and resolved_at is null
  );

drop policy if exists privacy_requests_super_admin_review on public.privacy_requests;
create policy privacy_requests_super_admin_review
  on public.privacy_requests
  for update
  to authenticated
  using (private.is_super_admin())
  with check (
    private.is_super_admin()
    and reviewed_by = (select auth.uid())
  );
