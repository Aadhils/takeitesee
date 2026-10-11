import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [header, nav, client, provider, switcher] = await Promise.all(['components/ProfileDashboardHeader.tsx', 'components/MobileNav.tsx', 'lib/identity-media.ts', 'providers/WorkspaceProvider.tsx', 'components/ProfileSwitcher.tsx'].map(read));

test('owner media remains Bearer authenticated under existing server ownership and RLS checks', async () => {
  assert.ok(client.includes('data.session.user.id !== userId'));
  assert.ok(client.includes("'/api/account/workspaces', { accessToken }"));
  assert.ok(header.includes('useFocusEffect'));
  assert.ok(provider.includes('state.userId === userId ? state : emptyState'));
  assert.ok(provider.includes('owner.current !== userId'));
  assert.ok(header.includes('currentOwnerKey.current === operationKey'));
  assert.ok(!client.includes('user_metadata'));
  const media = await read('../web/app/api/identity-media/route.ts');
  assert.equal((media.match(/createSupabaseServerClient\(request\)/g) ?? []).length, 2);
  for (const text of ['requireCustomer(request)', 'requireProvider(request)', ".eq('owner_user_id', session.user_id)", 'createSignedUrl(path, SIGNED_URL_TTL_SECONDS)']) assert.ok(media.includes(text));
  assert.ok(!media.includes('SERVICE_ROLE'));
});

test('native dashboards provide photo preview/save/removal and selected avatar switcher sheet', async () => {
  assert.ok((await read('app/account.tsx')).includes('<ProfileDashboardHeader context="customer" />'));
  assert.ok((await read('app/provider.tsx')).includes('<ProfileDashboardHeader context="provider" />'));
  for (const text of ['ImagePicker.launchImageLibraryAsync', 'allowsEditing: true', 'Preview profile photo', 'uploadIdentityMedia(userId, profile.scope', 'removeIdentityMedia(userId, profile.scope', 'Alert.alert']) assert.ok(header.includes(text));
  assert.ok(!header.includes('Manage them from your web dashboard.'));
  for (const text of ['<Modal', '<ProfileAvatar', 'accessibilityState={{ selected }}', 'router.replace(profileDestination(profile.scope))']) assert.ok(switcher.includes(text));
});

test('bottom navigation uses direct buttons, full width cells, SVG icons and role-aware destinations', () => {
  assert.ok(!nav.includes('<Link'));
  for (const text of ['router.navigate(destination)', 'link: { flex: 1, flexBasis: 0, minWidth: 0', "nav: { flexDirection: 'row', width: '100%'", 'iconWrap: { width: 40, height: 40', '<NativeIcon', "item.href === '/bookings' && provider ? '/provider-bookings'"]) assert.ok(nav.includes(text));
  assert.ok(!nav.includes('marginTop: -8'));
});

test('photo picker does not request camera/microphone and native dependencies are pinned', async () => {
  const config = JSON.parse(await read('app.json'));
  const picker = config.expo.plugins.find((item) => Array.isArray(item) && item[0] === 'expo-image-picker');
  assert.equal(picker[1].cameraPermission, false);
  assert.equal(picker[1].microphonePermission, false);
  assert.ok(config.expo.android.blockedPermissions.includes('android.permission.READ_EXTERNAL_STORAGE'));
  assert.ok(config.expo.android.blockedPermissions.includes('android.permission.WRITE_EXTERNAL_STORAGE'));
  assert.ok(!header.includes('requestMediaLibraryPermissionsAsync'));
  assert.ok(!header.includes('launchCameraAsync'));
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.dependencies['expo-image-picker'], '57.0.20');
  assert.equal(pkg.dependencies['react-native-svg'], '15.15.4');
});
