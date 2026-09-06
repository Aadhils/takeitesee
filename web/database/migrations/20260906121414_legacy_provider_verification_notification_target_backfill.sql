-- Backfill historical Provider verification notifications created before
-- provider verification notification deep links were added.
--
-- Future notifications are already covered by
-- 20260906094748_provider_verification_notification_deep_links.
-- This data-only migration changes notification navigation metadata only.

update public.notifications
set target_path = '/provider/verification'
where event_type in (
  'provider_verification_submitted',
  'provider_verification_approved'
)
  and target_path is null
  and booking_id is null
  and conversation_id is null;
