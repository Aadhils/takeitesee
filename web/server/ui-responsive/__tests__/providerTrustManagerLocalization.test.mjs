import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, trustRoute, verificationRoute] = await Promise.all([
  readFile(new URL('components/admin/ProviderTrustManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/AdminControlTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/super-admin/provider-trust/route.ts', root), 'utf8'),
  readFile(new URL('app/api/super-admin/provider-verifications/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<AdminControlKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Provider Trust Manager uses shared Admin Control EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 100);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useAdminControlTranslations'));
  assert.ok(source.includes('const { locale, t } = useAdminControlTranslations()'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Provider Trust Manager preserves trust overview load and admin PATCH contract', () => {
  assert.ok(source.includes("fetch('/api/super-admin/provider-trust', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/super-admin/provider-trust', {"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("provider_type: item.provider_type"));
  assert.ok(source.includes("provider_id: item.provider_id"));
  assert.ok(source.includes("action,"));
  assert.ok(source.includes("reason: actionReason"));
  assert.ok(trustRoute.includes('await productionAuthProvider.requireAdmin(request)'));
  assert.ok(trustRoute.includes("supabase.rpc('list_provider_trust_overview')"));
  assert.ok(trustRoute.includes("supabase.rpc('set_provider_trust_state'"));
});

test('Provider Trust Manager preserves required reason and action availability', () => {
  assert.ok(source.includes("if (actionReason.length < 3)"));
  assert.ok(source.includes("act(item, 'require_reverification')"));
  assert.ok(source.includes("act(item, 'suspend')"));
  assert.ok(source.includes("act(item, 'restore')"));
  assert.ok(source.includes("item.status === 'normal'"));
  assert.ok(source.includes("item.status !== 'suspended'"));
  assert.ok(source.includes("item.status === 'suspended'"));
  assert.ok(trustRoute.includes("if (reason.length < 3)"));
});

test('Provider Trust Manager preserves re-verification review path and approval semantics', () => {
  assert.ok(source.includes('href="/super-admin/provider-verifications"'));
  assert.ok(source.includes("item.status === 'reverification_required'"));
  assert.ok(translations.includes('Re-verification returns to Normal only after a fresh verification request is approved.'));
  assert.ok(verificationRoute.includes("supabase.rpc('review_provider_verification'"));
  assert.ok(verificationRoute.includes("decision: input.decision"));
});

test('Provider Trust Manager preserves service pause and no auto-reactivation messaging', () => {
  assert.ok(translations.includes('Restoring trust never auto-reactivates offerings'));
  assert.ok(translations.includes('the Provider must review and activate them again.'));
});

test('Provider Trust Manager localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
