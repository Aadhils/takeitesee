import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [styles, profile] = await Promise.all([
  readFile(new URL('components/detail/PublicProviderProfile.module.css', root), 'utf8'),
  readFile(new URL('components/detail/PublicProviderProfile.tsx', root), 'utf8'),
]);

test('Professional work showcase keeps image and video cards in the public profile', () => {
  assert.ok(profile.includes('className={styles.mediaGrid}'));
  assert.ok(profile.includes('className={styles.mediaCard}'));
  assert.ok(profile.includes('className={styles.mediaPreview}'));
  assert.ok(profile.includes('className={styles.mediaBody}'));
  assert.ok(profile.includes('loading="lazy"'));
  assert.ok(profile.includes('controls preload="metadata" playsInline'));
});

test('Professional work showcase captions and role badges wrap safely', () => {
  assert.ok(styles.includes('.mediaCard {\n  display: grid;\n  min-width: 0;'));
  assert.ok(styles.includes('.mediaBody > div:first-child > *'));
  assert.ok(styles.includes('max-width: 100%'));
  assert.ok(styles.includes('.mediaBody h3'));
  assert.ok(styles.includes('overflow-wrap: anywhere'));
});

test('Professional work showcase media becomes compact on mobile and narrow screens', () => {
  assert.ok(styles.includes('@media (max-width: 760px)'));
  assert.ok(styles.includes('.mediaPreview img,\n  .mediaPreview video {\n    height: 220px;'));
  assert.ok(styles.includes('.mediaBody {\n    gap: 7px;\n    padding: 14px 15px 16px;'));
  assert.ok(styles.includes('@media (max-width: 420px)'));
  assert.ok(styles.includes('.mediaPreview img,\n  .mediaPreview video {\n    height: 190px;'));
});
