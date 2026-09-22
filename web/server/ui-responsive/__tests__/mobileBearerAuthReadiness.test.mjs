import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [serverClient, sessionAuth, customerAuth] = await Promise.all([
  readFile(new URL('lib/supabase/server.ts', root), 'utf8'),
  readFile(new URL('server/auth/session.ts', root), 'utf8'),
  readFile(new URL('server/auth/customer-supabase.ts', root), 'utf8'),
]);

test('Supabase server client supports native Bearer access tokens while preserving cookie fallback', () => {
  assert.ok(serverClient.includes("import { createClient, type SupabaseClient } from '@supabase/supabase-js'"));
  assert.ok(serverClient.includes("import { cookies, headers } from 'next/headers'"));
  assert.ok(serverClient.includes("request?.headers.get('authorization')"));
  assert.ok(serverClient.includes("authorization.match(/^Bearer\\s+(.+)$/i)"));
  assert.ok(serverClient.includes('accessToken: async () => accessToken'));
  assert.ok(serverClient.includes('autoRefreshToken: false'));
  assert.ok(serverClient.includes('persistSession: false'));
  assert.ok(serverClient.includes('detectSessionInUrl: false'));
  assert.ok(serverClient.includes('const cookieStore = await cookies()'));
  assert.ok(serverClient.includes('return createServerClient(url, anonKey'));
});

test('Production auth verifies an explicit mobile token and still derives roles from server ownership', () => {
  assert.ok(sessionAuth.includes('getSupabaseRequestAccessToken'));
  assert.ok(sessionAuth.includes('const accessToken = await getSupabaseRequestAccessToken(request)'));
  assert.ok(sessionAuth.includes('createSupabaseServerClient(request, accessToken)'));
  assert.ok(sessionAuth.includes('supabase.auth.getUser(accessToken ?? undefined)'));
  assert.ok(sessionAuth.includes(".from('users')"));
  assert.ok(sessionAuth.includes(".from('professional_profiles')"));
  assert.ok(sessionAuth.includes(".from('businesses')"));
  assert.ok(sessionAuth.includes("if (!roles.includes('customer')) roles.push('customer')"));
});

test('Customer requirement auth accepts the same request token without weakening RLS', () => {
  assert.ok(customerAuth.includes('getSupabaseRequestAccessToken'));
  assert.ok(customerAuth.includes('createSupabaseServerClient(request, accessToken)'));
  assert.ok(customerAuth.includes('supabase.auth.getUser(accessToken ?? undefined)'));
  assert.ok(!customerAuth.includes('createSupabaseServiceClient'));
  assert.ok(!serverClient.includes('SUPABASE_SERVICE_ROLE_KEY'));
});

test('Mobile auth foundation stays outside frozen finance and recovery scope', () => {
  const combined = `${serverClient}\n${sessionAuth}\n${customerAuth}`;
  for (const forbidden of [
    'Cashfree',
    'refund',
    'payout',
    'settlement',
    'reconciliation',
    'RequirementOccurrenceRecoveryPanel',
    'schedule_pattern',
    'recurrence_frequency',
  ]) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-scope reference: ${forbidden}`);
  }
});
