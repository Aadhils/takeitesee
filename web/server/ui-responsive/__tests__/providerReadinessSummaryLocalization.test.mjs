import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [summary, translations] = await Promise.all([
  readFile(new URL('components/account/ProviderReadinessSummary.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'provider.readinessSummary.unableLoad',
  'provider.readinessSummary.unableOpen',
  'provider.readinessSummary.setupStatus',
  'provider.readinessSummary.setupLabel',
  'provider.readinessSummary.live',
  'provider.readinessSummary.suspended',
  'provider.readinessSummary.liveBody',
  'provider.readinessSummary.review',
  'provider.readinessSummary.continue',
  'provider.readinessSummary.progressReady',
  'provider.readinessSummary.trustState',
  'provider.readinessSummary.trustReverificationRequired',
  'provider.readinessSummary.trustSuspended',
];

test('Provider Readiness Summary uses shared Identity Workspace localization with exact EN/TA parity', () => {
  assert.ok(summary.includes('useIdentityWorkspaceTranslations'));
  assert.ok(summary.includes('const { t } = useIdentityWorkspaceTranslations()'));
  assert.ok(!summary.includes('const tamil ='));
  assert.ok(!summary.includes("locale.toLowerCase().startsWith('ta')"));
  assert.ok(!/[஀-௿]/u.test(summary));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(summary.includes("t('" + key + "')"));
  }
  assert.ok(summary.includes("t('profile.professional')"));
  assert.ok(summary.includes("t('profile.business')"));
});

test('Provider Readiness Summary preserves readiness discovery and fallback behavior', () => {
  assert.ok(summary.includes("fetch('/api/account/provider-readiness', { cache: 'no-store' })"));
  assert.ok(summary.includes("payload.error || t('provider.readinessSummary.unableLoad')"));
  assert.ok(summary.includes('setProviders(payload.providers ?? [])'));
  assert.ok(summary.includes('if (loading || (!providers.length && !error)) return null;'));
  assert.ok(summary.includes('role="alert"'));
});

test('Provider Readiness Summary preserves direct Provider navigation and Account workspace switching', () => {
  assert.ok(summary.includes("if (placement === 'provider')"));
  assert.ok(summary.includes('window.location.assign(provider.next_action.href)'));
  assert.ok(summary.includes("fetch('/api/account/workspaces', {"));
  assert.ok(summary.includes("method: 'POST'"));
  assert.ok(summary.includes("headers: { 'content-type': 'application/json' }"));
  assert.ok(summary.includes('body: JSON.stringify({ workspace: provider.provider_type })'));
  assert.ok(summary.includes("payload.error || t('provider.readinessSummary.unableOpen')"));
});

test('Provider Readiness Summary preserves live, trust and progress presentation contracts', () => {
  assert.ok(summary.includes("provider.marketplace_live ? 'success' : provider.trust_status === 'suspended' ? 'danger' : 'warning'"));
  assert.ok(summary.includes("provider.marketplace_live ? t('provider.readinessSummary.live')"));
  assert.ok(summary.includes("t('provider.readinessSummary.liveBody')"));
  assert.ok(summary.includes('provider.next_action.label'));
  assert.ok(summary.includes("provider.marketplace_live ? t('provider.readinessSummary.review') : t('provider.readinessSummary.continue')"));
  assert.ok(summary.includes('loading={opening === provider.provider_type}'));
  assert.ok(summary.includes('disabled={opening !== null && opening !== provider.provider_type}'));
  assert.ok(summary.includes("replace('{percent}', String(provider.progress_percent))"));
  assert.ok(summary.includes('account-readiness-progress'));
  assert.ok(summary.includes("provider.trust_status !== 'normal'"));
  assert.ok(summary.includes("status === 'reverification_required'"));
  assert.ok(summary.includes('provider.trust_reason'));
});

test('Provider Readiness Summary localization does not activate finance or payment behavior', () => {
  assert.ok(!summary.includes('Cashfree'));
  assert.ok(!summary.includes('/api/pay'));
  assert.ok(!summary.includes('refund'));
  assert.ok(!summary.includes('payout'));
  assert.ok(!summary.includes('settlement'));
  assert.ok(!summary.includes('reconciliation'));
});
