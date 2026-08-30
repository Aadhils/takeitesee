-- Customer-safe proposal comparison read model. No provider private contact data is exposed.
create or replace function public.get_customer_requirement_proposals(target_requirement_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Customer authentication required.'; end if;
  if not exists(select 1 from public.customer_requirements r where r.id=target_requirement_id and r.customer_id=auth.uid()) then
    raise exception 'You can view proposals only for your own requirement.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'proposal_reference',p.proposal_reference,
    'provider_user_id',p.provider_user_id,
    'provider_display_name',case
      when s.provider_type::text='business' then coalesce(nullif(btrim(b.name),''),'Verified business')
      else coalesce(nullif(btrim(pp.headline),''),'Verified professional')
    end,
    'provider_type',s.provider_type::text,
    'service_id',p.service_id,
    'service_name',s.name,
    'amount_minor',p.amount_minor,
    'currency',p.currency,
    'message',p.message,
    'estimated_start_date',p.estimated_start_date,
    'status',p.status,
    'submitted_at',p.submitted_at,
    'decided_at',p.decided_at
  ) order by p.created_at desc),'[]'::jsonb)
  into result_value
  from public.requirement_proposals p
  join public.services s on s.id=p.service_id
  left join public.businesses b on b.id=s.business_id
  left join public.professional_profiles pp on pp.id=s.professional_id
  where p.requirement_id=target_requirement_id;
  return result_value;
end;
$$;
revoke all on function public.get_customer_requirement_proposals(uuid) from public,anon;
grant execute on function public.get_customer_requirement_proposals(uuid) to authenticated;
