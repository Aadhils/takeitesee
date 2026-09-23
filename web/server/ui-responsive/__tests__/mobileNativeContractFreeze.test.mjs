import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [doc, mobileSession, requirements, providerLeads, bookings, providerBookings, notifications, messages, reviews, providerReviews] = await Promise.all([
  readFile(new URL('docs/mobile-api-readiness.md', root), 'utf8'),
  readFile(new URL('app/api/mobile/session/route.ts', root), 'utf8'),
  readFile(new URL('app/api/requirements/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/requirement-leads/route.ts', root), 'utf8'),
  readFile(new URL('app/api/bookings/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/bookings/route.ts', root), 'utf8'),
  readFile(new URL('app/api/notifications/route.ts', root), 'utf8'),
  readFile(new URL('app/api/messages/route.ts', root), 'utf8'),
  readFile(new URL('app/api/reviews/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/reviews/route.ts', root), 'utf8'),
]);

test('Native Contract v1 is explicitly frozen for React Native + Expo', () => {
  assert.ok(doc.includes('## Native Contract v1 — FROZEN'));
  assert.ok(doc.includes('Authorization: Bearer <Supabase access token>'));
  assert.ok(doc.includes('React Native + Expo may now build against Native Contract v1'));
  assert.ok(doc.includes('Mobile API Readiness Phase 1 is complete'));
});

test('Native Contract v1 lists the core public, customer and provider route families', () => {
  for (const route of [
    'GET /api/mobile/session',
    'GET /api/marketplace/services/search',
    'POST /api/marketplace/services/nearby',
    'GET /api/marketplace/providers',
    '/api/requirements',
    '/api/bookings',
    '/api/provider/requirement-leads',
    '/api/provider/bookings',
    '/api/notifications',
    '/api/messages',
    '/api/reviews',
    '/api/provider/reviews',
  ]) assert.ok(doc.includes(route), `missing frozen route family: ${route}`);
});

test('frozen route families remain backed by the existing server auth boundaries', () => {
  assert.ok(mobileSession.includes('productionAuthProvider.getSession(request)'));
  assert.ok(requirements.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(providerLeads.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(bookings.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(providerBookings.includes('productionAuthProvider.requireProvider(request)'));
  assert.ok(notifications.includes('createSupabaseServerClient(request)'));
  assert.ok(messages.includes('createSupabaseServerClient(request)'));
  assert.ok(reviews.includes('productionAuthProvider.requireCustomer(request)'));
  assert.ok(providerReviews.includes('productionAuthProvider.requireProvider(request)'));
});

test('Native Contract v1 keeps identity and state authority on the server', () => {
  assert.ok(doc.includes('One account remains Customer + exactly one final Provider identity: Professional OR Business, never both.'));
  assert.ok(doc.includes('ownership checks remain server-authoritative'));
  assert.ok(doc.includes('must not reproduce state machines independently'));
  assert.ok(doc.includes('requires an explicit Native Contract v2 decision'));
});

test('finance and frozen recurrence/recovery remain outside Native Contract v1', () => {
  assert.ok(doc.includes('Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD'));
  assert.ok(doc.includes('Recurrence/recovery remains FROZEN'));
  assert.ok(doc.includes('RequirementOccurrenceRecoveryPanel.tsx'));
  assert.ok(doc.includes('are not part of Native Contract v1'));
});
