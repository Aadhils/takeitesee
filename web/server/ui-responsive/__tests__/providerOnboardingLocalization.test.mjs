import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderOnboarding.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

const onboardingKeys = [
  'onboarding.identityHeadlineProfessional',
  'onboarding.identityHeadlineBusiness',
  'onboarding.identityBodyProfessional',
  'onboarding.identityBodyBusiness',
  'onboarding.pendingIdentityHeadline',
  'onboarding.chooseIdentityHeadline',
  'onboarding.pendingIdentityBody',
  'onboarding.chooseIdentityBody',
  'onboarding.oneAccountIdentity',
  'onboarding.lockedBodyProfessional',
  'onboarding.lockedBodyBusiness',
  'onboarding.profilesWorkspaces',
  'onboarding.pendingLockProfessional',
  'onboarding.pendingLockBusiness',
  'onboarding.chooseCarefully',
  'onboarding.identityLockWarning',
  'onboarding.acknowledgeProfessional',
  'onboarding.acknowledgeBusiness',
];

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider onboarding uses shared localization instead of local Tamil branching', () => {
  assert.ok(source.includes('const { t } = useIdentityWorkspaceTranslations();'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes("locale.toLowerCase().startsWith('ta')"));
  assert.ok(!source.includes('tamil ?'));
  assert.ok(!source.includes('const opposite ='));
  for (const key of onboardingKeys) {
    assert.ok(source.includes(`t('${key}')`), `missing shared key usage: ${key}`);
  }
});

test('Provider onboarding English and Tamil catalogs stay in parity', () => {
  for (const key of onboardingKeys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider onboarding keeps provider finality and application contracts unchanged', () => {
  assert.ok(source.includes("fetch('/api/provider/onboarding', { cache: 'no-store' })"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("action: 'withdraw'"));
  assert.ok(source.includes('available_provider_types'));
  assert.ok(source.includes('!provider && !pending && availableTypes.length > 0'));
  assert.ok(source.includes('setAcknowledged(false)'));
  assert.ok(source.includes("provider.provider_type === 'professional'"));
  assert.ok(source.includes("pending.provider_type === 'professional'"));
  assert.ok(source.includes("form.provider_type === 'professional'"));
});
