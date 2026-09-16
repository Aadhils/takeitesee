import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [handlePage, wrapperSource, wrapperCss, professionalContent] = await Promise.all([
  readFile(new URL('app/[handle]/page.tsx', root), 'utf8'),
  readFile(new URL('components/detail/CanonicalProfessionalProfileBody.tsx', root), 'utf8'),
  readFile(new URL('components/detail/CanonicalProfessionalProfileBody.module.css', root), 'utf8'),
  readFile(new URL('components/detail/ProfessionalPublicProfileContent.tsx', root), 'utf8'),
]);

test('canonical Professional handle keeps one modern provider identity hero', () => {
  assert.ok(handlePage.includes("import CanonicalProfessionalProfileBody"));
  assert.ok(handlePage.includes('<PublicProviderIdentityLayout kind="professional"'));
  assert.ok(handlePage.includes('<CanonicalProfessionalProfileBody>'));
  assert.ok(handlePage.includes('<ProfessionalPublicProfileContent providerId={resolved.identity_id} canonicalUrl={canonical} />'));
  assert.ok(wrapperSource.includes('className={styles.body}'));
  assert.ok(wrapperCss.includes(':global(.profile-hero)'));
  assert.ok(wrapperCss.includes('display: none'));
});

test('embedded canonical Professional body removes misplaced legacy breadcrumb chrome', () => {
  assert.ok(wrapperCss.includes(':global(.breadcrumbs)'));
  assert.ok(wrapperCss.includes(':global(.profile-hero)'));
});

test('Professional public talents career services and portfolio remain intact', () => {
  assert.ok(professionalContent.includes('<PublicProviderProfile'));
  assert.ok(professionalContent.includes('roles={roles.map'));
  assert.ok(professionalContent.includes('career={career ?'));
  assert.ok(professionalContent.includes('services={services.map'));
  assert.ok(professionalContent.includes('<PortfolioMediaSafetyPanel'));
});

test('canonical Professional service cards keep readable metadata and touch-friendly mobile CTAs', () => {
  assert.ok(wrapperCss.includes(':global(.profile-service)'));
  assert.ok(wrapperCss.includes('grid-template-columns: minmax(0, 1fr) auto'));
  assert.ok(wrapperCss.includes(':global(.profile-service p:last-of-type)'));
  assert.ok(wrapperCss.includes('overflow-wrap: anywhere'));
  assert.ok(wrapperCss.includes('@media (max-width: 700px)'));
  assert.ok(wrapperCss.includes('grid-template-columns: 1fr'));
  assert.ok(wrapperCss.includes('width: 100%'));
  assert.ok(wrapperCss.includes('min-height: 48px'));
  assert.ok(wrapperCss.includes('white-space: normal'));
});

test('Business handle composition remains on the Business-only wrapper', () => {
  const renderSource = handlePage.split('export default async function PublicHandlePage')[1] ?? '';
  const businessBranch = renderSource.split("if (resolved.identity_type === 'business')")[1]?.split("if (resolved.identity_type === 'professional')")[0] ?? '';
  assert.ok(businessBranch.includes('<CanonicalBusinessStorefrontBody>'));
  assert.ok(!businessBranch.includes('<CanonicalProfessionalProfileBody>'));
});
