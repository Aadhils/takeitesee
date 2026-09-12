import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [directorySource, stylesSource] = await Promise.all([
  readFile(new URL('components/discovery/PublicDirectoryViews.tsx', root), 'utf8'),
  readFile(new URL('components/discovery/PublicDirectoryViews.module.css', root), 'utf8'),
]);

test('Businesses empty state gives customers and prospective businesses clear next actions', () => {
  assert.ok(directorySource.includes('styles.businessEmpty'));
  assert.ok(directorySource.includes("text('Growing business marketplace'"));
  assert.ok(directorySource.includes("text('Verified business identity'"));
  assert.ok(directorySource.includes("text('Active service listings'"));
  assert.ok(directorySource.includes("text('Products & storefront discovery'"));
  assert.ok(directorySource.includes('href="/explore"'));
  assert.ok(directorySource.includes('href="/provider/onboarding"'));
  assert.ok(directorySource.includes("text('List your business'"));
});

test('Businesses empty state shares the compact responsive directory contract', () => {
  assert.ok(stylesSource.includes('.professionalEmpty,\n.businessEmpty'));
  assert.ok(stylesSource.includes('@media (max-width: 760px)'));
  assert.ok(stylesSource.includes('@media (max-width: 640px)'));
  assert.ok(stylesSource.includes('grid-template-columns: 1fr;'));
  assert.ok(stylesSource.includes('width: 100%;'));
});
