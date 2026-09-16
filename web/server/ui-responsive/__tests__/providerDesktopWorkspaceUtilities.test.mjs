import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = await readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8');

test('Provider desktop sidebar groups workspace and account utilities', () => {
  assert.ok(source.includes('className="provider-sidebar-utilities"'));
  assert.ok(source.includes("'Workspace & account'"));
  assert.ok(source.includes('className="provider-sidebar-utility-links"'));
});

test('Provider desktop utilities keep profile, public presence, settings and marketplace access', () => {
  assert.ok(source.includes('href="/account#workspaces" className="provider-exit-link"'));
  assert.ok(source.includes('publicProfileHref ? <Link href={publicProfileHref}'));
  assert.ok(source.includes('showPublicReadinessLink ? <Link href="/provider/public-readiness"'));
  assert.ok(source.includes('href="/account/settings" className="provider-exit-link"'));
  assert.ok(source.includes('href="/" className="provider-exit-link"'));
});

test('Provider desktop utility links have compact accessible hit areas and focus treatment', () => {
  assert.ok(source.includes('.provider-sidebar-utilities { display: grid; gap: 6px;'));
  assert.ok(source.includes('.provider-sidebar-utility-links .provider-exit-link { display: flex; min-height: 40px;'));
  assert.ok(source.includes('.provider-sidebar-utility-links .provider-exit-link:focus-visible'));
});

test('Provider mobile settings and grouped More tools remain intact', () => {
  assert.ok(source.includes('className="provider-mobile-settings-link"'));
  assert.ok(source.includes('className="provider-mobile-more-panel"'));
  assert.ok(source.includes('const mobileMoreGroups = providerNavGroups'));
});
