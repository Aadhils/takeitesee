alter table public.professional_portfolio_media
  add column moderation_state text not null default 'clear',
  add column moderation_updated_at timestamptz,
  add column moderation_updated_by uuid references public.users(id) on delete set null;

alter table public.professional_portfolio_media
  add constraint professional_portfolio_media_moderation_state_check
  check (moderation_state in ('clear','paused'));

create index professional_portfolio_media_moderation_updated_by_idx
  on public.professional_portfolio_media(moderation_updated_by)
  where moderation_updated_by is not null;

alter table public.marketplace_moderation_report_events
  drop constraint marketplace_moderation_report_events_event_type_check;
alter table public.marketplace_moderation_report_events
  add constraint marketplace_moderation_report_events_event_type_check
  check (event_type in ('opened','status_changed','note','content_action'));

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
    select 1
    from public.professional_roles role_row
    where role_row.id=target_professional_role_id
      and role_row.professional_id=profile_row.id
  ) then raise exception 'Portfolio role must belong to your professional profile.'; end if;

  select * into media_row
  from public.professional_portfolio_media
  where id=target_media_id
    and professional_id=profile_row.id
  for update;
  if not found then raise exception 'Portfolio media was not found.'; end if;

  if media_row.moderation_state='paused' and coalesce(target_active,true) then
    raise exception 'Portfolio media is paused by moderation and cannot be republished yet.';
  end if;

  update public.professional_portfolio_media
  set professional_role_id=target_professional_role_id,
      caption=clean_caption,
      alt_text=clean_alt,
      active=coalesce(target_active,true),
      display_order=target_display_order,
      updated_at=now()
  where id=media_row.id
  returning * into media_row;

  return media_row;
end;
$$;

revoke all on function public.update_professional_portfolio_media(uuid,uuid,text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.update_professional_portfolio_media(uuid,uuid,text,text,boolean,integer) to authenticated,service_role;

create or replace function public.admin_set_professional_portfolio_media_moderation(
  target_report_id uuid,
  requested_state text,
  requested_note text
)
returns public.professional_portfolio_media
language plpgsql
security definer
set search_path=''
as $$
declare
  report_row public.marketplace_moderation_reports%rowtype;
  media_row public.professional_portfolio_media%rowtype;
  professional_row public.professional_profiles%rowtype;
  state_value text:=lower(btrim(coalesce(requested_state,'')));
  note_value text:=nullif(btrim(coalesce(requested_note,'')),'');
  old_state text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if state_value not in ('clear','paused') then raise exception 'Portfolio moderation state is invalid.'; end if;
  if coalesce(char_length(note_value),0)<3 or char_length(note_value)>2000 then
    raise exception 'A moderation note between 3 and 2000 characters is required.';
  end if;

  select * into report_row
  from public.marketplace_moderation_reports
  where id=target_report_id
  for update;
  if not found then raise exception 'Moderation report was not found.'; end if;

  if report_row.context_kind<>'professional_portfolio' or report_row.target_type<>'portfolio_media' then
    raise exception 'This report does not control Professional portfolio media.';
  end if;
  if not private.marketplace_admin_can_manage_job() then
    raise exception 'Platform Admin manage permission is required for portfolio enforcement.';
  end if;

  select * into media_row
  from public.professional_portfolio_media
  where id=report_row.target_id
  for update;
  if not found then raise exception 'Reported portfolio media was not found.'; end if;

  select * into professional_row
  from public.professional_profiles
  where id=media_row.professional_id;
  if not found or professional_row.user_id is null then
    raise exception 'Portfolio professional identity is invalid.';
  end if;

  old_state:=media_row.moderation_state;
  if old_state=state_value then return media_row; end if;

  update public.professional_portfolio_media
  set moderation_state=state_value,
      active=false,
      moderation_updated_at=now(),
      moderation_updated_by=auth.uid(),
      updated_at=now()
  where id=media_row.id
  returning * into media_row;

  insert into public.marketplace_moderation_report_events(
    report_id,actor_user_id,actor_type,event_type,from_status,to_status,note
  ) values(
    report_row.id,auth.uid(),'admin','content_action',old_state,state_value,note_value
  );

  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(
    professional_row.user_id,
    'moderation_report_updated',
    case when state_value='paused' then 'Portfolio media paused' else 'Portfolio media restored' end,
    case when state_value='paused'
      then 'TakeItEsee moderation paused one of your portfolio work samples. It is no longer public.'
      else 'TakeItEsee moderation restored one of your portfolio work samples. It remains private until you choose to republish it.' end,
    '/provider/portfolio'
  );

  return media_row;
end;
$$;

revoke all on function public.admin_set_professional_portfolio_media_moderation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_professional_portfolio_media_moderation(uuid,text,text) to authenticated,service_role;

comment on column public.professional_portfolio_media.moderation_state is
  'Server-controlled portfolio visibility moderation state. paused overrides the owner active preference.';
comment on column public.professional_portfolio_media.moderation_updated_at is
  'Timestamp of the latest Admin portfolio visibility moderation action.';
comment on column public.professional_portfolio_media.moderation_updated_by is
  'Platform Admin who last changed portfolio visibility moderation state.';
