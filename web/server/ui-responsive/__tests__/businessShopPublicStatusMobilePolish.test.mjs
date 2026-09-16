import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [presentation, styles, loader] = await Promise.all([
  readFile(new URL('components/detail/BusinessShopPublicStatusPresentation.tsx', root), 'utf8'),
  readFile(new URL('components/detail/BusinessShopPublicStatusPresentation.module.css', root), 'utf8'),
  readFile(new URL('components/detail/BusinessShopPublicStatus.tsx', root), 'utf8'),
]);

test('Business shop status keeps the existing open/closed signal semantics', () => {
  assert.ok(presentation.includes("const open = shopState === 'open'"));
  assert.ok(presentation.includes("tone={open ? 'success' : 'neutral'}"));
  assert.ok(presentation.includes('Provider Available/Busy'));
  assert.ok(presentation.includes('service booking schedule'));
});

test('Business shop status keeps its read-only server loader unchanged', () => {
  assert.ok(loader.includes(".from('business_shop_status')"));
  assert.ok(loader.includes(".select('shop_state')"));
  assert.equal(loader.includes('.update('), false);
  assert.equal(loader.includes('.insert('), false);
  assert.equal(loader.includes('.delete('), false);
});

test('Business shop status long copy wraps and stacks on mobile', () => {
  assert.ok(styles.includes('overflow-wrap: anywhere'));
  assert.ok(styles.includes('word-break: break-word'));
  assert.ok(styles.includes('@media (max-width: 640px)'));
  assert.ok(styles.includes('flex-direction: column'));
  assert.ok(styles.includes('@media (max-width: 390px)'));
  assert.ok(styles.includes('width: 100%'));
});
