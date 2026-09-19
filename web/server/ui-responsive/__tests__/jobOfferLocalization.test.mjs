import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, offersRoute] = await Promise.all([
  readFile(new URL('components/jobs/JobOfferWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/JobOfferTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/provider/job-offers/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<JobOfferKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Job Offer workspace uses a shared EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 70);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useJobOfferTranslations'));
  assert.ok(source.includes('const { locale,t }=useJobOfferTranslations()'));
  assert.ok(!source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!/\bconst\s+ta\s*=|\bta\s*\?/u.test(source));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Job Offer workspace preserves offer loading and issue payload', () => {
  assert.ok(source.includes("fetch('/api/provider/job-offers',{cache:'no-store'})"));
  assert.ok(source.includes("fetch('/api/provider/job-offers',{method:'POST'"));
  for (const field of [
    'application_id:applicationId',
    'position_title:form.position_title',
    'employment_type:form.employment_type',
    'workplace_type:form.workplace_type',
    'location:form.location',
    'proposed_start_date:form.proposed_start_date',
    'compensation_amount:form.compensation_amount',
    'compensation_currency:form.compensation_currency',
    'compensation_period:form.compensation_period',
    'response_deadline:form.response_deadline',
    'note:form.note',
  ]) assert.ok(source.includes(field));
  assert.ok(source.includes("delete next[applicationId]"));
});

test('Job Offer workspace preserves respond and withdraw mutation contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/job-offers',{method:'PATCH'"));
  assert.ok(source.includes("JSON.stringify({offer_id:offerId,action,status})"));
  assert.ok(source.includes("mutateOffer(pending.id,'respond','accepted')"));
  assert.ok(source.includes("mutateOffer(pending.id,'respond','declined')"));
  assert.ok(source.includes("mutateOffer(pending.id,'withdraw')"));

  assert.ok(offersRoute.includes("if (action === 'respond')"));
  assert.ok(offersRoute.includes("if (context.mode !== 'professional')"));
  assert.ok(offersRoute.includes("if (!['accepted', 'declined'].includes(status))"));
  assert.ok(offersRoute.includes("if (action === 'withdraw')"));
  assert.ok(offersRoute.includes("if (context.mode !== 'business')"));
});

test('Job Offer workspace preserves offer eligibility, immutability and expiry UI rules', () => {
  assert.ok(source.includes("application.status==='interview'&&!pending"));
  assert.ok(source.includes("const pending=offers.find((offer)=>offer.status==='pending')"));
  assert.ok(source.includes("function expired(offer:Offer)"));
  assert.ok(source.includes("expired(pending)?"));
  assert.ok(source.includes("offers.filter((offer)=>offer.id!==pending?.id)"));

  assert.ok(offersRoute.includes("if (application.status !== 'interview')"));
  assert.ok(offersRoute.includes(".eq('status', 'pending')"));
  assert.ok(translations.includes('Issued terms are immutable.'));
  assert.ok(translations.includes('withdraw it and issue a revised offer'));
});

test('Employment-offer compensation remains informational and does not activate finance flows', () => {
  assert.ok(translations.includes('employment term only'));
  assert.ok(translations.includes('does not activate Cashfree, payment, payout, settlement, or payroll processing'));
  assert.ok(translations.includes('does not process salary or payroll transfers through this offer flow'));

  for (const term of ['/api/pay', '/api/payment', '/api/refund', '/api/payout', '/api/settlement', 'CashfreeClient', 'createPayment', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
  assert.equal((source.match(/fetch\('\/api\/provider\/job-offers'/g) ?? []).length, 3);
});
