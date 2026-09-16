import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [handlePage, wrapperSource, wrapperCss, businessContent] = await Promise.all([
  readFile(new URL('app/[handle]/page.tsx', root), 'utf8'),
  readFile(new URL('components/detail/CanonicalBusinessStorefrontBody.tsx', root), 'utf8'),
  readFile(new URL('components/detail/CanonicalBusinessStorefrontBody.module.css', root), 'utf8'),
  readFile(new URL('components/detail/BusinessPublicProfileContent.tsx', root), 'utf8'),
]);

test('canonical Business handle keeps one modern provider identity hero', () => {
  assert.ok(handlePage.includes("import CanonicalBusinessStorefrontBody"));
  assert.ok(handlePage.includes('<PublicProviderIdentityLayout kind="business"'));
  assert.ok(handlePage.includes('<CanonicalBusinessStorefrontBody>'));
  assert.ok(handlePage.includes('<BusinessPublicProfileContent providerId={resolved.identity_id} canonicalUrl={canonical} />'));
  assert.ok(wrapperSource.includes('className={styles.body}'));
  assert.ok(wrapperCss.includes(':global(.profile-hero)'));
  assert.ok(wrapperCss.includes('display: none'));
});

test('embedded canonical Business body removes misplaced legacy breadcrumb chrome', () => {
  assert.ok(wrapperCss.includes(':global(.breadcrumbs)'));
  assert.ok(wrapperCss.includes(':global(.profile-hero)'));
});

test('Business storefront customer actions and catalog remain intact', () => {
  assert.ok(businessContent.includes('<BusinessStorefrontQuickBook'));
  assert.ok(businessContent.includes('<BusinessStorefrontProducts products={storefrontProducts} />'));
  assert.ok(businessContent.includes('<PublicProviderProfile'));
  assert.ok(businessContent.includes('services={storefrontServices.map'));
});

test('Professional handle composition remains outside the Business-only wrapper', () => {
  const professionalBranch = handlePage.split("if (resolved.identity_type === 'professional')")[1] ?? '';
  assert.ok(professionalBranch.includes('<PublicProviderIdentityLayout kind="professional"'));
  assert.ok(professionalBranch.includes('<ProfessionalPublicProfileContent'));
  assert.ok(!professionalBranch.includes('<CanonicalBusinessStorefrontBody>'));
});
