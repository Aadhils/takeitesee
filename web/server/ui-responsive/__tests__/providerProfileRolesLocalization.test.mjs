import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderProfileManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider profile professional roles use shared identity localization without local bilingual branch', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!source.includes('return tamil ?'));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.profileRoles\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 45, 'expected broad Provider professional roles localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider profile preserves profile and professional-role API contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/profile', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/profile/roles', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/profile', { method: 'PATCH'"));
  assert.ok(source.includes("method: editingRoleId ? 'PATCH' : 'POST'"));
  assert.ok(source.includes("method: 'DELETE'"));
});

test('Provider professional roles preserve duplicate and destructive-action safeguards', () => {
  assert.ok(source.includes('const normalizedTitle = roleForm.title.trim().toLocaleLowerCase()'));
  assert.ok(source.includes('roles.find((role) => role.id !== editingRoleId'));
  assert.ok(source.includes('window.confirm(roleCopy.deleteConfirm)'));
  assert.ok(source.includes('profile.provider_type === \'professional\''));
});

test('Provider professional roles preserve opportunity-mode semantics', () => {
  assert.ok(source.includes('service_bookings_enabled'));
  assert.ok(source.includes('freelance_enabled'));
  assert.ok(source.includes('part_time_enabled'));
  assert.ok(source.includes('full_time_enabled'));
  assert.ok(source.includes('contract_enabled'));
  assert.ok(source.includes('active: role.active'));
});
