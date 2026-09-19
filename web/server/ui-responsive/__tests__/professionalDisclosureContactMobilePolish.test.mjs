import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [wrapperCss, profile] = await Promise.all([
  readFile(new URL('components/detail/CanonicalProfessionalProfileBody.module.css', root), 'utf8'),
  readFile(new URL('components/detail/PublicProviderProfile.tsx', root), 'utf8'),
]);

test('Professional public disclosure and grievance content remains intact', () => {
  assert.ok(profile.includes("t('publicProvider.profile.providerDisclosure')"));
  assert.ok(profile.includes("t('publicProvider.profile.principalAddress')"));
  assert.ok(profile.includes('provider.public_contact_email'));
  assert.ok(profile.includes('provider.public_contact_phone'));
  assert.ok(profile.includes("t('publicProvider.profile.consumerGrievance')"));
  assert.ok(profile.includes('provider.grievance_email'));
  assert.ok(profile.includes('provider.grievance_phone'));
});

test('canonical Professional aside cards wrap long public contact values safely', () => {
  assert.ok(wrapperCss.includes(':global(.profile-aside > .card .review-details)'));
  assert.ok(wrapperCss.includes(':global(.profile-aside > .card a)'));
  assert.ok(wrapperCss.includes('overflow-wrap: anywhere'));
  assert.ok(wrapperCss.includes('word-break: break-word'));
});

test('canonical Professional disclosure facts become phone-safe without hiding content', () => {
  assert.ok(wrapperCss.includes('@media (max-width: 760px)'));
  assert.ok(wrapperCss.includes('grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr)'));
  assert.ok(wrapperCss.includes('max-width: none'));
  assert.ok(wrapperCss.includes('@media (max-width: 420px)'));
  assert.ok(wrapperCss.includes('.body :global(.profile-aside > .card .review-details > div) {\n    grid-template-columns: 1fr;'));
  assert.ok(!wrapperCss.includes('.body :global(.profile-aside) {\n    display: none'));
});
