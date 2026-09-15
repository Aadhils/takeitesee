import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeUrl = new URL('../../../app/api/referral-attribution/route.ts', import.meta.url);
const migrationUrl = new URL('../../../database/migrations/20260915095500_referral_attribution_security_hardening.sql', import.meta.url);

const [routeSource, migrationSource] = await Promise.all([
  readFile(routeUrl, 'utf8'),
  readFile(migrationUrl, 'utf8'),
]);

test('public referral attribution writes stay behind the server service-role route', () => {
  assert.match(routeSource, /createSupabaseServiceClient/);
  assert.doesNotMatch(routeSource, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(routeSource, /from '@supabase\/supabase-js'/);
  assert.match(routeSource, /maxRawHandleLength = 128/);
  assert.match(routeSource, /value\.length >= 3 && value\.length <= 30/);
  assert.match(routeSource, /uuidPattern\.test\(existingAttributionId\)/);
  assert.match(routeSource, /const landingPath = `\/@\$\{destination\}`/);
});

test('referral attribution RPC is invoker-mode and service-role only', () => {
  assert.match(migrationSource, /security invoker/i);
  assert.match(migrationSource, /set search_path=''/i);
  assert.doesNotMatch(migrationSource, /security definer/i);
  assert.match(
    migrationSource,
    /revoke all on function public\.record_public_referral_attribution\(text,text,uuid,text\)[\s\S]*from public, anon, authenticated;/i,
  );
  assert.match(
    migrationSource,
    /grant execute on function public\.record_public_referral_attribution\(text,text,uuid,text\)[\s\S]*to service_role;/i,
  );
});

test('database layer binds landing path to the canonical destination handle', () => {
  assert.match(migrationSource, /char_length\(ref_handle\) < 3/);
  assert.match(migrationSource, /char_length\(dest_handle\) > 30/);
  assert.match(migrationSource, /p_landing_path <> '\/@' \|\| dest_handle/);
  assert.match(migrationSource, /Self-referral is not allowed\./);
  assert.match(migrationSource, /on conflict \(attribution_id, destination_identity_type, destination_identity_id\)/);
});
