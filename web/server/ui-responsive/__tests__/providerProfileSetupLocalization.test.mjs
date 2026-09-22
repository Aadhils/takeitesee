import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderProfileSetupCenter.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/ProviderProfileSetupTranslations.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: ProviderProfileSetupCopy = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1]).sort();
}

test('Provider Profile Setup uses focused EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.deepEqual(tamilKeys, englishKeys);
  assert.equal(englishKeys.length, 73);
  assert.ok(source.includes('useProviderProfileSetupTranslations'));
  assert.ok(source.includes('const copy = useProviderProfileSetupTranslations()'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Provider Profile Setup preserves profile and role read contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/profile', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/profile/roles', { cache: 'no-store' })"));
  assert.ok(source.includes("if (payload.profile.provider_type === 'professional') void loadRoles()"));
  assert.ok(source.includes('else setRoles([])'));
});

test('Provider Profile Setup preserves profile PATCH contract', () => {
  assert.ok(source.includes("fetch('/api/provider/profile', {"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("headers: { 'Content-Type': 'application/json' }"));
  assert.ok(source.includes('body: JSON.stringify(form)'));
  assert.ok(source.includes('await load()'));
});

test('Provider Profile Setup preserves Professional role create, update and delete contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/profile/roles', {"));
  assert.ok(source.includes("method: editingRoleId ? 'PATCH' : 'POST'"));
  assert.ok(source.includes('body: JSON.stringify({ id: editingRoleId ?? undefined, ...roleForm })'));
  assert.ok(source.includes("method: 'DELETE'"));
  assert.ok(source.includes('body: JSON.stringify({ id: role.id })'));
  assert.ok(source.includes('role.id !== editingRoleId'));
  assert.ok(source.includes('role.title.trim().toLocaleLowerCase() === normalizedTitle'));
  assert.ok(source.includes('await loadRoles()'));
});

test('Provider Profile Setup preserves identity finality and stays outside finance and recurrence', () => {
  assert.ok(source.includes("provider_type: 'professional' | 'business'"));
  assert.ok(source.includes("profile.provider_type === 'professional'"));
  assert.ok(source.includes("profile.provider_type === 'business'"));
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence', 'RequirementOccurrenceRecoveryPanel']) {
    assert.ok(!source.includes(term));
  }
});
