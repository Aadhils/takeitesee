import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [supportRouteSource, reportsRouteSource, cssSource] = await Promise.all([
  readFile(new URL('app/account/support/page.tsx', root), 'utf8'),
  readFile(new URL('app/account/reports/page.tsx', root), 'utf8'),
  readFile(new URL('components/account/CustomerSupportSafetyResponsive.module.css', root), 'utf8'),
]);

test('Customer Support and Safety Reports routes share the focused responsive wrapper', () => {
  for (const source of [supportRouteSource, reportsRouteSource]) {
    assert.ok(source.includes('CustomerSupportSafetyResponsive.module.css'));
    assert.ok(source.includes('supportSafetyJourney'));
    assert.ok(source.includes('getCurrentCustomerAsync'));
  }
});

test('Customer Support and Safety styles cover tablet and phone layouts', () => {
  assert.ok(cssSource.includes('overflow-x: clip'));
  assert.ok(cssSource.includes('overflow-wrap: anywhere'));
  assert.ok(cssSource.includes('account-layout'));
  assert.ok(cssSource.includes('admin-record-top'));
  assert.ok(cssSource.includes('account-details'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('font-size: 16px'));
  assert.ok(cssSource.includes('max-width: 760px'));
  assert.ok(cssSource.includes('max-width: 560px'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
  assert.ok(cssSource.includes('.supportSafetyJourney ul'));
  assert.ok(cssSource.includes('.supportSafetyJourney li'));
});

test('Customer Support workflow contracts remain present', () => {
  assert.ok(supportRouteSource.includes("fetch('/api/account/support-requests'"));
  assert.ok(supportRouteSource.includes("method: 'POST'"));
  assert.ok(supportRouteSource.includes('LocalizedAccountShell active="/account/support"'));
  assert.ok(supportRouteSource.includes("'platform_grievance' | 'account_help' | 'safety' | 'provider_conduct' | 'other'"));
  assert.ok(supportRouteSource.includes('/login?returnTo=%2Faccount%2Fsupport'));
  assert.ok(supportRouteSource.includes('mailto:uandv.com@gmail.com'));
  assert.ok(supportRouteSource.includes('href="/account/privacy"'));
});

test('Customer Safety Reports privacy and status-history contracts remain present', () => {
  assert.ok(reportsRouteSource.includes("fetch('/api/account/reports'"));
  assert.ok(reportsRouteSource.includes("'open' | 'reviewing' | 'actioned' | 'dismissed'"));
  assert.ok(reportsRouteSource.includes('/login?returnTo=%2Faccount%2Freports'));
  assert.ok(reportsRouteSource.includes('href="/account/support"'));
  assert.ok(reportsRouteSource.includes("t('reports.visibility.body')"));
  assert.ok(reportsRouteSource.includes('report.events.map'));
});
