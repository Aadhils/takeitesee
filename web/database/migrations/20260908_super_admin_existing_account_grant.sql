-- Super Admin delegated Admin grant foundation.
-- Adds an authenticated, audited RPC for granting application-scoped Admin
-- access to an existing TakeItEsee account. This intentionally does not create
-- or invite Supabase Auth users; the target must already exist in public.users.
-- Finance, Cashfree, payment, refund, payout, settlement, reconciliation,
-- recurrence and recovery are intentionally outside this migration.

create or replace function public.super_admin_grant_existing_admin(
  p_email text,
  p_application_id uuid,
  p_can_manage boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_target_user uuid;
  v_membership_id uuid;
  v_scope_id uuid;
  v_manage boolean := coalesce(p_can_manage, false);
begin
  if v_actor is null or not public.is_super_admin() then
    raise insufficient_privilege using message = 'Super Admin permission required.';
  end if;

  if v_email = '' or p_application_id is null then
    raise invalid_parameter_value using message = 'Email and application are required.';
  end if;

  select u.id into v_target_user
  from public.users u
  where lower(u.email) = v_email
  order by u.created_at asc
  limit 1;

  if v_target_user is null then
    raise exception 'TakeItEsee account not found.' using errcode = 'P0002';
  end if;

  if v_target_user = v_actor then
    raise insufficient_privilege using message = 'Self Admin grants are blocked.';
  end if;

  if not exists (
    select 1 from public.platform_applications a where a.id = p_application_id
  ) then
    raise exception 'Platform application not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.admin_memberships m
    join public.admin_scopes s on s.admin_membership_id = m.id
    where m.user_id = v_target_user
      and s.scope_type = 'platform'::public.admin_scope_type
      and s.can_manage = true
  ) then
    raise insufficient_privilege using message = 'Protected Super Admin authority cannot be changed here.';
  end if;

  insert into public.admin_memberships(user_id, active, created_by, created_at, updated_at)
  values (v_target_user, true, v_actor, now(), now())
  on conflict (user_id) do update
    set active = true,
        updated_at = now()
  returning id into v_membership_id;

  select s.id into v_scope_id
  from public.admin_scopes s
  where s.admin_membership_id = v_membership_id
    and s.scope_type = 'application'::public.admin_scope_type
    and s.application_id = p_application_id
  order by s.created_at asc
  limit 1
  for update;

  if v_scope_id is null then
    insert into public.admin_scopes(
      admin_membership_id,
      scope_type,
      application_id,
      can_view,
      can_manage,
      created_by,
      created_at
    ) values (
      v_membership_id,
      'application'::public.admin_scope_type,
      p_application_id,
      true,
      v_manage,
      v_actor,
      now()
    )
    returning id into v_scope_id;
  else
    update public.admin_scopes
    set can_view = true,
        can_manage = v_manage
    where id = v_scope_id;
  end if;

  insert into public.admin_audit_log(
    actor_user_id,
    action,
    resource_type,
    resource_id,
    application_id,
    metadata
  ) values (
    v_actor,
    'admin.membership.granted',
    'admin_membership',
    v_membership_id::text,
    p_application_id,
    jsonb_build_object(
      'target_user_id', v_target_user,
      'scope_id', v_scope_id,
      'scope_type', 'application',
      'can_view', true,
      'can_manage', v_manage
    )
  );
end;
$function$;

revoke execute on function public.super_admin_grant_existing_admin(text, uuid, boolean) from public, anon;
grant execute on function public.super_admin_grant_existing_admin(text, uuid, boolean) to authenticated;
