import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/support/LiveHelpCenter.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/LanguageProvider.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'help.topic.findBook.title','help.topic.findBook.body','help.topic.findBook.action',
  'help.topic.manageBooking.title','help.topic.manageBooking.body','help.topic.manageBooking.action',
  'help.topic.bookingSupport.title','help.topic.bookingSupport.body','help.topic.bookingSupport.action',
  'help.topic.accountProfile.title','help.topic.accountProfile.body','help.topic.accountProfile.action',
  'help.topic.platformSupport.title','help.topic.platformSupport.body','help.topic.platformSupport.action',
  'help.topic.providerTrust.title','help.topic.providerTrust.body','help.topic.providerTrust.action',
  'help.topic.safetyReporting.title','help.topic.safetyReporting.body','help.topic.safetyReporting.action',
  'help.eyebrow','help.title','help.intro','help.faq.eyebrow','help.faq.title',
  'help.faq.openCase.question','help.faq.openCase.answer','help.faq.privacy.question','help.faq.privacy.answer',
  'help.faq.providerLanguage.question','help.faq.providerLanguage.answer',
  'help.bookingCta.badge','help.bookingCta.title','help.bookingCta.body','help.bookingCta.action',
  'help.platformCta.badge','help.platformCta.title','help.platformCta.body','help.platformCta.action','help.platformCta.email','help.platformCta.privacy',
];

test('Live Help Center uses shared localization with exact EN/TA parity', () => {
  assert.ok(source.includes('const { t } = useLanguage()'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 42);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Live Help Center preserves support, privacy and safety routes', () => {
  for (const route of ["'/explore'","'/bookings'","'/account'","'/account/support'","'/businesses'","'/messages'"]) {
    assert.ok(source.includes(route), route);
  }
  assert.ok(source.includes('href="/privacy"'));
  assert.ok(source.includes('mailto:uandv.com@gmail.com'));
});

test('Live Help Center preserves deletion-review and authored-content guidance', () => {
  assert.ok(translations.includes("'help.faq.privacy.answer': 'Sign in and open Account privacy. You can submit and track an access, correction or deletion-review request. A deletion request is reviewed and is not an immediate automatic deletion.'"));
  assert.ok(translations.includes("'help.faq.providerLanguage.answer': 'Provider names, service descriptions, customer reviews and other authored marketplace content stay in their source language so TakeItEsee does not fabricate or alter user-authored meaning.'"));
  assert.ok(source.includes("t('help.faq.privacy.answer')"));
  assert.ok(source.includes("t('help.faq.providerLanguage.answer')"));
});

test('Live Help Center preserves booking-specific and platform support separation', () => {
  assert.ok(source.includes("href: '/bookings'"));
  assert.ok(source.includes("href: '/account/support'"));
  assert.ok(source.includes('href="/bookings"'));
  assert.ok(source.includes('href="/account/support"'));
  assert.ok(source.includes("t('help.bookingCta.badge')"));
  assert.ok(source.includes("t('help.platformCta.badge')"));
});

test('Live Help Center localization does not introduce finance behavior', () => {
  for (const term of ["fetch('/api/pay", 'createPayment', 'CashfreeClient', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.ok(!source.includes(term));
  }
});
