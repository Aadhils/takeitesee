import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [customerAttention, customerDashboard, providerDashboard] = await Promise.all([
  readFile(new URL('components/account/CustomerSmartAttention.tsx', root), 'utf8'),
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardManager.tsx', root), 'utf8'),
]);

test('Customer dashboard surfaces one Smart Attention card ahead of detailed inboxes', () => {
  assert.ok(customerDashboard.includes("import CustomerSmartAttention from './CustomerSmartAttention'"));
  assert.ok(customerDashboard.includes('<CustomerSmartAttention bookings={bookings} />'));
  assert.ok(customerDashboard.indexOf('<CustomerSmartAttention bookings={bookings} />') < customerDashboard.indexOf('<CustomerProductOrderAttention'));
  assert.ok(customerDashboard.indexOf('<CustomerSmartAttention bookings={bookings} />') < customerDashboard.indexOf('<CustomerAccountProposalSummary'));
});

test('Customer Smart Attention prioritizes explicit service and marketplace actions', () => {
  const completion = customerAttention.indexOf("kind: 'completion'");
  const proposal = customerAttention.indexOf("kind: 'proposal'");
  const schedule = customerAttention.indexOf("kind: 'schedule'");
  const message = customerAttention.indexOf("kind: 'message'");
  const order = customerAttention.indexOf("kind: 'order'");
  const service = customerAttention.indexOf("kind: 'service'");
  const clear = customerAttention.indexOf("kind: 'clear'");
  assert.ok(completion >= 0 && proposal > completion && schedule > proposal && message > schedule && order > message && service > order && clear > service);
  assert.ok(customerAttention.includes("booking.closeoutState === 'awaiting_customer'"));
  assert.ok(customerAttention.includes("fetch('/api/requirements'"));
  assert.ok(customerAttention.includes("fetch('/api/messages?workspace=customer'"));
  assert.ok(customerAttention.includes("fetch('/api/notifications?mode=product-order-unread-updates'"));
});

test('Customer Smart Attention deep-links to exact actionable objects and acknowledges scoped updates', () => {
  assert.ok(customerAttention.includes('/bookings/${encodeURIComponent(completion.bookingId)}#requirement-completion'));
  assert.ok(customerAttention.includes('/requirements/${encodeURIComponent(proposal.id)}?proposal='));
  assert.ok(customerAttention.includes('/messages?conversation=${encodeURIComponent(message.id)}'));
  assert.ok(customerAttention.includes('mark_requirement_proposals_read: true'));
  assert.ok(customerAttention.includes('mark_product_order_updates_read: true'));
});

test('Customer Smart Attention remains mobile-safe and progressive enhancement only', () => {
  assert.ok(customerAttention.includes('@media (max-width: 720px)'));
  assert.ok(customerAttention.includes('grid-template-columns: 1fr'));
  assert.ok(customerAttention.includes('min-height: 44px'));
  assert.ok(customerAttention.includes('Promise.allSettled'));
  assert.ok(!customerAttention.includes('Cashfree'));
  assert.ok(!customerAttention.includes('/api/pay'));
});

test('Provider Priority now opens the exact booking needing action', () => {
  assert.ok(providerDashboard.includes("booking.status === 'pending' ? 0 : booking.status === 'rescheduled' ? 1 : 2"));
  assert.ok(providerDashboard.includes('href: `/provider/bookings/${encodeURIComponent(booking.id)}`'));
  assert.ok(providerDashboard.includes("t('provider.dashboard.confirmPrefix')"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.reviewNewTimePrefix')"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.finishServicePrefix')"));
  assert.ok(providerDashboard.includes('[operations.needsAction, operations.upcoming, profile, t]'));
});

test('Provider no-action state deep-links to the exact next confirmed service', () => {
  assert.ok(providerDashboard.includes('href: `/provider/bookings/${encodeURIComponent(operations.upcoming[0].id)}`'));
  assert.ok(providerDashboard.includes("label: t('provider.dashboard.nextServiceReady')"));
});


test('Customer Smart Attention catches awarded services that still need a schedule', () => {
  assert.ok(customerAttention.includes("row.status === 'awarded'"));
  assert.ok(customerAttention.includes("/api/requirements/${encodeURIComponent(row.id)}/job"));
  assert.ok(customerAttention.includes('(payload.jobs ?? []).length > 0'));
  assert.ok(customerAttention.includes("kind: 'schedule'"));
  assert.ok(customerAttention.includes('Provider chosen — choose your service time'));
  assert.ok(customerAttention.includes('/requirements/${encodeURIComponent(unscheduledRequirement.id)}#requirement-service-job'));
  assert.ok(customerAttention.includes('Choose service time'));
});


test('Customer dashboard keeps detailed proposal and order activity collapsed behind one secondary control', () => {
  assert.ok(customerDashboard.includes('<details className="customer-secondary-activity">'));
  assert.ok(customerDashboard.includes("t('account.dashboard.moreActivity')"));
  assert.ok(customerDashboard.includes("t('account.dashboard.activitySummary')"));
  assert.ok(customerDashboard.includes('<CustomerProductOrderAttention onUnreadChange={setProductOrderUnreadCount} />'));
  assert.ok(customerDashboard.includes('<CustomerAccountProposalSummary onUnreadChange={setProposalUnreadCount} />'));
  assert.ok(
    customerDashboard.indexOf('<CustomerSmartAttention bookings={bookings} />')
      < customerDashboard.indexOf('<details className="customer-secondary-activity">'),
  );
});

test('Customer secondary activity stays compact and touch-safe on mobile', () => {
  assert.ok(customerDashboard.includes('.customer-secondary-activity > summary {'));
  assert.ok(customerDashboard.includes('min-height: 58px'));
  assert.ok(customerDashboard.includes('.customer-secondary-activity-count'));
  assert.ok(customerDashboard.includes('.customer-secondary-activity[open] .customer-secondary-activity-caret'));
  assert.ok(customerDashboard.includes('@media (max-width: 900px)'));
  assert.ok(customerDashboard.includes('min-height: 54px'));
  assert.ok(customerDashboard.includes('text-overflow: ellipsis'));
});


test('Customer dashboard replaces large navigation cards with compact quick actions', () => {
  assert.ok(customerDashboard.includes('className="customer-dashboard-quick-actions"'));
  assert.ok(customerDashboard.includes('className="customer-dashboard-quick-grid"'));
  assert.ok(customerDashboard.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'));
  assert.ok(customerDashboard.includes("href: '/bookings'"));
  assert.ok(customerDashboard.includes("href: '/orders'"));
  assert.ok(customerDashboard.includes("href: '/requirements'"));
  assert.ok(customerDashboard.includes("href: '/messages'"));
  assert.ok(customerDashboard.includes("href: '/explore'"));
  assert.ok(customerDashboard.includes("href: '/account/profile'"));
  assert.ok(!customerDashboard.includes('customer-overview-action-grid'));
  assert.ok(!customerDashboard.includes('customer-overview-action-card'));
});

test('Customer dashboard folds low-frequency destinations into More shortcuts', () => {
  assert.ok(customerDashboard.includes('className="customer-dashboard-more-links"'));
  assert.ok(customerDashboard.includes("t('account.dashboard.moreShortcuts')"));
  assert.ok(customerDashboard.includes("href: '/notifications'"));
  assert.ok(customerDashboard.includes("href: '/saved-services'"));
  assert.ok(customerDashboard.includes("href: '/saved-products'"));
  assert.ok(customerDashboard.includes("href: '/account/settings'"));
  assert.ok(customerDashboard.includes("href: '/account/support'"));
  assert.ok(customerDashboard.includes("href: '/account/reports'"));
});

test('Customer booking statistics are one compact activity strip instead of four cards', () => {
  assert.ok(customerDashboard.includes('className="customer-activity-strip"'));
  assert.ok(customerDashboard.includes('className="customer-activity-strip-item"'));
  assert.ok(customerDashboard.includes('{summary.upcoming}'));
  assert.ok(customerDashboard.includes('{summary.completed}'));
  assert.ok(customerDashboard.includes('{summary.cancelled}'));
  assert.ok(customerDashboard.includes('{summary.total}'));
  assert.ok(!customerDashboard.includes('customer-overview-stat-grid'));
  assert.ok(!customerDashboard.includes('customer-overview-stat-card'));
});

test('Customer compact navigation avoids duplicate mobile navigation and stays horizontally safe', () => {
  assert.ok(customerDashboard.includes('.customer-dashboard-quick-actions { display: none; }'));
  assert.ok(customerDashboard.includes('.customer-activity-strip { grid-template-columns: repeat(4, minmax(92px, 1fr)); overflow-x: auto;'));
  assert.ok(customerDashboard.includes('.customer-dashboard-more-links > summary { min-height: 44px; }'));
  assert.ok(customerDashboard.includes('.customer-dashboard-more-link-row a { min-height: 38px; }'));
  assert.ok(customerDashboard.includes('className="customer-mobile-quick-shell"'));
});


test('Customer dashboard relies on the identity hero for workspace switching without a duplicate switcher section', () => {
  assert.ok(customerDashboard.includes('<RoleIdentityMediaHeader context="customer"'));
  assert.ok(!customerDashboard.includes("import { WorkspaceSwitcher } from './WorkspaceSwitcher'"));
  assert.ok(!customerDashboard.includes('<WorkspaceSwitcher currentWorkspace="customer" />'));
});

test('Provider dashboard keeps Priority now ahead of profile editing and uses a compact activity strip', () => {
  const priorityIndex = providerDashboard.indexOf('className={`${styles.priorityPanel}');
  const profileIndex = providerDashboard.indexOf('<ProviderDashboardIdentityCenter onProfileUpdated={load} />');
  assert.ok(priorityIndex >= 0);
  assert.ok(profileIndex > priorityIndex);
  assert.ok(providerDashboard.includes('className={styles.providerActivityStrip}'));
  assert.ok(providerDashboard.includes('className={styles.providerActivityItem}'));
  assert.ok(!providerDashboard.includes('<MetricCard '));
});


test('Provider dashboard uses role-aware compact quick actions without mobile duplication', () => {
  assert.ok(providerDashboard.includes('const providerQuickActions: DashboardLink[]'));
  assert.ok(providerDashboard.includes('const providerPrimaryQuickActions = providerQuickActions.slice(0, 4)'));
  assert.ok(providerDashboard.includes('const providerRoleQuickActions = providerQuickActions.slice(4)'));
  assert.ok(providerDashboard.includes('className={styles.providerQuickPrimaryGrid}'));
  assert.ok(providerDashboard.includes('className={styles.providerQuickMore}'));
  assert.ok(providerDashboard.includes('className={styles.providerQuickMoreGrid}'));
  assert.ok(providerDashboard.includes('className={styles.providerQuickMobileRoleGrid}'));
  assert.ok(providerDashboard.includes("t('provider.dashboard.moreBusinessTools')"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.moreCareerTools')"));
  assert.ok(providerDashboard.includes("href: '/provider/leads'"));
  assert.ok(providerDashboard.includes("href: '/provider/messages'"));
  assert.ok(providerDashboard.includes("href: '/provider/bookings'"));
  assert.ok(providerDashboard.includes("href: '/provider/schedule'"));
  assert.ok(providerDashboard.includes("href: '/provider/services'"));
  assert.ok(providerDashboard.includes("href: '/provider/products'"));
  assert.ok(providerDashboard.includes("href: '/jobs'"));
  assert.ok(providerDashboard.includes("href: '/provider/jobs/applications'"));
  assert.ok(!providerDashboard.includes('className={styles.providerQuickGrid}'));
  assert.ok(!providerDashboard.includes('Run your day'));
  assert.ok(!providerDashboard.includes('Grow your opportunities'));
  assert.ok(!providerDashboard.includes('Grow your team'));
  assert.ok(!providerDashboard.includes('<ActionGrid '));
});


test('Provider dashboard avoids repeating the next confirmed service', () => {
  assert.ok(providerDashboard.includes('const nextUpcoming = operations.upcoming[0] ?? null'));
  assert.ok(providerDashboard.includes('const priorityShowsNextService = Boolean(nextUpcomingHref && priorityAction?.href === nextUpcomingHref)'));
  assert.ok(providerDashboard.includes('nextUpcoming && !priorityShowsNextService'));
  assert.ok(providerDashboard.includes('className={styles.nextServiceCompact}'));
  assert.ok(providerDashboard.includes('className={styles.nextServiceAction}'));
  assert.ok(providerDashboard.includes("aria-label={t('provider.dashboard.nextService')}"));
  assert.ok(!providerDashboard.includes('No upcoming bookings yet.'));
  assert.ok(!providerDashboard.includes('<h2>Next bookings</h2>'));
});

test('Provider upcoming activity count is not capped to four bookings', () => {
  const upcomingStart = providerDashboard.indexOf('const upcoming = bookings');
  const upcomingEnd = providerDashboard.indexOf('const completed = bookings', upcomingStart);
  assert.ok(upcomingStart >= 0 && upcomingEnd > upcomingStart);
  const upcomingBlock = providerDashboard.slice(upcomingStart, upcomingEnd);
  assert.ok(!upcomingBlock.includes('.slice(0, 4)'));
  assert.ok(providerDashboard.includes("value: String(operations.upcoming.length)"));
  assert.ok(providerDashboard.includes("operations.upcoming.length > 1 ?"));
});

test('Provider booking load failure stays compact instead of restoring a large bookings card', () => {
  assert.ok(providerDashboard.includes("aria-label={t('provider.dashboard.bookingStatus')}"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.bookingRefresh')"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.openBookings')"));
  assert.ok(!providerDashboard.includes('className={styles.supportGrid}'));
  assert.ok(!providerDashboard.includes('className={styles.bookingList}'));
});


test('Provider Priority keeps secondary work as compact follow-up chips', () => {
  assert.ok(providerDashboard.includes('className={styles.followUpQueue}'));
  assert.ok(providerDashboard.includes('className={styles.followUpRail}'));
  assert.ok(providerDashboard.includes('className={styles.followUpChip}'));
  assert.ok(providerDashboard.includes('className={styles.followUpChipIcon}'));
  assert.ok(providerDashboard.includes("{t('provider.dashboard.also')}</span>"));
  assert.ok(providerDashboard.includes('aria-label={`${item.label}. ${item.detail}`}'));
  assert.ok(providerDashboard.includes('title={item.detail}'));
  assert.ok(providerDashboard.includes('href={item.href}'));
  assert.ok(!providerDashboard.includes('className={styles.followUps}'));
  assert.ok(!providerDashboard.includes('className={styles.followUpLink}'));
  assert.ok(!providerDashboard.includes('className={styles.followUpArrow}'));
});

test('Provider Priority preserves one dominant primary CTA ahead of compact follow-ups', () => {
  const primaryCta = providerDashboard.indexOf("className=\"button button-primary\">{t('provider.dashboard.continueNow')}</Link>");
  const followUps = providerDashboard.indexOf('className={styles.followUpQueue}');
  assert.ok(primaryCta >= 0);
  assert.ok(followUps > primaryCta);
});


test('Provider Activity strip only surfaces meaningful signals', () => {
  assert.ok(providerDashboard.includes('const providerActivitySignals = profile'));
  assert.ok(providerDashboard.includes("operations.needsAction.length > 0"));
  assert.ok(providerDashboard.includes("operations.upcoming.length > 0"));
  assert.ok(providerDashboard.includes("profile.services_active > 0"));
  assert.ok(providerDashboard.includes("providerActivitySignals.map((item)"));
  assert.ok(providerDashboard.includes('className={styles.providerActivityEmpty}'));
  assert.ok(providerDashboard.includes("t('provider.dashboard.activityStarts')"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.noLiveActivity')"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.needsAction')"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.upcoming')"));
});

test('Provider booking load errors do not create fake activity counts', () => {
  assert.ok(providerDashboard.includes("...(!bookingsError && operations.needsAction.length > 0"));
  assert.ok(providerDashboard.includes("...(!bookingsError && operations.upcoming.length > 0"));
  assert.ok(providerDashboard.includes("t('provider.dashboard.bookingRefresh')"));
});


test('Provider mobile quick actions only render role-specific tools in the dashboard body', () => {
  assert.ok(providerDashboard.includes('providerPrimaryQuickActions.map((link)'));
  assert.ok(providerDashboard.includes('providerRoleQuickActions.map((link)'));
  const roleMapCount = providerDashboard.split('providerRoleQuickActions.map((link)').length - 1;
  assert.equal(roleMapCount, 2);
});
