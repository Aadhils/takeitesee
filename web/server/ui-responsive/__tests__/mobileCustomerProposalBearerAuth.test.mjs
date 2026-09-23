import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const proposalRoute = await readFile(
  new URL('app/api/requirements/[requirementId]/proposals/[proposalId]/route.ts', root),
  'utf8',
);

test('customer proposal decisions keep the authenticated Request attached to both Supabase RLS clients', () => {
  assert.ok(proposalRoute.includes('productionAuthProvider.requireCustomer(request)'));
  assert.equal((proposalRoute.match(/createSupabaseServerClient\(request\)/g) || []).length, 2);
  assert.ok(!proposalRoute.includes('const supabase = await createSupabaseServerClient();'));
});

test('proposal decision and choose-and-schedule RPC contracts remain unchanged', () => {
  assert.ok(proposalRoute.includes("customer_choose_and_schedule_requirement_provider"));
  assert.ok(proposalRoute.includes("customer_decide_requirement_proposal"));
  assert.ok(proposalRoute.includes("target_decision: body.decision"));
  assert.ok(proposalRoute.includes("requested_start_time: `${startTime}:00`"));
  assert.ok(proposalRoute.includes("body.decision === 'accept'"));
  assert.ok(proposalRoute.includes("['accept', 'decline']"));
});

test('proposal bearer fix does not rewrite recurrence, finance or booking conflict semantics', () => {
  assert.ok(proposalRoute.includes('previous occurrence'));
  assert.ok(proposalRoute.includes('all recurring'));
  assert.ok(proposalRoute.includes('booking during'));
  assert.ok(proposalRoute.includes('availability window'));
  assert.ok(!proposalRoute.includes('cashfree'));
  assert.ok(!proposalRoute.includes('payout'));
  assert.ok(!proposalRoute.includes('refund'));
  assert.ok(!proposalRoute.includes('settlement'));
});
