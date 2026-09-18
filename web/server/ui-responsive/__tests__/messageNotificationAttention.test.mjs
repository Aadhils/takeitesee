import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [messagesRoute, conversationRoute, notificationsRoute, customerShell, providerShell, workspace, customerMessagesRoute, customerMessagesPage, providerMessagesRoute, roleContextMigration] = await Promise.all([
  readFile(new URL('app/api/messages/route.ts', root), 'utf8'),
  readFile(new URL('app/api/messages/[conversationId]/route.ts', root), 'utf8'),
  readFile(new URL('app/api/notifications/route.ts', root), 'utf8'),
  readFile(new URL('components/account/LocalizedAccountShell.tsx', root), 'utf8'),
  readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8'),
  readFile(new URL('components/messages/MarketplaceMessagingWorkspace.tsx', root), 'utf8'),
  readFile(new URL('app/messages/page.tsx', root), 'utf8'),
  readFile(new URL('components/messages/CustomerMessagesPage.tsx', root), 'utf8'),
  readFile(new URL('app/provider/messages/page.tsx', root), 'utf8'),
  readFile(new URL('database/migrations/20260918114849_message_workspace_role_context.sql', root), 'utf8'),
]);

test('message inbox exposes one unread-count mode from the existing inbox RPC', () => {
  assert.ok(messagesRoute.includes('export async function GET(request: Request)'));
  assert.ok(messagesRoute.includes("url.searchParams.get('mode') === 'unread-count'"));
  assert.ok(messagesRoute.includes("supabase.rpc('get_marketplace_inbox')"));
  assert.ok(messagesRoute.includes('row.unread_count'));
  assert.ok(messagesRoute.includes("url.searchParams.get('workspace')"));
  assert.ok(messagesRoute.includes("row.participant_role === 'customer' || row.participant_role === 'applicant'"));
  assert.ok(messagesRoute.includes("row.participant_role === 'provider' || row.participant_role === 'business' || row.participant_role === 'employer'"));
  assert.ok(messagesRoute.includes('unread_count: unreadCount'));
});

test('opening a conversation acknowledges both inbox reads and message notifications', () => {
  assert.ok(conversationRoute.includes("mark_marketplace_conversation_read"));
  assert.ok(conversationRoute.includes(".eq('event_type', 'message_received')"));
  assert.ok(conversationRoute.includes(".eq('conversation_id', conversationId)"));
  assert.ok(conversationRoute.includes(".eq('recipient_user_id', user.id)"));
});

test('notification feed resolves legacy message destinations to the exact customer or provider inbox', () => {
  assert.ok(notificationsRoute.includes("supabase.rpc('get_marketplace_inbox')"));
  assert.ok(notificationsRoute.includes("row.participant_role === 'provider'"));
  assert.ok(notificationsRoute.includes("row.participant_role === 'business'"));
  assert.ok(notificationsRoute.includes("row.participant_role === 'employer'"));
  assert.ok(notificationsRoute.includes("'/provider/messages' : '/messages'"));
  assert.ok(notificationsRoute.includes('conversation=${encodeURIComponent(row.id)}'));
});

test('Customer navigation keeps Messages and Notifications attention live and separate', () => {
  assert.ok(customerShell.includes("fetch('/api/messages?mode=unread-count&workspace=customer'"));
  assert.ok(customerShell.includes("fetch('/api/notifications?mode=unread-count'"));
  assert.ok(customerShell.includes("window.addEventListener('marketplace-messages-attention-refresh', refresh)"));
  assert.ok(customerShell.includes("window.addEventListener('notifications-attention-refresh', refresh)"));
  assert.ok(customerShell.includes("link.href === '/messages' ? messageBadge"));
  assert.ok(customerShell.includes("link.href === '/notifications' ? notificationBadge"));
});

test('Provider navigation exposes the same message and notification attention on desktop and mobile', () => {
  assert.ok(providerShell.includes("{ href: '/notifications'"));
  assert.ok(providerShell.includes("fetch('/api/messages?mode=unread-count&workspace=provider'"));
  assert.ok(providerShell.includes("fetch('/api/notifications?mode=unread-count'"));
  assert.ok(providerShell.includes("link.href === '/provider/messages' && messageUnreadCount > 0"));
  assert.ok(providerShell.includes("link.href === '/notifications' && notificationUnreadCount > 0"));
  assert.ok(providerShell.includes("window.addEventListener('marketplace-messages-attention-refresh', refresh)"));
  assert.ok(providerShell.includes("window.addEventListener('notifications-attention-refresh', refresh)"));
});

test('message workspace refreshes both navigation attention sources immediately after a thread is read', () => {
  assert.ok(workspace.includes("window.dispatchEvent(new Event('marketplace-messages-attention-refresh'))"));
  assert.ok(workspace.includes("window.dispatchEvent(new Event('notifications-attention-refresh'))"));
});


test('customer and provider message routes keep conversation role context isolated', () => {
  assert.ok(!customerMessagesRoute.includes("session.roles.includes('professional')"));
  assert.ok(!customerMessagesRoute.includes("redirect(`/provider/messages"));
  assert.ok(customerMessagesPage.includes('workspace="customer"'));
  assert.ok(providerMessagesRoute.includes('workspace="provider"'));
  assert.ok(workspace.includes("fetch(`/api/messages?workspace=${workspace}`"));
  assert.ok(workspace.includes("rows.some((row) => row.id === initialConversationId) ? initialConversationId : ''"));
  assert.ok(workspace.includes("const [selectedId, setSelectedId] = useState('')"));
});


test('messaging migration keeps customer account names separate from Provider identity names', () => {
  assert.ok(roleContextMigration.includes('private.marketplace_participant_display_name'));
  assert.ok(roleContextMigration.includes("when participant_role = 'customer' then coalesce"));
  assert.ok(roleContextMigration.includes("'counterpart_name',private.marketplace_participant_display_name"));
  assert.ok(roleContextMigration.includes("'sender_name',private.marketplace_participant_display_name"));
  assert.ok(roleContextMigration.includes("sender_name:=private.marketplace_participant_display_name"));
  assert.ok(roleContextMigration.includes("set search_path = ''"));
});
