import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [bookings, liveStatus, serviceAvailability] = await Promise.all([
  readFile(new URL('app/bookings.tsx', root), 'utf8'),
  readFile(new URL('app/provider-live-status.tsx', root), 'utf8'),
  readFile(new URL('app/provider-service-availability.tsx', root), 'utf8'),
]);

test('remaining real-device marketplace screens use shared brand theme tokens', () => {
  for (const [name, source] of [
    ['bookings', bookings],
    ['live status', liveStatus],
    ['service availability', serviceAvailability],
  ]) {
    assert.ok(source.includes("from '../lib/theme'"), `${name} must use shared theme tokens`);
    assert.ok(source.includes('theme.colors.primary'), `${name} must use brand primary`);
    assert.ok(source.includes('backgroundColor: theme.colors.white'), `${name} must use brand canvas`);
    assert.equal(source.includes("backgroundColor: '#30304a'"), false, `${name} must not keep legacy selected navy`);
  }
});

test('Customer bookings keeps the logo outside the scrolling list so branding remains visible', () => {
  assert.ok(bookings.includes('<View style={styles.screen}>\n        <View style={styles.brandRow}><BrandLogo compact /></View>\n        <ScrollView'));
  assert.ok(bookings.includes('...cardShadow'));
  assert.ok(bookings.includes('color: theme.colors.primary'));
});

test('Provider live status and booking mode use branded selected states', () => {
  assert.ok(liveStatus.includes('durationChipSelected: { backgroundColor: theme.colors.primary }'));
  assert.ok(liveStatus.includes('modeButtonSelected: { backgroundColor: theme.colors.primary }'));
  assert.ok(serviceAvailability.includes('modeSelected: { backgroundColor: theme.colors.primary }'));
  assert.ok(serviceAvailability.includes('For detailed schedule editing, use the web.'));
});
