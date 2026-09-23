import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [requirementsClient, requirementsList, requirementDetail, mobileNav] = await Promise.all([
  readFile(new URL('lib/requirements.ts', root), 'utf8'),
  readFile(new URL('app/requirements.tsx', root), 'utf8'),
  readFile(new URL('app/requirements/[requirementId].tsx', root), 'utf8'),
  readFile(new URL('components/MobileNav.tsx', root), 'utf8'),
]);

test('Customer requirements list and detail reuse frozen bearer API routes', () => {
  assert.ok(requirementsClient.includes("apiFetch<{\n    requirements: CustomerRequirementSummary[];"));
  assert.ok(requirementsClient.includes("}>('/api/requirements',"));
  assert.ok(requirementsClient.includes('`/api/requirements/${encodeURIComponent(requirementId)}`'));
  assert.ok(requirementsClient.includes('method: \'GET\''));
  assert.ok(requirementsClient.includes('accessToken'));
  assert.ok(requirementsList.includes('fetchCustomerRequirements()'));
  assert.ok(requirementDetail.includes('fetchCustomerRequirementDetail(requirementId)'));
});

test('proposal decisions stay on the existing accept/decline endpoint with bearer auth', () => {
  assert.ok(requirementsClient.includes("decision: 'accept' | 'decline'"));
  assert.ok(requirementsClient.includes('/proposals/${encodeURIComponent(proposalId)}`'));
  assert.ok(requirementsClient.includes("method: 'PATCH'"));
  assert.ok(requirementsClient.includes('body: JSON.stringify({ decision })'));
  assert.ok(requirementDetail.includes('decideCustomerRequirementProposal(requirementId, proposal.id, decision)'));
});

test('native v1 keeps recurring requirements read-only and does not copy recovery or job workflows', () => {
  assert.ok(requirementDetail.includes("requirement.schedule_pattern !== 'one_time'"));
  assert.ok(requirementDetail.includes("requirement.schedule_pattern === 'recurring'"));
  assert.ok(requirementDetail.includes('Recurring requirement · read-only in native v1'));
  const combined = `${requirementsClient}\n${requirementsList}\n${requirementDetail}`.toLowerCase();
  assert.ok(!combined.includes('/recovery'));
  assert.ok(!combined.includes('/job'));
  assert.ok(!combined.includes('requirementoccurrencerecoverypanel'));
});

test('provider eligibility and public profile context remain server-derived', () => {
  assert.ok(requirementsClient.includes('provider_marketplace_status'));
  assert.ok(requirementsClient.includes('provider_profile_href'));
  assert.ok(requirementsClient.includes('providerParamsFromProfileHref'));
  assert.ok(requirementDetail.includes("proposal.provider_marketplace_status === 'ineligible'"));
  assert.ok(requirementDetail.includes("pathname: '/providers/[providerType]/[providerId]'"));
});

test('Requests navigation is Customer-authenticated and active on requirement detail routes', () => {
  assert.ok(mobileNav.includes("{ href: '/requirements', label: 'Requests', auth: true }"));
  assert.ok(mobileNav.includes("href === '/requirements' && pathname.startsWith('/requirements/')"));
});
