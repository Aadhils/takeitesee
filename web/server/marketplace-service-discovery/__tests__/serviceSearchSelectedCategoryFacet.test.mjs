import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [migrationSource, normalRouteSource, nearbyRouteSource, exploreSource] = await Promise.all([
  readFile(new URL('../../../database/migrations/20260912092839_service_discovery_selected_category_facet_retention.sql', import.meta.url), 'utf8'),
  readFile(new URL('../../../app/api/marketplace/services/search/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../../../app/api/marketplace/services/nearby/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../../../app/explore/page.tsx', import.meta.url), 'utf8'),
]);

test('selected-category facet v3 keeps live facets and adds only an approved selected taxonomy category', () => {
  assert.ok(migrationSource.includes('get_marketplace_service_discovery_categories_v3'));
  assert.ok(migrationSource.includes("target_category text default 'all'"));
  assert.ok(migrationSource.includes("where s.active=true and s.status='active'::public.service_status"));
  assert.ok(migrationSource.includes('from public.marketplace_search_taxonomy_public tx'));
  assert.ok(migrationSource.includes("lower(btrim(coalesce($1,'all'))) <> 'all'"));
  assert.ok(migrationSource.includes("replace(lower(tx.category_code),'_','-')=replace(lower(btrim($1)),'_','-')"));
  assert.ok(migrationSource.includes('select * from active_categories'));
  assert.ok(migrationSource.includes('union'));
  assert.ok(migrationSource.includes('select * from selected_category'));
});

test('selected-category facet v3 preserves public safe-function hardening', () => {
  assert.ok(migrationSource.includes("language sql stable security invoker set search_path=''"));
  assert.ok(migrationSource.includes('revoke all on function public.get_marketplace_service_discovery_categories_v3(text) from public,authenticated'));
  assert.ok(migrationSource.includes('grant execute on function public.get_marketplace_service_discovery_categories_v3(text) to anon,service_role'));
});

test('normal and nearby Service discovery pass the normalized selected category to the same v3 facet contract', () => {
  const expectedCall = "supabase.rpc('get_marketplace_service_discovery_categories_v3', { target_category: category })";
  assert.ok(normalRouteSource.includes(expectedCall));
  assert.ok(nearbyRouteSource.includes(expectedCall));
  assert.equal(normalRouteSource.includes("supabase.rpc('get_marketplace_service_discovery_categories_v2')"), false);
  assert.equal(nearbyRouteSource.includes("supabase.rpc('get_marketplace_service_discovery_categories_v2')"), false);
});

test('Explore still clears truly invalid category input after the server facet contract resolves', () => {
  assert.ok(exploreSource.includes("if (filters.category !== 'all' && !categories.includes(filters.category))"));
  assert.ok(exploreSource.includes("setFilters((current) => ({ ...current, category: 'all' }))"));
});
