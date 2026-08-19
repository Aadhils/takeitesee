-- Adds the authenticated customer's editable profile fields to the existing
-- customer_profiles table. The existing customer_profiles_self policy already
-- restricts all access to user_id = auth.uid().
--
-- Run this migration in Supabase before testing the customer profile UI.

alter table public.customer_profiles
  add column if not exists preferred_language text not null default 'English',
  add column if not exists service_regions text[] not null default '{}';

alter table public.users enable row level security;
alter table public.customer_profiles enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated using (id = auth.uid());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists customer_profiles_self on public.customer_profiles;
create policy customer_profiles_self on public.customer_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.users to authenticated;
grant update on public.users to authenticated;
grant select, insert, update, delete on public.customer_profiles to authenticated;