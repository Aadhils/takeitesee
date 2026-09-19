import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderRequirementLeadsManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/OperationalTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Leads uses shared operational localization instead of local Tamil branching', () => {
  assert.ok(source.includes('useOperationalTranslations'));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('tamil ?'));
  assert.ok(!source.includes('WEEKDAY_NAMES'));

  const keys = [...new Set([...source.matchAll(/t\('(lead\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 50, 'expected shared Provider Leads localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Leads preserves requirement and proposal API contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/requirement-leads', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/requirement-leads', { method: 'PATCH', cache: 'no-store' })"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes('/api/provider/requirement-proposals/${encodeURIComponent(proposal.id)}'));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("action: 'withdraw'"));
  assert.ok(source.includes('pricing_basis'));
  assert.ok(source.includes('matching_service_id'));
});

test('Provider Leads preserves deep-link focus, award actions and conversation routing', () => {
  assert.ok(source.includes("params.get('requirement')"));
  assert.ok(source.includes("params.get('proposal')"));
  assert.ok(source.includes('provider-targeted-lead'));
  assert.ok(source.includes('provider-targeted-proposal'));
  assert.ok(source.includes('href="/provider/bookings"'));
  assert.ok(source.includes('/provider/messages?conversation='));
  assert.ok(source.includes("proposal.status === 'accepted'"));
});
