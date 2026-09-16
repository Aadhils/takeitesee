import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = await readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8');

test('Provider mobile primary navigation uses accessible inline SVG icons instead of text symbols', () => {
  assert.ok(source.includes("type MobileNavIcon = 'home' | 'leads' | 'bookings' | 'messages' | 'profile'"));
  assert.ok(source.includes('function ProviderMobileNavIcon'));
  assert.ok(source.includes('className="provider-mobile-nav-icon"'));
  assert.ok(source.includes('<ProviderMobileNavIcon icon={link.icon} />'));
  for (const legacy of ["icon: '⌂'", "icon: '◇'", "icon: '▣'", "icon: '✉'", "icon: '◯'"]) assert.ok(!source.includes(legacy));
});

test('Provider mobile settings remains directly accessible with a touch-sized SVG control', () => {
  assert.ok(source.includes('function ProviderSettingsIcon'));
  assert.ok(source.includes('href="/account/settings" className="provider-mobile-settings-link"'));
  assert.ok(source.includes('<ProviderSettingsIcon />'));
  assert.ok(source.includes('.provider-mobile-settings-link { flex: 0 0 auto; display: grid; width: 40px; height: 40px;'));
});

test('Provider mobile navigation preserves attention badges and five primary destinations', () => {
  for (const href of ['/provider', '/provider/leads', '/provider/bookings', '/provider/messages', '/provider/profile']) assert.ok(source.includes(`href: '${href}'`));
  assert.ok(source.includes("link.href === '/provider/leads' && unreadLeads > 0"));
  assert.ok(source.includes("link.href === '/provider/bookings' && pending > 0"));
  assert.ok(source.includes("link.href === '/provider/messages' && messageUnreadCount > 0"));
});
