-- Align service activation with the existing public marketplace disclosure boundary.
-- Active services must be eligible to become customer-visible; a Provider with incomplete
-- legal/public-contact/grievance disclosure must finish that disclosure before activation.
-- Existing active rows are not mutated by this migration.
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remains HOLD.
-- Recurrence/recovery remains frozen.

create or replace function public.guard_service_publish_verified_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope_category text;
  scope_location text;
begin
  new.active := (new.status = 'active'::public.service_status);

  if new.status = 'active'::public.service_status then
    if not private.provider_owner_is_verified(
      new.provider_type::text,
      new.professional_id,
      new.business_id
    ) then
      raise exception 'Provider verification is required before a service can be published.';
    end if;

    if not private.provider_profile_is_complete(
      new.provider_type::text,
      new.professional_id,
      new.business_id
    ) then
      raise exception 'Complete the provider profile before publishing a service.';
    end if;

    if not private.provider_marketplace_disclosure_is_complete(
      new.provider_type::text,
      new.professional_id,
      new.business_id
    ) then
      raise exception 'Complete marketplace public disclosure before publishing a service.';
    end if;

    if not private.service_scope_is_launchable(new.id) then
      raise exception 'Platform category and location approval is required before a service can be published.';
    end if;

    if not private.provider_trust_allows_marketplace(
      new.provider_type::text,
      new.professional_id,
      new.business_id
    ) then
      raise exception 'Provider trust state must be normal before services can be published.';
    end if;

    select pc.name, pl.name
      into scope_category, scope_location
      from public.service_ecosystem_scope ses
      join public.platform_categories pc on pc.id = ses.category_id
      join public.platform_locations pl on pl.id = ses.location_id
     where ses.service_id = new.id
       and ses.enabled = true
     limit 1;

    if scope_category is null or scope_location is null then
      raise exception 'Platform category and location approval is required before a service can be published.';
    end if;

    if btrim(coalesce(new.category, '')) is distinct from scope_category
       or btrim(coalesce(new.location, '')) is distinct from scope_location then
      raise exception 'Service category and location must match the approved platform scope.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_service_publish_verified_provider() from public, anon, authenticated;
