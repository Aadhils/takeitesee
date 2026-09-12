import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, polishSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/products-mobile-polish.css', root), 'utf8'),
]);

test('Products narrow-mobile action row is globally loaded after responsive layers', () => {
  const foundationIndex = layoutSource.indexOf("import './responsive-foundation.css';");
  const productsIndex = layoutSource.indexOf("import './products-mobile-polish.css';");
  assert.ok(foundationIndex >= 0, 'responsive foundation import missing');
  assert.ok(productsIndex > foundationIndex, 'Products mobile polish must load after responsive foundation');
});

test('Products hero actions stay contained inside narrow mobile viewport', () => {
  assert.ok(polishSource.includes('@media (max-width: 640px)'));
  assert.ok(polishSource.includes('.discovery-page:has(.product-smart-filters) > .page-intro'));
  assert.ok(polishSource.includes('overflow-x: clip'));
  assert.ok(polishSource.includes('grid-auto-flow: column'));
  assert.ok(polishSource.includes('grid-auto-columns: minmax(0, 1fr)'));
  assert.ok(polishSource.includes('max-width: 100%'));
  assert.ok(polishSource.includes('overflow: hidden !important'));
  assert.ok(polishSource.includes('white-space: normal !important'));
});
