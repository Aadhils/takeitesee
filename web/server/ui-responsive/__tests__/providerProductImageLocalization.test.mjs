import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProductPrimaryImageControl.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Product primary image uses shared localization instead of local Tamil branching', () => {
  assert.ok(source.includes('const { t } = useIdentityWorkspaceTranslations();'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.products\.image[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 15, 'expected shared Product image localization keys');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Product primary image keeps media and revision contracts unchanged', () => {
  assert.ok(source.includes("new Set(['image/jpeg', 'image/png', 'image/webp'])"));
  assert.ok(source.includes('6 * 1024 * 1024'));
  assert.ok(source.includes('accept="image/jpeg,image/png,image/webp"'));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("method: 'DELETE'"));
  assert.ok(source.includes('review_revision'));
  assert.ok(source.includes('.upload(objectPath, file'));
  assert.ok(source.includes('.remove([objectPath])'));
  assert.ok(source.includes('onChanged?.()'));
});
