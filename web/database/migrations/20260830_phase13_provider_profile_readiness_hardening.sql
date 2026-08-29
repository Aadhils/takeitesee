-- Keep live service state consistent with provider profile readiness.
create or replace function public.update_provider_profile(
  requested_display_name text,
  requested_description text,
  requested_location text
)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  business_id_value uuid;
  professional_id_value uuid;
  display_value text:=btrim(coalesce(requested_display_name,''));
  description_value text:=nullif(btrim(coalesce(requested_description,'')),'');
  location_value text:=btrim(coalesce(requested_location,''));
  complete_value boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(display_value)<2 or char_length(display_value)>120 then raise exception 'Display name must be 2 to 120 characters.'; end if;
  if description_value is not null and char_length(description_value)>1200 then raise exception 'Description must be 1200 characters or fewer.'; end if;
  if char_length(location_value)<2 or char_length(location_value)>160 then raise exception 'Service area must be 2 to 160 characters.'; end if;

  select id into business_id_value from public.businesses where owner_user_id=auth.uid() limit 1;
  if business_id_value is not null then
    update public.businesses set name=display_value,description=description_value,location=location_value,updated_at=now() where id=business_id_value;
    complete_value:=public.provider_profile_is_complete('business',null,business_id_value);
    if not complete_value then
      update public.services set status='paused'::public.service_status,active=false,updated_at=now()
      where business_id=business_id_value and status='active'::public.service_status;
    end if;
    return jsonb_build_object('provider_type','business','provider_id',business_id_value,'profile_complete',complete_value);
  end if;

  select id into professional_id_value from public.professional_profiles where user_id=auth.uid() limit 1;
  if professional_id_value is null then raise exception 'Provider profile was not found.'; end if;
  update public.professional_profiles set headline=display_value,description=description_value,service_area=location_value,updated_at=now() where id=professional_id_value;
  complete_value:=public.provider_profile_is_complete('professional',professional_id_value,null);
  if not complete_value then
    update public.services set status='paused'::public.service_status,active=false,updated_at=now()
    where professional_id=professional_id_value and status='active'::public.service_status;
  end if;
  return jsonb_build_object('provider_type','professional','provider_id',professional_id_value,'profile_complete',complete_value);
end;
$$;
revoke all on function public.update_provider_profile(text,text,text) from public,anon;
grant execute on function public.update_provider_profile(text,text,text) to authenticated;
