import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [styles, businessProfile] = await Promise.all([
  readFile(new URL('components/detail/CanonicalBusinessStorefrontBody.module.css', root), 'utf8'),
  readFile(new URL('components/detail/BusinessPublicProfileContent.tsx', root), 'utf8'),
]);

test('Business canonical storefront keeps Quick Book, products and shared public profile composition', () => {
  assert.ok(businessProfile.includes('<BusinessStorefrontQuickBook'));
  assert.ok(businessProfile.includes('<BusinessStorefrontProducts'));
  assert.ok(businessProfile.includes('<PublicProviderProfile\n      kind="business"'));
  assert.ok(styles.includes('.body :global(.profile-layout main > .detail-section:last-child)'));
  assert.ok(styles.includes('display: none'));
});

test('Business disclosure and grievance cards wrap long public values safely', () => {
  assert.ok(styles.includes('.body :global(.profile-aside > .card h2)'));
  assert.ok(styles.includes('.body :global(.profile-aside > .card a)'));
  assert.ok(styles.includes('overflow-wrap: anywhere'));
  assert.ok(styles.includes('word-break: break-word'));
});

test('Business aside fact rows stay readable on mobile and narrow phones', () => {
  assert.ok(styles.includes('@media (max-width: 760px)'));
  assert.ok(styles.includes('grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr)'));
  assert.ok(styles.includes('text-align: left'));
  assert.ok(styles.includes('@media (max-width: 420px)'));
  assert.ok(styles.includes('grid-template-columns: 1fr'));
  assert.ok(styles.includes('width: 100%'));
});
