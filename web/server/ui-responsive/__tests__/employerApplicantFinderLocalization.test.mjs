import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, marketplaceRoute] = await Promise.all([
  readFile(new URL('components/jobs/EmployerApplicantFinder.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/ProviderJobsTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-marketplace/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<ProviderJobsKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Employer Applicant Finder reuses Provider Jobs EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 90);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useProviderJobsTranslations'));
  assert.ok(source.includes('const { locale, t } = useProviderJobsTranslations()'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const ta'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Employer Applicant Finder remains read-only and Business-mode gated', () => {
  assert.ok(source.includes("fetch('/api/provider/job-marketplace', { cache: 'no-store' })"));
  assert.ok(source.includes("if (payload.mode !== 'business')"));
  assert.ok(!source.includes("method: 'POST'"));
  assert.ok(!source.includes("method: 'PATCH'"));
  assert.ok(!source.includes("method: 'DELETE'"));
  assert.ok(marketplaceRoute.includes("return NextResponse.json({ mode: 'business'"));
  assert.ok(marketplaceRoute.includes(".eq('business_id', context.business.id)"));
});

test('Employer Applicant Finder preserves keyword, job, stage and verification filters', () => {
  assert.ok(source.includes("if (jobId && application.job_posting_id !== jobId) return false"));
  assert.ok(source.includes("if (stage && application.status !== stage) return false"));
  assert.ok(source.includes("if (verification === 'verified' && profile?.verified !== true) return false"));
  assert.ok(source.includes("if (verification === 'unverified' && profile?.verified === true) return false"));
  assert.ok(source.includes("return haystack.includes(keywordValue)"));
  assert.ok(source.includes("const hasFilters = Boolean(keyword.trim() || jobId || stage || verification || sortMode !== 'newest')"));
});

test('Employer Applicant Finder preserves sort semantics', () => {
  assert.ok(source.includes("if (sortMode === 'oldest')"));
  assert.ok(source.includes("if (sortMode === 'profile')"));
  assert.ok(source.includes("if (sortMode === 'job')"));
  assert.ok(source.includes("return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()"));
});

test('Employer Applicant Finder preserves profile, message and hiring destinations', () => {
  assert.ok(source.includes("href={`/professionals/${application.professional_id}`}"));
  assert.ok(source.includes("href={`/provider/messages?conversation=${conversation.id}`}"));
  assert.ok(source.includes('href="/provider/jobs"'));
});

test('Employer Applicant Finder localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
