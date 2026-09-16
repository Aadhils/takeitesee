import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [appShellSource, globalSwitcherSource, globalSwitcherCss, identityHeaderSource, accountSwitcherSource, routeSource, globalsCss] = await Promise.all([
  readFile(new URL('components/layout/AppShell.tsx', root), 'utf8'),
  readFile(new URL('components/layout/GlobalWorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('components/layout/GlobalWorkspaceSwitcher.module.css', root), 'utf8'),
  readFile(new URL('components/identity/RoleIdentityMediaHeader.tsx', root), 'utf8'),
  readFile(new URL('components/account/WorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('app/api/account/workspaces/route.ts', root), 'utf8'),
  readFile(new URL('app/globals.css', root), 'utf8'),
]);

test('primary workspace switching lives beside the identity hero with a deep-page header fallback', () => {
  assert.ok(appShellSource.includes("import GlobalWorkspaceSwitcher from './GlobalWorkspaceSwitcher';"));
  assert.ok(appShellSource.includes('<GlobalWorkspaceSwitcher fallbackName={currentUser.name}'));
  assert.ok(identityHeaderSource.includes("import GlobalWorkspaceSwitcher from '../layout/GlobalWorkspaceSwitcher';"));
  assert.ok(identityHeaderSource.includes('triggerVariant="identity"'));
  assert.ok(globalSwitcherSource.includes("triggerVariant === 'full' && (pathname === '/account' || pathname === '/provider')"));
  assert.ok(globalSwitcherSource.includes("tamil ? 'Profile மாற்று' : 'Switch profile'"));
  assert.ok(globalSwitcherSource.includes("fetch('/api/account/workspaces'"));
  assert.ok(globalSwitcherSource.includes("method: 'POST'"));
  assert.ok(accountSwitcherSource.includes('if (compact) return null;'));
  assert.ok(!accountSwitcherSource.includes("tamil ? 'விரைவு மாற்றம்' : 'Quick switch'"));
});

test('identity switch trigger is circular and the overlay escapes the sticky filtered header', () => {
  assert.ok(globalsCss.includes('.site-header { position: sticky'));
  assert.ok(globalsCss.includes('backdrop-filter: blur(8px)'));
  assert.ok(globalSwitcherSource.includes("import { createPortal } from 'react-dom';"));
  assert.ok(globalSwitcherSource.includes('createPortal(<>'));
  assert.ok(globalSwitcherSource.includes('document.body'));
  assert.ok(globalSwitcherSource.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(globalSwitcherCss.includes('.triggerIdentity{display:grid'));
  assert.ok(globalSwitcherCss.includes('border-radius:50%'));
  assert.ok(globalSwitcherCss.includes('.backdrop{position:fixed'));
  assert.ok(globalSwitcherCss.includes('.panel{position:fixed'));
  assert.ok(globalSwitcherCss.includes('z-index:1001'));
  assert.ok(!globalSwitcherCss.includes('.panel{position:absolute'));
});

test('workspace switcher stays responsive as desktop popover and mobile bottom sheet', () => {
  assert.ok(globalSwitcherCss.includes('top:var(--switcher-top,80px)'));
  assert.ok(globalSwitcherCss.includes('right:var(--switcher-right,16px)'));
  assert.ok(globalSwitcherCss.includes('@media(max-width:900px)'));
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
