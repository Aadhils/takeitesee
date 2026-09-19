import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, translations, actionsSource] = await Promise.all([
  readFile(new URL('app/provider/category-requests/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderCategoryRequestsManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
  readFile(new URL('app/provider/category-requests/actions.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider category requests use shared localization in the client journey', () => {
  assert.ok(managerSource.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(managerSource));

  const keys = [...new Set([...managerSource.matchAll(/t\('(categoryRequest\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 25, 'expected broad category-request localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider category request data access remains server-side and scoped to the current provider', () => {
  assert.ok(routeSource.includes("productionAuthProvider.requireProvider()"));
  assert.ok(routeSource.includes("supabase.from('platform_applications')"));
  assert.ok(routeSource.includes("supabase.from('platform_categories')"));
  assert.ok(routeSource.includes("supabase.from('provider_category_requests')"));
  assert.ok(routeSource.includes(".eq('requester_user_id', session.user_id)"));
  assert.ok(routeSource.includes('ProviderCategoryRequestsManager'));
});

test('Provider category request governance action remains unchanged', () => {
  assert.ok(managerSource.includes('action={submitProviderCategoryRequest}'));
  assert.ok(actionsSource.includes("supabase.rpc('submit_provider_category_request'"));
  assert.ok(actionsSource.includes('requested_provider_type: providerType'));
  assert.ok(actionsSource.includes('target_application_id: applicationId'));
  assert.ok(actionsSource.includes('target_parent_category_id: parentCategoryId'));
  assert.ok(actionsSource.includes("revalidatePath('/provider/category-requests')"));
  assert.ok(actionsSource.includes("revalidatePath('/provider/services')"));
  assert.ok(actionsSource.includes("revalidatePath('/provider/setup')"));
});
