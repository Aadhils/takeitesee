import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, profilePage] = await Promise.all([
  readFile(new URL('components/identity/IdentityHandleManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
  readFile(new URL('app/account/profile/page.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }
const keys = [
  'identity.handle.customerEyebrow','identity.handle.providerEyebrow','identity.handle.customerTitle','identity.handle.providerTitle',
  'identity.handle.customerIntro','identity.handle.providerIntro','identity.handle.label','identity.handle.hint','identity.handle.save',
  'identity.handle.saving','identity.handle.current','identity.handle.notSet','identity.handle.publicLink','identity.handle.reservedLink',
  'identity.handle.copyLink','identity.handle.copied','identity.handle.loading','identity.handle.saved','identity.handle.savedLive',
  'identity.handle.savedReserved','identity.handle.customerReserved','identity.handle.providerReservedTitle','identity.handle.providerReservedBody',
  'identity.handle.completeReadiness','identity.handle.live','identity.handle.reservedBadge','identity.handle.loadFallback','identity.handle.saveFallback',
];

test('Identity Handle Manager uses shared workspace localization with EN/TA parity', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(source.includes('const { t } = useIdentityWorkspaceTranslations()'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!source.includes('useMemo(() => tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Customer profile no longer passes a duplicate locale prop to Identity Handle Manager', () => {
  assert.ok(profilePage.includes('<IdentityHandleManager context="customer" />'));
  assert.ok(!profilePage.includes('<IdentityHandleManager context="customer" locale={locale} />'));
});

test('Identity Handle API load and save contracts remain unchanged', () => {
  assert.ok(source.includes('fetch(`/api/identity-handle?context=${context}`, { cache: \'no-store\' })'));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("headers: { 'Content-Type': 'application/json' }"));
  assert.ok(source.includes('body: JSON.stringify({ handle: input })'));
  assert.ok(source.includes('payload.public_profile_ready'));
  assert.ok(source.includes('payload.readiness_href'));
});

test('Provider handle readiness and canonical-link semantics remain unchanged', () => {
  assert.ok(source.includes("const reservedProviderUrl = context === 'provider' && handle ? `https://www.takeitesee.com/@${handle}` : null"));
  assert.ok(source.includes('const publicUrl = reservedProviderUrl && publicProfileReady ? reservedProviderUrl : null'));
  assert.ok(source.includes("context === 'provider' && reservedProviderUrl"));
  assert.ok(source.includes('readinessHref ?'));
  assert.ok(source.includes('navigator.clipboard.writeText(publicUrl)'));
});

test('Identity Handle localization does not activate finance behavior', () => {
  for (const term of ['Cashfree','/api/pay','refund','payout','settlement','reconciliation']) assert.ok(!source.includes(term));
});
