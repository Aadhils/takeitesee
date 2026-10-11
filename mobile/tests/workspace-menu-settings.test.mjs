import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
async function compile(path, dependencies = {}) {
  const code = ts.transpileModule(await read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  Function('exports', 'require', code)(exports, (name) => { assert.ok(name in dependencies, name); return dependencies[name]; });
  return exports;
}
const menu = await compile('lib/workspace-menu.ts');
test('Customer, Professional and Business menus have separate destinations and preserve held boundaries', async () => {
  for (const scope of ['customer', 'professional', 'business']) {
    const items = menu.workspaceMenu(scope).flatMap((group) => group.items);
    assert.equal(items.find((item) => item.label === 'Messages').path, `/messages?workspace=${scope === 'customer' ? 'customer' : 'provider'}`);
    assert.ok(items.some((item) => item.path === '/settings'));
    assert.ok(!items.some((item) => /earnings|orders|products|payment|refund|recovery/.test(item.path)));
    for (const item of items) {
      if (item.web) { assert.ok(menu.workspaceWebUrl(item.path).startsWith('https://www.takeitesee.com/')); await access(new URL(`../../web/app${item.path}/page.tsx`, import.meta.url)); }
      else await access(new URL(`app${item.path.split('?')[0]}.tsx`, root));
    }
    assert.equal(items.some((item) => item.label === 'Portfolio'), scope === 'professional');
    assert.equal(items.some((item) => item.label === 'Hiring & applicants'), scope === 'business');
  }
  for (const path of ['https://attacker.example', '//attacker.example', '/provider/earnings', '/account/security?token=secret']) assert.throws(() => menu.workspaceWebUrl(path));
});
const defaults = { notifyBookingUpdates: true, notifyReviewReminders: true, notifyProductUpdates: false, useHistoryForRecommendations: true };
async function fixture({ owner = 'owner', row = null, error = null, changeOwner = false } = {}) {
  const writes = []; const filters = []; let calls = 0;
  const builder = {
    select: () => builder, eq: (key, value) => { filters.push([key, value]); return builder; },
    maybeSingle: async () => ({ data: row, error }),
    upsert: (data, options) => { writes.push([data, options]); return builder; },
    single: async () => ({ data: row ?? { user_id: owner, notify_booking_updates: false, notify_review_reminders: true, notify_product_updates: false, use_history_for_recommendations: true }, error }),
  };
  const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: changeOwner && calls++ > 0 ? 'other' : owner } } }, error: null }) }, from: (table) => { assert.equal(table, 'customer_profiles'); return builder; } };
  return { client: await compile('lib/account-settings.ts', { './supabase': { supabase } }), writes, filters };
}
test('native settings load self-owned values with web-compatible defaults', async () => {
  const f = await fixture(); assert.deepEqual(await f.client.fetchAccountPreferences('owner'), defaults);
  assert.deepEqual(f.filters, [['user_id', 'owner']]);
  const wrong = await fixture({ owner: 'other' }); await assert.rejects(wrong.client.fetchAccountPreferences('owner')); assert.equal(wrong.filters.length, 0);
});
test('settings save returns confirmed values and patches only preference fields', async () => {
  const f = await fixture(); const result = await f.client.saveAccountPreferences('owner', defaults);
  assert.equal(result.notifyBookingUpdates, false);
  const [payload, options] = f.writes[0]; assert.equal(payload.user_id, 'owner'); assert.deepEqual(options, { onConflict: 'user_id' });
  for (const key of ['name', 'preferred_language', 'service_regions', 'default_location', 'larger_text', 'reduced_motion']) assert.equal(key in payload, false);
});
test('wrong-owner, invalid values, database failures and changed sessions never claim successful saves', async () => {
  const wrong = await fixture({ owner: 'other' }); await assert.rejects(wrong.client.saveAccountPreferences('owner', defaults)); assert.equal(wrong.writes.length, 0);
  const invalid = await fixture(); await assert.rejects(invalid.client.saveAccountPreferences('owner', { ...defaults, notifyBookingUpdates: 'yes' })); assert.equal(invalid.writes.length, 0);
  const failed = await fixture({ error: { message: 'RLS rejected' } }); await assert.rejects(failed.client.saveAccountPreferences('owner', defaults));
  const changed = await fixture({ changeOwner: true }); await assert.rejects(changed.client.saveAccountPreferences('owner', defaults));
});
test('menus and settings guard account changes, focus changes and repeat actions', async () => {
  const [sheet, settings] = await Promise.all([read('components/WorkspaceMenu.tsx'), read('app/settings.tsx')]);
  assert.ok(sheet.includes('openOwner === userId'));
  assert.ok(sheet.includes('workspace.select(scope)'));
  for (const text of ['useFocusEffect', 'state.owner === userId', 'epoch.current === version', 'busy.current', 'Opens website ↗', 'auth.signOut()']) assert.ok(settings.includes(text));
});
