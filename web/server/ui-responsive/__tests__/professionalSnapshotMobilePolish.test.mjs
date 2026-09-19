import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [styles, profile] = await Promise.all([
  readFile(new URL('components/detail/PublicProviderProfile.module.css', root), 'utf8'),
  readFile(new URL('components/detail/PublicProviderProfile.tsx', root), 'utf8'),
]);

test('Professional snapshot remains a public profile aside card', () => {
  assert.ok(profile.includes("kind === 'professional' ? <Card className={styles.snapshotCard}>"));
  assert.ok(profile.includes("t('publicProvider.profile.professionalSnapshot')"));
  assert.ok(profile.includes("t('publicProvider.profile.oneVerifiedIdentity')"));
  assert.ok(profile.includes('className="review-details"'));
});

test('Professional snapshot facts wrap safely without changing profile data', () => {
  assert.ok(styles.includes('.snapshotCard :global(.review-details)'));
  assert.ok(styles.includes('.snapshotCard :global(.review-details > div)'));
  assert.ok(styles.includes('.snapshotCard :global(.review-details dt)'));
  assert.ok(styles.includes('.snapshotCard :global(.review-details dd)'));
  assert.ok(styles.includes('overflow-wrap: anywhere'));
});

test('Professional snapshot becomes phone-safe while staying fully visible', () => {
  assert.ok(styles.includes('@media (max-width: 760px)'));
  assert.ok(styles.includes('grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr)'));
  assert.ok(styles.includes('max-width: none'));
  assert.ok(styles.includes('@media (max-width: 420px)'));
  assert.ok(styles.includes('.snapshotCard :global(.review-details > div) {\n    grid-template-columns: 1fr;'));
  assert.ok(!styles.includes('.snapshotCard {\n    display: none'));
});
