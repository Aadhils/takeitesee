-- Make requirement proposal notifications launch-safe and notify the selected Provider when a proposal is accepted.
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain untouched.

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications
  add constraint notifications_event_type_check
  check (event_type = any (array[
    'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
    'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
    'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
    'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
    'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
    'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
    'provider_reverification_required','provider_suspended','provider_restored','provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed','provider_payout_destination_updated',
    'refund_requested','refund_onhold','refund_failed','refund_cancelled','payment_dispute_opened','payment_dispute_resolved','provider_finance_hold','provider_recovery_required','provider_recovery_resolved',
    'requirement_chat_opened','message_received','moderation_report_updated','job_chat_opened','job_interview_scheduled','job_interview_rescheduled','job_interview_accepted','job_interview_declined','job_interview_cancelled',
    'job_offer_issued','job_offer_accepted','job_offer_declined','job_offer_withdrawn','product_order_requested','product_order_accepted','product_order_declined','product_order_fulfilled','product_order_cancelled',
    'provider_requirement_match','requirement_proposal_received','requirement_proposal_accepted'
  ]::text[]));

create unique index if not exists notifications_requirement_proposal_received_unique_idx
  on public.notifications(recipient_user_id,event_type,target_path)
  where event_type='requirement_proposal_received';

create unique index if not exists notifications_requirement_proposal_accepted_unique_idx
  on public.notifications(recipient_user_id,event_type,target_path)
  where event_type='requirement_proposal_accepted';

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

  begin
    select * into proposal_row
      from public.requirement_proposals
     where id = new.proposal_id;
    if not found then return new; end if;

    select * into requirement_row
      from public.customer_requirements
     where id = proposal_row.requirement_id;
    if not found then return new; end if;

    notification_target := '/requirements/' || requirement_row.id::text || '?proposal=' || proposal_row.proposal_reference;

    insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
    values (
      requirement_row.customer_id,
      'requirement_proposal_received',
      'New proposal received',
      'A provider submitted a proposal for "' || left(requirement_row.title, 120) || '". Review the quote and provider details before deciding.',
      notification_target
    )
    on conflict (recipient_user_id,event_type,target_path)
      where event_type='requirement_proposal_received'
      do nothing;
  exception when others then
    raise warning 'Customer proposal notification failed for event %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function private.notify_customer_on_requirement_proposal_submitted() from public, anon, authenticated;
grant execute on function private.notify_customer_on_requirement_proposal_submitted() to service_role;

create or replace function private.notify_provider_on_requirement_proposal_accepted()
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
  if new.event_type <> 'accepted' then
    return new;
  end if;

  begin
    select * into proposal_row
      from public.requirement_proposals
     where id = new.proposal_id;
    if not found then return new; end if;

    select * into requirement_row
      from public.customer_requirements
     where id = proposal_row.requirement_id;
    if not found then return new; end if;

    notification_target := '/provider/leads?requirement=' || requirement_row.id::text || '&proposal=' || proposal_row.id::text;

    insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
    values (
      proposal_row.provider_user_id,
      'requirement_proposal_accepted',
      'Proposal accepted',
      'The customer selected your proposal for "' || left(requirement_row.title, 120) || '". Open the awarded requirement to review your accepted proposal and coordinate next steps.',
      notification_target
    )
    on conflict (recipient_user_id,event_type,target_path)
      where event_type='requirement_proposal_accepted'
      do nothing;
  exception when others then
    raise warning 'Provider accepted-proposal notification failed for event %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function private.notify_provider_on_requirement_proposal_accepted() from public, anon, authenticated;
grant execute on function private.notify_provider_on_requirement_proposal_accepted() to service_role;

drop trigger if exists requirement_proposal_accepted_provider_notification on public.requirement_proposal_events;
create trigger requirement_proposal_accepted_provider_notification
after insert on public.requirement_proposal_events
for each row
when (new.event_type = 'accepted')
execute function private.notify_provider_on_requirement_proposal_accepted();
