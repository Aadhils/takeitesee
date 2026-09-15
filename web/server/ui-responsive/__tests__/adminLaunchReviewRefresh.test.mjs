import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = await readFile(new URL('components/admin/ServiceLaunchReviewManager.tsx', root), 'utf8');

test('Admin launch reviews provide a manual refresh action', () => {
  assert.ok(source.includes('Refresh reviews'));
  assert.ok(source.includes("cache: 'no-store'"));
});

test('Admin launch reviews refresh when the operator returns', () => {
  assert.ok(source.includes("window.addEventListener('focus', refreshVisibleReviews)"));
  assert.ok(source.includes("document.addEventListener('visibilitychange', refreshVisibleReviews)"));
  assert.ok(source.includes('if (loadingRef.current) return;'));
});
