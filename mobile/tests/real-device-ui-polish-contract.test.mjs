import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const paths = [
  'app/home.tsx',
  'app/account.tsx',
  'app/bookings.tsx',
  'app/provider-bookings.tsx',
  'app/bookings/[bookingId].tsx',
  'app/provider-bookings/[bookingId].tsx',
  'app/book-service/[serviceId].tsx',
  'app/booking-actions/[bookingId].tsx',
  'app/provider-live-status.tsx',
  'app/reviews/[bookingId].tsx',
  'app/messages/[conversationId].tsx',
  'app/request-service.tsx',
  'app/provider-reviews.tsx',
];

const sources = await Promise.all(paths.map((path) => readFile(new URL(path, root), 'utf8')));
const combined = sources.join('\n');

test('real-device user UI hides internal diagnostics and implementation language', () => {
  for (const forbidden of [
    'Server-authoritative',
    'server-authoritative',
    'Server-validated',
    'server-validated',
    'Native Contract v1',
    'Finance HOLD',
    'Recurrence FROZEN',
    'Backend connection',
    'Read-only in this native slice',
    'outside this release slice',
    'outside this native slice',
    'Server roles',
    '>User ID<',
    'server-owned Provider review contract',
    'Server-guarded responses',
  ]) {
    assert.equal(combined.includes(forbidden), false, `user UI must not expose internal copy: ${forbidden}`);
  }
});

test('home and account avoid exposing raw internal identity values', async () => {
  const [home, account] = await Promise.all([
    readFile(new URL('app/home.tsx', root), 'utf8'),
    readFile(new URL('app/account.tsx', root), 'utf8'),
  ]);

  assert.ok(home.includes('Find services, manage bookings and keep up with your requests in one place.'));
  assert.ok(home.includes('Explore services'));
  assert.ok(home.includes('Post a requirement'));
  assert.ok(!home.includes('auth.identity.userId'));

  assert.ok(account.includes('Your access'));
  assert.ok(account.includes('Customer'));
  assert.ok(account.includes('Provider tools are available'));
  assert.ok(!account.includes('auth.identity.userId'));
});

test('real-device marketplace and booking screens expose clear next actions', async () => {
  const [explore, bookings, providerBookings] = await Promise.all([
    readFile(new URL('app/explore.tsx', root), 'utf8'),
    readFile(new URL('app/bookings.tsx', root), 'utf8'),
    readFile(new URL('app/provider-bookings.tsx', root), 'utf8'),
  ]);

  assert.ok(explore.includes('View service →'));
  assert.ok(bookings.includes('View booking →'));
  assert.ok(providerBookings.includes('Booking actions'));
  assert.ok(providerBookings.includes('View booking →'));
});
