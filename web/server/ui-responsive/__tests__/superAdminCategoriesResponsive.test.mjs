import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, actionsSource, journeyCss] = await Promise.all([
  readFile(new URL('app/super-admin/categories/page.tsx', root), 'utf8'),
  readFile(new URL('app/super-admin/categories/actions.ts', root), 'utf8'),
  readFile(new URL('components/super-admin/SuperAdminCategoriesResponsive.module.css', root), 'utf8'),
]);

test('Super Admin category registry uses a scoped responsive wrapper', () => {
  assert.ok(routeSource.includes('SuperAdminCategoriesResponsive.module.css'));
  assert.ok(routeSource.includes('className={styles.registryJourney}'));
  assert.ok(routeSource.includes('Category review queue'));
  assert.ok(routeSource.includes('Registered categories'));
});

test('Super Admin category registry controls stay phone and tablet safe', () => {
  assert.ok(journeyCss.includes('overflow-x: clip'));
  assert.ok(journeyCss.includes('overflow-wrap: anywhere'));
  assert.ok(journeyCss.includes('min-height: 44px'));
  assert.ok(journeyCss.includes('font-size: 16px'));
  assert.ok(journeyCss.includes('max-width: 760px'));
  assert.ok(journeyCss.includes('max-width: 640px'));
  assert.ok(journeyCss.includes('safe-area-inset-bottom'));
  assert.ok(routeSource.includes('className={styles.reviewActions}'));
  assert.ok(routeSource.includes('styles.categoryCard'));
});

test('Super Admin category governance semantics remain unchanged', () => {
  assert.ok(routeSource.includes("supabase.from('platform_applications')"));
  assert.ok(routeSource.includes("supabase.from('platform_categories')"));
  assert.ok(routeSource.includes("supabase.from('provider_category_requests')"));
  assert.ok(routeSource.includes('action={reviewCategoryRequest}'));
  assert.ok(routeSource.includes('action={createCategory}'));
  assert.ok(routeSource.includes('action={updateCategorySearchAliases}'));
  assert.ok(routeSource.includes('action={setCategoryActive}'));
  assert.ok(routeSource.includes('Approve & create category'));
  assert.ok(routeSource.includes('Reject request'));
  assert.ok(actionsSource.includes("revalidatePath('/super-admin/categories')"));
  assert.ok(actionsSource.includes("revalidatePath('/provider/category-requests')"));
  assert.ok(actionsSource.includes("revalidatePath('/provider/services')"));
});
