import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [source, translations] = await Promise.all([
  readFile(new URL('components/provider/ProfessionalPortfolioMediaManager.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
]);

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('Professional Portfolio media manager uses shared identity localization without local bilingual helper', () => {
  assert.ok(source.includes('useIdentityWorkspaceTranslations'));
  assert.ok(!source.includes('const text ='));
  assert.ok(!source.includes('const tamil ='));
  assert.ok(!/[஀-௿]/u.test(source));

  const keys = [...new Set([...source.matchAll(/t\('(provider\.portfolioManager\.[^']+)'\)/g)].map((match) => match[1]))];
  assert.ok(keys.length >= 50, 'expected broad Professional Portfolio media localization coverage');
  for (const key of keys) {
    assert.equal(occurrences(translations, `'${key}':`), 2, `${key} should exist once per locale`);
  }
});

test('Professional Portfolio media manager preserves private storage and upload safeguards', () => {
  assert.ok(source.includes("const BUCKET = 'professional-portfolio-media'"));
  assert.ok(source.includes("const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])"));
  assert.ok(source.includes('const imageMaxBytes = 8 * 1024 * 1024'));
  assert.ok(source.includes('const videoMaxBytes = 25 * 1024 * 1024'));
  assert.ok(source.includes('supabase.auth.getUser()'));
  assert.ok(source.includes('supabase.storage.from(BUCKET).upload(objectPath, file'));
  assert.ok(source.includes('if (objectPath) await supabase.storage.from(BUCKET).remove([objectPath])'));
});

test('Professional Portfolio media manager preserves media API mutation contracts', () => {
  assert.ok(source.includes("fetch('/api/provider/profile/media', { cache: 'no-store' })"));
  assert.ok(source.includes("method: 'POST'"));
  assert.ok(source.includes("method: 'PATCH'"));
  assert.ok(source.includes("method: 'DELETE'"));
  assert.ok(source.includes('professional_role_id: roleId || null'));
  assert.ok(source.includes('body: JSON.stringify({ id: editingId, ...editForm })'));
  assert.ok(source.includes('body: JSON.stringify({ id: item.id })'));
});

test('Professional Portfolio media manager preserves moderation and destructive-action safeguards', () => {
  assert.ok(source.includes("window.confirm(t('provider.portfolioManager.deleteConfirm'))"));
  assert.ok(source.includes("item.moderation_state === 'paused'"));
  assert.ok(source.includes("t('provider.portfolioManager.publicLockedWhilePaused')"));
  assert.ok(source.includes('verified'));
  assert.ok(source.includes('active'));
});
