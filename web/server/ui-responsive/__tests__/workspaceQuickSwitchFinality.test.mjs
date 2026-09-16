import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [appShellSource, globalSwitcherSource, globalSwitcherCss, accountSwitcherSource, routeSource] = await Promise.all([
  readFile(new URL('components/layout/AppShell.tsx', root), 'utf8'),
  readFile(new URL('components/layout/GlobalWorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('components/layout/GlobalWorkspaceSwitcher.module.css', root), 'utf8'),
  readFile(new URL('components/account/WorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('app/api/account/workspaces/route.ts', root), 'utf8'),
]);

test('workspace switching lives in global app chrome instead of an extra dashboard card', () => {
  assert.ok(appShellSource.includes("import GlobalWorkspaceSwitcher from './GlobalWorkspaceSwitcher';"));
  assert.ok(appShellSource.includes('<GlobalWorkspaceSwitcher fallbackName={currentUser.name}'));
  assert.ok(globalSwitcherSource.includes("tamil ? 'Profile மாற்று' : 'Switch profile'"));
  assert.ok(globalSwitcherSource.includes("fetch('/api/account/workspaces'"));
  assert.ok(globalSwitcherSource.includes("method: 'POST'"));
  assert.ok(accountSwitcherSource.includes('if (compact) return null;'));
  assert.ok(!accountSwitcherSource.includes("tamil ? 'விரைவு மாற்றம்' : 'Quick switch'"));
});

test('global switcher is responsive as desktop popover and mobile bottom sheet', () => {
  assert.ok(globalSwitcherCss.includes('.panel{position:absolute'));
  assert.ok(globalSwitcherCss.includes('@media(max-width:900px)'));
  assert.ok(globalSwitcherCss.includes('.panel{position:fixed'));
  assert.ok(globalSwitcherCss.includes('bottom:calc(78px + env(safe-area-inset-bottom))'));
  assert.ok(globalSwitcherCss.includes('@media(max-width:390px)'));
});

test('direct provider routes resolve the owned provider as the current identity', () => {
  assert.ok(globalSwitcherSource.includes("if (pathname.startsWith('/provider'))"));
  assert.ok(globalSwitcherSource.includes("workspace.id === 'professional' || workspace.id === 'business'"));
  assert.ok(globalSwitcherSource.includes('activeFromRoute(pathname, options, fallbackActive)'));
});

test('confirmed provider ownership never exposes another provider identity', () => {
  assert.ok(routeSource.includes('const providerOwned = Boolean(professional || business);'));
  assert.ok(routeSource.includes('if (!providerOwned && pendingType)'));
  assert.ok(routeSource.includes('else if (!providerOwned && !pendingType)'));
  assert.ok(routeSource.includes("provider_identity_policy: 'single_provider'"));
  assert.ok(accountSwitcherSource.includes("This account's Provider identity is final as"));
  assert.ok(!accountSwitcherSource.includes('To operate a ${opposite} provider identity'));
});

test('workspace POST remains role gated', () => {
  assert.ok(routeSource.includes("workspace === 'professional' && session.roles.includes('professional')"));
  assert.ok(routeSource.includes("workspace === 'business' && session.roles.includes('business_owner')"));
  assert.ok(routeSource.includes("return NextResponse.json({ error: 'This workspace is not available for your account.' }, { status: 403 })"));
});
