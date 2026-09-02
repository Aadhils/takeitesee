-- Keep the public user-profile email mirror aligned with the canonical Supabase Auth identity.
-- Supabase Auth remains the source of truth. This trigger runs only after auth.users.email
-- actually changes (for example, after any required secure email-change confirmation completes).
-- Non-finance only.

create schema if not exists private;

create or replace function private.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.users
    set email = new.email,
        updated_at = now()
    where id = new.id
      and email is distinct from new.email;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_auth_user_email() from public, anon, authenticated, service_role;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.sync_auth_user_email();
