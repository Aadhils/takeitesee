import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, jobsRoute, marketplaceRoute, interviewsRoute, offersRoute] = await Promise.all([
  readFile(new URL('components/jobs/EmployerHiringWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/EmployerHiringTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/jobs/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-marketplace/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-interviews/route.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-offers/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<EmployerHiringKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Employer Hiring workspace uses a shared EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 100);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useEmployerHiringTranslations'));
  assert.ok(source.includes('const { locale,t }=useEmployerHiringTranslations()'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const ta='));
  assert.ok(!source.includes('ta?'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Employer Hiring preserves hiring workspace reads and pending-offer count semantics', () => {
  assert.ok(source.includes("fetch('/api/provider/job-marketplace',{cache:'no-store'})"));
  assert.ok(source.includes("fetch('/api/provider/job-offers',{cache:'no-store'})"));
  assert.ok(source.includes("setPendingOffers((offers.offers??[]).filter((offer)=>offer.status==='pending').length)"));
  assert.ok(source.includes('<JobOfferWorkspace />'));
  assert.ok(offersRoute.includes("return { mode: 'business' as const"));
  assert.ok(offersRoute.includes(".order('issued_at', { ascending: false })"));
});

test('Employer Hiring preserves job create, edit and status mutation payloads', () => {
  assert.ok(source.includes("fetch('/api/jobs',{method:'POST'"));
  assert.ok(source.includes("JSON.stringify({...jobPayload(form),status})"));
  assert.ok(source.includes("fetch('/api/jobs',{method:'PATCH'"));
  assert.ok(source.includes("JSON.stringify({job_id:jobId,...jobPayload(editForm)})"));
  assert.ok(source.includes("patch({action:'job_status',job_id:job.id,status:'open'})"));
  assert.ok(source.includes("patch({action:'job_status',job_id:job.id,status:'closed'})"));
  assert.ok(source.includes("patch({action:'job_status',job_id:job.id,status:'filled'})"));

  assert.ok(jobsRoute.includes("if (status === 'open' && !business.verified)"));
  assert.ok(jobsRoute.includes("Job terms are locked after the first application."));
  assert.ok(jobsRoute.includes("if (!['draft','open'].includes(status))"));
});

test('Employer Hiring preserves applicant stage mutation rules', () => {
  assert.ok(source.includes("patch({action:'application_status',application_id:application.id,status})"));
  assert.ok(source.includes("application.status==='submitted'?['shortlisted','interview','rejected']"));
  assert.ok(source.includes("application.status==='shortlisted'?['interview','rejected']"));
  assert.ok(source.includes("application.status==='interview'?['rejected']:[]"));

  assert.ok(marketplaceRoute.includes("if (!applicationId || !['shortlisted','interview','hired','rejected','withdrawn'].includes(status))"));
  assert.ok(marketplaceRoute.includes("if (context.mode === 'professional' && status !== 'withdrawn')"));
  assert.ok(marketplaceRoute.includes("if (context.mode === 'business' && status === 'withdrawn')"));
});

test('Employer Hiring preserves interview schedule, reschedule and cancel contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/job-interviews',{method"));
  assert.ok(source.includes("const body={application_id:applicationId,starts_at:value.starts_at,duration_minutes:value.duration_minutes,timezone:value.timezone,mode:value.mode,location:value.location,meeting_url:value.meeting_url,note:value.note}"));
  assert.ok(source.includes("interviewMutation('PATCH',{action:'reschedule',interview_id:latest.id,...body})"));
  assert.ok(source.includes("interviewMutation('POST',body)"));
  assert.ok(source.includes("interviewMutation('PATCH',{action:'cancel',interview_id:latest.id})"));

  assert.ok(interviewsRoute.includes("if (context.mode !== 'business') return NextResponse.json({ error: 'Business employer required.' }, { status: 403 })"));
  assert.ok(interviewsRoute.includes("if (!context.business.verified) return NextResponse.json({ error: 'Verify your business before scheduling interviews.' }, { status: 403 })"));
  assert.ok(interviewsRoute.includes("const MODES = new Set<Mode>(['in_person', 'phone', 'video'])"));
  assert.ok(interviewsRoute.includes("if (new Date(start).getTime() <= Date.now())"));
  assert.ok(interviewsRoute.includes("if (body.meeting_url && !url)"));
});

test('Employer Hiring localization does not alter finance, recovery or provider identity boundaries', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
