import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [page, privacy, audit] = await Promise.all([
  readFile(new URL('app/account-deletion/page.tsx', root), 'utf8'),
  readFile(new URL('app/privacy/page.tsx', root), 'utf8'),
  readFile(new URL('../mobile/PLAY_DATA_SAFETY_AUDIT.md', root), 'utf8'),
]);

test('public account deletion resource is app-independent and identity-verified', () => {
  assert.ok(page.includes('Delete your TakeItEsee account'));
  assert.ok(page.includes('You do not need the TakeItEsee mobile app installed'));
  assert.ok(page.includes('/login?returnTo=%2Faccount%2Fprivacy'));
  assert.ok(page.includes('another person cannot request'));
  assert.ok(page.includes('/privacy#grievance-contact'));
});

test('Privacy Policy prominently links the deletion resource', () => {
  assert.ok(privacy.includes('href="/account-deletion"'));
  assert.ok(privacy.includes('TakeItEsee account deletion resource'));
});

test('Play audit records the stable external deletion URL', () => {
  assert.ok(audit.includes('https://www.takeitesee.com/account-deletion'));
  assert.ok(audit.includes('Play Console Data deletion URL field'));
});

test('deletion resource does not introduce direct destructive or finance behavior', () => {
  for (const term of ['deleteUser(', 'admin.deleteUser', 'cashfree', 'refund', 'payout', 'settlement', 'reconciliation']) {
    assert.equal(page.toLowerCase().includes(term.toLowerCase()), false, term);
  }
});
