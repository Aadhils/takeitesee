import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../../../../app/[handle]/page.tsx', import.meta.url), 'utf8');
const wrapper = readFileSync(new URL('../../../../components/detail/CanonicalProfessionalProfileBody.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../../components/detail/CanonicalProfessionalProfileBody.module.css', import.meta.url), 'utf8');
const professional = readFileSync(new URL('../../../../components/detail/ProfessionalPublicProfileContent.tsx', import.meta.url), 'utf8');

test('canonical Professional handle keeps the modern identity hero as the single profile hero', () => {
  assert.match(route, /<PublicProviderIdentityLayout kind="professional" providerId=\{resolved\.identity_id\}>[\s\S]*?<CanonicalProfessionalProfileBody>[\s\S]*?<ProfessionalPublicProfileContent/);
  assert.match(wrapper, /className=\{styles\.body\}/);
  assert.match(styles, /:global\(\.breadcrumbs\)[\s\S]*:global\(\.profile-hero\)[\s\S]*display:\s*none/);
});

test('Professional public services, talents, career and portfolio content remain in the shared profile body', () => {
  assert.match(professional, /<PublicProviderProfile/);
  assert.match(professional, /roles=\{roles\.map/);
  assert.match(professional, /career=\{career \?/);
  assert.match(professional, /services=\{services\.map/);
  assert.match(professional, /PortfolioMediaSafetyPanel/);
});

test('Business canonical storefront keeps its dedicated wrapper', () => {
  assert.match(route, /<CanonicalBusinessStorefrontBody>[\s\S]*?<BusinessShopPublicStatus[\s\S]*?<BusinessPublicProfileContent/);
});
