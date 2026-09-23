import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const source = await readFile(new URL('app/api/provider/requirement-leads/route.ts', root), 'utf8');

test('Provider requirement leads uses one bearer-aware Request for auth and Supabase RLS', () => {
  assert.equal((source.match(/productionAuthProvider\.requireProvider\(request\)/g) ?? []).length, 3);
  assert.equal((source.match(/createSupabaseServerClient\(request\)/g) ?? []).length, 3);
  assert.ok(!source.includes('createSupabaseServerClient()'));
});

test('Provider lead read and notification acknowledgement semantics stay unchanged', () => {
  assert.ok(source.includes("supabase.rpc('get_provider_requirement_leads')"));
  assert.ok(source.includes(".from('marketplace_conversations')"));
  assert.ok(source.includes(".eq('provider_user_id', session.user_id)"));
  assert.ok(source.includes(".from('notifications')"));
  assert.ok(source.includes(".in('event_type', ['provider_requirement_match', 'requirement_proposal_accepted'])"));
  assert.ok(source.includes(".is('read_at', null)"));
});

test('Provider proposal validation and RPC payload stay unchanged', () => {
  assert.ok(source.includes("type PricingBasis = 'per_occurrence' | 'whole_requirement'"));
  assert.ok(source.includes("body.pricing_basis === 'whole_requirement' ? 'whole_requirement' : 'per_occurrence'"));
  assert.ok(source.includes('message.length < 20 || message.length > 2000'));
  assert.ok(source.includes("supabase.rpc('provider_submit_requirement_proposal'"));
  assert.ok(source.includes('target_requirement_id: body.requirement_id'));
  assert.ok(source.includes('target_service_id: body.service_id'));
  assert.ok(source.includes('target_amount_minor: body.amount_minor'));
  assert.ok(source.includes('target_message: message'));
  assert.ok(source.includes('target_estimated_start_date: body.estimated_start_date || null'));
  assert.ok(source.includes('target_pricing_basis: pricingBasis'));
});

test('Mobile provider lead auth change stays outside finance and recovery domains', () => {
  const lower = source.toLowerCase();
  for (const forbidden of ['cashfree', 'refund', 'payout', 'settlement', 'reconciliation', 'requirementoccurrencerecoverypanel']) {
    assert.ok(!lower.includes(forbidden), `unexpected frozen-domain reference: ${forbidden}`);
  }
});
