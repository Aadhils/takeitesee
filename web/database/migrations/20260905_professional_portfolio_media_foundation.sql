-- Product: Professional portfolio media foundation.
--
-- Adds private, owner-controlled photo/video storage for professional work samples.
-- Public professional pages receive only active media from verified professionals via
-- short-lived server-signed URLs. Subscription limits, ranking boosts, resume/job
-- workflows, social interactions and finance behavior remain outside this slice.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'professional-portfolio-media',
  'professional-portfolio-media',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types,
  updated_at=now();

create table if not exists public.professional_portfolio_media (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  professional_role_id uuid references public.professional_roles(id) on delete set null,
  media_type text not null check (media_type in ('image','video')),
  object_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  caption text,
  alt_text text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_portfolio_media_filename_length_check
    check (char_length(original_filename) between 1 and 255),
  constraint professional_portfolio_media_object_path_length_check
    check (char_length(object_path) between 10 and 1000),
  constraint professional_portfolio_media_caption_length_check
    check (caption is null or char_length(caption) <= 600),
  constraint professional_portfolio_media_alt_text_length_check
    check (alt_text is null or char_length(alt_text) <= 240),
  constraint professional_portfolio_media_display_order_check
    check (display_order between 0 and 9999),
  constraint professional_portfolio_media_image_size_check
    check (media_type <> 'image' or size_bytes <= 8388608)
);

create index if not exists professional_portfolio_media_professional_active_order_idx
  on public.professional_portfolio_media(professional_id,active,display_order,created_at desc);
create index if not exists professional_portfolio_media_role_active_order_idx
  on public.professional_portfolio_media(professional_role_id,active,display_order,created_at desc)
  where professional_role_id is not null;

alter table public.professional_portfolio_media enable row level security;

revoke all on table public.professional_portfolio_media from public,anon,authenticated;
grant select on table public.professional_portfolio_media to authenticated;
grant select,insert,update,delete on table public.professional_portfolio_media to service_role;

-- Owners can read all of their portfolio metadata, including paused items.
drop policy if exists professional_portfolio_media_owner_read on public.professional_portfolio_media;
create policy professional_portfolio_media_owner_read
on public.professional_portfolio_media
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id=professional_portfolio_media.professional_id
      and profile.user_id=(select auth.uid())
  )
);

-- Storage path: <user-id>/<professional-id>/<random-file-name>.
-- The bucket is private. There is intentionally no anon/public object SELECT policy.
drop policy if exists professional_portfolio_storage_owner_insert on storage.objects;
create policy professional_portfolio_storage_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='professional-portfolio-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.professional_profiles profile
    where profile.id::text=(storage.foldername(name))[2]
      and profile.user_id=(select auth.uid())
  )
);

drop policy if exists professional_portfolio_storage_owner_read on storage.objects;
create policy professional_portfolio_storage_owner_read
on storage.objects
for select
to authenticated
using (
  bucket_id='professional-portfolio-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.professional_profiles profile
    where profile.id::text=(storage.foldername(name))[2]
      and profile.user_id=(select auth.uid())
  )
);

drop policy if exists professional_portfolio_storage_owner_delete on storage.objects;
create policy professional_portfolio_storage_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id='professional-portfolio-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.professional_profiles profile
    where profile.id::text=(storage.foldername(name))[2]
      and profile.user_id=(select auth.uid())
  )
);

create or replace function public.register_professional_portfolio_media(
  target_object_path text,
  target_original_filename text,
  target_professional_role_id uuid default null,
  target_caption text default null,
  target_alt_text text default null,
  target_active boolean default true
)
returns public.professional_portfolio_media
language plpgsql
security definer
set search_path=''
as $$
declare
  profile_row public.professional_profiles%rowtype;
  media_row public.professional_portfolio_media%rowtype;
  object_meta jsonb;
  actual_mime text;
  actual_size bigint;
  media_kind text;
  expected_prefix text;
  clean_filename text:=btrim(coalesce(target_original_filename,''));
  clean_caption text:=nullif(btrim(coalesce(target_caption,'')),'');
  clean_alt text:=nullif(btrim(coalesce(target_alt_text,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into profile_row
  from public.professional_profiles
  where user_id=auth.uid();
  if not found then raise exception 'A professional provider profile is required.'; end if;

  expected_prefix:=auth.uid()::text || '/' || profile_row.id::text || '/';
  if target_object_path is null or left(target_object_path,char_length(expected_prefix))<>expected_prefix then
    raise exception 'Portfolio media path is invalid.';
  end if;
  if char_length(clean_filename)<1 or char_length(clean_filename)>255 then
    raise exception 'Portfolio file name is invalid.';
  end if;
  if clean_caption is not null and char_length(clean_caption)>600 then
    raise exception 'Portfolio caption must be 600 characters or fewer.';
  end if;
  if clean_alt is not null and char_length(clean_alt)>240 then
    raise exception 'Portfolio alt text must be 240 characters or fewer.';
  end if;

  if target_professional_role_id is not null and not exists (
    select 1 from public.professional_roles role_row
    where role_row.id=target_professional_role_id
      and role_row.professional_id=profile_row.id
  ) then
    raise exception 'Portfolio role must belong to your professional profile.';
  end if;

  select metadata into object_meta
  from storage.objects
  where bucket_id='professional-portfolio-media'
    and name=target_object_path;
  if object_meta is null then raise exception 'Uploaded portfolio media was not found.'; end if;

  actual_mime:=coalesce(object_meta->>'mimetype','');
  actual_size:=coalesce(nullif(object_meta->>'size','')::bigint,0);

  if actual_mime in ('image/jpeg','image/png','image/webp') then
    media_kind:='image';
    if actual_size<=0 or actual_size>8388608 then
      raise exception 'Portfolio images must be 8 MB or smaller.';
    end if;
  elsif actual_mime in ('video/mp4','video/webm') then
    media_kind:='video';
    if actual_size<=0 or actual_size>26214400 then
      raise exception 'Portfolio videos must be 25 MB or smaller.';
    end if;
  else
    raise exception 'Unsupported portfolio media type.';
  end if;

  insert into public.professional_portfolio_media(
    professional_id,professional_role_id,media_type,object_path,original_filename,mime_type,size_bytes,caption,alt_text,active
  ) values(
    profile_row.id,target_professional_role_id,media_kind,target_object_path,clean_filename,actual_mime,actual_size,clean_caption,clean_alt,coalesce(target_active,true)
  )
  on conflict (object_path) do nothing
  returning * into media_row;

  if media_row.id is null then
    select * into media_row
    from public.professional_portfolio_media
    where object_path=target_object_path
      and professional_id=profile_row.id;
  end if;
  if media_row.id is null then raise exception 'Portfolio media could not be registered.'; end if;
  return media_row;
end;
$$;
revoke all on function public.register_professional_portfolio_media(text,text,uuid,text,text,boolean) from public,anon;
grant execute on function public.register_professional_portfolio_media(text,text,uuid,text,text,boolean) to authenticated;

create or replace function public.update_professional_portfolio_media(
  target_media_id uuid,
  target_professional_role_id uuid default null,
  target_caption text default null,
  target_alt_text text default null,
  target_active boolean default true,
  target_display_order integer default 0
)
returns public.professional_portfolio_media
language plpgsql
security definer
set search_path=''
as $$
declare
  profile_row public.professional_profiles%rowtype;
  media_row public.professional_portfolio_media%rowtype;
  clean_caption text:=nullif(btrim(coalesce(target_caption,'')),'');
  clean_alt text:=nullif(btrim(coalesce(target_alt_text,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if target_display_order<0 or target_display_order>9999 then raise exception 'Display order must be between 0 and 9999.'; end if;
  if clean_caption is not null and char_length(clean_caption)>600 then raise exception 'Portfolio caption must be 600 characters or fewer.'; end if;
  if clean_alt is not null and char_length(clean_alt)>240 then raise exception 'Portfolio alt text must be 240 characters or fewer.'; end if;

  select * into profile_row
  from public.professional_profiles
  where user_id=auth.uid();
  if not found then raise exception 'A professional provider profile is required.'; end if;

  if target_professional_role_id is not null and not exists (
    select 1 from public.professional_roles role_row
    where role_row.id=target_professional_role_id
      and role_row.professional_id=profile_row.id
  ) then
    raise exception 'Portfolio role must belong to your professional profile.';
  end if;

  update public.professional_portfolio_media
  set professional_role_id=target_professional_role_id,
      caption=clean_caption,
      alt_text=clean_alt,
      active=coalesce(target_active,true),
      display_order=target_display_order,
      updated_at=now()
  where id=target_media_id
    and professional_id=profile_row.id
  returning * into media_row;

  if media_row.id is null then raise exception 'Portfolio media was not found.'; end if;
  return media_row;
end;
$$;
revoke all on function public.update_professional_portfolio_media(uuid,uuid,text,text,boolean,integer) from public,anon;
grant execute on function public.update_professional_portfolio_media(uuid,uuid,text,text,boolean,integer) to authenticated;

create or replace function public.delete_professional_portfolio_media(target_media_id uuid)
returns public.professional_portfolio_media
language plpgsql
security definer
set search_path=''
as $$
declare
  profile_row public.professional_profiles%rowtype;
  media_row public.professional_portfolio_media%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into profile_row
  from public.professional_profiles
  where user_id=auth.uid();
  if not found then raise exception 'A professional provider profile is required.'; end if;

  select * into media_row
  from public.professional_portfolio_media
  where id=target_media_id
    and professional_id=profile_row.id;
  if not found then raise exception 'Portfolio media was not found.'; end if;

  if exists (
    select 1 from storage.objects
    where bucket_id='professional-portfolio-media'
      and name=media_row.object_path
  ) then
    raise exception 'Remove the portfolio storage object before deleting its metadata.';
  end if;

  delete from public.professional_portfolio_media
  where id=media_row.id;
  return media_row;
end;
$$;
revoke all on function public.delete_professional_portfolio_media(uuid) from public,anon;
grant execute on function public.delete_professional_portfolio_media(uuid) to authenticated;

comment on table public.professional_portfolio_media is
  'Professional-owned photo/video work samples stored privately and selectively presented on verified public profiles.';
comment on column public.professional_portfolio_media.professional_role_id is
  'Optional professional talent/role this work sample demonstrates.';
comment on column public.professional_portfolio_media.active is
  'When true, this media item may appear on the verified public professional profile.';