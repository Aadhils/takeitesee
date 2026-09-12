import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [directorySource, stylesSource] = await Promise.all([
  readFile(new URL('components/discovery/PublicDirectoryViews.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/PublicDirectoryViews.module.css', root), 'utf8'),
]);

test('Professionals empty state gives users clear marketplace and provider next actions', () => {
  assert.ok(directorySource.includes("import styles from './PublicDirectoryViews.module.css'"));
  assert.ok(directorySource.includes('styles.professionalEmpty'));
  assert.ok(directorySource.includes('styles.emptyHighlights'));
  assert.ok(directorySource.includes('styles.emptyActions'));
  assert.ok(directorySource.includes('href="/explore"'));
  assert.ok(directorySource.includes('href="/provider/onboarding"'));
  assert.ok(directorySource.includes("text('Join as a professional'"));
});

test('Professionals empty state remains compact and phone-safe', () => {
  assert.ok(stylesSource.includes('grid-template-columns: minmax(0, 1fr) auto'));
  assert.ok(stylesSource.includes('@media (max-width: 760px)'));
  assert.ok(stylesSource.includes('@media (max-width: 640px)'));
  assert.ok(stylesSource.includes('grid-template-columns: 1fr;'));
  assert.ok(stylesSource.includes('width: 100%;'));
});
