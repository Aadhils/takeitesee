import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = await readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8');

test('Customer mobile quick navigation uses accessible inline SVG icons instead of text symbols', () => {
  assert.ok(source.includes("type CustomerMobileIcon = 'bookings' | 'orders' | 'needs' | 'messages' | 'explore' | 'profile'"));
  assert.ok(source.includes('function CustomerMobileNavIcon'));
  assert.ok(source.includes('className="customer-mobile-quick-svg"'));
  assert.ok(source.includes('<CustomerMobileNavIcon icon={link.icon} />'));
  for (const legacy of ["icon: '▣'", "icon: '□'", "icon: '◇'", "icon: '✉'", "icon: '◯'"]) assert.ok(!source.includes(legacy));
});

test('Customer settings stays directly accessible with a touch-sized SVG control', () => {
  assert.ok(source.includes('function CustomerSettingsIcon'));
  assert.ok(source.includes('href="/account/settings" className="customer-mobile-quick-settings"'));
  assert.ok(source.includes('<CustomerSettingsIcon />'));
  assert.ok(source.includes('width: 40px;'));
  assert.ok(source.includes('.customer-mobile-settings-svg { width: 19px; height: 19px; }'));
});

test('Customer quick navigation preserves destinations, badges and sticky identity shell', () => {
  for (const href of ['/bookings', '/orders', '/requirements', '/messages', '/account/profile']) assert.ok(source.includes(`href: '${href}'`));
  assert.ok(source.includes('badge: productOrderUnreadCount'));
  assert.ok(source.includes('badge: proposalUnreadCount'));
  assert.ok(source.includes('position: sticky;'));
  assert.ok(source.includes('<RoleIdentityMediaHeader context="customer"'));
});
