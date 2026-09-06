-- Phase B: Provider avatar/banner assets are public marketplace identity media.
-- Customer media remains private. Provider paths intentionally omit auth user UUIDs.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('provider-identity-media','provider-identity-media',true,6291456,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- The private identity-media bucket is Customer-only from this migration onward.
drop policy if exists identity_media_owner_insert on storage.objects;
create policy identity_media_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=4
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[2]='customer'
  and (storage.foldername(storage.objects.name))[3]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[4] in ('avatar','banner')
);

drop policy if exists identity_media_owner_select on storage.objects;
create policy identity_media_owner_select
on storage.objects for select to authenticated
using (
  bucket_id='identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=4
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[2]='customer'
  and (storage.foldername(storage.objects.name))[3]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[4] in ('avatar','banner')
);

drop policy if exists identity_media_owner_delete on storage.objects;
create policy identity_media_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id='identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=4
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[2]='customer'
  and (storage.foldername(storage.objects.name))[3]=(select auth.uid())::text
  and (storage.foldername(storage.objects.name))[4] in ('avatar','banner')
);

-- Provider assets are publicly served, while list/write/delete remain owner-scoped.
drop policy if exists provider_identity_media_owner_insert on storage.objects;
create policy provider_identity_media_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='provider-identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=3
  and (storage.foldername(storage.objects.name))[1] in ('professional','business')
  and (storage.foldername(storage.objects.name))[3] in ('avatar','banner')
  and storage.objects.name ~ '/[0-9A-Fa-f-]{36}\.(jpg|png|webp)$'
  and (
    ((storage.foldername(storage.objects.name))[1]='professional' and exists (
      select 1 from public.professional_profiles p
      where p.id::text=(storage.foldername(storage.objects.name))[2]
        and p.user_id=(select auth.uid())
    ))
    or ((storage.foldername(storage.objects.name))[1]='business' and exists (
      select 1 from public.businesses b
      where b.id::text=(storage.foldername(storage.objects.name))[2]
        and b.owner_user_id=(select auth.uid())
    ))
  )
);

drop policy if exists provider_identity_media_owner_select on storage.objects;
create policy provider_identity_media_owner_select
on storage.objects for select to authenticated
using (
  bucket_id='provider-identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=3
  and (storage.foldername(storage.objects.name))[1] in ('professional','business')
  and (storage.foldername(storage.objects.name))[3] in ('avatar','banner')
  and (
    ((storage.foldername(storage.objects.name))[1]='professional' and exists (
      select 1 from public.professional_profiles p
      where p.id::text=(storage.foldername(storage.objects.name))[2]
        and p.user_id=(select auth.uid())
    ))
    or ((storage.foldername(storage.objects.name))[1]='business' and exists (
      select 1 from public.businesses b
      where b.id::text=(storage.foldername(storage.objects.name))[2]
        and b.owner_user_id=(select auth.uid())
    ))
  )
);

drop policy if exists provider_identity_media_owner_delete on storage.objects;
create policy provider_identity_media_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id='provider-identity-media'
  and array_length(storage.foldername(storage.objects.name),1)=3
  and (storage.foldername(storage.objects.name))[1] in ('professional','business')
  and (storage.foldername(storage.objects.name))[3] in ('avatar','banner')
  and (
    ((storage.foldername(storage.objects.name))[1]='professional' and exists (
      select 1 from public.professional_profiles p
      where p.id::text=(storage.foldername(storage.objects.name))[2]
        and p.user_id=(select auth.uid())
    ))
    or ((storage.foldername(storage.objects.name))[1]='business' and exists (
      select 1 from public.businesses b
      where b.id::text=(storage.foldername(storage.objects.name))[2]
        and b.owner_user_id=(select auth.uid())
    ))
  )
);

-- Provider DB paths are constrained to public-safe provider-id paths.
alter table public.professional_profiles drop constraint if exists professional_avatar_public_identity_path;
alter table public.professional_profiles add constraint professional_avatar_public_identity_path check (
  avatar_object_path is null or avatar_object_path ~ ('^professional/' || id::text || '/avatar/[0-9A-Fa-f-]{36}\.(jpg|png|webp)$')
);
alter table public.professional_profiles drop constraint if exists professional_banner_public_identity_path;
alter table public.professional_profiles add constraint professional_banner_public_identity_path check (
  banner_object_path is null or banner_object_path ~ ('^professional/' || id::text || '/banner/[0-9A-Fa-f-]{36}\.(jpg|png|webp)$')
);
alter table public.businesses drop constraint if exists business_avatar_public_identity_path;
alter table public.businesses add constraint business_avatar_public_identity_path check (
  avatar_object_path is null or avatar_object_path ~ ('^business/' || id::text || '/avatar/[0-9A-Fa-f-]{36}\.(jpg|png|webp)$')
);
alter table public.businesses drop constraint if exists business_banner_public_identity_path;
alter table public.businesses add constraint business_banner_public_identity_path check (
  banner_object_path is null or banner_object_path ~ ('^business/' || id::text || '/banner/[0-9A-Fa-f-]{36}\.(jpg|png|webp)$')
);

-- These paths contain only public Provider type/id/media identifiers; no auth user UUID.
grant select (avatar_object_path,banner_object_path) on public.professional_profiles to anon;
grant select (avatar_object_path,banner_object_path) on public.businesses to anon;

create or replace function public.set_my_identity_media_path(target_context text,target_kind text,target_path text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  current_user_id uuid := auth.uid();
  entity_id uuid;
  resolved_scope text;
  path_parts text[];
  avatar_path text;
  banner_path text;
begin
  if current_user_id is null then raise exception 'Authentication required.'; end if;
  if target_context not in ('customer','provider') then raise exception 'Invalid identity context.'; end if;
  if target_kind not in ('avatar','banner') then raise exception 'Invalid identity media kind.'; end if;

  if target_context='customer' then
    resolved_scope := 'customer'; entity_id := current_user_id;
  else
    select p.id into entity_id from public.professional_profiles p where p.user_id=current_user_id limit 1;
    if entity_id is not null then resolved_scope := 'professional';
    else
      select b.id into entity_id from public.businesses b where b.owner_user_id=current_user_id limit 1;
      if entity_id is null then raise exception 'Provider profile is required.'; end if;
      resolved_scope := 'business';
    end if;
  end if;

  if target_path is not null then
    path_parts := string_to_array(target_path,'/');
    if resolved_scope='customer' then
      if cardinality(path_parts)<>5
         or path_parts[1]<>current_user_id::text
         or path_parts[2]<>'customer'
         or path_parts[3]<>current_user_id::text
         or path_parts[4]<>target_kind
         or path_parts[5] !~ '^[0-9A-Fa-f-]{36}\.(jpg|png|webp)$' then
        raise exception 'Identity media path does not belong to this account workspace.';
      end if;
    else
      if cardinality(path_parts)<>4
         or path_parts[1]<>resolved_scope
         or path_parts[2]<>entity_id::text
         or path_parts[3]<>target_kind
         or path_parts[4] !~ '^[0-9A-Fa-f-]{36}\.(jpg|png|webp)$' then
        raise exception 'Identity media path does not belong to this Provider workspace.';
      end if;
    end if;
  end if;

  if resolved_scope='customer' then
    if target_kind='avatar' then
      update public.customer_profiles set avatar_object_path=target_path,updated_at=now()
      where user_id=current_user_id returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    else
      update public.customer_profiles set banner_object_path=target_path,updated_at=now()
      where user_id=current_user_id returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    end if;
  elsif resolved_scope='professional' then
    if target_kind='avatar' then
      update public.professional_profiles set avatar_object_path=target_path,updated_at=now()
      where id=entity_id and user_id=current_user_id returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    else
      update public.professional_profiles set banner_object_path=target_path,updated_at=now()
      where id=entity_id and user_id=current_user_id returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    end if;
  else
    if target_kind='avatar' then
      update public.businesses set avatar_object_path=target_path,updated_at=now()
      where id=entity_id and owner_user_id=current_user_id returning avatar_object_path,banner_object_path into avatar_path,banner_path;
    else
      update public.businesses set banner_object_path=target_path,updated_at=now()
      where id=entity_id and owner_user_id=current_user_id returning avatar_object_path,banner_object_path into avatar_path,banner_path;
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

revoke all on function public.set_my_identity_media_path(text,text,text) from public,anon;
grant execute on function public.set_my_identity_media_path(text,text,text) to authenticated,service_role;
