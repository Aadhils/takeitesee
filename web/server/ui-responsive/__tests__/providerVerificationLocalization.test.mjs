import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProviderVerificationManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/RemainingWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Provider Verification uses shared localization without local Tamil branching', () => {
  assert.ok(source.includes('useRemainingWorkspaceTranslations'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('text('));
  assert.ok(!source.includes("locale === 'ta-IN'"));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(verification\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 75, 'expected broad Provider Verification localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Provider Verification preserves verification and private-document API contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/verification', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/provider/verification', { method: 'POST'"));
  assert.ok(source.includes("fetch('/api/provider/verification', { method: 'PATCH'"));
  assert.ok(source.includes("action: 'withdraw'"));
  assert.ok(source.includes("fetch('/api/provider/verification/documents', { method: 'POST'"));
  assert.ok(source.includes("fetch('/api/provider/verification/documents', { method: 'DELETE'"));
  assert.ok(source.includes("const bucket = 'provider-verification-documents'"));
  assert.ok(source.includes(".storage.from(bucket).upload("));
  assert.ok(source.includes(".storage.from(bucket).remove("));
  assert.ok(source.includes('const maxBytes = 8 * 1024 * 1024'));
});

test('Provider Verification preserves disclosure and verification state semantics', () => {
  assert.ok(source.includes('marketplace_disclosure_complete'));
  assert.ok(source.includes('missing_disclosure_fields'));
  assert.ok(source.includes("item.status === 'pending'"));
  assert.ok(source.includes("payload?.provider.verified && !payload.provider.marketplace_disclosure_complete"));
  assert.ok(source.includes("grievance_officer_designation: 'Grievance Officer'"));
  assert.ok(source.includes("evidence_type: 'government_id'"));
});
