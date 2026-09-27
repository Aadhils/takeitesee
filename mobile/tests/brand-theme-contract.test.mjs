import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const paths = {
  theme: 'lib/theme.ts',
  brand: 'components/BrandLogo.tsx',
  nav: 'components/MobileNav.tsx',
  home: 'app/home.tsx',
  notifications: 'app/notifications.tsx',
  serviceDetail: 'app/service/[serviceId].tsx',
  directBooking: 'app/book-service/[serviceId].tsx',
  appConfig: 'app.json',
};

const entries = await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(new URL(path, root), 'utf8')]),
);
const source = Object.fromEntries(entries);

const brandedRoutes = [
  'app/index.tsx',
  'app/login.tsx',
  'app/home.tsx',
  'app/explore.tsx',
  'app/requirements.tsx',
  'app/requirements/[requirementId].tsx',
  'app/request-service.tsx',
  'app/account.tsx',
  'app/bookings.tsx',
  'app/bookings/[bookingId].tsx',
  'app/booking-actions/[bookingId].tsx',
  'app/messages.tsx',
  'app/messages/[conversationId].tsx',
  'app/notifications.tsx',
  'app/reviews.tsx',
  'app/reviews/[bookingId].tsx',
  'app/provider.tsx',
  'app/provider-bookings.tsx',
  'app/provider-bookings/[bookingId].tsx',
  'app/provider-live-status.tsx',
  'app/provider-reviews.tsx',
  'app/provider-service-availability.tsx',
  'app/providers/[providerType]/[providerId].tsx',
  'app/service/[serviceId].tsx',
  'app/book-service/[serviceId].tsx',
];

test('native theme matches the approved TakeItEsee web brand palette', () => {
  for (const token of [
    "primary: '#6352D9'",
    "primaryStrong: '#2D2D9A'",
    "accent: '#8F7AFF'",
    "ink: '#101A34'",
    "inkMuted: '#5E6983'",
    "border: '#DFE6F2'",
    "secondary: '#F2EFFF'",
  ]) {
    assert.ok(source.theme.includes(token), `missing brand token: ${token}`);
  }
});

test('native brand mark is bundled locally from the existing official TakeItEsee logo', async () => {
  assert.ok(source.brand.includes("require('../assets/official-takeitesee-logo.png')"));
  assert.ok(!source.brand.includes('https://www.takeitesee.com/official-takeitesee-logo.png'));
  const logo = await readFile(new URL('assets/official-takeitesee-logo.png', root));
  assert.ok(logo.length > 1000, 'bundled official logo asset should be present');
});

test('native launch screen uses the bundled official logo and brand canvas', () => {
  const config = JSON.parse(source.appConfig);
  const splashPlugin = config.expo.plugins.find((item) => Array.isArray(item) && item[0] === 'expo-splash-screen');
  assert.ok(splashPlugin);
  assert.equal(splashPlugin[1].image, './assets/official-takeitesee-logo.png');
  assert.equal(splashPlugin[1].backgroundColor, '#F8F7FF');
  assert.equal(splashPlugin[1].resizeMode, 'contain');
});

test('every user-facing native route surfaces the shared TakeItEsee brand mark', async () => {
  for (const path of brandedRoutes) {
    const route = await readFile(new URL(path, root), 'utf8');
    assert.ok(route.includes('<BrandLogo'), `${path} must show the shared brand mark`);
  }
});

test('primary actions and bottom navigation use shared brand theme tokens', () => {
  assert.ok(source.nav.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.home.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.notifications.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.serviceDetail.includes('backgroundColor: theme.colors.primary'));
  assert.ok(source.directBooking.includes('backgroundColor: theme.colors.primary'));
});

test('real-device Home navigation keeps cards directly pressable and shrink-safe', () => {
  assert.ok(source.home.includes("router.push('/explore')"));
  assert.ok(source.home.includes("router.push('/bookings')"));
  assert.ok(source.home.includes("router.push('/requirements')"));
  assert.ok(source.home.includes('minWidth: 0'));
  assert.ok(!source.home.includes('<Link href="/explore" asChild>'));
});

test('Notifications keep human-friendly timestamps', () => {
  assert.ok(source.notifications.includes('formatNotificationTime(item.created_at)'));
  assert.ok(!source.notifications.includes('{item.created_at}</Text>'));
});
