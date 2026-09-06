drop policy if exists professionals_authenticated_read on public.professional_profiles;
create policy professionals_authenticated_read
on public.professional_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_super_admin()
);

drop policy if exists businesses_authenticated_read on public.businesses;
create policy businesses_authenticated_read
on public.businesses
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or private.is_super_admin()
);
