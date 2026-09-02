create table if not exists public.platform_support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  request_type text not null check (request_type in ('platform_grievance','account_help','safety','provider_conduct','other')),
  subject text not null check (char_length(btrim(subject)) between 5 and 160),
  details text not null check (char_length(btrim(details)) between 10 and 4000),
  status text not null default 'submitted' check (status in ('submitted','in_review','awaiting_information','resolved','closed')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists platform_support_requests_user_created_idx
  on public.platform_support_requests(user_id, created_at desc);
create index if not exists platform_support_requests_status_created_idx
  on public.platform_support_requests(status, created_at desc);
create index if not exists platform_support_requests_reviewed_by_idx
  on public.platform_support_requests(reviewed_by) where reviewed_by is not null;

alter table public.platform_support_requests enable row level security;

revoke all on table public.platform_support_requests from anon;
revoke all on table public.platform_support_requests from authenticated;
grant select on table public.platform_support_requests to authenticated;
grant insert (user_id, request_type, subject, details) on table public.platform_support_requests to authenticated;
grant update (status, review_note, reviewed_by, updated_at, resolved_at) on table public.platform_support_requests to authenticated;

create policy "customers read own platform support requests"
  on public.platform_support_requests for select to authenticated
  using (user_id = auth.uid() or private.is_super_admin());

create policy "customers submit own platform support requests"
  on public.platform_support_requests for insert to authenticated
  with check (user_id = auth.uid());

create policy "super admins review platform support requests"
  on public.platform_support_requests for update to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
