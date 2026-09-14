import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, managerSource, cssSource] = await Promise.all([
  readFile(new URL('app/provider/leads/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderRequirementLeadsManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderRequirementLeadsResponsive.module.css', root), 'utf8'),
]);

test('Provider Leads route uses the responsive journey wrapper', () => {
  assert.ok(routeSource.includes('ProviderRequirementLeadsResponsive.module.css'));
  assert.ok(routeSource.includes('className={styles.journey}'));
  assert.ok(routeSource.includes('ProviderRequirementLeadsManager'));
});

test('Provider Leads mobile styles protect density and touch targets', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('@media (max-width: 760px)'));
  assert.ok(cssSource.includes('@media (max-width: 560px)'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('padding-bottom: calc(78px + env(safe-area-inset-bottom, 0px))'));
});

test('Proposal form and accepted next actions stay responsive', () => {
  assert.ok(cssSource.includes(':global(.provider-lead-proposal)'));
  assert.ok(cssSource.includes(':global(.provider-proposal-actions)'));
  assert.ok(cssSource.includes(':global(.provider-award-next-actions-buttons)'));
  assert.ok(cssSource.includes(':global(.field-control)'));
  assert.ok(cssSource.includes('width: 100%'));
});

test('Existing proposal and conversation flows remain present', () => {
  assert.ok(managerSource.includes('submitProposal'));
  assert.ok(managerSource.includes('withdrawProposal'));
  assert.ok(managerSource.includes('pricing_basis'));
  assert.ok(managerSource.includes('/provider/messages?conversation='));
  assert.ok(managerSource.includes('/provider/bookings'));
});
