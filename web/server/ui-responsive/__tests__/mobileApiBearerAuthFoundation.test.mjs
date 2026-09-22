import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [supabaseServer, sessionSource, customerSupabase, mobileSessionRoute] = await Promise.all([
  readFile(new URL('lib/supabase/server.ts', root), 'utf8'),
  readFile(new URL('server/auth/session.ts', root), 'utf8'),
  readFile(new URL('server/auth/customer-supabase.ts', root), 'utf8'),
  readFile(new URL('app/api/mobile/session/route.ts', root), 'utf8'),
]);

test('Supabase server boundary supports native bearer tokens while preserving cookie auth', () => {
  assert.ok(supabaseServer.includes("request?.headers.get('authorization')"));
  assert.ok(supabaseServer.includes('/^Bearer\\s+(.+)$/i'));
  assert.ok(supabaseServer.includes("import { createClient } from '@supabase/supabase-js'"));
  assert.ok(supabaseServer.includes('Authorization: `Bearer ${bearerAccessToken}`'));
  assert.ok(supabaseServer.includes('persistSession: false'));
  assert.ok(supabaseServer.includes('autoRefreshToken: false'));
  assert.ok(supabaseServer.includes('detectSessionInUrl: false'));
  assert.ok(supabaseServer.includes('const cookieStore = await cookies()'));
  assert.ok(supabaseServer.includes('return createServerClient(url, anonKey'));
});

test('Authenticated user resolution verifies bearer JWTs and server sessions forward Request', () => {
  assert.ok(supabaseServer.includes('supabase.auth.getUser(bearerAccessToken ?? undefined)'));
  assert.ok(sessionSource.includes('createSupabaseServerClient(request)'));
  assert.ok(sessionSource.includes('getSupabaseAuthenticatedUser(supabase, request)'));
  assert.ok(sessionSource.includes("if (!roles.includes('customer')) roles.push('customer')"));
  assert.ok(sessionSource.includes("storedRole === 'professional'"));
  assert.ok(sessionSource.includes("storedRole === 'business'"));
});

test('Customer Supabase helper is request-aware for future mobile API slices', () => {
  assert.ok(customerSupabase.includes('requireCustomerSupabase(request?: Request)'));
  assert.ok(customerSupabase.includes('createSupabaseServerClient(request)'));
  assert.ok(customerSupabase.includes('getSupabaseAuthenticatedUser(supabase, request)'));
});

test('Mobile session endpoint exposes only authenticated identity and server-derived roles', () => {
  assert.ok(mobileSessionRoute.includes('productionAuthProvider.getSession(request)'));
  assert.ok(mobileSessionRoute.includes('authenticated: false'));
  assert.ok(mobileSessionRoute.includes('authenticated: true'));
  assert.ok(mobileSessionRoute.includes('user_id: session.user_id'));
  assert.ok(mobileSessionRoute.includes('roles: session.roles'));
  assert.ok(!mobileSessionRoute.includes('password'));
  assert.ok(!mobileSessionRoute.includes('access_token'));
  assert.ok(!mobileSessionRoute.includes('refresh_token'));
});

test('Mobile auth foundation stays outside frozen finance and recovery domains', () => {
  const combined = [supabaseServer, sessionSource, customerSupabase, mobileSessionRoute].join('\n').toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!combined.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
