-- Follow-up hardening for the Professional multi-skill identity foundation.
--
-- The initial live migration used two permissive authenticated SELECT policies:
-- one for verified public roles and one for owner access. Supabase Performance
-- Advisor correctly flags that overlap. Keep the same visibility semantics while
-- separating anonymous public read from one consolidated authenticated read path.

drop policy if exists professional_roles_public_read on public.professional_roles;
drop policy if exists professional_roles_owner_read on public.professional_roles;

drop policy if exists professional_roles_anon_public_read on public.professional_roles;
create policy professional_roles_anon_public_read
on public.professional_roles
for select
to anon
using (
  active
  and exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.verified = true
  )
);

drop policy if exists professional_roles_authenticated_read on public.professional_roles;
create policy professional_roles_authenticated_read
on public.professional_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    active
    and exists (
      select 1
      from public.professional_profiles profile
      where profile.id = professional_roles.professional_id
        and profile.verified = true
    )
  )
);
