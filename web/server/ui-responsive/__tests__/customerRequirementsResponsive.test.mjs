import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [requirementsPage, workspace, detailSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/requirements/page.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementDetail.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementsManager.tsx', root), 'utf8'),
  readFile(new URL('components/requirements/CustomerRequirementsResponsive.module.css', root), 'utf8'),
]);

test('Customer Requirements list and detail share the responsive journey wrapper', () => {
  assert.ok(requirementsPage.includes("CustomerRequirementsResponsive.module.css"));
  assert.ok(requirementsPage.includes('className={styles.journey}'));
  assert.ok(workspace.includes("CustomerRequirementsResponsive.module.css"));
  assert.ok(workspace.includes('className={styles.detailJourney}'));
  assert.ok(workspace.includes('<CustomerRequirementDetail'));
});

test('Requirements responsive styles protect mobile density and long localized content', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('grid-template-columns: 1fr !important'));
  assert.ok(cssSource.includes('.journey section :global(.policy-card) :global(.button)'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px))'));
});

test('Proposal comparison cards and provider context remain responsive', () => {
  assert.ok(cssSource.includes(':global(.customer-proposal-card)'));
  assert.ok(cssSource.includes(':global(.customer-proposal-statuses)'));
  assert.ok(cssSource.includes(':global(.customer-provider-current-context)'));
  assert.ok(cssSource.includes(':global(.customer-proposal-confirm)'));
  assert.ok(cssSource.includes('justify-content: flex-start'));
  assert.ok(cssSource.includes('max-width: none'));
});

test('Requirement and proposal lifecycle semantics remain present', () => {
  assert.ok(detailSource.includes("decision: 'accept' | 'decline'"));
  assert.ok(detailSource.includes('Selecting ${proposal.provider_display_name} awards this requirement'));
  assert.ok(detailSource.includes('This action does not start a payment'));
  assert.ok(detailSource.includes('conversationId ? `/messages?conversation='));
  assert.ok(managerSource.includes("RequirementStatus = 'open' | 'paused' | 'awarded' | 'fulfilled' | 'cancelled'"));
  assert.ok(managerSource.includes('href={`/requirements/${encodeURIComponent(row.id)}`}'));
});
