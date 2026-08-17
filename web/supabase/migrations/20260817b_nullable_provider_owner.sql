-- Makes provider ownership optional so catalog listings (services, professional profiles,
-- businesses) can exist before a real professional/business has registered and claimed them.
-- Do NOT insert/update/delete auth.users for this — ownership is linked later via a normal
-- UPDATE once a real provider signs up, exactly like any other application write.
--
-- Safe to re-run: the FK-lookup + drop/recreate is idempotent regardless of the FK's name.

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.professional_profiles'::regclass
      and confrelid = 'public.users'::regclass
      and contype = 'f'
  loop
    execute format('alter table public.professional_profiles drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.professional_profiles alter column user_id drop not null;
alter table public.professional_profiles
  add constraint professional_profiles_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.businesses'::regclass
      and confrelid = 'public.users'::regclass
      and contype = 'f'
  loop
    execute format('alter table public.businesses drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.businesses alter column owner_user_id drop not null;
alter table public.businesses
  add constraint businesses_owner_user_id_fkey
  foreign key (owner_user_id) references public.users(id) on delete set null;

-- RLS is unaffected: existing public-read policies on these tables already allow select
-- regardless of ownership, and no write/ownership policy is changed by this migration.
