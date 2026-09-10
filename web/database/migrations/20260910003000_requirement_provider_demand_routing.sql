-- Marketplace demand routing: route new customer requirements to matching Providers.
-- Preserves the existing pull-based Provider Leads marketplace while adding a capped,
-- in-app notification shortlist prioritized by live availability.
-- No finance/payment/refund/payout/recovery behavior is changed.

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications
  add constraint notifications_event_type_check
  check (event_type = any (array[
    'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
    'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
    'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
    'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
    'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
    'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
    'provider_reverification_required','provider_suspended','provider_restored','provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed','provider_payout_destination_updated',
    'refund_requested','refund_onhold','refund_failed','refund_cancelled','payment_dispute_opened','payment_dispute_resolved','provider_finance_hold','provider_recovery_required','provider_recovery_resolved',
    'requirement_chat_opened','message_received','moderation_report_updated','job_chat_opened','job_interview_scheduled','job_interview_rescheduled','job_interview_accepted','job_interview_declined','job_interview_cancelled',
    'job_offer_issued','job_offer_accepted','job_offer_declined','job_offer_withdrawn','product_order_requested','product_order_accepted','product_order_declined','product_order_fulfilled','product_order_cancelled',
    'provider_requirement_match'
  ]::text[]));

create unique index if not exists notifications_provider_requirement_match_unique_idx
  on public.notifications(recipient_user_id,event_type,target_path)
  where event_type='provider_requirement_match';

create or replace function public.provider_service_matches_requirement(
  target_service_id uuid,
  target_requirement_id uuid,
  target_provider_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.services s
    join public.service_ecosystem_scope ses on ses.service_id=s.id and ses.enabled=true
    join public.customer_requirements r on r.id=target_requirement_id
    where s.id=target_service_id
      and r.status='open'
      and ses.location_id=r.location_id
      and public.requirement_category_matches_scope(ses.category_id,r.category_id)
      and s.status='active'::public.service_status
      and s.active=true
      and private.provider_owner_is_verified(s.provider_type::text,s.professional_id,s.business_id)
      and private.provider_profile_is_complete(s.provider_type::text,s.professional_id,s.business_id)
      and private.provider_trust_allows_marketplace(s.provider_type::text,s.professional_id,s.business_id)
      and private.service_scope_is_launchable(s.id)
      and exists(
        select 1
        from public.service_fulfillment_modes sfm
        where sfm.service_id=s.id
          and sfm.active=true
          and (
            r.service_mode='either'
            or (r.service_mode='remote' and sfm.mode='remote'::public.marketplace_service_fulfillment_mode)
            or (
              r.service_mode='onsite'
              and sfm.mode in (
                'at_provider'::public.marketplace_service_fulfillment_mode,
                'at_customer'::public.marketplace_service_fulfillment_mode
              )
            )
          )
      )
      and (
        exists(
          select 1 from public.professional_profiles pp
          where pp.id=s.professional_id and pp.user_id=target_provider_user_id
        )
        or exists(
          select 1 from public.businesses b
          where b.id=s.business_id and b.owner_user_id=target_provider_user_id
        )
      )
  );
$$;
revoke all on function public.provider_service_matches_requirement(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.provider_service_matches_requirement(uuid,uuid,uuid) to service_role;

create or replace function private.route_requirement_match_notifications()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  category_name text;
  location_name text;
begin
  if new.status<>'open' then
    return new;
  end if;

  select c.name,l.name into category_name,location_name
  from public.platform_categories c
  cross join public.platform_locations l
  where c.id=new.category_id and l.id=new.location_id;

  begin
    with candidate_services as (
      select
        case
          when s.provider_type::text='professional' then pp.user_id
          when s.provider_type::text='business' then b.owner_user_id
          else null
        end as provider_user_id,
        s.id as service_id,
        s.updated_at as service_updated_at,
        case
          when pla.work_mode::text='available'
            and pla.mode_expires_at is not null
            and pla.mode_expires_at>now() then 0
          when pla.work_mode::text='busy'
            and pla.mode_expires_at is not null
            and pla.mode_expires_at>now() then 1
          when pla.work_mode::text='paused' then 3
          else 2
        end as live_rank
      from public.services s
      left join public.professional_profiles pp
        on pp.id=s.professional_id and s.provider_type::text='professional'
      left join public.businesses b
        on b.id=s.business_id and s.provider_type::text='business'
      left join public.provider_live_availability pla
        on pla.provider_type=s.provider_type
       and (
         (s.provider_type::text='professional' and pla.professional_id=s.professional_id)
         or (s.provider_type::text='business' and pla.business_id=s.business_id)
       )
      where coalesce(pp.user_id,b.owner_user_id) is not null
        and coalesce(pp.user_id,b.owner_user_id)<>new.customer_id
        and public.provider_service_matches_requirement(
          s.id,
          new.id,
          coalesce(pp.user_id,b.owner_user_id)
        )
    ), provider_best as (
      select distinct on (provider_user_id)
        provider_user_id,
        service_id,
        service_updated_at,
        live_rank
      from candidate_services
      where provider_user_id is not null
      order by provider_user_id,live_rank asc,service_updated_at desc,service_id
    ), ranked as (
      select
        provider_user_id,
        service_id,
        live_rank,
        row_number() over(
          order by live_rank asc,service_updated_at desc,provider_user_id
        ) as route_rank
      from provider_best
    )
    insert into public.notifications(
      recipient_user_id,event_type,title,body,target_path
    )
    select
      provider_user_id,
      'provider_requirement_match',
      'New matching customer requirement',
      coalesce(category_name,'Service')||' · '||coalesce(location_name,'Location')||': '||left(new.title,180),
      '/provider/leads?requirement='||new.id::text
    from ranked
    where route_rank<=50
    on conflict (recipient_user_id,event_type,target_path)
      where event_type='provider_requirement_match'
      do nothing;
  exception when others then
    -- Demand notifications are enrichment. A routing failure must never block the
    -- customer's requirement from being created; Provider Leads remains available.
    raise warning 'Requirement provider routing failed for %: %',new.id,sqlerrm;
  end;

  return new;
end;
$$;
revoke all on function private.route_requirement_match_notifications() from public,anon,authenticated;

drop trigger if exists customer_requirements_route_provider_matches on public.customer_requirements;
create trigger customer_requirements_route_provider_matches
after insert on public.customer_requirements
for each row execute function private.route_requirement_match_notifications();
