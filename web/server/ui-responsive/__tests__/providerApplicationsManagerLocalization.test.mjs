import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, route] = await Promise.all([
  readFile(new URL('components/admin/ProviderApplicationsManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/AdminControlTranslations.ts', root), 'utf8'),
  readFile(new URL('app/api/super-admin/provider-applications/route.ts', root), 'utf8'),
]);

function catalogKeys(kind) {
  const pattern = kind === 'english'
    ? /const english = \{([\s\S]*?)\} as const;/
    : /const tamil: Record<AdminControlKey, string> = \{([\s\S]*?)\};/;
  const block = translations.match(pattern)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)':/g)].map((match) => match[1]).sort();
}

test('Provider Applications Manager uses shared Admin Control EN/TA localization with exact key parity', () => {
  const englishKeys = catalogKeys('english');
  const tamilKeys = catalogKeys('tamil');
  assert.ok(englishKeys.length >= 110);
  assert.deepEqual(tamilKeys, englishKeys);
  assert.ok(source.includes('useAdminControlTranslations'));
  assert.ok(source.includes('const { locale, t } = useAdminControlTranslations()'));
  assert.ok(!source.includes("startsWith('ta')"));
  assert.ok(!source.includes('const tamil'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!/[\u0B80-\u0BFF]/u.test(source));
});

test('Provider Applications Manager preserves admin GET and PATCH review contract', () => {
  assert.ok(source.includes("fetch('/api/super-admin/provider-applications', { cache: 'no-store' })"));
  assert.ok(source.includes("fetch('/api/super-admin/provider-applications', {"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("body: JSON.stringify({ application_id: application.id, decision, note })"));
  assert.ok(route.includes('await productionAuthProvider.requireAdmin(request)'));
  assert.ok(route.includes("supabase.rpc('review_provider_application'"));
  assert.ok(route.includes("target_application_id: input.application_id"));
  assert.ok(route.includes("decision: input.decision"));
});

test('Provider Applications Manager preserves approve and reject decisions with rejection reason guard', () => {
  assert.ok(source.includes("decision: 'approve' | 'reject'"));
  assert.ok(source.includes("if (decision === 'reject' && note.length < 3)"));
  assert.ok(source.includes("review(application, 'approve')"));
  assert.ok(source.includes("review(application, 'reject')"));
});

test('Provider Applications Manager preserves one-provider-per-account conflict guard', () => {
  assert.ok(source.includes("const identityConflict = application.status === 'pending' && Boolean(professional || business)"));
  assert.ok(source.includes('disabled={busyId === application.id || identityConflict}'));
  assert.ok(source.includes("t('applications.identityConflict')"));
  assert.ok(source.includes("t('applications.identityConflictHelp')"));
  assert.ok(source.includes("t('applications.approvalDisabled')"));
  assert.ok(route.includes("professional_profiles"));
  assert.ok(route.includes("businesses"));
});

test('Provider Applications Manager keeps approval separate from verification', () => {
  assert.ok(translations.includes('Approval activates provider ownership and workspace access. It does not mark the provider verified.'));
});

test('Provider Applications Manager localization does not activate finance or recurrence surfaces', () => {
  for (const term of ['/api/pay', 'CashfreeClient', 'createPayment', 'refund', 'payout', 'settlement', 'reconciliation', '/api/recurrence']) {
    assert.ok(!source.includes(term));
  }
});
