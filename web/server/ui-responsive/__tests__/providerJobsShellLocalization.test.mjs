import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [experience, professional, journey, translations, marketplaceRoute] = await Promise.all([
  readFile(new URL('components/jobs/ProviderJobsExperience.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/ProfessionalJobsWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/HiringJourneyGuide.tsx', root), 'utf8'),
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

test('Provider Jobs shell uses a shared EN/TA catalog with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 35);
  assert.deepEqual(tamilKeys, englishKeys);

  for (const source of [experience, professional, journey]) {
    assert.ok(source.includes('useProviderJobsTranslations'));
    assert.ok(!source.includes("startsWith('ta')"));
    assert.ok(!source.includes('const ta'));
    assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
  }
});

test('Provider Jobs experience preserves provider mode discovery and routing', () => {
  assert.ok(experience.includes("fetch('/api/provider/job-marketplace',{cache:'no-store'})"));
  assert.ok(experience.includes("payload.mode!=='business'&&payload.mode!=='professional'"));
  assert.ok(experience.includes("if(mode==='business')"));
  assert.ok(experience.includes('<EmployerHiringWorkspace/>'));
  assert.ok(experience.includes('return <ProfessionalJobsWorkspace/>'));
  assert.ok(marketplaceRoute.includes("mode: 'professional'"));
  assert.ok(marketplaceRoute.includes("mode: 'business'"));
});

test('Business Jobs shell preserves public jobs, applicant finder and safe deletion destinations', () => {
  assert.ok(experience.includes('href="/jobs"'));
  assert.ok(experience.includes('href="/provider/jobs/applicants"'));
  assert.ok(experience.includes('<SafeJobDeletionPanel/>'));
  assert.ok(experience.includes('<HiringJourneyGuide role="business" />'));
});

test('Professional Jobs shell preserves tab structure and child workspaces', () => {
  assert.ok(professional.includes("useState<ProfessionalJobsTab>('applications')"));
  assert.ok(professional.includes("type ProfessionalJobsTab = 'applications' | 'saved' | 'offers'"));
  assert.ok(professional.includes('id="professional-jobs-applications-tab"'));
  assert.ok(professional.includes('id="professional-jobs-saved-tab"'));
  assert.ok(professional.includes('id="professional-jobs-offers-tab"'));
  assert.ok(professional.includes('<ProviderJobMarketplace />'));
  assert.ok(professional.includes('<SavedJobsWorkspace />'));
  assert.ok(professional.includes('<JobOfferWorkspace />'));
  assert.ok(professional.includes('href="/jobs"'));
  assert.ok(professional.includes('href="/provider/resume"'));
  assert.ok(professional.includes('<HiringJourneyGuide role="professional" />'));
});

test('Hiring Journey keeps offer acceptance as the final Hired gate', () => {
  assert.ok(translations.includes('Hired is finalized only after you accept the offer.'));
  assert.ok(translations.includes('Hired is finalized only after the applicant accepts the offer.'));
  assert.ok(journey.includes("'providerJobs.journey.professional.step.hired'"));
  assert.ok(journey.includes("'providerJobs.journey.business.step.acceptedHired'"));
  assert.ok(!journey.includes('tamil: boolean'));
});

test('Provider Jobs shell localization does not activate finance or recurrence surfaces', () => {
  const sources = [experience, professional, journey].join('\n');
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!sources.includes(term));
  }
});
