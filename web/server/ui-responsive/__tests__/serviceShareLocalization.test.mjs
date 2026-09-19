import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, detail] = await Promise.all([
  readFile(new URL('components/detail/ServiceShareAction.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
  readFile(new URL('components/detail/LiveServiceDetail.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

test('Service share action uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));
  for (const key of ['publicProvider.serviceShare.byProvider','publicProvider.serviceShare.onPlatform','publicProvider.serviceShare.shared','publicProvider.serviceShare.copied','publicProvider.serviceShare.action','publicProvider.serviceShare.error']) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Service share action preserves canonical service URL and share payload semantics', () => {
  assert.ok(source.includes('new URL(`/services/${serviceId}`, window.location.origin).toString()'));
  assert.ok(source.includes('title: serviceName'));
  assert.ok(source.includes("replace('{serviceName}', serviceName)"));
  assert.ok(source.includes("replace('{providerName}', providerName)"));
  assert.ok(source.includes('url,'));
});

test('Service share action preserves native share, cancellation and clipboard fallback', () => {
  assert.ok(source.includes("typeof navigator.share === 'function'"));
  assert.ok(source.includes('await navigator.share(shareData)'));
  assert.ok(source.includes("cause instanceof DOMException && cause.name === 'AbortError'"));
  assert.ok(source.includes('navigator.clipboard?.writeText'));
  assert.ok(source.includes("document.execCommand('copy')"));
  assert.ok(source.includes('await copyServiceUrl(url)'));
  assert.ok(source.includes("setStatus('error')"));
  assert.ok(source.includes("setTimeout(() => setStatus('idle'), 3000)"));
});

test('Live service detail still exposes the shared service share action', () => {
  assert.ok(detail.includes('<ServiceShareAction'));
  assert.ok(detail.includes('serviceId={service.id}'));
  assert.ok(detail.includes('serviceName={service.name}'));
  assert.ok(detail.includes('providerName={providerName}'));
});
