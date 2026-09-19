import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations, detail] = await Promise.all([
  readFile(new URL('components/detail/SavedServiceAction.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/PublicProviderTranslations.ts', root), 'utf8'),
  readFile(new URL('components/detail/LiveServiceDetail.tsx', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

test('Saved service action uses shared public-provider localization', () => {
  assert.ok(source.includes('usePublicProviderTranslations'));
  assert.ok(source.includes('const { t } = usePublicProviderTranslations()'));
  assert.ok(!source.includes('useLanguage'));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));
  for (const key of ['publicProvider.savedService.signIn','publicProvider.savedService.saved','publicProvider.savedService.save','publicProvider.savedService.loadError','publicProvider.savedService.removeError','publicProvider.savedService.saveError','publicProvider.savedService.updateError']) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
  }
});

test('Saved service action preserves read, auth return and save-toggle API semantics', () => {
  assert.ok(source.includes('`/api/account/saved-services?service_id=${encodeURIComponent(serviceId)}`'));
  assert.ok(source.includes('response.status === 401'));
  assert.ok(source.includes('encodeURIComponent(`/services/${serviceId}`)'));
  assert.ok(source.includes('href={`/login?returnTo=${returnTo}`}'));
  assert.ok(source.includes("fetch('/api/account/saved-services'"));
  assert.ok(source.includes("method: saved ? 'DELETE' : 'POST'"));
  assert.ok(source.includes('JSON.stringify({ service_id: serviceId })'));
  assert.ok(source.includes('setSaved((current) => !current)'));
});

test('Saved service action preserves busy and error behavior', () => {
  assert.ok(source.includes('if (busy) return'));
  assert.ok(source.includes('setBusy(true)'));
  assert.ok(source.includes('setBusy(false)'));
  assert.ok(source.includes('payload.error ||'));
  assert.ok(source.includes('role="alert"'));
});

test('Live service detail still renders saved service action', () => {
  assert.ok(detail.includes('<SavedServiceAction serviceId={service.id} />'));
});
