import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [migrationSource, proposalRouteSource, notificationsSource] = await Promise.all([
  readFile(new URL('database/migrations/20260918125808_smart_service_journey_notification_folding.sql', root), 'utf8'),
  readFile(new URL('app/api/requirements/[requirementId]/proposals/[proposalId]/route.ts', root), 'utf8'),
  readFile(new URL('components/account/LiveNotificationsPage.tsx', root), 'utf8'),
]);

test('Smart Service Journey folds one combined customer action into one notification per participant', () => {
  assert.ok(migrationSource.includes("event_type = 'booking_created'"));
  assert.ok(migrationSource.includes("event_type = 'requirement_chat_opened'"));
  assert.ok(migrationSource.includes("event_type = 'requirement_proposal_accepted'"));
  assert.ok(migrationSource.includes("'Service request sent'"));
  assert.ok(migrationSource.includes("'Action needed: confirm service request'"));
  assert.ok(migrationSource.includes("'/requirements/' || target_requirement_id::text"));
  assert.ok(migrationSource.includes("'/provider/bookings/' || booking_uuid::text"));
});

test('Notification folding is scoped to the atomic choose-and-schedule path only', () => {
  assert.ok(migrationSource.includes("proposal_row := public.customer_decide_requirement_proposal(target_proposal_id, 'accept')"));
  assert.ok(migrationSource.includes('job_payload := public.customer_create_requirement_job('));
  assert.ok(proposalRouteSource.includes("supabase.rpc('customer_choose_and_schedule_requirement_provider'"));
  assert.ok(proposalRouteSource.includes("supabase.rpc('customer_decide_requirement_proposal'"));
  assert.ok(!migrationSource.includes('delete from public.requirement_proposal_events'));
  assert.ok(!migrationSource.includes('delete from public.marketplace_conversations'));
  assert.ok(!migrationSource.includes('delete from public.bookings'));
});

test('Smart notification keeps booking event compatibility with the existing notifications UI', () => {
  assert.ok(notificationsSource.includes("type.startsWith('booking_')"));
  assert.ok(migrationSource.includes("'booking_created'"));
  assert.ok(migrationSource.includes('booking_id'));
  assert.ok(migrationSource.includes('conversation_id'));
});

test('Notification folding preserves RPC security hardening', () => {
  assert.ok(migrationSource.includes('security definer'));
  assert.ok(migrationSource.includes("set search_path = ''"));
  assert.ok(migrationSource.includes('revoke all on function public.customer_choose_and_schedule_requirement_provider'));
  assert.ok(migrationSource.includes('grant execute on function public.customer_choose_and_schedule_requirement_provider'));
});
