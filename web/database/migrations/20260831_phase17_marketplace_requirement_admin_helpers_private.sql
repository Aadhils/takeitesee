-- Phase 17: move marketplace requirement Admin authorization helpers out of the exposed public schema.
--
-- marketplace_admin_can_view_requirement() and marketplace_admin_can_manage_requirement() are
-- internal SECURITY DEFINER authorization helpers. The application does not call them directly;
-- public moderation RPCs and RLS policies are their only consumers.
--
-- Supabase recommends keeping RLS SECURITY DEFINER helpers in a non-exposed schema. PostgreSQL
-- tracks RLS policy dependencies on the function objects, so ALTER FUNCTION ... SET SCHEMA updates
-- those stored policy expressions automatically. PL/pgSQL function bodies are updated explicitly
-- below because they contain schema-qualified helper calls as function-body text.
--
-- The public moderation queue/update RPC signatures and authorization semantics remain unchanged.
-- Anonymous execution stays denied; authenticated/service-role execution is retained only so RLS
-- and the public moderation RPCs can evaluate the private helpers.
--
-- is_active_admin(), is_super_admin(), admin_can_view(), and admin_can_manage() remain public in
-- this migration because they have a much wider dependency graph, including finance paths.
-- Cashfree, payment, refund, payout, recovery, and finance functions/policies are untouched.

alter function public.marketplace_admin_can_view_requirement(uuid) set schema private;
alter function public.marketplace_admin_can_manage_requirement(uuid) set schema private;

alter function private.marketplace_admin_can_view_requirement(uuid) set search_path = '';
alter function private.marketplace_admin_can_manage_requirement(uuid) set search_path = '';

revoke execute on function private.marketplace_admin_can_view_requirement(uuid) from public, anon;
revoke execute on function private.marketplace_admin_can_manage_requirement(uuid) from public, anon;
grant execute on function private.marketplace_admin_can_view_requirement(uuid) to authenticated, service_role;
grant execute on function private.marketplace_admin_can_manage_requirement(uuid) to authenticated, service_role;

create or replace function public.get_marketplace_moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',mr.id,'report_reference',mr.report_reference,'target_type',mr.target_type,'target_id',mr.target_id,
    'category',mr.category,'details',mr.details,'status',mr.status,'admin_note',mr.admin_note,
    'created_at',mr.created_at,'updated_at',mr.updated_at,'resolved_at',mr.resolved_at,
    'reporter_name',public.marketplace_safe_display_name(mr.reporter_user_id),
    'reported_user_name',case when mr.reported_user_id is null then null else public.marketplace_safe_display_name(mr.reported_user_id) end,
    'requirement_id',req.id,'requirement_reference',req.requirement_reference,'requirement_title',req.title,
    'proposal_reference',case when mr.target_type='proposal' then prop.proposal_reference else null end,
    'message_excerpt',case when mr.target_type='message' then left(msg.body,240) else null end
  ) order by case mr.status when 'open' then 0 when 'reviewing' then 1 else 2 end,mr.created_at desc),'[]'::jsonb)
  into result_value
  from public.marketplace_moderation_reports mr
  join public.customer_requirements req on req.id=mr.requirement_id
  left join public.requirement_proposals prop on prop.id=case when mr.target_type='proposal' then mr.target_id else null end
  left join public.marketplace_messages msg on msg.id=case when mr.target_type='message' then mr.target_id else null end
  where private.marketplace_admin_can_view_requirement(mr.requirement_id);
  return result_value;
end;
$function$;

create or replace function public.admin_update_marketplace_moderation_report(
  target_report_id uuid,
  requested_status text,
  requested_note text default null::text
)
returns public.marketplace_moderation_reports
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  report_row public.marketplace_moderation_reports%rowtype;
  old_status text;
  status_value text:=lower(btrim(coalesce(requested_status,'')));
  note_value text:=nullif(btrim(coalesce(requested_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if status_value not in ('open','reviewing','actioned','dismissed') then raise exception 'Moderation status is invalid.'; end if;
  if note_value is not null and char_length(note_value)>2000 then raise exception 'Admin note must be 2000 characters or fewer.'; end if;
  if status_value in ('actioned','dismissed') and coalesce(char_length(note_value),0)<3 then raise exception 'A moderation note is required to close a report.'; end if;
  select * into report_row from public.marketplace_moderation_reports where id=target_report_id for update;
  if not found then raise exception 'Moderation report was not found.'; end if;
  if not private.marketplace_admin_can_manage_requirement(report_row.requirement_id) then raise exception 'Admin manage permission is required for this report.'; end if;
  old_status:=report_row.status;
  update public.marketplace_moderation_reports
  set status=status_value,handled_by=auth.uid(),admin_note=coalesce(note_value,admin_note),updated_at=now(),
      resolved_at=case when status_value in ('actioned','dismissed') then now() else null end
  where id=report_row.id returning * into report_row;
  insert into public.marketplace_moderation_report_events(report_id,actor_user_id,actor_type,event_type,from_status,to_status,note)
  values(report_row.id,auth.uid(),'admin','status_changed',old_status,status_value,note_value);
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(report_row.reporter_user_id,'moderation_report_updated','Report updated','Your marketplace safety report is now '||replace(status_value,'_',' ')||'.');
  return report_row;
end;
$function$;
