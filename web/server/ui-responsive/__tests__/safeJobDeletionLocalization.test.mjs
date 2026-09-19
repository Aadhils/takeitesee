import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, deleteRoute, marketplaceRoute] = await Promise.all([
  readFile(new URL('components/jobs/SafeJobDeletionPanel.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/ProviderJobsTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/jobs/delete/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-marketplace/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<ProviderJobsKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Safe Job Deletion reuses Provider Jobs EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 110);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useProviderJobsTranslations'));
  assert.ok(source.includes('const { t } = useProviderJobsTranslations()'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const ta'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Safe Job Deletion preserves Business workspace read and zero-application eligibility', () => {
  assert.ok(source.includes("fetch('/api/provider/job-marketplace', { cache: 'no-store' })"));
  assert.ok(source.includes("if (payload.mode !== 'business')"));
  assert.ok(source.includes("jobs.filter((job) => (applicationCountByJob.get(job.id) ?? 0) === 0)"));
  assert.ok(marketplaceRoute.includes("return NextResponse.json({ mode: 'business'"));
  assert.ok(marketplaceRoute.includes("applications, professionals"));
});

test('Safe Job Deletion preserves exact DELETE endpoint and payload', () => {
  assert.ok(source.includes("fetch('/api/jobs/delete', {"));
  assert.ok(source.includes("method: 'DELETE'"));
  assert.ok(source.includes("body: JSON.stringify({ job_id: job.id })"));
  assert.ok(deleteRoute.includes("export async function DELETE(request: Request)"));
  assert.ok(deleteRoute.includes("const jobId = text(body.job_id, 64)"));
});

test('Safe Job Deletion keeps server-side ownership and application lock', () => {
  assert.ok(deleteRoute.includes(".eq('owner_user_id', session.user_id)"));
  assert.ok(deleteRoute.includes(".eq('business_id', business.id)"));
  assert.ok(deleteRoute.includes(".from('job_applications')"));
  assert.ok(deleteRoute.includes(".eq('job_posting_id', jobId)"));
  assert.ok(deleteRoute.includes("if ((count ?? 0) > 0)"));
  assert.ok(deleteRoute.includes("Job posting cannot be deleted after applications exist."));
  assert.ok(deleteRoute.includes(".from('job_postings')"));
  assert.ok(deleteRoute.includes(".delete()"));
});

test('Safe Job Deletion confirmation remains explicit before destructive action', () => {
  assert.ok(source.includes('confirmId === job.id'));
  assert.ok(source.includes('onClick={() => setConfirmId(null)}'));
  assert.ok(source.includes('onClick={() => void deleteJob(job)}'));
  assert.ok(source.includes('onClick={() => { setConfirmId(job.id); setMessage(null); }}'));
});

test('Safe Job Deletion localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
