import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [
  layoutSource,
  accountPolishCss,
  requirementCtaCss,
  proposalSource,
  catalogRouteSource,
  catalogMigrationSource,
  requirementsRouteSource,
  requirementDetailRouteSource,
] = await Promise.all([
  readFile(new URL('app/layout.tsx', root), 'utf8'),
  readFile(new URL('app/account-overview-stage4-polish.css', root), 'utf8'),
  readFile(new URL('app/post-requirement-mobile-cta.css', root), 'utf8'),
  readFile(new URL('components/account/CustomerAccountProposalSummary.tsx', root), 'utf8'),
  readFile(new URL('app/api/requirements/catalog/route.ts', root), 'utf8'),
  readFile(new URL('database/migrations/20260917182000_customer_requirement_catalog_rpc.sql', root), 'utf8'),
  readFile(new URL('app/api/requirements/route.ts', root), 'utf8'),
  readFile(new URL('app/api/requirements/[requirementId]/route.ts', root), 'utf8'),
]);

test('mobile and tablet account overview removes redundant identity chrome and compacts the welcome hero', () => {
  assert.ok(layoutSource.includes("import './account-overview-stage4-polish.css';"));
  assert.match(accountPolishCss, /@media \(max-width: 900px\)[\s\S]*?\.account-layout > \.account-sidebar > \.account-sidebar-heading\s*\{\s*display:\s*none !important/);
  assert.match(accountPolishCss, /\.customer-social-dashboard > \.eyebrow,[\s\S]*?\.customer-social-dashboard > p\s*\{\s*display:\s*none !important/);
  assert.match(accountPolishCss, /\.customer-social-dashboard > h1\s*\{[\s\S]*?font-size:\s*clamp\(1\.3rem, 3\.8vw, 1\.65rem\) !important/);
});

test('customer proposal attention explains the requirement to proposal journey', () => {
  assert.ok(proposalSource.includes("t('customer.proposals.inbox')"));
  assert.ok(proposalSource.includes("t('customer.proposals.postNeedTitle')"));
  assert.ok(proposalSource.includes("t('customer.proposals.postNeedHelp')"));
  assert.ok(proposalSource.includes("t('customer.proposals.waitingTitle')"));
  assert.ok(proposalSource.includes("t('customer.proposals.postRequirement')"));
  assert.ok(proposalSource.includes('margin-top: 16px'));
});

test('mobile and tablet surfaces a persistent post requirement action', () => {
  assert.ok(layoutSource.includes("import './post-requirement-mobile-cta.css';"));
  assert.match(requirementCtaCss, /@media \(max-width: 900px\)/);
  assert.match(requirementCtaCss, /\.header-requirement\s*\{[\s\S]*?display:\s*inline-flex !important/);
  assert.ok(requirementCtaCss.includes('position: fixed'));
  assert.ok(requirementCtaCss.includes('bottom: calc(78px + env(safe-area-inset-bottom))'));
});

test('customer requirement catalog uses an authenticated RPC without weakening governance table RLS', () => {
  assert.ok(catalogRouteSource.includes('requireCustomerSupabase'));
  assert.ok(!catalogRouteSource.includes('createSupabaseServiceClient'));
  const authIndex = catalogRouteSource.indexOf('await requireCustomerSupabase()');
  const rpcIndex = catalogRouteSource.indexOf("supabase.rpc('get_customer_requirement_catalog')");
  assert.ok(authIndex >= 0);
  assert.ok(rpcIndex > authIndex);
  assert.ok(catalogMigrationSource.includes('security definer'));
  assert.ok(catalogMigrationSource.includes("if auth.uid() is null"));
  assert.ok(catalogMigrationSource.includes("location.type::text = 'city'"));
  assert.ok(catalogMigrationSource.includes('revoke all on function public.get_customer_requirement_catalog() from anon;'));
  assert.ok(catalogMigrationSource.includes('grant execute on function public.get_customer_requirement_catalog() to authenticated;'));
});

test('requirement list and detail hydrate canonical category and city names through the authenticated catalog projection', () => {
  assert.ok(requirementsRouteSource.includes("supabase.rpc('get_customer_requirement_catalog')"));
  assert.ok(requirementsRouteSource.includes('catalog?.locations?.find((item) => item.id === row.location_id)?.name'));
  assert.ok(requirementsRouteSource.includes('catalog?.categories?.find((item) => item.id === row.category_id)?.name'));
  assert.ok(requirementDetailRouteSource.includes("supabase.rpc('get_customer_requirement_catalog')"));
  assert.ok(requirementDetailRouteSource.includes('hydrateRequirementTaxonomy'));
  assert.ok(requirementDetailRouteSource.includes('platform_locations: location'));
  assert.ok(requirementDetailRouteSource.includes('platform_categories: category'));
});


test('provider workspace keeps customer quick actions out of provider chrome', async () => {
  const shellSource = await readFile(new URL('components/layout/AppShell.tsx', root), 'utf8');
  assert.ok(shellSource.includes("const isProviderWorkspace = pathname === '/provider' || pathname.startsWith('/provider/')"));
  assert.ok(shellSource.includes("!isProviderWorkspace ? <Link href=\"/requirements\" className=\"header-requirement\""));
});

test('skip link uses keyboard modality and a touch-device hard hide', async () => {
  const shellSource = await readFile(new URL('components/layout/AppShell.tsx', root), 'utf8');
  assert.ok(shellSource.includes("event.key === 'Tab'"));
  assert.ok(shellSource.includes("root.classList.add('takeitesee-keyboard-nav')"));
  assert.ok(shellSource.includes("window.addEventListener('pointerdown', disableKeyboardNav, true)"));
  assert.ok(shellSource.includes("window.addEventListener('touchstart', disableKeyboardNav, true)"));
  assert.ok(shellSource.includes("window.addEventListener('pageshow', resetKeyboardNav)"));
  assert.ok(shellSource.includes('.takeitesee-keyboard-nav .skip-link:focus'));
  assert.ok(shellSource.includes('@media (hover: none), (pointer: coarse)'));
  assert.ok(shellSource.includes('clip-path: inset(50%) !important'));
  assert.ok(shellSource.includes('pointer-events: none !important'));
  assert.ok(!shellSource.includes('.skip-link:focus-visible'));
});
