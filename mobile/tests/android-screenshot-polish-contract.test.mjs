import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const paths = ['components/BrandLogo.tsx', 'app/home.tsx', 'app/explore.tsx', 'app/bookings.tsx', 'app/account.tsx'];
const [logo, home, explore, bookings, account] = await Promise.all(paths.map(path => readFile(new URL(path, root), 'utf8')));

test('shared logo respects centered screen headers and has readable compact bounds', () => {
  assert.ok(!logo.includes("alignSelf: 'flex-start'"));
  assert.ok(logo.includes("alignSelf: 'center'"));
  assert.ok(logo.includes('width: 152'));
  assert.ok(logo.includes('height: 44'));
  assert.ok(logo.includes("require('../assets/official-takeitesee-logo.png')"));
});
test('Home hero uses natural wrapping instead of displaying a literal backslash newline', () => {
  assert.ok(home.includes('Find the right service for your next task.'));
  assert.ok(!home.includes('Find the right service\\n'));
});
test('linked service, booking and account cards use static styles with Android tap feedback', () => {
  for (const source of [explore, bookings]) {
    assert.ok(source.includes('foreground: true }} style={styles.card}'));
    assert.ok(!source.includes('style={({ pressed }) => [styles.card,'));
    assert.ok(source.includes('asChild'));
  }
  assert.equal((account.match(/foreground: true }} style=\{styles.quickCard\}/g) ?? []).length, 4);
  assert.ok(account.includes('foreground: true }} style={styles.workspaceButton}'));
});
