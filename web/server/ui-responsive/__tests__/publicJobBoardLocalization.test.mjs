import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, jobsRoute, savedJobsRoute, marketplaceRoute] = await Promise.all([
  readFile(new URL('components/jobs/PublicJobBoard.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicJobBoardTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/jobs/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/saved-jobs/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-marketplace/route.ts', root), 'utf8'),
]);

function catalogKeys(blockName) {
  const pattern = blockName === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<PublicJobBoardKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Public Job Board uses a shared EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 60);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('usePublicJobBoardTranslations'));
  assert.ok(source.includes('const { t } = usePublicJobBoardTranslations()'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const ta ='));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Public Job Board preserves public discovery and saved-job mutation semantics', () => {
  assert.ok(source.includes("fetch('/api/jobs', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/saved-jobs', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/saved-jobs', {"));
  assert.ok(source.includes("method: alreadySaved ? 'DELETE' : 'POST'"));
  assert.ok(source.includes("JSON.stringify({ job_posting_id: jobId })"));
  assert.ok(source.includes('setSavedJobIds((current) => alreadySaved ? current.filter((id) => id !== jobId) : [...new Set([...current, jobId])])'));

  assert.ok(jobsRoute.includes("query = query.eq('status', 'open')"));
  assert.ok(savedJobsRoute.includes("if (!session.roles.includes('professional')) throw new Error('Professional profile required.')"));
  assert.ok(savedJobsRoute.includes("if (job.status !== 'open' || job.moderation_state !== 'clear' || !deadlineOk || !business.verified)"));
  assert.ok(savedJobsRoute.includes("if (!business || business.owner_user_id === context.session.user_id)"));
});

test('Public Job Board preserves application POST payload, reset and professional constraints', () => {
  assert.ok(source.includes("fetch('/api/provider/job-marketplace', {"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("JSON.stringify({ job_posting_id: selectedJob.id, cover_note: coverNote })"));
  assert.ok(source.includes("setSelectedJobId(null)"));
  assert.ok(source.includes("setCoverNote('')"));

  assert.ok(marketplaceRoute.includes("if (context.mode !== 'professional') return NextResponse.json({ error: 'Professional profile required to apply.' }, { status: 403 })"));
  assert.ok(marketplaceRoute.includes("if (!context.professional.verified) return NextResponse.json({ error: 'Verify your professional profile before applying.' }, { status: 403 })"));
  assert.ok(marketplaceRoute.includes("selected_professional_role_id: roleId"));
  assert.ok(marketplaceRoute.includes("status: 'submitted'"));
});

test('Public Job Board preserves report targeting and frozen resume snapshot guidance', () => {
  assert.ok(source.includes('<MarketplaceReportForm targetType="job_posting" targetId={job.id}'));
  assert.ok(source.includes("label={t('publicJobBoard.action.report')}"));
  assert.ok(translations.includes('frozen career-only resume snapshot'));
  assert.ok(translations.includes('Contact, KYC/legal, grievance and finance data are excluded'));
  assert.ok(translations.includes('frozen snapshot'));
  assert.ok(translations.includes('finance data'));
});

test('Public Job Board localization does not activate finance or recurrence flows', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
