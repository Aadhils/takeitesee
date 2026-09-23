import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [client, providerScreen] = await Promise.all([
  readFile(new URL('lib/provider-leads.ts', root), 'utf8'),
  readFile(new URL('app/provider.tsx', root), 'utf8'),
]);

test('Provider leads native flow reuses the frozen bearer endpoint for list seen and proposal submit', () => {
  assert.ok(client.includes("'/api/provider/requirement-leads'"));
  assert.ok(client.includes("method: 'GET'"));
  assert.ok(client.includes("method: 'PATCH'"));
  assert.ok(client.includes("method: 'POST'"));
  assert.ok(client.includes('accessToken'));
  assert.ok(providerScreen.includes('fetchProviderRequirementLeads()'));
  assert.ok(providerScreen.includes('markProviderRequirementLeadsSeen()'));
});

test('native proposal submission is hard-limited to one-time per-occurrence proposals', () => {
  assert.ok(client.includes("pricing_basis: 'per_occurrence'"));
  assert.ok(providerScreen.includes("lead.schedule_pattern !== 'one_time'"));
  assert.ok(providerScreen.includes("lead.schedule_pattern === 'recurring'"));
  assert.ok(providerScreen.includes('Recurring lead · read-only in native v1'));
  assert.ok(providerScreen.includes('submitOneTimeRequirementProposal'));
});

test('proposal validation preserves server amount and message constraints before submit', () => {
  assert.ok(providerScreen.includes('!Number.isFinite(amount) || amount <= 0'));
  assert.ok(providerScreen.includes('message.length < 20 || message.length > 2000'));
  assert.ok(providerScreen.includes('amountMinor: Math.round(amount * 100)'));
  assert.ok(client.includes('message: input.message.trim()'));
});

test('provider native slice does not add withdrawal booking recovery or finance actions', () => {
  const combined = `${client}\n${providerScreen}`.toLowerCase();
  for (const forbidden of [
    '/api/provider/requirement-proposals',
    '/recovery',
    '/job',
    'cashfree',
    'refund',
    'payout',
    'settlement',
    'reconciliation',
    'requirementoccurrencerecoverypanel',
  ]) {
    assert.ok(!combined.includes(forbidden), `unexpected out-of-scope provider action: ${forbidden}`);
  }
});

test('Provider workspace remains gated only by server-returned provider roles', () => {
  assert.ok(providerScreen.includes("auth.identity.roles.includes('professional')"));
  assert.ok(providerScreen.includes("auth.identity.roles.includes('business_owner')"));
  assert.ok(providerScreen.includes('if (!hasProviderAccess) return <Redirect href="/home" />'));
});
