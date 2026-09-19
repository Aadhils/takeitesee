import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [shell, translations] = await Promise.all([
  readFile(new URL('components/account/LocalizedAccountShell.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

test('Customer account shell uses shared workspace localization for navigation copy', () => {
  assert.ok(shell.includes('useRemainingWorkspaceTranslations'));
  assert.ok(shell.includes('const { t } = useRemainingWorkspaceTranslations()'));
  assert.ok(!shell.includes("locale === 'ta-IN'"));
  assert.ok(!/[஀-௿]/u.test(shell));
  for (const key of [
    'account.unreadNotifications',
    'account.unreadMessages',
    'account.newProductOrderUpdates',
    'account.more',
    'account.savedServices',
    'account.savedServicesMobile',
    'account.savedProducts',
    'account.savedProductsMobile',
    'account.requirements',
    'account.requirementsMobile',
    'account.orders',
    'account.ordersMobile',
    'account.messages',
    'account.messagesMobile',
    'account.support',
    'account.supportMobile',
    'account.mobileNavSuffix',
  ]) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(shell.includes("t('" + key + "')"));
  }
});

test('Customer account shell preserves primary and More navigation structure', () => {
  for (const href of [
    '/account',
    '/account/profile',
    '/account/settings',
    '/saved-services',
    '/saved-products',
    '/requirements',
    '/orders',
    '/messages',
    '/notifications',
    '/reviews',
    '/account/support',
    '/help',
  ]) assert.ok(shell.includes(`'${href}'`));
  assert.ok(shell.includes("new Set(['/account', '/saved-services', '/saved-products', '/requirements'])"));
  assert.ok(shell.includes('mobilePrimaryLinks'));
  assert.ok(shell.includes('mobileSecondaryLinks'));
  assert.ok(shell.includes('activeSecondaryLink'));
  assert.ok(shell.includes('account-mobile-more'));
  assert.ok(shell.includes('<details'));
  assert.ok(shell.includes("aria-current={active === link.href ? 'page' : undefined}"));
});

test('Customer account shell preserves notification, message and Product Order attention polling', () => {
  assert.ok(shell.includes("fetch('/api/notifications?mode=unread-count'"));
  assert.ok(shell.includes("fetch('/api/messages?mode=unread-count&workspace=customer'"));
  assert.ok(shell.includes("fetch('/api/notifications?mode=product-order-unread-updates'"));
  assert.equal(occurrences(shell, 'window.setInterval(refresh, 60_000)'), 3);
  assert.ok(shell.includes("window.addEventListener('notifications-attention-refresh', refresh)"));
  assert.ok(shell.includes("window.addEventListener('marketplace-messages-attention-refresh', refresh)"));
  assert.ok(shell.includes("window.addEventListener('customer-product-order-attention-refresh', refresh)"));
  assert.ok(shell.includes("link.href === '/messages' ? messageBadge : null"));
  assert.ok(shell.includes("link.href === '/notifications' ? notificationBadge : null"));
  assert.ok(shell.includes("link.href === '/orders' ? productOrderBadge : null"));
});

test('Customer account shell preserves unread count display and ARIA contracts', () => {
  assert.ok(shell.includes('const resolvedUnreadCount = unreadCount ?? fetchedUnreadCount'));
  assert.ok(shell.includes("value > 99 ? '99+' : String(value)"));
  assert.ok(shell.includes('`${resolvedUnreadCount} ${unreadLabel}`'));
  assert.ok(shell.includes('`${messageUnreadCount} ${messageUnreadLabel}`'));
  assert.ok(shell.includes('`${productOrderUnreadCount} ${productOrderUnreadLabel}`'));
  assert.ok(shell.includes("`${t('account.nav')} ${t('account.mobileNavSuffix')}`"));
  assert.ok(shell.includes('activeSecondaryLink ? `${mobileMoreLabel} — ${moreLabel}` : moreLabel'));
});
