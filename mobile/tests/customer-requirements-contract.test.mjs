import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const normalizeNewlines = (value) => value.replace(/\r\n/g, '\n');
const [requirementsClient, requirementsList, requirementDetail, mobileNav] = await Promise.all([
  readFile(new URL('lib/requirements.ts', root), 'utf8'),
  readFile(new URL('app/requirements.tsx', root), 'utf8'),
  readFile(new URL('app/requirements/[requirementId].tsx', root), 'utf8'),
  readFile(new URL('components/MobileNav.tsx', root), 'utf8'),
]);

test('Customer requirements list and detail reuse frozen bearer API routes', () => {
  const normalizedRequirementsClient = normalizeNewlines(requirementsClient);
  assert.ok(normalizedRequirementsClient.includes("apiFetch<{\n    requirements: CustomerRequirementSummary[];"));
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

test('central request navigation is authenticated and active on requirement detail routes', () => {
  const definition = mobileNav.split('const items = ')[1].split(' as const;')[0];
  const items = Function('return (' + definition + ')')();
  assert.equal(items.find((item) => item.href === '/request-service')?.auth, true);
  assert.ok(mobileNav.includes("item.href === '/request-service' && pathname.startsWith('/requirements')"));
});

test('selected one-time requirements open the server-linked Customer conversation', () => {
  assert.ok(requirementDetail.includes("requirement.schedule_pattern === 'one_time' && requirement.accepted_proposal_id && data.conversation_id ?"));
  assert.ok(requirementDetail.includes("pathname: '/messages/[conversationId]'"));
  assert.ok(requirementDetail.includes("conversationId: data.conversation_id, workspace: 'customer'"));
  assert.ok(requirementDetail.includes('Open conversation →'));
});

test('missing requirement links recover to the list instead of an endless loading screen', () => {
  const guard = requirementDetail.split('  if (!requirementId) {')[1]?.split('\n  return (')[0];
  assert.ok(guard, 'a missing-ID render guard must exist');
  assert.ok(guard.includes('Requirement link unavailable'));
  assert.ok(guard.includes('href="/requirements"'));
  assert.ok(!guard.includes('<ActivityIndicator'));
  assert.ok(requirementDetail.includes("firstParam(params.requirementId)?.trim() ?? ''"));
});

test('requirement fetches and decisions ignore results from a previous route context', () => {
  assert.ok(requirementDetail.includes('const version = ++requestVersion.current'));
  assert.ok(requirementDetail.includes('return () => { requestVersion.current += 1; }'));
  assert.ok(requirementDetail.includes("state.status === 'ready' && state.data.requirement.id === requirementId"));
  assert.ok(requirementDetail.includes('state.data.requirement.id !== requirementId || busyProposalId'));
  assert.ok(requirementDetail.includes('await decideCustomerRequirementProposal(requirementId, proposal.id, decision);\n      if (version !== requestVersion.current) return;'));
});
