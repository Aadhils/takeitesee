import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const header = await read('components/ProfileDashboardHeader.tsx');
const nav = await read('components/MobileNav.tsx');

test('dashboard loads owner-scoped media and workspace names with the native session token', async () => {
  assert.ok(header.includes("data.session.user.id !== userId"));
  assert.ok(header.includes("apiFetch<{ workspaces: Workspace[] }>('/api/account/workspaces', { accessToken })"));
  assert.ok(header.includes('/api/identity-media?context='));
  assert.ok(header.includes('useFocusEffect'));
  assert.ok(header.includes('return () => { active = false; }'));
  assert.ok(header.includes('providers.length > 1'));
  assert.ok(header.includes("profile.id === media.identity.scope"));
  assert.ok(!header.includes('user_metadata'));
  const media = await read('../web/app/api/identity-media/route.ts');
  assert.equal((media.match(/createSupabaseServerClient\(request\)/g) ?? []).length, 2);
  assert.ok(media.includes('requireCustomer(request)'));
  assert.ok(media.includes('requireProvider(request)'));
  assert.ok(media.includes(".eq('owner_user_id', session.user_id)"));
  assert.ok(media.includes('createSignedUrl(path, SIGNED_URL_TTL_SECONDS)'));
  assert.ok(!media.includes('SERVICE_ROLE'));
  const workspaces = await read('../web/app/api/account/workspaces/route.ts');
  assert.ok(workspaces.includes('createSupabaseServerClient(request)'));
});

test('Customer and Provider dashboards show real profile media, fallback initials and owned profile links', async () => {
  assert.ok((await read('app/account.tsx')).includes('<ProfileDashboardHeader context="customer" />'));
  assert.ok((await read('app/provider.tsx')).includes('<ProfileDashboardHeader context="provider" />'));
  assert.ok(header.includes('media.avatar_url'));
  assert.ok(header.includes('media.banner_url'));
  assert.ok(header.includes('workspace.verified ?'));
  assert.ok(header.includes('onError={() => setFailedAvatar(true)}'));
  assert.ok(header.includes('Manage them from your web dashboard.'));
});

test('Expo Link children preserve equal-width navigation and Provider booking card layout on Android', async () => {
  assert.ok(nav.includes('style={[styles.link, active && styles.activeLink]}'));
  assert.ok(!nav.includes('style={({ pressed })'));
  assert.ok(nav.includes('link: { flex: 1, minWidth: 0'));
  assert.ok(nav.includes('iconWrap: { width: 42, height: 42'));
  assert.ok(!nav.includes('marginTop: -8'));
  const bookings = await read('app/provider-bookings.tsx');
  assert.ok(bookings.includes("android_ripple={{ color: '#E8E2FF', foreground: true }} style={styles.card}"));
});
