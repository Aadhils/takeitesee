import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [experienceSource, employerSource, marketplaceCss, responsiveCss] = await Promise.all([
  readFile(new URL('components/jobs/ProviderJobsExperience.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/EmployerHiringWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/jobs/JobMarketplace.module.css', root), 'utf8'),
  readFile(new URL('components/jobs/BusinessEmployerJobsResponsive.module.css', root), 'utf8'),
]);

test('Business Jobs keeps role-aware routing and scoped responsive wrapper', () => {
  assert.ok(experienceSource.includes("if(mode==='business')"));
  assert.ok(experienceSource.includes('<EmployerHiringWorkspace/>'));
  assert.ok(experienceSource.includes('return <ProfessionalJobsWorkspace/>'));
  assert.ok(experienceSource.includes('BusinessEmployerJobsResponsive.module.css'));
  assert.ok(experienceSource.includes('businessJobsJourney'));
});

test('Business Employer Jobs responsive contract covers narrow-screen text, controls and provider navigation', () => {
  assert.ok(responsiveCss.includes('overflow-x: clip'));
  assert.ok(responsiveCss.includes('overflow-wrap: anywhere'));
  assert.ok(responsiveCss.includes('min-height: 44px'));
  assert.ok(responsiveCss.includes('font-size: 16px'));
  assert.ok(responsiveCss.includes('max-width: 760px'));
  assert.ok(responsiveCss.includes('max-width: 560px'));
  assert.ok(responsiveCss.includes('safe-area-inset-bottom'));
  assert.ok(marketplaceCss.includes('word-break:break-all'));
  assert.ok(marketplaceCss.includes('@media(max-width:420px)'));
  assert.ok(marketplaceCss.includes('.statsGrid{grid-template-columns:1fr}'));
});

test('Business hiring lifecycle contracts remain present', () => {
  assert.ok(employerSource.includes("fetch('/api/provider/job-marketplace'"));
  assert.ok(employerSource.includes("fetch('/api/provider/job-offers'"));
  assert.ok(employerSource.includes("fetch('/api/jobs'"));
  assert.ok(employerSource.includes("fetch('/api/provider/job-interviews'"));
  assert.ok(employerSource.includes("status:'draft'"));
  assert.ok(employerSource.includes("status:'open'"));
  assert.ok(employerSource.includes('EmployerApplicantResumeReview'));
  assert.ok(employerSource.includes('JobOfferWorkspace'));
});

test('Business employer journey keeps public jobs, applicant finder and safe deletion entry points', () => {
  assert.ok(experienceSource.includes('href="/jobs"'));
  assert.ok(experienceSource.includes('href="/provider/jobs/applicants"'));
  assert.ok(experienceSource.includes('<HiringJourneyGuide role="business"'));
  assert.ok(experienceSource.includes('<SafeJobDeletionPanel/>'));
});
