import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [identitySource, catalogSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardIdentityCenter.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

const identityKeys = [...new Set(
  [...identitySource.matchAll(/t\('(provider\.identity\.[^']+)'\)/g)].map((match) => match[1]),
)];

test('Provider identity center uses the shared translation hook without local bilingual copy', () => {
  assert.ok(identitySource.includes('const { t } = useIdentityWorkspaceTranslations()'));
  assert.ok(identityKeys.length >= 20);
  assert.ok(!identitySource.includes('const tamil'));
  assert.ok(!identitySource.includes('const copy ='));
  assert.ok(!identitySource.includes('useMemo('));
});

test('Every Provider identity center key exists in both English and Tamil catalogs', () => {
  for (const key of identityKeys) {
    const occurrences = catalogSource.split(`'${key}'`).length - 1;
    assert.equal(occurrences, 2, `${key} should exist once in English and once in Tamil`);
  }
});

test('Provider identity localization preserves profile, roles and setup routes', () => {
  assert.ok(identitySource.includes("fetch('/api/provider/profile'"));
  assert.ok(identitySource.includes("fetch('/api/provider/profile/roles'"));
  assert.ok(identitySource.includes('href="/provider/public-readiness"'));
  assert.ok(identitySource.includes('href="/provider/setup"'));
  assert.ok(identitySource.includes("t('provider.identity.deleteRoleConfirm')"));
  assert.ok(identitySource.includes("t('provider.identity.marketplaceSetup')"));
});

test('Provider identity center no longer hardcodes migrated visible bilingual states', () => {
  const forbidden = [
    'Delete this role?',
    'Loading provider identity…',
    'Provider profile unavailable.',
    'Loading roles…',
    'Experience not specified',
    'Profile ready — marketplace setup',
    'Finish your profile basics',
  ];
  for (const phrase of forbidden) {
    assert.ok(!identitySource.includes(phrase), `localized identity copy should not remain hardcoded: ${phrase}`);
  }
});
