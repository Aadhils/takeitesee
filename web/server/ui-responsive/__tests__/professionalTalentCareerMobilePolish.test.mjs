import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [styles, profile] = await Promise.all([
  readFile(new URL('components/detail/PublicProviderProfile.module.css', root), 'utf8'),
  readFile(new URL('components/detail/PublicProviderProfile.tsx', root), 'utf8'),
]);

test('Professional talent cards keep long role content readable', () => {
  assert.ok(profile.includes('className={styles.talentGrid}'));
  assert.ok(profile.includes('className={styles.talentCard}'));
  assert.ok(profile.includes('className={styles.opportunities}'));
  assert.ok(styles.includes('.talentCardTop h3'));
  assert.ok(styles.includes('overflow-wrap: anywhere'));
  assert.ok(styles.includes('.opportunities > *'));
  assert.ok(styles.includes('max-width: 100%'));
});

test('Professional career cards stay compact and wrap safely on mobile', () => {
  assert.ok(profile.includes('className={styles.careerSignals}'));
  assert.ok(profile.includes('className={styles.careerTimeline}'));
  assert.ok(profile.includes('className={styles.careerGrid}'));
  assert.ok(profile.includes('className={styles.careerItem}'));
  assert.ok(styles.includes('@media (max-width: 760px)'));
  assert.ok(styles.includes('.careerItem {\n    gap: 6px;\n    padding: 14px;'));
  assert.ok(styles.includes('.careerNote {\n    padding: 12px 14px;'));
  assert.ok(styles.includes('.careerTimeline,\n  .careerGrid {\n    gap: 10px;'));
});

test('narrow mobile Professional profile reduces card density without hiding content', () => {
  assert.ok(styles.includes('@media (max-width: 420px)'));
  assert.ok(styles.includes('.talentCard,\n  .careerItem {\n    padding: 13px;'));
  assert.ok(!styles.includes('display: none'));
});
