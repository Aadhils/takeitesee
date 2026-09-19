import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, withdrawal, translations, marketplaceRoute, interviewsRoute, jobsRoute] = await Promise.all([
  readFile(new URL('components/jobs/ProviderJobMarketplace.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/ApplicationWithdrawalControl.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/ProviderJobMarketplaceTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-marketplace/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-interviews/route.ts', root), 'utf8'),
  readFile(new URL('app/api/jobs/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<ProviderJobMarketplaceKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Provider Job Marketplace uses a shared EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 90);
  assert.deepEqual(tamilKeys, englishKeys);

  assert.ok(source.includes('useProviderJobMarketplaceTranslations'));
  assert.ok(source.includes('const { locale,t } = useProviderJobMarketplaceTranslations()'));
  assert.ok(withdrawal.includes('useProviderJobMarketplaceTranslations'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const ta='));
  assert.ok(!source.includes('tamil={'));
  assert.ok(!withdrawal.includes('tamil: boolean'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(withdrawal));
});

test('Professional application workspace keeps read and withdrawal semantics', () => {
  assert.ok(source.includes("fetch('/api/provider/job-marketplace',{cache:'no-store'})"));
  assert.ok(source.includes("patch({action:'application_status',application_id:applicationId,status:'withdrawn'})"));
  assert.ok(source.includes('<ApplicationWithdrawalControl applicationId={application.id} saving={saving} onConfirm='));
  assert.ok(marketplaceRoute.includes("if (context.mode === 'professional' && status !== 'withdrawn')"));
  assert.ok(marketplaceRoute.includes("if (context.mode === 'business' && status === 'withdrawn')"));
});

test('Professional interview response remains accept or decline only', () => {
  assert.ok(source.includes("interviewMutation('PATCH',{action:'respond',interview_id:interview.id,status:'accepted'})"));
  assert.ok(source.includes("interviewMutation('PATCH',{action:'respond',interview_id:interview.id,status:'declined'})"));
  assert.ok(interviewsRoute.includes("if (context.mode !== 'professional') return NextResponse.json({ error: 'Professional applicant required.' }, { status: 403 })"));
  assert.ok(interviewsRoute.includes("if (!['accepted', 'declined'].includes(responseStatus))"));
});

test('Legacy Business branch keeps job and applicant mutation contracts intact', () => {
  assert.ok(source.includes("fetch('/api/jobs',{method:'POST'"));
  assert.ok(source.includes("salary_currency:'INR'"));
  assert.ok(source.includes("patch({action:'job_status',job_id:job.id,status:'open'})"));
  assert.ok(source.includes("patch({action:'job_status',job_id:job.id,status:'closed'})"));
  assert.ok(source.includes("patch({action:'job_status',job_id:job.id,status:'filled'})"));
  assert.ok(source.includes("application.status==='submitted'?['shortlisted','interview','rejected']"));
  assert.ok(source.includes("application.status==='shortlisted'?['interview','rejected']"));
  assert.ok(source.includes("application.status==='interview'?['rejected']:[]"));

  assert.ok(jobsRoute.includes("if (status === 'open' && !business.verified)"));
  assert.ok(jobsRoute.includes("Job terms are locked after the first application."));
});

test('Legacy Business interview schedule, reschedule and cancel payloads remain unchanged', () => {
  assert.ok(source.includes("const body={application_id:applicationId,starts_at:value.starts_at,duration_minutes:value.duration_minutes,timezone:value.timezone,mode:value.mode,location:value.location,meeting_url:value.meeting_url,note:value.note}"));
  assert.ok(source.includes("interviewMutation('PATCH',{action:'reschedule',interview_id:latest.id,...body})"));
  assert.ok(source.includes("interviewMutation('POST',body)"));
  assert.ok(source.includes("interviewMutation('PATCH',{action:'cancel',interview_id:latest.id})"));
  assert.ok(interviewsRoute.includes("if (context.mode !== 'business') return NextResponse.json({ error: 'Business employer required.' }, { status: 403 })"));
  assert.ok(interviewsRoute.includes("if (!context.business.verified) return NextResponse.json({ error: 'Verify your business before scheduling interviews.' }, { status: 403 })"));
});

test('Provider Job Marketplace localization does not activate finance or recurrence surfaces', () => {
  const ui = source + withdrawal;
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!ui.includes(term));
  }
});
