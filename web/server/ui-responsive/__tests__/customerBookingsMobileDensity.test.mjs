import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [componentSource, cssSource] = await Promise.all([
  readFile(new URL('components/booking/CustomerBookings.tsx', root), 'utf8'),
  readFile(new URL('components/booking/CustomerBookings.module.css', root), 'utf8'),
]);

test('Customer Bookings keeps all lifecycle groups and adds a compact jump summary', () => {
  assert.ok(componentSource.includes("key: 'upcoming'"));
  assert.ok(componentSource.includes("key: 'completed'"));
  assert.ok(componentSource.includes("key: 'closeout'"));
  assert.ok(componentSource.includes("key: 'cancelled'"));
  assert.ok(componentSource.includes('lifecycleNav'));
  assert.ok(componentSource.includes('booking-group-${group.key}'));
  assert.ok(componentSource.includes('group.values.length'));
});

test('Customer Bookings mobile presentation is compact without changing booking grids on desktop', () => {
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'));
  assert.ok(cssSource.includes('.bookingGroupEmpty :global(.state-panel)'));
  assert.ok(cssSource.includes('padding: 18px 16px'));
  assert.ok(cssSource.includes('.bookingsPage :global(.booking-card)'));
  assert.ok(cssSource.includes('overflow-x: clip'));
});
