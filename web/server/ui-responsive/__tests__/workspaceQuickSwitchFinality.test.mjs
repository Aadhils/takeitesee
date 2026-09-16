import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [switcherSource, switcherCss, routeSource] = await Promise.all([
  readFile(new URL('components/account/WorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('components/account/WorkspaceSwitcher.module.css', root), 'utf8'),
  readFile(new URL('app/api/account/workspaces/route.ts', root), 'utf8'),
]);

test('mobile workspace switching is direct and one tap', () => {
  assert.ok(switcherSource.includes("tamil ? 'விரைவு மாற்றம்' : 'Quick switch'"));
  assert.ok(switcherSource.includes('onClick={() => void switchWorkspace(workspace.id)}'));
  assert.ok(switcherSource.includes('if (compact) return quickSwitch;'));
  assert.ok(switcherCss.includes('.quickSwitch'));
  assert.ok(switcherCss.includes('@media(max-width:640px)'));
  assert.ok(switcherCss.includes('.quickSwitch{display:grid'));
});

test('confirmed provider ownership never advertises another provider identity', () => {
  assert.ok(routeSource.includes('const providerOwned = Boolean(professional || business);'));
  assert.ok(routeSource.includes('if (!providerOwned && pendingType)'));
  assert.ok(routeSource.includes('else if (!providerOwned && !pendingType)'));
  assert.ok(routeSource.includes("provider_identity_policy: 'single_provider'"));
  assert.ok(switcherSource.includes("This account's Provider identity is final as"));
  assert.ok(!switcherSource.includes('To operate a ${opposite} provider identity'));
  assert.ok(!switcherSource.includes("const opposite = providerWorkspace?.id"));
});

test('workspace POST remains role gated', () => {
  assert.ok(routeSource.includes("workspace === 'professional' && session.roles.includes('professional')"));
  assert.ok(routeSource.includes("workspace === 'business' && session.roles.includes('business_owner')"));
  assert.ok(routeSource.includes("return NextResponse.json({ error: 'This workspace is not available for your account.' }, { status: 403 })"));
});
