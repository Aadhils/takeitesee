import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const original = { service_id: 'owned', mode: 'on_request', timezone: 'Asia/Kolkata', weekly_windows: [], blackout_periods: [{ starts_at: '2026-12-01T00:00:00Z', ends_at: '2026-12-02T00:00:00Z', reason: 'Closed' }] };
const draft = { ...original, mode: 'scheduled', weekly_windows: [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }] };
async function fixture({ owner = 'owner', owned = true, latest = original, fail = false } = {}) {
  const calls = [];
  const code = ts.transpileModule(await readFile(new URL('lib/provider-weekly-schedule.ts', root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const deps = { './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: 'jwt' } } }) } } }, './provider-services': { fetchOwnedServices: async () => owned ? [{ id: 'owned' }] : [] }, './api': { apiFetch: async (path, init) => { calls.push([path, init]); if (init.method && fail) throw new Error('Partial write'); return { availability: init.method ? draft : latest }; } } };
  const client = {}; Function('exports', 'require', code)(client, name => deps[name]); return { client, calls };
}
test('weekly validation rejects missing hours, invalid weekday/time, overnight and overlaps; adjacent windows allowed', async () => {
  const { client } = await fixture(); client.validateWeeklySchedule(draft);
  for (const windows of [[], [{ day_of_week: 7, start_time: '09:00', end_time: '10:00' }], [{ day_of_week: 0, start_time: '24:00', end_time: '25:00' }], [{ day_of_week: 0, start_time: '17:00', end_time: '09:00' }], [...draft.weekly_windows, { day_of_week: 1, start_time: '16:00', end_time: '18:00' }]]) assert.throws(() => client.validateWeeklySchedule({ ...draft, weekly_windows: windows }));
  client.validateWeeklySchedule({ ...draft, weekly_windows: [...draft.weekly_windows, { day_of_week: 1, start_time: '17:00:00', end_time: '18:00' }] });
});
test('both Provider scopes send authenticated hours and preserve saved timezone and blackouts instead of draft alterations', async () => {
  for (const scope of ['professional', 'business']) {
    const f = await fixture(); await f.client.saveWeeklySchedule('owner', scope, original, { ...draft, blackout_periods: [] });
    const [, init] = f.calls.find(([, init]) => init.method === 'PUT'); const body = JSON.parse(init.body);
    assert.equal(init.accessToken, 'jwt'); assert.equal(body.timezone, original.timezone); assert.deepEqual(body.blackout_periods, original.blackout_periods); assert.deepEqual(body.weekly_windows, draft.weekly_windows);
  }
});
test('changed schedules, unowned services, wrong account and timezone changes stop before PUT', async () => {
  for (const options of [{ latest: { ...original, mode: 'always_available' } }, { owned: false }, { owner: 'other' }]) {
    const f = await fixture(options); await assert.rejects(f.client.saveWeeklySchedule('owner', 'business', original, draft)); assert.ok(!f.calls.some(([, init]) => init.method));
  }
  const f = await fixture(); await assert.rejects(f.client.saveWeeklySchedule('owner', 'business', original, { ...draft, timezone: 'UTC' })); assert.equal(f.calls.length, 0);
});
test('ambiguous PUT failure requires reload and never automatically retries', async () => {
  const f = await fixture({ fail: true }); await assert.rejects(f.client.saveWeeklySchedule('owner', 'professional', original, draft), f.client.ScheduleSaveUncertainError); assert.equal(f.calls.filter(([, init]) => init.method).length, 1);
});
test('native navigation and quick mode refresh expose weekly editor; authenticated Request reaches all repository clients', async () => {
  const [menu, quick, repo, route, screen] = await Promise.all(['lib/workspace-menu.ts', 'app/provider-service-availability.tsx', '../web/server/provider-availability/repository.ts', '../web/app/api/provider/services/[serviceId]/availability/route.ts', 'app/provider-schedule.tsx'].map(path => readFile(new URL(path, root), 'utf8')));
  assert.match(menu, /path: '\/provider-schedule'/); assert.match(quick, /useFocusEffect\(useCallback/); assert.match(quick, /pathname: '\/provider-schedule'/);
  assert.equal((repo.match(/createSupabaseServerClient\(\)/g) ?? []).length, 0); assert.match(repo, /this.get\(session, serviceId, request\)/); assert.match(route, /get\(session, serviceId as EntityId, request\)/); assert.match(route, /save\(session, serviceId as EntityId, input, request\)/);
  assert.match(screen, /epoch.current === version/); assert.match(screen, /ScheduleSaveUncertainError/); assert.match(screen, /visible.needsReload/);
});
