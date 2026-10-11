import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const root = new URL('../lib/', import.meta.url);
async function compile(path, dependencies = {}) {
  const source = await readFile(new URL(path, root), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  Function('exports', 'require', code)(exports, (name) => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; });
  return exports;
}
const model = await compile('profile-model.ts');
const jpeg = () => Uint8Array.from([255, 216, 255, 0]).buffer;
const customer = { id: 'customer', label: 'Customer', display_name: 'Customer Name' };

test('single Provider rule and stored preferences cannot grant unavailable profile access', () => {
  for (const id of ['professional', 'business']) assert.equal(model.ownedWorkspaces([customer, { id }]).length, 2);
  assert.throws(() => model.ownedWorkspaces([customer, { id: 'professional' }, { id: 'business' }]), /needs review/);
  assert.throws(() => model.ownedWorkspaces([{ id: 'business' }]), /Customer profile/);
  assert.equal(model.resolveProfileSelection([{ scope: 'customer' }], 'business'), 'customer');
  assert.equal(model.resolveProfileSelection([{ scope: 'customer' }, { scope: 'professional' }], 'professional'), 'professional');
  assert.equal(model.profileDestination('business'), '/provider');
  assert.equal(model.profileDestination('customer'), '/account');
});

test('image validation checks byte signatures, empty files and 6 MB bounds', () => {
  assert.deepEqual(model.inspectIdentityImage(jpeg()), { contentType: 'image/jpeg', extension: 'jpg' });
  assert.equal(model.inspectIdentityImage(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]).buffer).extension, 'png');
  assert.equal(model.inspectIdentityImage(new TextEncoder().encode('RIFF0000WEBP').buffer).extension, 'webp');
  assert.throws(() => model.inspectIdentityImage(new ArrayBuffer(0)), /6 MB/);
  assert.throws(() => model.inspectIdentityImage(new ArrayBuffer(model.MAX_IDENTITY_IMAGE_BYTES + 1)), /6 MB/);
  assert.throws(() => model.inspectIdentityImage(new TextEncoder().encode('<svg>bad</svg>').buffer), /JPG, PNG or WebP/);
});
class ApiError extends Error { constructor(status) { super('Rejected'); this.status = status; } }
async function fixture({ scope = 'customer', patchError, uploadError, wrongUser = false, wrongScope = false, switchUserAfterUpload = false } = {}) {
  const trace = [];
  let switchedUser = false;
  const identity = { scope: wrongScope ? 'business' : scope, bucket: scope === 'customer' ? 'identity-media' : 'provider-identity-media', upload_prefix: scope === 'customer' ? 'owner/customer/owner' : `${scope}/entity`, avatar_url: null, banner_url: null };
  const storage = { upload: async (...args) => { trace.push(['upload', ...args]); switchedUser = switchUserAfterUpload; return { error: uploadError }; }, remove: async (...args) => { trace.push(['remove', ...args]); return { error: null }; } };
  const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: wrongUser || switchedUser ? 'other-user' : 'owner' }, access_token: 'owner-jwt' } }, error: null }) }, storage: { from: (bucket) => { trace.push(['bucket', bucket]); return storage; } } };
  const apiFetch = async (path, init) => { trace.push(['api', path, init]); if (init.method === 'PATCH' && patchError) throw patchError; return { identity }; };
  const client = await compile('identity-media.ts', { 'expo-crypto': { randomUUID: () => '00000000-0000-4000-8000-000000000000' }, './api': { apiFetch, ApiError }, './supabase': { supabase }, './profile-model': model });
  return { client, trace };
}

test('all three identity types upload binary data to server-owned paths and publish with the native JWT', async () => {
  for (const scope of ['customer', 'professional', 'business']) {
    const { client, trace } = await fixture({ scope }); const buffer = jpeg();
    await client.uploadIdentityMedia('owner', scope, 'avatar', buffer);
    const upload = trace.find((entry) => entry[0] === 'upload');
    assert.equal(upload[2], buffer); assert.equal(upload[3].upsert, false); assert.equal(upload[3].contentType, 'image/jpeg');
    assert.ok(upload[1].endsWith('/avatar/00000000-0000-4000-8000-000000000000.jpg'));
    const patch = trace.find((entry) => entry[0] === 'api' && entry[2].method === 'PATCH');
    assert.equal(patch[2].accessToken, 'owner-jwt');
    assert.deepEqual(JSON.parse(patch[2].body), { kind: 'avatar', object_path: upload[1] });
  }
});

test('wrong-owner sessions and scope mismatches cannot write media', async () => {
  for (const options of [{ wrongUser: true }, { wrongScope: true }]) {
    const { client, trace } = await fixture(options);
    await assert.rejects(client.uploadIdentityMedia('owner', 'customer', 'banner', jpeg()));
    assert.ok(!trace.some((entry) => entry[0] === 'upload'));
  }
});

test('a changed login after storage upload cannot publish or clean up with the new account', async () => {
  const { client, trace } = await fixture({ switchUserAfterUpload: true });
  await assert.rejects(client.uploadIdentityMedia('owner', 'customer', 'banner', jpeg()), /sign in again/);
  assert.ok(!trace.some((entry) => entry[0] === 'api' && entry[2].method === 'PATCH'));
  assert.ok(!trace.some((entry) => entry[0] === 'remove'));
});

test('storage failure cannot publish; rejected PATCH cleans up; lost response retains possibly committed bytes', async () => {
  const failed = await fixture({ uploadError: { message: 'Upload failed' } });
  await assert.rejects(failed.client.uploadIdentityMedia('owner', 'customer', 'avatar', jpeg()), /Upload failed/);
  assert.ok(!failed.trace.some((entry) => entry[0] === 'api' && entry[2].method === 'PATCH'));
  const rejected = await fixture({ patchError: new ApiError(403) });
  await assert.rejects(rejected.client.uploadIdentityMedia('owner', 'customer', 'banner', jpeg()));
  assert.equal(rejected.trace.filter((entry) => entry[0] === 'remove').length, 1);
  const ambiguous = await fixture({ patchError: new Error('Network disconnected') });
  await assert.rejects(ambiguous.client.uploadIdentityMedia('owner', 'customer', 'banner', jpeg()));
  assert.ok(!ambiguous.trace.some((entry) => entry[0] === 'remove'));
});

test('removal sends authenticated DELETE and leaves object unlinking to the server', async () => {
  const { client, trace } = await fixture(); await client.removeIdentityMedia('owner', 'customer', 'avatar');
  const removal = trace.find((entry) => entry[0] === 'api' && entry[2].method === 'DELETE');
  assert.equal(removal[2].accessToken, 'owner-jwt'); assert.deepEqual(JSON.parse(removal[2].body), { kind: 'avatar' });
  assert.ok(!trace.some((entry) => entry[0] === 'remove'));
});
