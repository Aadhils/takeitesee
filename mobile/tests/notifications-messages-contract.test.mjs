import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [notificationsClient, messagesClient, notificationsScreen, inboxScreen, threadScreen, accountScreen] = await Promise.all([
  readFile(new URL('lib/notifications.ts', root), 'utf8'),
  readFile(new URL('lib/messages.ts', root), 'utf8'),
  readFile(new URL('app/notifications.tsx', root), 'utf8'),
  readFile(new URL('app/messages.tsx', root), 'utf8'),
  readFile(new URL('app/messages/[conversationId].tsx', root), 'utf8'),
  readFile(new URL('app/account.tsx', root), 'utf8'),
]);

const combined = [notificationsClient, messagesClient, notificationsScreen, inboxScreen, threadScreen].join('\n').toLowerCase();

test('Notifications use the frozen bearer-authenticated GET/PATCH contract only', () => {
  assert.ok(notificationsClient.includes("'/api/notifications'"));
  assert.ok(notificationsClient.includes("method: 'GET'"));
  assert.equal((notificationsClient.match(/method: 'PATCH'/g) ?? []).length, 2);
  assert.ok(notificationsClient.includes('JSON.stringify({ id })'));
  assert.ok(notificationsClient.includes('JSON.stringify({ mark_all_read: true })'));
  assert.ok(notificationsClient.includes('supabase.auth.getSession()'));
  assert.ok(!notificationsClient.includes("method: 'POST'"));
  assert.ok(!notificationsClient.includes("method: 'DELETE'"));
});

test('Notifications only deep-link to native-known routes', () => {
  assert.ok(notificationsScreen.includes("pathname: '/messages/[conversationId]'"));
  assert.ok(notificationsScreen.includes("pathname: '/bookings/[bookingId]'"));
  assert.ok(notificationsScreen.includes("pathname: '/provider-bookings/[bookingId]'"));
  assert.ok(notificationsScreen.includes("pathname: '/requirements/[requirementId]'"));
  assert.ok(notificationsScreen.includes('markNotificationRead(item.id)'));
});

test('Messages preserve server workspace scoping, thread reads, safety reads and idempotent sends', () => {
  assert.ok(messagesClient.includes('`/api/messages?workspace=${workspace}`'));
  assert.ok(messagesClient.includes('`/api/messages/${encodeURIComponent(conversationId)}`'));
  assert.ok(messagesClient.includes('`/api/messages/${encodeURIComponent(conversationId)}/safety`'));
  assert.ok(messagesClient.includes("method: 'POST'"));
  assert.ok(messagesClient.includes('idempotency_key: idempotencyKey'));
  assert.ok(messagesClient.includes('conversationCanCompose'));
  assert.ok(!messagesClient.includes("method: 'PATCH'"));
});

test('Provider workspace selection stays server-role gated and blocked threads cannot compose', () => {
  assert.ok(inboxScreen.includes("roles.includes('professional')"));
  assert.ok(inboxScreen.includes("roles.includes('business_owner')"));
  assert.ok(inboxScreen.includes("fetchMessageInbox(effectiveWorkspace)"));
  assert.ok(threadScreen.includes('fetchConversationSafety(conversationId)'));
  assert.ok(threadScreen.includes('conversationCanCompose(conversation, state.safety)'));
  assert.ok(threadScreen.includes('state.safety.messaging_blocked'));
  assert.ok(!threadScreen.includes('set_marketplace_conversation_block'));
});

test('Account exposes Notifications and Messages without expanding the bottom navigation', () => {
  assert.ok(accountScreen.includes('href="/notifications"'));
  assert.ok(accountScreen.includes('href="/messages"'));
  assert.ok(accountScreen.includes('Notifications'));
  assert.ok(accountScreen.includes('Messages'));
});

test('Notifications and messages native slice stays outside frozen finance and recovery domains', () => {
  for (const forbidden of [
    '/api/payments',
    '/api/cashfree',
    '/checkout',
    '/recovery',
    '/api/requirements/',
    'requirementoccurrencerecoverypanel',
  ]) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
