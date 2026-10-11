import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
async function compile(path, deps) {
  const code = ts.transpileModule(await readFile(new URL(path, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; Function('exports', 'require', code)(exports, (name) => { assert.ok(name in deps, name); return deps[name]; }); return exports;
}
const categories = [{ id: 'specialty', name: 'Web Development', code: 'web', application_id: 'services', parent_id: 'group' }];
const options = { applications: [{ id: 'services', code: 'services' }, { id: 'jobs', code: 'jobs' }], categories: [{ id: 'group', name: 'IT', code: 'it', application_id: 'services', parent_id: null }, ...categories, { id: 'job-category', name: 'Jobs', code: 'job', application_id: 'jobs', parent_id: null }] };
const draft = { name: ' Website ', description: ' Build a website ', categoryId: 'specialty', location: ' Trichy ', duration: '60', price: '1500.50', currency: 'INR' };
async function fixture({ scope = 'business', owner = 'owner', services = null, fail = false } = {}) {
  const calls = [];
  const service = { id: 'owned', provider_type: scope, name: 'Website', description: 'Build a website', category: 'Web Development', location: 'Trichy', duration_minutes: 60, base_price: 1500.5, currency: 'INR', status: 'draft' };
  const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: 'owner-jwt' } }, error: null }) }, rpc: async (name) => { assert.equal(name, 'get_provider_launch_options'); return { data: options, error: null }; } };
  const apiFetch = async (path, init) => { calls.push([path, init]); if (fail) throw new Error('Network response lost'); return init.method ? { service } : { services: services ?? [service] }; };
  return { client: await compile('lib/provider-services.ts', { './api': { apiFetch, ApiError: class extends Error {} }, './supabase': { supabase } }), calls };
}
test('service category choices are Services-only leaves, and drafts validate numeric inputs without converting blank price to zero', async () => {
  const f = await fixture(); assert.deepEqual(f.client.serviceCategories(options), categories);
  assert.deepEqual(await f.client.fetchServiceCategories('owner'), categories);
  const input = f.client.serviceInput(draft, categories, true); assert.equal(input.base_price, 1500.5); assert.equal(input.status, 'draft'); assert.equal(input.name, 'Website');
  for (const bad of [{ price: '' }, { price: 'Infinity' }, { price: '-1' }, { price: '1.001' }, { duration: '0' }, { duration: '2.5' }, { categoryId: 'group' }, { categoryId: 'job-category' }, { currency: 'EUR' }]) assert.throws(() => f.client.serviceInput({ ...draft, ...bad }, categories, true));
});
test('both Provider types create drafts with native JWT and edit only existing owned services without changing status', async () => {
  for (const scope of ['professional', 'business']) {
    const f = await fixture({ scope }); await f.client.saveOwnedService('owner', scope, draft, categories);
    const create = f.calls[0]; assert.equal(create[1].method, 'POST'); assert.equal(create[1].accessToken, 'owner-jwt'); assert.equal(JSON.parse(create[1].body).status, 'draft');
    await f.client.saveOwnedService('owner', scope, { ...draft, categoryId: '' }, categories, 'owned');
    const patch = f.calls.find(([, init]) => init.method === 'PATCH'); const body = JSON.parse(patch[1].body);
    assert.equal(patch[0], '/api/provider/services/owned'); assert.equal('status' in body, false); assert.equal('category_id' in body, false);
    for (const key of ['professional_id', 'business_id', 'provider_type', 'active']) assert.equal(key in body, false);
  }
});
test('wrong-user, wrong Provider type and unowned ids cannot submit writes; uncertain failures do not auto-retry', async () => {
  const wrong = await fixture({ owner: 'other' }); await assert.rejects(wrong.client.saveOwnedService('owner', 'business', draft, categories)); assert.equal(wrong.calls.length, 0);
  const unowned = await fixture({ services: [] }); await assert.rejects(unowned.client.saveOwnedService('owner', 'business', draft, categories, 'other')); assert.ok(!unowned.calls.some(([, init]) => init.method === 'PATCH'));
  const mismatch = await fixture({ scope: 'professional' }); await assert.rejects(mismatch.client.fetchOwnedServices('owner', 'business'));
  const failure = await fixture({ fail: true }); await assert.rejects(failure.client.saveOwnedService('owner', 'business', draft, categories), failure.client.ServiceSaveUncertainError); assert.equal(failure.calls.length, 1);
});
async function repositoryFixture(scope, verified = true) {
  const clients = [], queries = [], mutations = []; const request = new Request('https://example.test', { headers: { Authorization: 'Bearer native-jwt' } });
  const profile = { id: 'provider-id', verified, legal_name: 'Name', principal_address: 'Address', public_contact_email: 'email', public_contact_phone: 'phone', grievance_officer_name: 'Name', grievance_officer_designation: 'Officer', grievance_email: 'email', grievance_phone: 'phone' };
  const row = { id: 'owned', provider_type: scope, professional_id: scope === 'professional' ? profile.id : null, business_id: scope === 'business' ? profile.id : null, name: 'Service', description: 'Description', duration_minutes: 60, base_price: 100, currency: 'INR', status: 'draft' };
  const client = {
    rpc: async (name) => ({ data: name === 'provider_current_trust_status' ? 'normal' : true, error: null }),
    from: (table) => {
      const filters = []; queries.push([table, filters]); let input;
      const result = () => ({ data: table === 'professional_profiles' || table === 'businesses' ? profile : table === 'platform_applications' ? { id: 'services', code: 'services' } : table === 'platform_categories' ? (filters.some(([key]) => key === 'parent_id') ? null : categories[0]) : input ? { ...row, ...input } : [row], error: null });
      const q = { select: () => q, eq: (key, value) => { filters.push([key, value]); return q; }, limit: () => q, order: () => q,
        insert: (data) => { input = data; mutations.push(['insert', data, filters]); return q; }, update: (data) => { input = data; mutations.push(['update', data, filters]); return q; },
        maybeSingle: async () => result(), single: async () => result(), then: (resolve) => Promise.resolve(result()).then(resolve) }; return q;
    },
  };
  const exports = await compile('../web/server/provider-services/repository.ts', { '../../lib/supabase/server': { createSupabaseServerClient: async (r) => { clients.push(r); return client; } }, '../config': { assertProductionBackendConfigured: () => {} } });
  return { repo: exports.productionProviderServiceRepository, request, clients, queries, mutations, session: { user_id: 'owner', roles: [scope === 'professional' ? 'professional' : 'business_owner'] } };
}
test('server list/create/edit propagate native request through ownership, trust, category and write clients for both Provider types', async () => {
  for (const scope of ['professional', 'business']) {
    const f = await repositoryFixture(scope); const input = { name: 'Service', description: 'Description', category_id: 'specialty', duration_minutes: 60, base_price: 100, status: 'draft' };
    await f.repo.list(f.session, f.request); await f.repo.create(f.session, input, f.request); await f.repo.update(f.session, 'owned', { name: 'Updated' }, f.request);
    assert.ok(f.clients.length >= 9); assert.ok(f.clients.every((r) => r === f.request));
    const write = f.mutations.find(([mode]) => mode === 'update'); assert.ok(write[2].some(([key, value]) => key === (scope === 'professional' ? 'professional_id' : 'business_id') && value === 'provider-id'));
    assert.ok(write[2].some(([key, value]) => key === 'id' && value === 'owned'));
    assert.equal(f.mutations[0][1].provider_type, scope); assert.equal(f.mutations[0][1].active, false);
  }
});
test('existing publish verification gate still rejects activation before any mutation', async () => {
  const f = await repositoryFixture('business', false); await assert.rejects(f.repo.update(f.session, 'owned', { status: 'active' }, f.request), /verification is required/); assert.equal(f.mutations.length, 0);
});
test('existing service API routes forward the authenticated Request to repository list/create/update', async () => {
  const calls = [], session = { user_id: 'owner', roles: ['business_owner'] };
  const dependencies = {
    'next/server': { NextResponse: { json: (body) => body } },
    '../../../../server/auth/session': { productionAuthProvider: { requireProvider: async () => session } },
    '../../../../server/marketplace/provider-public-discoverability': { loadPublicServiceIds: async () => new Set() },
    '../../../../server/provider-services/repository': { productionProviderServiceRepository: { list: async (...args) => { calls.push(['list', args]); return []; }, create: async (...args) => { calls.push(['create', args]); return {}; } } },
  };
  const routes = await compile('../web/app/api/provider/services/route.ts', dependencies);
  const get = new Request('https://example.test', { headers: { Authorization: 'Bearer token' } });
  const post = new Request('https://example.test', { method: 'POST', body: JSON.stringify({ name: 'New' }) });
  await routes.GET(get); await routes.POST(post);
  const patchRoute = await compile('../web/app/api/provider/services/[serviceId]/route.ts', {
    'next/server': dependencies['next/server'],
    '../../../../../server/auth/session': dependencies['../../../../server/auth/session'],
    '../../../../../server/provider-services/repository': { productionProviderServiceRepository: { update: async (...args) => { calls.push(['update', args]); return {}; } } },
  });
  const patch = new Request('https://example.test', { method: 'PATCH', body: JSON.stringify({ name: 'Updated' }) });
  await patchRoute.PATCH(patch, { params: Promise.resolve({ serviceId: 'owned' }) });
  assert.equal(calls[0][1][1], get); assert.equal(calls[1][1][2], post); assert.equal(calls[2][1][3], patch);
  assert.equal(calls[2][1][1], 'owned'); assert.ok(calls.every(([, args]) => args[0] === session));
});
