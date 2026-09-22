import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [requirementsPage, workspace, detailSource, managerSource, proposalAttentionSource, lifecycleSource, requirementsRouteSource, requirementDetailRouteSource, requirementCatalogRouteSource, customerSupabaseSource, cssSource] = await Promise.all([
  readFile(new URL('app/requirements/page.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementDetail.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementsManager.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementProposalAttention.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementLifecycleOverview.tsx', root), 'utf8'),
  readFile(new URL('app/api/requirements/route.ts', root), 'utf8'),
  readFile(new URL('app/api/requirements/[requirementId]/route.ts', root), 'utf8'),
  readFile(new URL('app/api/requirements/catalog/route.ts', root), 'utf8'),
  readFile(new URL('server/auth/customer-supabase.ts', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementsResponsive.module.css', root), 'utf8'),
]);

test('Customer Requirements list and detail share the responsive journey wrapper', () => {
  assert.ok(requirementsPage.includes("CustomerRequirementsResponsive.module.css"));
  assert.ok(requirementsPage.includes('className={styles.journey}'));
  assert.ok(workspace.includes("CustomerRequirementsResponsive.module.css"));
  assert.ok(workspace.includes('className={styles.detailJourney}'));
  assert.ok(workspace.includes('<CustomerRequirementDetail'));
});

test('Requirements responsive styles protect mobile density and long localized content', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('grid-template-columns: 1fr !important'));
  assert.ok(cssSource.includes('.journey section :global(.policy-card) :global(.button)'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px))'));
});

test('Smart mobile requirement form keeps long catalogs and optional details compact', () => {
  assert.ok(managerSource.includes("const [categorySearch, setCategorySearch] = useState('')"));
  assert.ok(managerSource.includes('const categoryMatches = useMemo'));
  assert.ok(managerSource.includes('requirement-category-search'));
  assert.ok(managerSource.includes("const [showOneTimeDetails, setShowOneTimeDetails] = useState(false)"));
  assert.ok(managerSource.includes('requirement-more-details-toggle'));
  assert.ok(managerSource.includes("schedulePattern === 'recurring' || showOneTimeDetails"));
  assert.ok(managerSource.includes('requirement-mobile-sticky-submit'));
  assert.ok(cssSource.includes('bottom: calc(76px + env(safe-area-inset-bottom, 0px))'));
  assert.ok(cssSource.includes(':global(.requirement-manager-drafting)'));
});

test('Recurring requirement semantics remain visible and unchanged by compact one-time controls', () => {
  assert.ok(managerSource.includes("if (schedulePattern === 'recurring' && !neededBy)"));
  assert.ok(managerSource.includes("schedulePattern === 'recurring' && recurrenceFrequency === 'weekly'"));
  assert.ok(managerSource.includes('recurrence_interval: interval'));
  assert.ok(managerSource.includes('recurrence_count: count'));
  assert.ok(managerSource.includes('recurrence_weekdays: selectedWeekdays'));
});

test('Proposal comparison cards and provider context remain responsive', () => {
  assert.ok(cssSource.includes(':global(.customer-proposal-card)'));
  assert.ok(cssSource.includes(':global(.customer-proposal-statuses)'));
  assert.ok(cssSource.includes(':global(.customer-provider-current-context)'));
  assert.ok(cssSource.includes(':global(.customer-proposal-confirm)'));
  assert.ok(cssSource.includes('justify-content: flex-start'));
  assert.ok(cssSource.includes('max-width: none'));
});

test('Requirement and proposal lifecycle semantics remain present', () => {
  assert.ok(detailSource.includes("decision: 'accept' | 'decline'"));
  assert.ok(detailSource.includes('Choose & schedule'));
  assert.ok(detailSource.includes('One confirmation chooses the provider and creates the first service booking'));
  assert.ok(detailSource.includes('No payment starts now'));
  assert.ok(detailSource.includes('conversationId ? `/messages?conversation='));
  assert.ok(managerSource.includes("RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled'"));
  assert.ok(managerSource.includes('href={`/requirements/${encodeURIComponent(row.id)}`}'));
});


test('Requirements list revalidates after browser restore and ignores stale overlapping loads', () => {
  assert.ok(managerSource.includes('const loadSequence = useRef(0)'));
  assert.ok(managerSource.includes("window.addEventListener('pageshow'"));
  assert.ok(managerSource.includes("window.addEventListener('popstate'"));
  assert.ok(managerSource.includes("document.addEventListener('visibilitychange'"));
  assert.ok(managerSource.includes("takeitesee:requirements-changed"));
  assert.ok(proposalAttentionSource.includes('const loadSequence = useRef(0)'));
  assert.ok(proposalAttentionSource.includes("takeitesee:requirements-changed"));
  assert.ok(lifecycleSource.includes('const loadSequence = useRef(0)'));
  assert.ok(lifecycleSource.includes("takeitesee:requirements-changed"));
});

test('Requirements list uses base owner rows and authenticated catalog hydration without governance embeds', () => {
  assert.ok(requirementsRouteSource.includes("supabase.rpc('get_customer_requirement_catalog')"));
  assert.ok(requirementsRouteSource.includes("catalog?.categories?.find((item) => item.id === row.category_id)"));
  assert.ok(requirementsRouteSource.includes("catalog?.locations?.find((item) => item.id === row.location_id)"));
  assert.ok(!requirementsRouteSource.includes('platform_categories(name,code)'));
  assert.ok(!requirementsRouteSource.includes('platform_locations(name,code,timezone)'));
});


test('Customer Requirement API paths keep auth and RLS reads on one Supabase client', () => {
  assert.ok(customerSupabaseSource.includes("import { headers } from 'next/headers'"));
  assert.ok(customerSupabaseSource.includes('requireCustomerSupabase(request?: Request)'));
  assert.ok(customerSupabaseSource.includes("(await headers()).get('authorization')"));
  assert.ok(customerSupabaseSource.includes('const effectiveRequest = await resolveCustomerRequest(request)'));
  assert.ok(customerSupabaseSource.includes('const supabase = await createSupabaseServerClient(effectiveRequest)'));
  assert.ok(customerSupabaseSource.includes('getSupabaseAuthenticatedUser(supabase, effectiveRequest)'));
  assert.ok(requirementsRouteSource.includes("requireCustomerSupabase"));
  assert.ok(requirementsRouteSource.includes("const { supabase, user } = await requireCustomerSupabase()"));
  assert.ok(requirementsRouteSource.includes(".eq('customer_id', user.id)"));
  assert.ok(!requirementsRouteSource.includes('productionAuthProvider.requireCustomer'));
  assert.ok(requirementDetailRouteSource.includes("const { supabase, user } = await requireCustomerSupabase()"));
  assert.ok(!requirementDetailRouteSource.includes('productionAuthProvider.requireCustomer'));
  assert.ok(requirementCatalogRouteSource.includes("const { supabase } = await requireCustomerSupabase()"));
  assert.ok(!requirementCatalogRouteSource.includes('productionAuthProvider.requireCustomer'));
});
