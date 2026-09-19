import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [shell, account, polishCss, responsiveCss] = await Promise.all([
  readFile(new URL('components/account/LocalizedAccountShell.tsx', root), 'utf8'),
  readFile(new URL('components/account/AuthenticatedAccount.tsx', root), 'utf8'),
  readFile(new URL('app/account-overview-stage4-polish.css', root), 'utf8'),
  readFile(new URL('app/responsive-overrides.css', root), 'utf8'),
]);

test('Customer workspace exposes an explicit body marker with cleanup', () => {
  assert.ok(shell.includes("document.body.classList.add('customer-workspace-active')"));
  assert.ok(shell.includes("document.body.classList.remove('customer-workspace-active')"));
});

test('Customer booking summary becomes readable cards on real mobile widths', () => {
  assert.ok(account.includes('className="customer-activity-strip"'));
  assert.ok(account.includes('className="customer-activity-strip-item"'));
  assert.ok(polishCss.includes('.account-content > .customer-social-dashboard .customer-activity-strip {'));
  assert.ok(polishCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important;'));
  assert.ok(polishCss.includes('@media (max-width: 640px)'));
  assert.ok(polishCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'));
  assert.ok(polishCss.includes('min-height: 72px !important;'));
  assert.ok(polishCss.includes('white-space: normal;'));
});

test('Customer secondary shortcuts and sign out use contained mobile controls', () => {
  assert.ok(account.includes('className="customer-dashboard-more-links"'));
  assert.ok(account.includes('className="account-sign-out"'));
  assert.ok(polishCss.includes('border: 1px solid var(--color-border);'));
  assert.ok(polishCss.includes('.account-content > .customer-social-dashboard > .account-actions {'));
  assert.ok(polishCss.includes('justify-content: flex-end;'));
  assert.ok(polishCss.includes('.account-content > .customer-social-dashboard > .account-actions .account-sign-out {'));
  assert.ok(polishCss.includes('width: auto !important;'));
  assert.ok(polishCss.includes('border-radius: 999px;'));
});

test('Customer workspace mobile footer is compact without changing public or Provider footer contracts', () => {
  assert.ok(responsiveCss.includes('body.customer-workspace-active .site-footer .footer-inner'));
  assert.ok(responsiveCss.includes('body.customer-workspace-active .footer-link-column'));
  assert.ok(responsiveCss.includes('display: none !important;'));
  assert.ok(responsiveCss.includes('body.customer-workspace-active .footer-brand-column'));
  assert.ok(responsiveCss.includes('body.customer-workspace-active .footer-legal'));
  assert.ok(responsiveCss.includes('body.provider-dashboard-active .site-footer .footer-inner'));
  assert.ok(responsiveCss.includes('body.provider-dashboard-active .footer-link-column'));
});

test('Customer dashboard polish is presentation-only', () => {
  assert.ok(account.includes('<CustomerSmartAttention bookings={bookings} />'));
  assert.ok(account.includes('<CustomerProductOrderAttention onUnreadChange={setProductOrderUnreadCount} />'));
  assert.ok(account.includes('<CustomerAccountProposalSummary onUnreadChange={setProposalUnreadCount} />'));
  assert.ok(!polishCss.includes('Cashfree'));
  assert.ok(!responsiveCss.includes('/api/pay'));
});
