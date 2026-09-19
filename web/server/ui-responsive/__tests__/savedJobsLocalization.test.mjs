import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, savedJobsRoute] = await Promise.all([
  readFile(new URL('components/jobs/SavedJobsWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/SavedJobsTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/saved-jobs/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<SavedJobsKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Saved Jobs workspace uses a shared EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 30);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useSavedJobsTranslations'));
  assert.ok(source.includes('const { locale, t } = useSavedJobsTranslations()'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const ta'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Saved Jobs preserves Professional-only read contract and unavailable records', () => {
  assert.ok(source.includes("fetch('/api/provider/saved-jobs', { cache: 'no-store' })"));
  assert.ok(savedJobsRoute.includes("if (!session.roles.includes('professional')) throw new Error('Professional profile required.')"));
  assert.ok(savedJobsRoute.includes("if (!job) return { job_posting_id: row.job_posting_id, saved_at: row.saved_at, available: false, job: null }"));
  assert.ok(savedJobsRoute.includes("const available = isCurrentlyAvailable(job, business) && business?.owner_user_id !== context.session.user_id"));
  assert.ok(source.includes("if (!saved.available || !saved.job)"));
});

test('Saved Jobs preserves exact DELETE mutation and local removal behavior', () => {
  assert.ok(source.includes("fetch('/api/provider/saved-jobs', {"));
  assert.ok(source.includes("method: 'DELETE'"));
  assert.ok(source.includes("body: JSON.stringify({ job_posting_id: jobId })"));
  assert.ok(source.includes("setSavedJobs((current) => current.filter((item) => item.job_posting_id !== jobId))"));
  assert.ok(savedJobsRoute.includes(".delete()"));
  assert.ok(savedJobsRoute.includes(".eq('professional_id', context.professional.id)"));
  assert.ok(savedJobsRoute.includes(".eq('job_posting_id', jobId)"));
  assert.ok(savedJobsRoute.includes("return NextResponse.json({ removed: true, job_posting_id: jobId })"));
});

test('Saved Jobs preserves public job deep-link and canonical display values', () => {
  assert.ok(source.includes('href={`/jobs#job-${job.id}`}'));
  assert.ok(source.includes("full_time: 'savedJobs.employment.fullTime'"));
  assert.ok(source.includes("part_time: 'savedJobs.employment.partTime'"));
  assert.ok(source.includes("onsite: 'savedJobs.workplace.onsite'"));
  assert.ok(source.includes("remote: 'savedJobs.workplace.remote'"));
  assert.ok(source.includes("hybrid: 'savedJobs.workplace.hybrid'"));
});

test('Saved Jobs API availability rules remain unchanged', () => {
  assert.ok(savedJobsRoute.includes("job.status === 'open'"));
  assert.ok(savedJobsRoute.includes("job.moderation_state === 'clear'"));
  assert.ok(savedJobsRoute.includes("business?.verified === true"));
  assert.ok(savedJobsRoute.includes("business.owner_user_id === context.session.user_id"));
  assert.ok(savedJobsRoute.includes("This job is no longer available to save."));
});

test('Saved Jobs localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
