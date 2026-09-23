import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [inboxRoute, conversationRoute, safetyRoute] = await Promise.all([
  readFile(new URL('app/api/messages/route.ts', root), 'utf8'),
  readFile(new URL('app/api/messages/[conversationId]/route.ts', root), 'utf8'),
  readFile(new URL('app/api/messages/[conversationId]/safety/route.ts', root), 'utf8'),
]);

test('message inbox uses the bearer-aware Supabase auth boundary without changing workspace semantics', () => {
  assert.ok(inboxRoute.includes("import { createSupabaseServerClient, getSupabaseAuthenticatedUser } from '../../../lib/supabase/server'"));
  assert.ok(inboxRoute.includes('createSupabaseServerClient(request)'));
  assert.ok(inboxRoute.includes('getSupabaseAuthenticatedUser(supabase, request)'));
  assert.ok(inboxRoute.includes("supabase.rpc('get_marketplace_inbox')"));
  assert.ok(inboxRoute.includes("url.searchParams.get('workspace')"));
  assert.ok(inboxRoute.includes("url.searchParams.get('mode') === 'unread-count'"));
  assert.ok(inboxRoute.includes("row.participant_role === 'customer' || row.participant_role === 'applicant'"));
  assert.ok(inboxRoute.includes("row.participant_role === 'provider' || row.participant_role === 'business' || row.participant_role === 'employer'"));
});

test('conversation read and send keep the Request on RLS clients while preserving RPC contracts', () => {
  assert.ok(conversationRoute.includes('export async function GET(request: Request'));
  assert.equal((conversationRoute.match(/createSupabaseServerClient\(request\)/g) ?? []).length, 2);
  assert.equal((conversationRoute.match(/getSupabaseAuthenticatedUser\(supabase, request\)/g) ?? []).length, 2);
  assert.ok(conversationRoute.includes("supabase.rpc('get_marketplace_conversation', { target_conversation_id: conversationId })"));
  assert.ok(conversationRoute.includes("supabase.rpc('mark_marketplace_conversation_read', { target_conversation_id: conversationId })"));
  assert.ok(conversationRoute.includes(".eq('recipient_user_id', user.id)"));
  assert.ok(conversationRoute.includes(".eq('event_type', 'message_received')"));
  assert.ok(conversationRoute.includes("supabase.rpc('send_marketplace_message', {"));
  assert.ok(conversationRoute.includes('requested_idempotency_key: body.idempotency_key?.trim() ??'));
  assert.ok(conversationRoute.includes('requested_body: body.message?.trim() ??'));
  assert.ok(conversationRoute.includes('{ status: 201 }'));
});

test('conversation safety keeps the existing session gate, validation and block RPCs on the bearer client', () => {
  assert.equal((safetyRoute.match(/productionAuthProvider\.getSession\(request\)/g) ?? []).length, 2);
  assert.equal((safetyRoute.match(/createSupabaseServerClient\(request\)/g) ?? []).length, 2);
  assert.ok(safetyRoute.includes("supabase.rpc('get_marketplace_conversation_safety'"));
  assert.ok(safetyRoute.includes("supabase.rpc('set_marketplace_conversation_block', {"));
  assert.ok(safetyRoute.includes("typeof body.blocked !== 'boolean'"));
  assert.ok(safetyRoute.includes('reason.length > 500'));
  assert.ok(safetyRoute.includes('should_block: body.blocked'));
  assert.ok(safetyRoute.includes('block_reason: reason || null'));
});

test('Messages bearer slice stays outside finance and frozen recovery domains', () => {
  const combined = [inboxRoute, conversationRoute, safetyRoute].join('\n').toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'cash-collection', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
