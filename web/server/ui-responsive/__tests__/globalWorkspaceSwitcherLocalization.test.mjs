import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [switcher, translations, css, appShell, identityHeader] = await Promise.all([
  readFile(new URL('components/layout/GlobalWorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
  readFile(new URL('components/layout/GlobalWorkspaceSwitcher.module.css', root), 'utf8'),
  readFile(new URL('components/layout/AppShell.tsx', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'workspace.global.unableLoadProfiles',
  'workspace.global.unableSwitchProfile',
  'workspace.global.switchProfile',
  'workspace.global.closeSwitcher',
  'workspace.global.close',
  'workspace.global.manageAccountProfiles',
  'workspace.global.openAccount',
];

test('Global Workspace Switcher uses shared Identity Workspace localization with exact EN/TA parity', () => {
  assert.ok(switcher.includes("useIdentityWorkspaceTranslations"));
  assert.ok(switcher.includes("const { t } = useIdentityWorkspaceTranslations()"));
  assert.ok(!switcher.includes('tamil: boolean'));
  assert.ok(!switcher.includes('tamil ?'));
  assert.ok(!/[஀-௿]/u.test(switcher));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(switcher.includes("t('" + key + "')"));
  }
  assert.ok(switcher.includes("t('account.customer')"));
  assert.ok(switcher.includes("t('workspace.switcher.verified')"));
  assert.ok(switcher.includes("t('account.dashboard.accountFallback')"));
});

test('Global Workspace Switcher preserves workspace discovery, route ownership and switching semantics', () => {
  assert.ok(switcher.includes("fetch('/api/account/workspaces', { cache: 'no-store' })"));
  assert.ok(switcher.includes("if (pathname.startsWith('/provider'))"));
  assert.ok(switcher.includes("workspace.id === 'professional' || workspace.id === 'business'"));
  assert.ok(switcher.includes("if (workspace === active || switching) return;"));
  assert.ok(switcher.includes("method: 'POST'"));
  assert.ok(switcher.includes("body: JSON.stringify({ workspace })"));
  assert.ok(switcher.includes("window.location.assign(payload.redirect)"));
});

test('Global Workspace Switcher preserves overlay accessibility and responsive presentation', () => {
  assert.ok(switcher.includes("createPortal(<>"));
  assert.ok(switcher.includes('document.body'));
  assert.ok(switcher.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(switcher.includes("event.key === 'Escape'"));
  assert.ok(switcher.includes('aria-haspopup="dialog"'));
  assert.ok(switcher.includes('aria-modal="true"'));
  assert.ok(css.includes('@media(max-width:900px)'));
  assert.ok(css.includes('bottom:calc(78px + env(safe-area-inset-bottom))'));
});

test('Global Workspace Switcher callers no longer pass a parallel Tamil locale flag', () => {
  assert.ok(appShell.includes('<GlobalWorkspaceSwitcher fallbackName={currentUser.name} attentionCount={proposalUnreadCount}'));
  assert.ok(identityHeader.includes('<GlobalWorkspaceSwitcher fallbackName={displayName} triggerVariant="identity" />'));
  assert.ok(!appShell.includes('GlobalWorkspaceSwitcher fallbackName={currentUser.name} tamil='));
  assert.ok(!identityHeader.includes('GlobalWorkspaceSwitcher fallbackName={displayName} tamil='));
});

test('Global Workspace Switcher localization does not activate finance or payment behavior', () => {
  for (const term of ['Cashfree', '/api/pay', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!switcher.includes(term));
  }
});
