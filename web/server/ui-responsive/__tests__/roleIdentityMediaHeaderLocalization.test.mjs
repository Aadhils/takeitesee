import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [header, translations, compactTest] = await Promise.all([
  readFile(new URL('components/identity/RoleIdentityMediaHeader.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
  readFile(new URL('server/ui-responsive/__tests__/identityMediaCompactPhotoControls.test.mjs', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'identity.media.scopeBusinessBrand',
  'identity.media.scopeProfessionalIdentity',
  'identity.media.scopePersonalAccount',
  'identity.media.loadFallback',
  'identity.media.avatarGuidance',
  'identity.media.bannerGuidance',
  'identity.media.invalidType',
  'identity.media.tooLarge',
  'identity.media.saveFallback',
  'identity.media.avatarUpdated',
  'identity.media.bannerUpdated',
  'identity.media.uploadFallback',
  'identity.media.removeAvatarConfirm',
  'identity.media.removeBannerConfirm',
  'identity.media.removeSaveFallback',
  'identity.media.avatarRemoved',
  'identity.media.bannerRemoved',
  'identity.media.removeFallback',
  'identity.media.sectionLabel',
  'identity.media.uploading',
  'identity.media.changeBanner',
  'identity.media.addBanner',
  'identity.media.remove',
  'identity.media.profileAlt',
  'identity.media.changeProfilePicture',
  'identity.media.addProfilePicture',
  'identity.media.removePhoto',
  'identity.media.loading',
];

test('Role Identity Media Header uses shared localization with exact EN/TA parity', () => {
  assert.ok(header.includes("const { t } = useIdentityWorkspaceTranslations()"));
  assert.ok(!header.includes('const tamil ='));
  assert.ok(!header.includes('tamil ?'));
  assert.ok(!/[஀-௿]/u.test(header));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(header.includes("t('" + key + "')"));
  }
});

test('identity media discovery, upload and removal API contracts remain intact', () => {
  assert.ok(header.includes('const endpoint = `/api/identity-media?context=${context}`'));
  assert.ok(header.includes("fetch(endpoint, { cache: 'no-store' })"));
  assert.ok(header.includes("method: 'PATCH'"));
  assert.ok(header.includes("body: JSON.stringify({ kind, object_path: objectPath })"));
  assert.ok(header.includes("method: 'DELETE'"));
  assert.ok(header.includes("body: JSON.stringify({ kind })"));
});

test('identity media storage safety and validation semantics remain intact', () => {
  assert.ok(header.includes("new Set(['image/jpeg', 'image/png', 'image/webp'])"));
  assert.ok(header.includes('const maxBytes = 6 * 1024 * 1024'));
  assert.ok(header.includes('file.size <= 0 || file.size > maxBytes'));
  assert.ok(header.includes('`${identity.upload_prefix}/${kind}/${crypto.randomUUID()}.${extensionFor(file)}`'));
  assert.ok(header.includes("supabase.storage.from(identity.bucket).upload(objectPath, file"));
  assert.ok(header.includes("await supabase.storage.from(identity.bucket).remove([objectPath])"));
});

test('identity media hero preserves scope, responsive controls and workspace switch integration', () => {
  assert.ok(header.includes("context === 'customer' ? 'customer' : 'professional'"));
  assert.ok(header.includes("if (scope === 'business') return styles.bannerBusiness"));
  assert.ok(header.includes("if (scope === 'professional') return styles.bannerProfessional"));
  assert.ok(header.includes('<GlobalWorkspaceSwitcher fallbackName={displayName} triggerVariant="identity" />'));
  assert.ok(header.includes('<ProviderReadinessSummary placement="provider" />'));
  assert.ok(header.includes("const visibleMeta = context === 'customer' ? '' : meta"));
  assert.ok(compactTest.includes("t('identity.media.changeProfilePicture')"));
});

test('identity media localization does not activate finance or payment behavior', () => {
  for (const term of ['Cashfree', '/api/pay', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!header.includes(term));
  }
});
