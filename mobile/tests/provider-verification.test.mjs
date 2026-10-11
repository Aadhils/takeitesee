import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
async function compile(path, deps) { const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText; const exports = {}; Function('exports', 'require', code)(exports, name => deps[name]); return exports; }
async function fixture(owner = 'owner') {
  const calls = []; const client = await compile('../lib/provider-verification.ts', { './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: 'jwt' } } }) } } }, './api': { apiFetch: async (...args) => { calls.push(args); return payload('business'); } } }); return { client, calls };
}
function payload(scope) { return { provider: { id: 'owned', provider_type: scope, display_name: 'Provider', verified: false, marketplace_disclosure_complete: false, missing_disclosure_fields: ['legal_name'], disclosure: { legal_name: 'Private' } }, requests: [{ id: 'mine', provider_type: scope, professional_id: scope === 'professional' ? 'owned' : null, business_id: scope === 'business' ? 'owned' : null, status: 'changes_requested', review_note: 'Update evidence', created_at: '2026-10-01', evidence_reference: 'Private' }, { id: 'other', provider_type: scope, professional_id: 'other', business_id: 'other', status: 'approved' }], documents: [{ verification_request_id: 'mine', status: 'active', original_filename: 'Private.pdf' }, { verification_request_id: 'mine', status: 'deleted' }, { verification_request_id: 'other', status: 'active' }] }; }
test('both Provider summaries retain only owned request status, reviewer notes and active document counts', async () => {
  const { client } = await fixture(); for (const scope of ['professional', 'business']) { const result = client.summarizeVerification(payload(scope), scope, 'owned'); assert.equal(result.requests.length, 1); assert.equal(result.requests[0].documentCount, 1); assert.equal(result.requests[0].note, 'Update evidence'); assert.equal(result.verified, false); assert.equal(JSON.stringify(result).includes('Private'), false); }
  assert.equal(client.verificationStatusLabel('unrecognized'), 'Status unavailable'); assert.throws(() => client.summarizeVerification(payload('business'), 'professional')); assert.throws(() => client.summarizeVerification(payload('business'), 'business', 'other'));
});
test('native read uses JWT and wrong owner never requests verification data', async () => {
  const f = await fixture(); await f.client.fetchVerificationStatus('owner', 'business'); assert.equal(f.calls[0][1].accessToken, 'jwt'); assert.equal(f.calls[0][1].method, undefined);
  const wrong = await fixture('other'); await assert.rejects(wrong.client.fetchVerificationStatus('owner', 'business')); assert.equal(wrong.calls.length, 0);
});
test('verification GET forwards native Request and preserves applicant ownership queries for both Provider types', async () => {
  for (const scope of ['professional', 'business']) {
    const requests = [], filters = []; const request = new Request('https://example.test/api/provider/verification');
    const supabase = { from: table => { const q = { select: () => q, eq: (key,value) => { filters.push([table,key,value]); return q; }, limit: () => q, order: () => q, maybeSingle: async () => ({ data: { id: 'owned', name: 'Name', headline: 'Name', verified: false }, error: null }), then: resolve => Promise.resolve({ data: [], error: null }).then(resolve) }; return q; } };
    const routes = await compile('../../web/app/api/provider/verification/route.ts', { 'next/server': { NextResponse: { json: body => body } }, '../../../../server/auth/session': { productionAuthProvider: { requireProvider: async r => { assert.equal(r, request); return { user_id: 'owner', roles: [scope === 'professional' ? 'professional' : 'business_owner'] }; } } }, '../../../../lib/supabase/server': { createSupabaseServerClient: async r => { requests.push(r); return supabase; } } });
    const result = await routes.GET(request); assert.equal(result.provider.provider_type, scope); assert.deepEqual(requests, [request]);
    for (const table of ['provider_verification_requests','provider_verification_documents']) assert.ok(filters.some(([t,k,v]) => t === table && k === 'applicant_user_id' && v === 'owner'));
  }
});
