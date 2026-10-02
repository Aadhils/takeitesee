import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [provider, api, entry, login, home, nav, explore, marketplace, providerScreen] = await Promise.all([
  readFile(new URL('providers/AuthProvider.tsx', root), 'utf8'),
  readFile(new URL('lib/api.ts', root), 'utf8'),
  readFile(new URL('app/index.tsx', root), 'utf8'),
  readFile(new URL('app/login.tsx', root), 'utf8'),
  readFile(new URL('app/home.tsx', root), 'utf8'),
  readFile(new URL('components/MobileNav.tsx', root), 'utf8'),
  readFile(new URL('app/explore.tsx', root), 'utf8'),
  readFile(new URL('lib/marketplace.ts', root), 'utf8'),
  readFile(new URL('app/provider.tsx', root), 'utf8'),
]);

test('native sign in mirrors the web email/password Supabase contract', () => {
  assert.ok(provider.includes('supabase.auth.signInWithPassword'));
  assert.ok(provider.includes('email: email.trim().toLowerCase()'));
  assert.ok(provider.includes('password,'));
  assert.ok(login.includes('same email and password you use on TakeItEsee web'));
});

test('saved sessions are accepted only after server bearer validation', () => {
  assert.ok(provider.includes('fetchNativeSession(session.access_token)'));
  assert.ok(api.includes("'/api/mobile/session'"));
  assert.ok(api.includes('Authorization'));
  assert.ok(api.includes('Bearer ${accessToken}'));
  assert.ok(provider.includes('userId: result.user_id'));
  assert.ok(provider.includes('roles: result.roles'));
});

test('mobile routing separates loading, signed out and signed in states', () => {
  assert.ok(entry.includes("auth.status === 'signedIn'"));
  assert.ok(entry.includes('<Redirect href="/home" />'));
  assert.ok(entry.includes("auth.status === 'signedOut'"));
  assert.ok(entry.includes('<Link href="/login" asChild>'));
  assert.ok(entry.includes('<Link href="/explore" asChild>'));
  assert.ok(entry.includes('Get Started'));
  assert.ok(entry.includes('<BrandLogo large />'));
  assert.ok(home.includes('Find the right service'));
  assert.ok(home.includes('Explore services'));
});

test('client does not invent customer or provider roles', () => {
  assert.ok(!provider.includes("roles: ['customer']"));
  assert.ok(!provider.includes("roles: ['provider']"));
  assert.ok(!home.includes('auth.identity.userId'));
  assert.ok(!home.includes('Server roles'));
  assert.ok(home.includes("roles.includes('professional')"));
  assert.ok(home.includes("roles.includes('business_owner')"));
  assert.ok(providerScreen.includes("roles.includes('professional')"));
  assert.ok(providerScreen.includes("roles.includes('business_owner')"));
});

test('public Explore uses the frozen marketplace service search contract without bearer auth', () => {
  assert.ok(login.includes('Explore services without signing in'));
  assert.ok(explore.includes('searchMarketplaceServices'));
  assert.ok(marketplace.includes('/api/marketplace/services/search?'));
  assert.ok(!marketplace.includes('accessToken'));
  assert.ok(marketplace.includes("provider_type: 'professional' | 'business'"));
});

test('reference navigation gates private tabs and keeps Provider access role-controlled on Home', () => {
  const definition = nav.split('const items = ')[1].split(' as const;')[0];
  const items = Function('return (' + definition + ')')();
  assert.deepEqual(items.map((item) => item.href), ['/home', '/explore', '/request-service', '/bookings', '/account']);
  assert.deepEqual(items.filter((item) => !item.auth).map((item) => item.href), ['/explore']);
  assert.ok(nav.includes("item.auth && auth.status !== 'signedIn'"));
  assert.ok(home.includes('providerAccess ?'));
  assert.ok(home.includes("router.push('/provider')"));
});

test('Home search hands real query text to Explore and categories come from marketplace data', () => {
  assert.ok(home.includes("searchMarketplaceServices('')"));
  assert.ok(home.includes("params: { q: text.trim() }"));
  assert.ok(explore.includes('useLocalSearchParams'));
  assert.ok(explore.includes('setSubmittedQuery(incomingQuery.trim())'));
  assert.ok(home.includes('marketplace?.categories'));
  assert.ok(home.includes('service.review_count > 0'));
});
