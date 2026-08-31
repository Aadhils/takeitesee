-- Phase 17: fix provider trust-state trigger field access for business onboarding.
--
-- The shared trigger previously referenced NEW.user_id in a compound condition before the
-- businesses branch could be selected. On a businesses row, that field does not exist, so
-- business-provider creation could fail with `record "new" has no field "user_id"`.
--
-- Route by trigger table first, then access only columns that exist on that row type. Keep
-- professional behavior unchanged, preserve the existing trust-state values, and pin the
-- SECURITY DEFINER trigger function to an empty search_path because all application-owned
-- relation references are explicitly schema-qualified.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

create or replace function public.ensure_provider_trust_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'professional_profiles' then
    if new.user_id is not null then
      insert into public.provider_trust_states(
        provider_type,
        professional_id,
        business_id,
        owner_user_id,
        status,
        reason
      )
      values(
        'professional',
        new.id,
        null,
        new.user_id,
        'normal',
        'Provider account created.'
      )
      on conflict do nothing;
    end if;
  elsif tg_table_name = 'businesses' then
    if new.owner_user_id is not null then
      insert into public.provider_trust_states(
        provider_type,
        professional_id,
        business_id,
        owner_user_id,
        status,
        reason
      )
      values(
        'business',
        null,
        new.id,
        new.owner_user_id,
        'normal',
        'Provider account created.'
      )
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;
