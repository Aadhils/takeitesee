import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [shell, translations] = await Promise.all([
  readFile(new URL('components/layout/AppShell.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/LanguageProvider.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'nav.products',
  'nav.proposalBadgeOne',
  'nav.proposalBadgeMany',
  'footer.browseProducts',
  'footer.support',
  'footer.helpCenter',
];

test('App Shell uses shared LanguageProvider localization with exact EN/TA parity', () => {
  assert.ok(shell.includes("const { locale, setLocale, t } = useLanguage()"));
  assert.ok(!shell.includes('const isTamil ='));
  assert.ok(!shell.includes('isTamil ?'));
  assert.ok(!/[஀-௿]/u.test(shell));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(shell.includes("t('" + key + "')") || shell.includes("'" + key + "'"));
  }
});

test('App Shell preserves proposal attention discovery, pluralization and deep-link behavior', () => {
  assert.ok(shell.includes("fetch('/api/notifications?mode=proposal-unread-count', { cache: 'no-store' })"));
  assert.ok(shell.includes('setProposalUnreadCount(Math.max(0, Number(payload.unread_count ?? 0)))'));
  assert.ok(shell.includes("t(proposalUnreadCount === 1 ? 'nav.proposalBadgeOne' : 'nav.proposalBadgeMany')"));
  assert.ok(shell.includes(".replace('{count}', String(proposalUnreadCount))"));
  assert.ok(shell.includes("proposalUnreadCount > 0 ? '/account#proposal-attention' : '/account'"));
  assert.ok(shell.includes("proposalUnreadCount > 99 ? '99+' : String(proposalUnreadCount)"));
  assert.ok(shell.includes('attentionCount={proposalUnreadCount} attentionLabel={proposalBadgeLabel}'));
});

test('App Shell preserves desktop, mobile and footer Product navigation contracts', () => {
  assert.ok(shell.includes("const productsActive = pathname === '/products' || pathname.startsWith('/products/')"));
  assert.equal(occurrences(shell, 'href="/products"'), 3);
  assert.ok(shell.includes("{t('nav.products')}"));
  assert.ok(shell.includes('<ShellIcon name="products" />'));
  assert.ok(shell.includes("{t('footer.browseProducts')}"));
  assert.ok(shell.includes("{t('footer.support')}"));
  assert.ok(shell.includes("{t('footer.helpCenter')}"));
});

test('App Shell preserves locale switching, Provider chrome and responsive navigation behavior', () => {
  assert.ok(shell.includes("value={locale} onChange={(event) => setLocale(event.target.value as 'en-IN' | 'ta-IN')}"));
  assert.ok(shell.includes("const isProviderWorkspace = pathname === '/provider' || pathname.startsWith('/provider/')"));
  assert.ok(shell.includes("!isProviderWorkspace ? <Link href=\"/requirements\""));
  assert.ok(shell.includes('className="mobile-bottom-nav"'));
  assert.ok(shell.includes('@media (max-width: 640px)'));
  assert.ok(shell.includes('global-proposal-attention-badge-mobile'));
});

test('App Shell localization does not activate finance or payment behavior', () => {
  for (const term of ['Cashfree', '/api/pay', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!shell.includes(term));
  }
});
