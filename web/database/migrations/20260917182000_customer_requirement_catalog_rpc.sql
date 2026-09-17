-- Customer-safe requirement catalog projection.
-- Keep governance tables private while allowing authenticated Customers to load
-- the active leaf service categories and active city choices needed to post a requirement.

create or replace function public.get_customer_requirement_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'code', category.code
        )
        order by category.sort_order asc, category.name asc
      )
      from public.platform_categories category
      where category.active = true
        and not exists (
          select 1
          from public.platform_categories child
          where child.parent_id = category.id
            and child.active = true
        )
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', location.id,
          'name', location.name,
          'code', location.code,
          'timezone', location.timezone
        )
        order by location.name asc
      )
      from public.platform_locations location
      where location.active = true
        and location.type::text = 'city'
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_customer_requirement_catalog() from public;
revoke all on function public.get_customer_requirement_catalog() from anon;
grant execute on function public.get_customer_requirement_catalog() to authenticated;
