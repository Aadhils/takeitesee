import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, actionsSource, journeyCss] = await Promise.all([
  readFile(new URL('app/provider/category-requests/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderCategoryRequestsManager.tsx', root), 'utf8'),
  readFile(new URL('app/provider/category-requests/actions.ts', root), 'utf8'),
  readFile(new URL('components/provider/ProviderCategoryRequestsResponsive.module.css', root), 'utf8'),
]);

test('Provider category requests use a scoped responsive journey wrapper', () => {
  assert.ok(managerSource.includes('ProviderCategoryRequestsResponsive.module.css'));
  assert.ok(managerSource.includes('className={styles.categoryRequestsJourney}'));
  assert.ok(routeSource.includes('LiveProviderShell active="/provider/services"'));
  assert.ok(routeSource.includes('ProviderCategoryRequestsManager'));
});

test('Provider category request controls stay phone and tablet safe', () => {
  assert.ok(journeyCss.includes('overflow-x: clip'));
  assert.ok(journeyCss.includes('overflow-wrap: anywhere'));
  assert.ok(journeyCss.includes('min-height: 44px'));
  assert.ok(journeyCss.includes('font-size: 16px'));
  assert.ok(journeyCss.includes('max-width: 760px'));
  assert.ok(journeyCss.includes('max-width: 560px'));
  assert.ok(journeyCss.includes('safe-area-inset-bottom'));
  assert.ok(managerSource.includes('className={styles.submitAction}'));
  assert.ok(managerSource.includes('className={styles.requestHeader}'));
  assert.ok(managerSource.includes('className={styles.statusPill}'));
});

test('Provider category request governance semantics remain unchanged', () => {
  assert.ok(routeSource.includes("supabase.from('platform_applications')"));
  assert.ok(routeSource.includes("supabase.from('platform_categories')"));
  assert.ok(routeSource.includes("supabase.from('provider_category_requests')"));
  assert.ok(routeSource.includes(".eq('requester_user_id', session.user_id)"));
  assert.ok(managerSource.includes('action={submitProviderCategoryRequest}'));
  assert.ok(managerSource.includes("t('categoryRequest.intro')"));
  assert.ok(managerSource.includes("t('categoryRequest.pendingHelp')"));
  assert.ok(actionsSource.includes("supabase.rpc('submit_provider_category_request'"));
  assert.ok(actionsSource.includes("revalidatePath('/provider/category-requests')"));
  assert.ok(actionsSource.includes("revalidatePath('/provider/services')"));
});
