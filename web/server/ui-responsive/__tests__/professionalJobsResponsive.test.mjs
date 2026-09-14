import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [jobsRoute, applicationsRoute, experienceSource, professionalSource, marketplaceSource, savedSource, offerSource, responsiveCss] = await Promise.all([
  readFile(new URL('app/provider/jobs/page.tsx', root), 'utf8'),
  readFile(new URL('app/provider/jobs/applications/page.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/ProviderJobsExperience.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/ProfessionalJobsWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/ProviderJobMarketplace.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/SavedJobsWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/JobOfferWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/ProfessionalJobsResponsive.module.css', root), 'utf8'),
]);

test('shared Provider Jobs route remains role-aware while Professional workspace gets scoped responsive polish', () => {
  assert.ok(jobsRoute.includes('<ProviderJobsExperience />'));
  assert.ok(experienceSource.includes("if(mode==='business')"));
  assert.ok(experienceSource.includes('<EmployerHiringWorkspace/>'));
  assert.ok(experienceSource.includes('return <ProfessionalJobsWorkspace/>'));
  assert.ok(professionalSource.includes('ProfessionalJobsResponsive.module.css'));
  assert.ok(professionalSource.includes('professionalJobsJourney'));
});

test('Professional Jobs keeps applications, saved jobs and offers tab semantics', () => {
  assert.ok(professionalSource.includes("type ProfessionalJobsTab = 'applications' | 'saved' | 'offers'"));
  assert.ok(professionalSource.includes('role="tablist"'));
  assert.ok(professionalSource.includes('role="tab"'));
  assert.ok(professionalSource.includes('role="tabpanel"'));
  assert.ok(professionalSource.includes('<ProviderJobMarketplace />'));
  assert.ok(professionalSource.includes('<SavedJobsWorkspace />'));
  assert.ok(professionalSource.includes('<JobOfferWorkspace />'));
});

test('direct Professional applications route preserves role guard and responsive wrapper', () => {
  assert.ok(applicationsRoute.includes('getProviderSessionOrNull'));
  assert.ok(applicationsRoute.includes("session.roles.includes('professional')"));
  assert.ok(applicationsRoute.includes("redirect('/provider/jobs')"));
  assert.ok(applicationsRoute.includes('ProfessionalJobsResponsive.module.css'));
  assert.ok(applicationsRoute.includes('professionalJobsJourney'));
  assert.ok(applicationsRoute.includes('<ProviderJobMarketplace />'));
});

test('Professional Jobs responsive contract covers narrow-screen text, tabs, controls and bottom navigation', () => {
  assert.ok(responsiveCss.includes('overflow-x: clip'));
  assert.ok(responsiveCss.includes('overflow-wrap: anywhere'));
  assert.ok(responsiveCss.includes('word-break: break-all'));
  assert.ok(responsiveCss.includes("[role='tab']"));
  assert.ok(responsiveCss.includes('min-height: 44px'));
  assert.ok(responsiveCss.includes('font-size: 16px'));
  assert.ok(responsiveCss.includes('max-width: 760px'));
  assert.ok(responsiveCss.includes('max-width: 560px'));
  assert.ok(responsiveCss.includes('safe-area-inset-bottom'));
});

test('Professional Jobs data and lifecycle contracts remain present', () => {
  assert.ok(marketplaceSource.includes("fetch('/api/provider/job-marketplace'"));
  assert.ok(marketplaceSource.includes("fetch('/api/provider/job-interviews'"));
  assert.ok(marketplaceSource.includes('<ApplicationWithdrawalControl'));
  assert.ok(savedSource.includes("fetch('/api/provider/saved-jobs'"));
  assert.ok(savedSource.includes("method: 'DELETE'"));
  assert.ok(offerSource.includes("fetch('/api/provider/job-offers'"));
  assert.ok(offerSource.includes("action:'respond'"));
  assert.ok(offerSource.includes("'accepted'"));
  assert.ok(offerSource.includes("'declined'"));
});
