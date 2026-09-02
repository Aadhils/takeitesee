-- Record signup legal acceptance without touching finance/payment behavior.

create table if not exists public.account_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  age_18_confirmed boolean not null check (age_18_confirmed),
  terms_version text not null check (char_length(btrim(terms_version)) > 0),
  privacy_version text not null check (char_length(btrim(privacy_version)) > 0),
  acceptance_source text not null default 'signup' check (acceptance_source = 'signup'),
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version, acceptance_source)
);

create index if not exists account_legal_acceptances_user_id_idx
  on public.account_legal_acceptances(user_id);

alter table public.account_legal_acceptances enable row level security;

revoke all on table public.account_legal_acceptances from anon;
revoke insert, update, delete on table public.account_legal_acceptances from authenticated;
grant select on table public.account_legal_acceptances to authenticated;

drop policy if exists account_legal_acceptances_select_own on public.account_legal_acceptances;
create policy account_legal_acceptances_select_own
  on public.account_legal_acceptances
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  legal_age_confirmed boolean := coalesce(new.raw_user_meta_data -> 'legal_age_18_confirmed', 'false'::jsonb) = 'true'::jsonb;
  legal_terms_version text := nullif(btrim(new.raw_user_meta_data ->> 'legal_terms_version'), '');
  legal_privacy_version text := nullif(btrim(new.raw_user_meta_data ->> 'legal_privacy_version'), '');
begin
  insert into public.users (id, name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    'customer'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.customer_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  if legal_age_confirmed and legal_terms_version is not null and legal_privacy_version is not null then
    insert into public.account_legal_acceptances (
      user_id,
      age_18_confirmed,
      terms_version,
      privacy_version,
      acceptance_source,
      accepted_at
    )
    values (
      new.id,
      true,
      legal_terms_version,
      legal_privacy_version,
      'signup',
      now()
    )
    on conflict (user_id, terms_version, privacy_version, acceptance_source) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_auth_user_created() from public, anon, authenticated;
grant execute on function public.handle_auth_user_created() to service_role;
