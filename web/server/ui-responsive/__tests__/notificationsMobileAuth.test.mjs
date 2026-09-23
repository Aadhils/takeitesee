import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const notificationRoute = await readFile(new URL('app/api/notifications/route.ts', root), 'utf8');

test('Notifications GET and PATCH use the bearer-aware Supabase auth boundary', () => {
  assert.ok(notificationRoute.includes("import { createSupabaseServerClient, getSupabaseAuthenticatedUser } from '../../../lib/supabase/server'"));
  assert.equal((notificationRoute.match(/createSupabaseServerClient\(request\)/g) ?? []).length, 2);
  assert.equal((notificationRoute.match(/getSupabaseAuthenticatedUser\(supabase, request\)/g) ?? []).length, 2);
  assert.equal((notificationRoute.match(/Authentication required\./g) ?? []).length, 2);
});

test('Notification read modes and message destination enrichment remain unchanged', () => {
  assert.ok(notificationRoute.includes("url.searchParams.get('mode') === 'proposal-unread-count'"));
  assert.ok(notificationRoute.includes("url.searchParams.get('mode') === 'product-order-unread-updates'"));
  assert.ok(notificationRoute.includes("url.searchParams.get('mode') === 'unread-count'"));
  assert.ok(notificationRoute.includes(".eq('event_type', 'requirement_proposal_received')"));
  assert.ok(notificationRoute.includes("supabase.rpc('get_marketplace_inbox')"));
  assert.ok(notificationRoute.includes("item.event_type === 'message_received'"));
  assert.ok(notificationRoute.includes("providerSide ? '/provider/messages' : '/messages'"));
});

test('Notification acknowledgement semantics remain unchanged', () => {
  assert.ok(notificationRoute.includes('body.mark_requirement_proposals_read'));
  assert.ok(notificationRoute.includes(".like('target_path', `/requirements/${requirementId}?proposal=%`)"));
  assert.ok(notificationRoute.includes('body.mark_product_order_updates_read'));
  assert.ok(notificationRoute.includes(".eq('target_path', `/orders/${orderId}`)"));
  assert.ok(notificationRoute.includes('body.mark_all_read'));
  assert.ok(notificationRoute.includes("query = query.eq('id', body.id)"));
  assert.ok(notificationRoute.includes(".eq('recipient_user_id', user.id)"));
});

test('Notifications bearer slice stays outside finance and frozen recovery domains', () => {
  const lower = notificationRoute.toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'payment-intent', 'payment-method', '/checkout', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!lower.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
