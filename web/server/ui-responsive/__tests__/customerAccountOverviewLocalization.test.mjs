import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [page, translations] = await Promise.all([
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const dashboardKeys = [
  'account.dashboard.accountFallback',
  'account.dashboard.bookings',
  'account.dashboard.orders',
  'account.dashboard.needs',
  'account.dashboard.messages',
  'account.dashboard.profile',
  'account.dashboard.explore',
  'account.dashboard.newOrderUpdates',
  'account.dashboard.newProposals',
  'account.dashboard.newUpdates',
  'account.dashboard.reviews',
  'account.dashboard.savedServices',
  'account.dashboard.savedProducts',
  'account.dashboard.products',
  'account.dashboard.support',
  'account.dashboard.safetyReports',
  'account.dashboard.quickNavigation',
  'account.dashboard.workspace',
  'account.dashboard.settingsAria',
  'account.dashboard.primaryNavigation',
  'account.dashboard.personalAccount',
  'account.dashboard.moreActivity',
  'account.dashboard.activitySummary',
  'account.dashboard.details',
  'account.dashboard.quickActions',
  'account.dashboard.quickActionsEyebrow',
  'account.dashboard.goWhereNeeded',
  'account.dashboard.moreShortcuts',
  'account.dashboard.moreCustomerShortcuts',
  'account.dashboard.bookingActivitySummary',
];

test('Customer Account Overview uses shared identity-workspace localization', () => {
  assert.ok(page.includes('useIdentityWorkspaceTranslations'));
  assert.ok(page.includes('const { t } = useIdentityWorkspaceTranslations()'));
  assert.ok(!page.includes('const tamil ='));
  assert.ok(!page.includes('tamil ?'));
  assert.ok(!page.includes("locale === 'ta-IN'"));
  assert.ok(!/[஀-௿]/u.test(page));
  for (const key of dashboardKeys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(page.includes("t('" + key + "')"));
  }
});

test('Customer Account Overview preserves authentication and booking repository behavior', () => {
  assert.ok(page.includes('isSupabaseConfigured()'));
  assert.ok(page.includes('getSupabaseBrowserUser()'));
  assert.ok(page.includes('localDevelopmentAuthAdapter.getCurrentUser()'));
  assert.ok(page.includes('getBookingsThroughConfiguredRepository(currentUser.id)'));
  assert.ok(page.includes('getBookingsForCustomer(currentUser.id)'));
  assert.ok(page.includes("error instanceof Error ? error.message : t('account.loadBookingFallback')"));
  assert.ok(page.includes('signOutWithSupabase()'));
  assert.ok(page.includes('localDevelopmentAuthAdapter.signOut()'));
});

test('Customer Account Overview preserves booking summary lifecycle semantics', () => {
  assert.ok(page.includes("['pending', 'confirmed', 'accepted', 'in_progress', 'rescheduled'].includes(booking.status)"));
  assert.ok(page.includes("booking.status === 'completed'"));
  assert.ok(page.includes("booking.status === 'cancelled'"));
  assert.ok(page.includes('total: bookings.length'));
  assert.ok(page.includes('{summary.upcoming}'));
  assert.ok(page.includes('{summary.completed}'));
  assert.ok(page.includes('{summary.cancelled}'));
  assert.ok(page.includes('{summary.total}'));
});

test('Customer Account Overview preserves quick destinations and attention badges', () => {
  for (const href of [
    '/bookings',
    '/orders',
    '/requirements',
    '/messages',
    '/explore',
    '/account/profile',
    '/notifications',
    '/reviews',
    '/saved-services',
    '/saved-products',
    '/products',
    '/account/settings',
    '/account/support',
    '/account/reports',
  ]) assert.ok(page.includes(`'${href}'`) || page.includes(`href="${href}"`));
  assert.ok(page.includes('badge: productOrderUnreadCount'));
  assert.ok(page.includes('badge: proposalUnreadCount'));
  assert.ok(page.includes('<CustomerProductOrderAttention onUnreadChange={setProductOrderUnreadCount} />'));
  assert.ok(page.includes('<CustomerAccountProposalSummary onUnreadChange={setProposalUnreadCount} />'));
  assert.ok(page.includes('<CustomerSmartAttention bookings={bookings} />'));
});

test('Customer Account Overview preserves responsive identity and compact dashboard contracts', () => {
  assert.ok(page.includes('<RoleIdentityMediaHeader context="customer"'));
  assert.ok(page.includes("subtitle={t('account.dashboard.personalAccount')}"));
  assert.ok(page.includes('className="customer-mobile-quick-shell"'));
  assert.ok(page.includes('className="customer-dashboard-quick-actions"'));
  assert.ok(page.includes('className="customer-dashboard-more-links"'));
  assert.ok(page.includes('className="customer-activity-strip"'));
  assert.ok(page.includes('.customer-dashboard-quick-actions { display: none; }'));
  assert.ok(page.includes('grid-template-columns: repeat(5, minmax(0, 1fr));'));
  assert.ok(page.includes("link.badge > 99 ? '99+' : link.badge"));
  assert.ok(!page.includes('Cashfree'));
  assert.ok(!page.includes('/api/pay'));
});
