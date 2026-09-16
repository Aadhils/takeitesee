import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [nav, css, professionalWrapper, businessWrapper] = await Promise.all([
  readFile(new URL('components/detail/PublicProfileJumpNav.tsx', root), 'utf8'),
  readFile(new URL('components/detail/PublicProfileJumpNav.module.css', root), 'utf8'),
  readFile(new URL('components/detail/CanonicalProfessionalProfileBody.tsx', root), 'utf8'),
  readFile(new URL('components/detail/CanonicalBusinessStorefrontBody.tsx', root), 'utf8'),
]);

test('canonical Professional profile exposes useful jump targets', () => {
  assert.ok(professionalWrapper.includes('<PublicProfileJumpNav kind="professional" />'));
  for (const selector of ['#professional-talents-heading', '#professional-career-heading', '#professional-work-showcase-heading', '.profile-services']) {
    assert.ok(nav.includes(selector));
  }
});

test('canonical Business storefront exposes services products and about jump targets', () => {
  assert.ok(businessWrapper.includes('<PublicProfileJumpNav kind="business" />'));
  assert.ok(nav.includes('#business-storefront-heading'));
  assert.ok(nav.includes('section[aria-label="Business products"]'));
  assert.ok(nav.includes('.profile-layout main .detail-section'));
});

test('jump rail only renders targets present on the current public profile', () => {
  assert.ok(nav.includes('setAvailable(new Set(items.filter((item) => Boolean(targetFor(item.selector)))'));
  assert.ok(nav.includes('const visibleItems = items.filter((item) => available.has(item.id))'));
  assert.ok(nav.includes('if (!visibleItems.length) return null'));
});

test('jump navigation is sticky, horizontally scrollable and touch-friendly', () => {
  assert.ok(css.includes('position: sticky'));
  assert.ok(css.includes('overflow-x: auto'));
  assert.ok(css.includes('min-height: 44px'));
  assert.ok(nav.includes("scrollIntoView({ behavior: 'smooth', block: 'start' })"));
});
