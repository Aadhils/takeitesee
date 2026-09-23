import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [listRoute, detailRoute, requirementContextRoute, repository, transition] = await Promise.all([
  readFile(new URL('app/api/provider/bookings/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/bookings/[bookingId]/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/bookings/[bookingId]/requirement-context/route.ts', root), 'utf8'),
  readFile(new URL('server/provider-bookings/repository.ts', root), 'utf8'),
  readFile(new URL('server/provider-bookings/status-transition.ts', root), 'utf8'),
]);

test('provider booking list and detail keep the authenticated Request on repository RLS clients', () => {
  assert.ok(listRoute.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(listRoute.includes('productionProviderBookingRepository.list(session, request)'));
  assert.equal((detailRoute.match(/productionAuthProvider\.requireProvider\(request\)/g) ?? []).length, 2);
  assert.ok(detailRoute.includes('productionProviderBookingRepository.getById(session, bookingId as EntityId, request)'));
  assert.ok(detailRoute.includes('transitionProviderBookingStatus(session, bookingId as EntityId, body.action, body.reason, request)'));
});

test('provider booking repository threads an optional Request through owner, booking, history and closeout reads', () => {
  assert.ok(repository.includes('resolveOwner(session: ServerCustomerSession, request?: Request)'));
  assert.ok(repository.includes('ownedBookingQuery(owner: ProviderOwner, bookingId: EntityId, request?: Request)'));
  assert.ok(repository.includes('loadCloseout(bookingId: EntityId, request?: Request)'));
  assert.ok(repository.includes('async list(session: ServerCustomerSession, request?: Request)'));
  assert.ok(repository.includes('async getById(session: ServerCustomerSession, bookingId: EntityId, request?: Request)'));
  assert.ok(repository.includes('async updateStatus(session: ServerCustomerSession, bookingId: EntityId, action:'));
  assert.ok(repository.includes('const owner = await resolveOwner(session, request)'));
  assert.ok(repository.includes('ownedBookingQuery(owner, bookingId, request)'));
  assert.ok(repository.includes('loadCloseout(bookingId, request)'));
  assert.ok(!repository.includes('createSupabaseServerClient()'));
});

test('provider booking action contract and status transition RPC payload remain unchanged', () => {
  assert.ok(detailRoute.includes("action?: 'accept' | 'decline' | 'complete'"));
  assert.ok(detailRoute.includes("!['accept', 'decline', 'complete'].includes(body.action)"));
  assert.ok(detailRoute.includes('reason.length < 3'));
  assert.ok(detailRoute.includes('reason.length > 500'));
  assert.ok(transition.includes("type ProviderBookingAction = 'accept' | 'decline' | 'complete'"));
  assert.ok(transition.includes("supabase.rpc('provider_update_booking_status'"));
  assert.ok(transition.includes('p_booking_id: bookingId'));
  assert.ok(transition.includes('p_action: action'));
  assert.ok(transition.includes("p_reason: reason?.trim() || null"));
  assert.ok(transition.includes('createSupabaseServerClient(request)'));
  assert.ok(transition.includes('productionProviderBookingRepository.getById(session, bookingId, request)'));
});

test('provider completion timing and closeout safety rules remain present', () => {
  assert.ok(repository.includes("const expectedStatus: ProductionBookingStatus = action === 'complete' ? 'confirmed' : 'pending'"));
  assert.ok(repository.includes("if (action === 'complete')"));
  assert.ok(repository.includes("current.status !== 'confirmed'"));
  assert.ok(repository.includes("closeout.attendance_outcome !== 'pending'"));
  assert.ok(repository.includes('const eligibleAt = completionEligibleAt'));
  assert.ok(repository.includes('if (Date.now() < eligibleAt)'));
});

test('provider booking requirement context uses the bearer-bearing Request without changing its RPC or conversation ownership filter', () => {
  assert.ok(requirementContextRoute.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(requirementContextRoute.includes('createSupabaseServerClient(request)'));
  assert.ok(requirementContextRoute.includes("supabase.rpc('provider_get_booking_requirement_context'"));
  assert.ok(requirementContextRoute.includes(".from('marketplace_requirement_jobs')"));
  assert.ok(requirementContextRoute.includes(".from('marketplace_conversations')"));
  assert.ok(requirementContextRoute.includes(".eq('provider_user_id', session.user_id)"));
});

test('provider booking mobile-auth slice stays outside finance, cash collection and frozen recovery routes', () => {
  const combined = [listRoute, detailRoute, requirementContextRoute, repository, transition].join('\n').toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'cash-collection', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
