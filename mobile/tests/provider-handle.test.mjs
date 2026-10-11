import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function fixture({ owner = 'owner', scope = 'business', fail = false, handle = 'old-name', ready = false } = {}) {
  const calls = []; let current = handle;
  const code = ts.transpileModule(await readFile(new URL('../lib/provider-handle.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const deps = { './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: 'jwt' } } }) } } }, './api': { apiFetch: async (path, init) => { calls.push([path, init]); if (init.method) { if (fail) throw new Error('Response lost'); current = JSON.parse(init.body).handle; return { result: { handle: current, identity_type: scope } }; } return { context: 'provider', identity_type: scope, handle: current, public_profile_ready: ready }; } } };
  const client = {}; Function('exports', 'require', code)(client, name => deps[name]); return { client, calls };
}
test('handle format and share readiness do not imply a reserved handle is public', async () => {
  const { client } = await fixture(); assert.equal(client.normalizeHandle(' New-Name '), 'new-name');
  for (const input of ['ab', '-name', 'name-', 'two--parts', 'space name', 'x'.repeat(31), '@name']) assert.throws(() => client.normalizeHandle(input));
  assert.equal(client.publicHandleUrl({ handle: 'reserved', public_profile_ready: false }), null); assert.equal(client.publicHandleUrl({ handle: 'ready', public_profile_ready: true }), 'https://www.takeitesee.com/@ready');
});
test('both Provider identities send only handle with JWT and reload confirmed saved state', async () => {
  for (const scope of ['professional', 'business']) {
    const f = await fixture({ scope }); const result = await f.client.saveProviderHandle('owner', scope, 'old-name', 'New-Name'); assert.equal(result.handle, 'new-name');
    const [, init] = f.calls.find(([, init]) => init.method); assert.deepEqual(JSON.parse(init.body), { handle: 'new-name' }); assert.equal(init.accessToken, 'jwt'); assert.equal(f.calls.length, 3);
  }
});
test('wrong account, wrong scope and changed handles cannot write; ambiguous writes never retry', async () => {
  const wrong = await fixture({ owner: 'other' }); await assert.rejects(wrong.client.saveProviderHandle('owner', 'business', 'old-name', 'new-name')); assert.equal(wrong.calls.length, 0);
  for (const [scope, previous] of [['professional', 'old-name'], ['business', 'stale-name']]) { const f = await fixture(); await assert.rejects(f.client.saveProviderHandle('owner', scope, previous, 'new-name')); assert.ok(!f.calls.some(([, init]) => init.method)); }
  const f = await fixture({ fail: true }); await assert.rejects(f.client.saveProviderHandle('owner', 'business', 'old-name', 'new-name'), f.client.HandleSaveUncertainError); assert.equal(f.calls.filter(([, init]) => init.method).length, 1);
});
test('existing handle route propagates native Request to ownership, read and atomic RPC clients', async () => {
  const requests = [], rpc = [], filters = [];
  const request = new Request('https://example.test/api/identity-handle?context=provider', { method: 'PATCH', body: JSON.stringify({ handle: 'new-name' }) });
  const supabase = { rpc: async (name, input) => { rpc.push([name, input]); return { data: { handle: 'new-name' }, error: null }; }, from: (table) => {
    const q = { select: () => q, eq: (k, v) => { filters.push([table,k,v]); return q; }, limit: () => q, maybeSingle: async () => ({ data: table === 'identity_handles' ? { handle: 'old-name' } : table === 'provider_trust_states' ? { status: 'suspended' } : { id: 'business', verified: false }, error: null }) }; return q;
  } };
  const deps = { 'next/server': { NextResponse: { json: body => body } }, '../../../server/auth/session': { productionAuthProvider: { requireProvider: async r => { assert.equal(r, request); return { user_id: 'owner', roles: ['business_owner'] }; } } }, '../../../lib/supabase/server': { createSupabaseServerClient: async r => { requests.push(r); return supabase; } } };
  const code = ts.transpileModule(await readFile(new URL('../../web/app/api/identity-handle/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const routes = {}; Function('exports', 'require', code)(routes, name => deps[name]);
  const get = await routes.GET(request); assert.equal(get.public_profile_ready, false); const patch = await routes.PATCH(request); assert.equal(patch.public_profile_ready, false);
  assert.ok(requests.every(r => r === request)); assert.ok(filters.some(([t,k,v]) => t === 'businesses' && k === 'owner_user_id' && v === 'owner')); assert.deepEqual(rpc, [['set_my_identity_handle', { target_context: 'provider', requested_handle: 'new-name' }]]);
});
