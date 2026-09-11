-- Service search unified Professional + Business / normal + precise-nearby E2E verification.
--
-- This verifier intentionally reuses the known quarantined synthetic marketplace fixtures.
-- All fixture mutations run inside an exception-backed subtransaction and are rolled back.
-- The script must leave the synthetic Business unverified and both services paused/inactive.
--
-- Verified behavior:
-- 1. Normal Service search returns both Professional and Business for the same canonical alias query.
-- 2. Precise-nearby search returns the same two candidates.
-- 3. Non-geo relevance score is identical between normal and nearby paths per service.
-- 4. Nearby relevance differs from normal relevance only by the documented distance contribution.
-- 5. Availability/capability weighting makes the richer Professional rank first in normal search.
-- 6. Strong nearby distance makes the closer Business rank first for near-me relevance.
-- 7. All fixture changes are rolled back and quarantine remains intact.
--
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD.
-- Recurrence/recovery remains FROZEN. Supabase leaked-password protection remains HOLD.

create temp table if not exists pg_temp.service_search_e2e_result(payload jsonb);
truncate pg_temp.service_search_e2e_result;

do $acceptance$
declare
  professional_id constant uuid := '412062ab-8eda-488d-81ea-124d03cdb210'::uuid;
  business_id constant uuid := '2dede740-9d64-4b93-95b9-746105a73234'::uuid;
  professional_service_id constant uuid := '89e139e5-8da2-4a91-9c64-79b789cec764'::uuid;
  business_service_id constant uuid := '5a0030bd-df7e-47f6-8f88-97f07530bb91'::uuid;
  services_application_id constant uuid := 'a1e5b3d1-3897-4e59-8398-d76bf0aaf648'::uuid;
  software_category_id constant uuid := 'd5a7f37f-fd8d-4cec-b491-f0caf83172fd'::uuid;
  chennai_location_id constant uuid := 'e21d29d2-66ba-423d-b9cb-1c843c0ef00a'::uuid;
  result_payload jsonb;
  forced_rollback boolean := false;
begin
  begin
    -- Re-open only the exact known synthetic fixture inside this subtransaction.
    update public.businesses
    set verified = true, updated_at = now()
    where id = business_id
      and name = 'Takeitesee Test Business'
      and description = 'Synthetic business record for testing only.';

    -- The Professional fixture predates marketplace-disclosure enforcement. Copy the
    -- already-complete synthetic Business disclosure only for this rollback-only test.
    update public.professional_profiles p
    set legal_name = b.legal_name,
        principal_address = b.principal_address,
        public_contact_email = b.public_contact_email,
        public_contact_phone = b.public_contact_phone,
        grievance_officer_name = b.grievance_officer_name,
        grievance_officer_designation = b.grievance_officer_designation,
        grievance_email = b.grievance_email,
        grievance_phone = b.grievance_phone,
        verified = true,
        updated_at = now()
    from public.businesses b
    where p.id = professional_id
      and p.headline = 'Takeitesee Test Professional'
      and p.description = 'Synthetic professional record for testing only.'
      and b.id = business_id;

    -- Persist catalog metadata while services remain paused. The publication guard
    -- deliberately evaluates the persisted category/location when status becomes active.
    update public.services
    set category = 'Custom Software & IT Support',
        category_code = 'software_it_support',
        location = 'Chennai',
        updated_at = now()
    where id in (professional_service_id, business_service_id)
      and status = 'paused'::public.service_status;

    -- Use the real active Services application/category/location approval scope.
    insert into public.service_ecosystem_scope(
      service_id, application_id, category_id, location_id, enabled
    )
    values
      (professional_service_id, services_application_id, software_category_id, chennai_location_id, true),
      (business_service_id, services_application_id, software_category_id, chennai_location_id, true)
    on conflict (service_id) do update
      set application_id = excluded.application_id,
          category_id = excluded.category_id,
          location_id = excluded.location_id,
          enabled = true,
          updated_at = now();

    -- Activate through the normal publication guard after scope and metadata agree.
    update public.services
    set status = 'active'::public.service_status,
        updated_at = now()
    where id in (professional_service_id, business_service_id);

    -- Give the Professional broader delivery readiness so normal relevance has a
    -- deterministic availability/capability preference independent of geography.
    insert into public.service_availability(service_id, mode, timezone)
    values
      (professional_service_id, 'always_available'::public.availability_mode, 'Asia/Kolkata'),
      (business_service_id, 'on_request'::public.availability_mode, 'Asia/Kolkata')
    on conflict (service_id) do update
      set mode = excluded.mode,
          timezone = excluded.timezone,
          updated_at = now();

    insert into public.service_fulfillment_modes(
      service_id, mode, max_travel_distance_meters, active
    )
    values
      (professional_service_id, 'at_provider'::public.marketplace_service_fulfillment_mode, null, true),
      (professional_service_id, 'at_customer'::public.marketplace_service_fulfillment_mode, 50000, true),
      (professional_service_id, 'remote'::public.marketplace_service_fulfillment_mode, null, true),
      (business_service_id, 'at_provider'::public.marketplace_service_fulfillment_mode, null, true)
    on conflict (service_id, mode) do update
      set max_travel_distance_meters = excluded.max_travel_distance_meters,
          active = true,
          updated_at = now();

    -- Create deterministic Chennai test distances: Business at the origin, Professional farther away.
    delete from public.service_geo_locations
    where service_id in (professional_service_id, business_service_id);

    insert into public.service_geo_locations(
      service_id, role, label, point, is_primary, active
    )
    values
      (
        professional_service_id,
        'service_site'::public.service_geo_location_role,
        'Synthetic professional distant site',
        extensions.st_point(80.4000, 13.0827)::extensions.geography,
        true,
        true
      ),
      (
        business_service_id,
        'service_site'::public.service_geo_location_role,
        'Synthetic business near site',
        extensions.st_point(80.2707, 13.0827)::extensions.geography,
        true,
        true
      );

    -- Execute through the same anon role used by the public marketplace API.
    set local role anon;

    with normal as (
      select id, provider_type::text as provider_type, relevance_score, rating, review_count
      from public.search_marketplace_service_discovery_candidates_v2(
        'software developer',
        array['software', 'developer']::text[],
        'all', null, 'any', 'any', 'any', false, 'relevance', 0, 10
      )
      where id in (professional_service_id, business_service_id)
    ), nearby as (
      select id, provider_type::text as provider_type, relevance_score, rating, review_count,
             distance_priority, nearby_match_mode
      from public.search_marketplace_service_nearby_candidates_v2(
        13.0827, 80.2707,
        'software developer',
        array['software', 'developer']::text[],
        'all', null, 'any', 'any', 'any', false, 'relevance', true, 0, 10
      )
      where id in (professional_service_id, business_service_id)
    ), parity as (
      select
        n.id,
        n.provider_type,
        n.relevance_score as normal_score,
        p.relevance_score as nearby_score,
        p.distance_priority,
        p.nearby_match_mode,
        least(30, round(coalesce(p.distance_priority, 0) * 1.25)::integer) as expected_geo_add,
        p.relevance_score
          - least(30, round(coalesce(p.distance_priority, 0) * 1.25)::integer) as nearby_base_score
      from normal n
      join nearby p using (id, provider_type)
    )
    select jsonb_build_object(
      'normal_count', (select count(*) from normal),
      'nearby_count', (select count(*) from nearby),
      'normal_has_both', (select count(distinct provider_type) = 2 from normal),
      'nearby_has_both', (select count(distinct provider_type) = 2 from nearby),
      'base_score_parity', (
        select coalesce(bool_and(normal_score = nearby_base_score), false) from parity
      ),
      'geo_only_delta', (
        select coalesce(bool_and(nearby_score - normal_score = expected_geo_add), false) from parity
      ),
      'normal_top_provider', (
        select provider_type
        from normal
        order by relevance_score desc, rating desc, review_count desc, id asc
        limit 1
      ),
      'nearby_top_provider', (
        select provider_type
        from nearby
        order by relevance_score desc, rating desc, review_count desc, id asc
        limit 1
      ),
      'rows', (select jsonb_agg(to_jsonb(parity) order by provider_type) from parity)
    )
    into result_payload;

    reset role;

    if coalesce((result_payload ->> 'normal_count')::integer, 0) <> 2
       or coalesce((result_payload ->> 'nearby_count')::integer, 0) <> 2
       or coalesce((result_payload ->> 'normal_has_both')::boolean, false) is not true
       or coalesce((result_payload ->> 'nearby_has_both')::boolean, false) is not true
       or coalesce((result_payload ->> 'base_score_parity')::boolean, false) is not true
       or coalesce((result_payload ->> 'geo_only_delta')::boolean, false) is not true
       or result_payload ->> 'normal_top_provider' <> 'professional'
       or result_payload ->> 'nearby_top_provider' <> 'business' then
      raise exception 'Service search E2E assertion failed: %', result_payload;
    end if;

    -- Force rollback of every fixture mutation after successful assertions.
    forced_rollback := true;
    raise exception 'TAKEITESEE_SERVICE_SEARCH_E2E_ROLLBACK';
  exception
    when others then
      if forced_rollback and sqlerrm = 'TAKEITESEE_SERVICE_SEARCH_E2E_ROLLBACK' then
        null;
      else
        raise;
      end if;
  end;

  insert into pg_temp.service_search_e2e_result(payload)
  values (result_payload || jsonb_build_object('fixture_changes_rolled_back', true));
end
$acceptance$;

select payload from pg_temp.service_search_e2e_result;

-- Residue guard: these values must describe the quarantined post-test state.
select jsonb_build_object(
  'active_services_total', (
    select count(*) from public.services where active = true and status = 'active'::public.service_status
  ),
  'synthetic_business_verified', (
    select verified from public.businesses where id = '2dede740-9d64-4b93-95b9-746105a73234'::uuid
  ),
  'fixture_active_services', (
    select count(*) from public.services
    where id in (
      '89e139e5-8da2-4a91-9c64-79b789cec764'::uuid,
      '5a0030bd-df7e-47f6-8f88-97f07530bb91'::uuid
    )
      and (active = true or status = 'active'::public.service_status)
  ),
  'fixture_scope_rows', (
    select count(*) from public.service_ecosystem_scope
    where service_id in (
      '89e139e5-8da2-4a91-9c64-79b789cec764'::uuid,
      '5a0030bd-df7e-47f6-8f88-97f07530bb91'::uuid
    )
  ),
  'fixture_geo_rows', (
    select count(*) from public.service_geo_locations
    where service_id in (
      '89e139e5-8da2-4a91-9c64-79b789cec764'::uuid,
      '5a0030bd-df7e-47f6-8f88-97f07530bb91'::uuid
    )
  )
) as residue_state;
