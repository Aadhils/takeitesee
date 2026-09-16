import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [layoutSource, accountPolishCss, proposalSource, catalogRouteSource] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/account-overview-stage4-polish.css', root), 'utf8'),
  readFile(new URL('components/account/CustomerAccountProposalSummary.tsx', root), 'utf8'),
  readFile(new URL('app/api/requirements/catalog/route.ts', root), 'utf8'),
]);

test('mobile and tablet account overview removes redundant identity chrome and compacts the welcome hero', () => {
  assert.ok(layoutSource.includes("import './account-overview-stage4-polish.css';"));
  assert.match(accountPolishCss, /@media \(max-width: 900px\)[\s\S]*?\.account-layout > \.account-sidebar > \.account-sidebar-heading\s*\{\s*display:\s*none !important/);
  assert.match(accountPolishCss, /\.customer-social-dashboard > \.eyebrow,[\s\S]*?\.customer-social-dashboard > p\s*\{\s*display:\s*none !important/);
  assert.match(accountPolishCss, /\.customer-social-dashboard > h1\s*\{[\s\S]*?font-size:\s*clamp\(1\.65rem, 4\.8vw, 2\.2rem\) !important/);
});

test('customer proposal attention reads as a friendly proposal inbox', () => {
  assert.ok(proposalSource.includes('Proposal inbox'));
  assert.ok(proposalSource.includes('No provider proposals yet'));
  assert.ok(proposalSource.includes('When you post a requirement and a verified provider responds, the reply will appear here.'));
  assert.ok(proposalSource.includes('Post or manage requirements'));
});

test('customer requirement catalog authenticates first then resolves active marketplace taxonomy server-side', () => {
  assert.ok(catalogRouteSource.includes("createSupabaseServiceClient"));
  assert.ok(!catalogRouteSource.includes('createSupabaseServerClient'));
  const authIndex = catalogRouteSource.indexOf('await productionAuthProvider.requireCustomer(request)');
  const serviceIndex = catalogRouteSource.indexOf('const supabase = createSupabaseServiceClient()');
  assert.ok(authIndex >= 0);
  assert.ok(serviceIndex > authIndex);
  assert.ok(catalogRouteSource.includes(".from('platform_categories')"));
  assert.ok(catalogRouteSource.includes(".from('platform_locations')"));
  assert.ok(catalogRouteSource.includes(".eq('active', true)"));
  assert.ok(catalogRouteSource.includes(".eq('type', 'city')"));
});
