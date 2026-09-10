create or replace function private.notify_customer_on_requirement_proposal_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal_row public.requirement_proposals%rowtype;
  requirement_row public.customer_requirements%rowtype;
  notification_target text;
begin
  if new.event_type <> 'submitted' then
    return new;
  end if;

  select *
  into proposal_row
  from public.requirement_proposals
  where id = new.proposal_id;

  if not found then
    return new;
  end if;

  select *
  into requirement_row
  from public.customer_requirements
  where id = proposal_row.requirement_id;

  if not found then
    return new;
  end if;

  notification_target := '/requirements/' || requirement_row.id::text || '?proposal=' || proposal_row.proposal_reference;

  if not exists (
    select 1
    from public.notifications n
    where n.recipient_user_id = requirement_row.customer_id
      and n.event_type = 'requirement_proposal_received'
      and n.target_path = notification_target
  ) then
    insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
    values (
      requirement_row.customer_id,
      'requirement_proposal_received',
      'New proposal received',
      'A provider submitted a proposal for "' || left(requirement_row.title, 120) || '". Review the quote and provider details before deciding.',
      notification_target
    );
  end if;

  return new;
end;
$$;

revoke all on function private.notify_customer_on_requirement_proposal_submitted() from public;
revoke all on function private.notify_customer_on_requirement_proposal_submitted() from anon, authenticated;
grant execute on function private.notify_customer_on_requirement_proposal_submitted() to service_role;

drop trigger if exists requirement_proposal_submitted_customer_notification on public.requirement_proposal_events;
create trigger requirement_proposal_submitted_customer_notification
after insert on public.requirement_proposal_events
for each row
when (new.event_type = 'submitted')
execute function private.notify_customer_on_requirement_proposal_submitted();