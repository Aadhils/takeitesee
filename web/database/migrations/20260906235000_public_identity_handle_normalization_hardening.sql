-- Harden public identity handle normalization so surrounding whitespace is removed
-- before an optional leading @ is stripped.

create or replace function public.normalize_identity_handle(raw_handle text)
returns text
language sql
immutable
security invoker
set search_path=''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(
      lower(trim(leading '@' from btrim(coalesce(raw_handle,'')))),
      '[ _]+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
$$;

revoke all on function public.normalize_identity_handle(text) from public;
grant execute on function public.normalize_identity_handle(text) to anon,authenticated,service_role;
