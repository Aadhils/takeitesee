-- Keep role-scoped identity media private while allowing the signed-in owner to list/sign
-- their own objects without a production service-role environment dependency.

drop policy if exists identity_media_owner_select on storage.objects;
create policy identity_media_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id='identity-media'
  and array_length(storage.foldername(name),1)=4
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.foldername(name))[4] in ('avatar','banner')
  and (
    ((storage.foldername(name))[2]='customer' and (storage.foldername(name))[3]=(select auth.uid())::text)
    or ((storage.foldername(name))[2]='professional' and exists (
      select 1 from public.professional_profiles profile
      where profile.id::text=(storage.foldername(name))[3] and profile.user_id=(select auth.uid())
    ))
    or ((storage.foldername(name))[2]='business' and exists (
      select 1 from public.businesses business
      where business.id::text=(storage.foldername(name))[3] and business.owner_user_id=(select auth.uid())
    ))
  )
);

create or replace function public.set_my_identity_media_path(
  target_context text,
  target_kind text,
  target_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  entity_id uuid;
  resolved_scope text;
  path_parts text[];
  avatar_path text;
  banner_path text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if target_context not in ('customer','provider') then
    raise exception 'Invalid identity context.';
  end if;
  if target_kind not in ('avatar','banner') then
    raise exception 'Invalid identity media kind.';
  end if;

  if target_context='customer' then
    resolved_scope := 'customer';
    entity_id := current_user_id;
  else
    select profile.id into entity_id
    from public.professional_profiles profile
    where profile.user_id=current_user_id
    limit 1;
    if entity_id is not null then
      resolved_scope := 'professional';
    else
      select business.id into entity_id
      from public.businesses business
      where business.owner_user_id=current_user_id
      limit 1;
      if entity_id is null then raise exception 'Provider profile is required.'; end if;
      resolved_scope := 'business';
    end if;
  end if;

  if target_path is not null then
    path_parts := string_to_array(target_path,'/');
    if cardinality(path_parts)<>5
       or path_parts[1]<>current_user_id::text
       or path_parts[2]<>resolved_scope
       or path_parts[3]<>entity_id::text
       or path_parts[4]<>target_kind
       or path_parts[5] !~ '^[0-9A-Fa-f-]{36}\.(jpg|png|webp)$'
    then
      raise exception 'Identity media path does not belong to this account workspace.';
    end if;
  end if;

  if resolved_scope='customer' then
    if target_kind='avatar' then
      update public.customer_profiles set avatar_object_path=target_path, updated_at=now()
      where user_id=current_user_id
      returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    else
      update public.customer_profiles set banner_object_path=target_path, updated_at=now()
      where user_id=current_user_id
      returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    end if;
  elsif resolved_scope='professional' then
    if target_kind='avatar' then
      update public.professional_profiles set avatar_object_path=target_path, updated_at=now()
      where id=entity_id and user_id=current_user_id
      returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    else
      update public.professional_profiles set banner_object_path=target_path, updated_at=now()
      where id=entity_id and user_id=current_user_id
      returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    end if;
  else
    if target_kind='avatar' then
      update public.businesses set avatar_object_path=target_path, updated_at=now()
      where id=entity_id and owner_user_id=current_user_id
      returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    else
      update public.businesses set banner_object_path=target_path, updated_at=now()
      where id=entity_id and owner_user_id=current_user_id
      returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    end if;
  end if;

  if not found then raise exception 'Identity profile could not be updated.'; end if;

  return jsonb_build_object(
    'scope',resolved_scope,
    'entity_id',entity_id,
    'avatar_object_path',avatar_path,
    'banner_object_path',banner_path
  );
end;
$$;

revoke all on function public.set_my_identity_media_path(text,text,text) from public, anon;
grant execute on function public.set_my_identity_media_path(text,text,text) to authenticated, service_role;
