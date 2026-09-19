import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = await readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8');

test('Provider mobile More tools keeps role-aware navigation groups', () => {
  assert.ok(source.includes("id: 'customer-work'"));
  assert.ok(source.includes("id: 'services-trust'"));
  assert.ok(source.includes("id: 'professional-career'"));
  assert.ok(source.includes("id: 'business-hiring'"));
  assert.ok(source.includes("id: 'earnings'"));
  assert.ok(source.includes('const mobileMoreGroups = providerNavGroups'));
  assert.ok(source.includes("group.links.filter((link) => !mobilePrimaryHrefs.has(link.href))"));
});

test('Provider mobile More tools renders grouped sections plus workspace utilities', () => {
  assert.ok(source.includes('className="provider-mobile-more-panel"'));
  assert.ok(source.includes('className="provider-mobile-more-section"'));
  assert.ok(source.includes('className="provider-mobile-more-section-title"'));
  assert.ok(source.includes("t('provider.shell.workspaceAccount')"));
  assert.ok(source.includes('href="/account#workspaces"'));
  assert.ok(source.includes('href="/account/settings"'));
});

test('Provider mobile More tools preserves active and attention states', () => {
  assert.ok(source.includes("className={active === link.href ? 'provider-mobile-more-active' : ''}"));
  assert.ok(source.includes("link.href === '/provider/orders' && requestedProductOrders > 0"));
  assert.ok(source.includes("link.href === '/notifications' && notificationUnreadCount > 0"));
  assert.ok(source.includes("aria-current={active === link.href ? 'page' : undefined}"));
});

test('Provider mobile More tools is compact, touch-friendly and responsive', () => {
  assert.ok(source.includes('.provider-mobile-more-tools > summary { display: flex; min-height: 44px;'));
  assert.ok(source.includes('.provider-mobile-more-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));'));
  assert.ok(source.includes('.provider-mobile-more-grid a { min-width: 0; min-height: 44px;'));
  assert.ok(source.includes('@media (max-width: 390px)'));
  assert.ok(source.includes('.provider-mobile-more-grid { grid-template-columns: 1fr; }'));
});
