import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
async function compile(path, dependencies) {
  const source = await readFile(new URL(path, root), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  Function('exports', 'require', code)(exports, (name) => { assert.ok(name in dependencies, name); return dependencies[name]; });
  return exports;
}
const draft = { name: ' New name ', phone: ' +91 1234567890 ', location: ' Trichy ', description: ' A helpful public description. ' };
async function fixture({ scope = 'customer', owner = 'owner', providerType = scope, patchError = false, zeroRows = false, locationError = false, changedOwner = false } = {}) {
  const writes = []; const api = []; let sessions = 0;
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: changedOwner && sessions++ >= 3 ? 'other' : owner }, access_token: 'owner-jwt' } }, error: null }) },
    from: (table) => {
      let operation = 'read';
      const query = { select: () => query, eq: (key, value) => { assert.equal(value, 'owner'); return query; },
        update: (data) => { operation = 'update'; writes.push([table, data]); return query; },
        upsert: (data) => { operation = 'upsert'; writes.push([table, data]); return query; },
        single: async () => ({ data: zeroRows ? null : table === 'users' ? { id: owner, name: 'Saved name', email: 'test@example.com', phone: '123' } : { user_id: owner }, error: locationError && operation === 'upsert' ? { message: 'failed' } : null }),
        maybeSingle: async () => ({ data: { default_location: 'Saved location' }, error: null }),
      }; return query;
    },
  };
  const apiFetch = async (path, init) => { api.push([path, init]); if (init.method === 'PATCH') { if (patchError) throw new Error('Rejected'); return { result: { provider_type: providerType, provider_id: 'entity' } }; } return { profile: { provider_type: providerType, id: 'entity', display_name: 'Saved Provider', description: 'Saved description', location: 'Trichy' } }; };
  return { client: await compile('lib/profile-details.ts', { './supabase': { supabase }, './api': { apiFetch } }), writes, api };
}
test('profile validation trims input and matches Provider bounds', async () => {
  const { client } = await fixture(); assert.equal(client.validateProfileDraft('business', draft).name, 'New name');
  for (const scope of ['professional', 'business']) {
    for (const input of [{ ...draft, name: 'A' }, { ...draft, location: '' }, { ...draft, description: 'x'.repeat(1201) }]) assert.throws(() => client.validateProfileDraft(scope, input));
  }
  assert.equal(client.validateProfileDraft('customer', { ...draft, location: '', phone: '' }).location, '');
});
test('Customer saves only self-owned name, phone and location, then reloads actual persisted data', async () => {
  const f = await fixture(); const result = await f.client.saveProfileDetails('owner', { scope: 'customer', id: 'owner' }, draft);
  assert.equal(result.name, 'Saved name'); assert.equal(result.location, 'Saved location');
  assert.equal(f.writes.length, 2); assert.equal(f.writes[0][1].name, 'New name'); assert.equal(f.writes[1][1].default_location, 'Trichy');
  for (const [, data] of f.writes) for (const field of ['email', 'role', 'preferred_language', 'notify_booking_updates', 'service_regions']) assert.equal(field in data, false);
});
test('wrong-owner and mismatched Customer ids never mutate data; partial failures never report success', async () => {
  const wrong = await fixture({ owner: 'other' }); await assert.rejects(wrong.client.saveProfileDetails('owner', { scope: 'customer', id: 'owner' }, draft)); assert.equal(wrong.writes.length, 0);
  const mismatch = await fixture(); await assert.rejects(mismatch.client.saveProfileDetails('owner', { scope: 'customer', id: 'other' }, draft)); assert.equal(mismatch.writes.length, 0);
  for (const options of [{ zeroRows: true }, { locationError: true }]) { const f = await fixture(options); await assert.rejects(f.client.saveProfileDetails('owner', { scope: 'customer', id: 'owner' }, draft), /Some changes may have saved/); }
});
test('both Provider types use owned scope and existing Bearer-authenticated profile RPC route', async () => {
  for (const scope of ['professional', 'business']) {
    const f = await fixture({ scope }); const result = await f.client.saveProfileDetails('owner', { scope, id: 'entity' }, draft);
    assert.equal(result.scope, scope); const patch = f.api.find(([, init]) => init.method === 'PATCH');
    assert.equal(patch[1].accessToken, 'owner-jwt'); assert.deepEqual(JSON.parse(patch[1].body), { display_name: 'New name', description: 'A helpful public description.', location: 'Trichy' });
    assert.equal(f.writes.length, 0);
  }
});
test('unavailable Provider scope and changed sessions cannot submit another profile', async () => {
  const f = await fixture({ scope: 'professional', providerType: 'business' }); await assert.rejects(f.client.saveProfileDetails('owner', { scope: 'professional', id: 'entity' }, draft)); assert.ok(!f.api.some(([, init]) => init.method === 'PATCH'));
  const changed = await fixture({ scope: 'business', changedOwner: true }); await assert.rejects(changed.client.saveProfileDetails('owner', { scope: 'business', id: 'entity' }, draft)); assert.ok(!changed.api.some(([, init]) => init.method === 'PATCH'));
  const failed = await fixture({ scope: 'business', patchError: true }); await assert.rejects(failed.client.saveProfileDetails('owner', { scope: 'business', id: 'entity' }, draft));
});
test('Provider server route forwards the exact authenticated request to GET queries and PATCH RPC', async () => {
  for (const scope of ['professional', 'business']) {
    const forwarded = []; const requests = []; const mutations = [];
    const request = new Request('https://example.test/api/provider/profile', { method: 'PATCH', headers: { Authorization: 'Bearer native-jwt', 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: 'Provider', description: 'Description', location: 'Trichy' }) });
    const profile = { id: 'entity', headline: 'Provider', name: 'Provider', service_area: 'Trichy', location: 'Trichy' };
    const client = { from: (table) => { const result = { data: table === 'services' || table === 'business_products' ? [] : table === 'provider_trust_states' ? { status: 'normal' } : profile, error: null }; const q = { select: () => q, eq: () => q, limit: () => q, maybeSingle: async () => result, then: (resolve) => Promise.resolve(result).then(resolve) }; return q; }, rpc: async (name, input) => { mutations.push([name, input]); return { data: { provider_type: scope, provider_id: 'entity' }, error: null }; } };
    const route = await compile('../web/app/api/provider/profile/route.ts', {
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
      '../../../../server/auth/session': { productionAuthProvider: { requireProvider: async (r) => { requests.push(r); return { user_id: 'owner', roles: [scope === 'professional' ? 'professional' : 'business_owner'] }; } } },
      '../../../../lib/supabase/server': { createSupabaseServerClient: async (r) => { forwarded.push(r); return client; } },
    });
    assert.equal((await route.GET(request)).body.profile.provider_type, scope);
    assert.equal((await route.PATCH(request)).status, 200);
    assert.deepEqual(forwarded, [request, request]); assert.deepEqual(requests, [request, request]);
    assert.equal(mutations[0][0], 'update_provider_profile');
  }
});
