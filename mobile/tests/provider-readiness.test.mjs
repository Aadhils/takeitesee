import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function fixture(owner = 'owner', scope = 'professional', id = 'provider') {
  const profile = { id, provider_type: scope, verified: true, profile_complete: true, marketplace_disclosure_complete: true, trust_status: 'normal' };
  const calls = [];
  const code = ts.transpileModule(await readFile(new URL('../lib/provider-readiness.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const deps = { './api': { apiFetch: async (...args) => { calls.push(args); return { profile }; } }, './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: 'jwt' } } }) } } } };
  const client = {}; Function('exports', 'require', code)(client, name => deps[name]); return { client, profile, calls };
}
test('visibility gates match separate Professional and Business web identity rules; unknown trust fails closed', async () => {
  const f = await fixture(); assert.equal(f.client.readinessGates(f.profile).length, 4);
  for (const trust_status of ['suspended', 'reverification_required', 'unknown']) assert.equal(f.client.readinessGates({ ...f.profile, trust_status }).every(g => g.done), false);
  const business = f.client.readinessGates({ ...f.profile, provider_type: 'business', profile_complete: false }); assert.equal(business.length, 3); assert.ok(business.every(g => g.done));
  assert.ok(!f.client.readinessGates({ ...f.profile, verified: false }).every(g => g.done));
});
test('readiness reads with JWT and rejects wrong accounts, Provider type and known entity mismatch', async () => {
  const f = await fixture(); await f.client.fetchProviderReadiness('owner', 'professional', 'provider'); assert.equal(f.calls[0][1].accessToken, 'jwt'); assert.equal(f.calls[0][1].method, undefined);
  const wrong = await fixture('other'); await assert.rejects(wrong.client.fetchProviderReadiness('owner', 'professional')); assert.equal(wrong.calls.length, 0);
  await assert.rejects(f.client.fetchProviderReadiness('owner', 'business')); await assert.rejects(f.client.fetchProviderReadiness('owner', 'professional', 'other'));
});
