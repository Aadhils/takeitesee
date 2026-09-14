import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, css] = await Promise.all([
  readFile(new URL('components/account/LiveNotificationsPage.tsx', root), 'utf8'),
  readFile(new URL('components/account/LiveNotificationsPage.module.css', root), 'utf8'),
]);

test('Notifications page uses scoped responsive card styles without changing destination semantics', () => {
  assert.ok(source.includes("import styles from './LiveNotificationsPage.module.css'"));
  assert.ok(source.includes('styles.notificationCard'));
  assert.ok(source.includes('styles.unreadCard'));
  assert.ok(source.includes('styles.openAction'));
  assert.ok(source.includes("if (item.target_path?.startsWith('/')"));
  assert.ok(source.includes('router.push(href)'));
  assert.ok(source.includes("body: JSON.stringify({ mark_all_read: true })"));
});

test('Notifications cards stay compact, wrap safely and expose touch-friendly actions', () => {
  assert.ok(css.includes('max-width: 900px'));
  assert.ok(css.includes('overflow-x: clip'));
  assert.ok(css.includes('overflow-wrap: anywhere'));
  assert.ok(css.includes('min-height: 44px'));
  assert.ok(css.includes('@media (max-width: 760px)'));
  assert.ok(css.includes('@media (max-width: 560px)'));
  assert.ok(css.includes('grid-template-columns: 1fr'));
  assert.ok(css.includes('.mark {\n    display: none;'));
  assert.ok(css.includes('padding-bottom: 78px'));
});

test('Phone notification actions become full-width while tablet keeps compact cards', () => {
  assert.ok(css.includes('.openAction,\n  .actions :global(.button)'));
  assert.ok(css.includes('width: 100%'));
  assert.ok(css.includes('grid-template-columns: 34px minmax(0, 1fr)'));
  assert.ok(source.includes('notification-card-actions'));
  assert.ok(source.includes('notification-card-top'));
});
