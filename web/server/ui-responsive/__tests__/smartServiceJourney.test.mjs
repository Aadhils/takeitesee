import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [detailSource, proposalRoute, migrationSource, providerLeadsSource, translationsSource] = await Promise.all([
  readFile(new URL('components/requirements/CustomerRequirementDetail.tsx', root), 'utf8'),
  readFile(new URL('app/api/requirements/[requirementId]/proposals/[proposalId]/route.ts', root), 'utf8'),
  readFile(new URL('database/migrations/20260918124935_smart_service_journey_choose_and_schedule.sql', root), 'utf8'),
  readFile(new URL('components/provider/ProviderRequirementLeadsManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/OperationalTranslations.ts', root), 'utf8'),
]);

test('Smart Service Journey combines provider choice and initial schedule in one customer action', () => {
  assert.ok(detailSource.includes('Choose & schedule'));
  assert.ok(detailSource.includes('Confirm provider & time'));
  assert.ok(detailSource.includes("booking_date: scheduleDate"));
  assert.ok(detailSource.includes("start_time: scheduleTime"));
  assert.ok(detailSource.includes('If the time is unavailable, the provider selection is not saved'));
  assert.ok(detailSource.includes('Choose time later'));
});

test('Choose and schedule API uses the atomic RPC while preserving legacy proposal decisions', () => {
  assert.ok(proposalRoute.includes("body.decision === 'accept' && Boolean(bookingDate || startTime)"));
  assert.ok(proposalRoute.includes("supabase.rpc('customer_choose_and_schedule_requirement_provider'"));
  assert.ok(proposalRoute.includes("supabase.rpc('customer_decide_requirement_proposal'"));
  assert.ok(proposalRoute.includes('requested_booking_date: bookingDate'));
  assert.ok(proposalRoute.includes('requested_start_time: `${startTime}:00`'));
});

test('Atomic RPC accepts the proposal before creating the booking in one transaction boundary', () => {
  assert.ok(migrationSource.includes('security definer'));
  assert.ok(migrationSource.includes("set search_path = ''"));
  assert.ok(migrationSource.includes("proposal_row := public.customer_decide_requirement_proposal(target_proposal_id, 'accept')"));
  assert.ok(migrationSource.includes('job_payload := public.customer_create_requirement_job('));
  assert.ok(migrationSource.includes('Proposal does not belong to this requirement.'));
  assert.ok(migrationSource.includes('revoke all on function public.customer_choose_and_schedule_requirement_provider'));
  assert.ok(migrationSource.includes('grant execute on function public.customer_choose_and_schedule_requirement_provider'));
});

test('Customer and Provider copy reflects the single service journey instead of a ping-pong workflow', () => {
  assert.ok(translationsSource.includes("'job.eyebrow': 'My service'"));
  assert.ok(translationsSource.includes("'job.create': 'Schedule service'"));
  assert.ok(providerLeadsSource.includes("t('lead.awardNextHelp')"));
  assert.ok(translationsSource.includes('If the customer scheduled a time while choosing you, the booking is already in your Bookings workspace.'));
  assert.ok(translationsSource.includes('If they chose to schedule later'));
});
