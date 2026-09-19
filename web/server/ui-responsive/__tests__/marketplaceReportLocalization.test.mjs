import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, route] = await Promise.all([
  readFile(new URL('components/safety/MarketplaceReportForm.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/MarketplaceReportTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/moderation/report/route.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'marketplaceReport.action.open',
  'marketplaceReport.category.spam',
  'marketplaceReport.category.harassment',
  'marketplaceReport.category.fraud',
  'marketplaceReport.category.unsafe',
  'marketplaceReport.category.offPlatform',
  'marketplaceReport.category.inappropriate',
  'marketplaceReport.category.other',
  'marketplaceReport.field.concern',
  'marketplaceReport.field.details',
  'marketplaceReport.field.detailsPlaceholder',
  'marketplaceReport.error.fallback',
  'marketplaceReport.error.title',
  'marketplaceReport.success.title',
  'marketplaceReport.success.reference',
  'marketplaceReport.success.audit',
  'marketplaceReport.action.submit',
  'marketplaceReport.action.cancel',
];

test('Marketplace report form uses isolated shared EN/TA localization', () => {
  assert.ok(source.includes('useMarketplaceReportTranslations'));
  assert.ok(source.includes('const { t } = useMarketplaceReportTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.equal(keys.length, 18);
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2, key);
    assert.ok(source.includes("'" + key + "'"), key);
  }
});

test('Marketplace report form preserves canonical report mutation and category semantics', () => {
  assert.ok(source.includes("type TargetType = 'requirement' | 'proposal' | 'conversation' | 'message' | 'portfolio_media' | 'job_posting'"));
  assert.ok(source.includes("type Category = 'spam' | 'harassment' | 'fraud' | 'unsafe' | 'off_platform' | 'inappropriate' | 'other'"));
  assert.ok(source.includes("targetType === 'portfolio_media' ? 'inappropriate' : 'spam'"));
  assert.ok(source.includes("fetch('/api/moderation/report'"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("JSON.stringify({ target_type: targetType, target_id: targetId, category, details })"));
  assert.ok(source.includes("!payload.report?.report_reference"));
  assert.ok(source.includes('setReference(payload.report.report_reference)'));

  assert.ok(route.includes("['requirement','proposal','conversation','message','portfolio_media','job_posting'].includes(body.target_type)"));
  assert.ok(route.includes("['spam','harassment','fraud','unsafe','off_platform','inappropriate','other'].includes(body.category)"));
});

test('Marketplace report form preserves report reference, audit history and cancel/reset behavior', () => {
  assert.ok(translations.includes('The marketplace safety team can review it without deleting the audit history.'));
  assert.ok(source.includes("setOpen(false); setError('');"));
  assert.ok(source.includes('if (busy || reference) return'));
  assert.ok(source.includes('open && !reference'));
  assert.ok(source.includes('!open && !reference'));
  assert.ok(!source.includes('setCategory(' + "'spam'" + ')'));
  assert.ok(!source.includes("setDetails(''); setOpen(false)"));
});

test('Marketplace report localization does not activate finance or recurrence behavior', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', 'recovery']) {
    assert.ok(!source.includes(term));
    assert.ok(!translations.includes(term));
  }
});
