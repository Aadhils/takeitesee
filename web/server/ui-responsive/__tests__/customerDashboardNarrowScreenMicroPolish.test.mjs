import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [dashboardCss, attention] = await Promise.all([
  readFile(new URL('app/account-overview-stage4-polish.css', root), 'utf8'),
  readFile(new URL('components/account/CustomerSmartAttention.tsx', root), 'utf8'),
]);

test('Customer narrow-screen dashboard uses tighter shortcut and booking density', () => {
  assert.ok(dashboardCss.includes('margin-top: 6px;'));
  assert.ok(dashboardCss.includes('min-height: 44px;'));
  assert.ok(dashboardCss.includes('gap: 6px !important;'));
  assert.ok(dashboardCss.includes('min-height: 62px !important;'));
  assert.ok(dashboardCss.includes('min-height: 64px !important;'));
});

test('Customer Smart Attention keeps title and badge in one compact mobile row', () => {
  assert.ok(attention.includes('@media (max-width: 720px)'));
  assert.ok(attention.includes('grid-template-columns: minmax(0, 1fr) auto'));
  assert.ok(attention.includes('padding: 16px !important;'));
  assert.ok(attention.includes('font-size: clamp(1.2rem, 5.4vw, 1.45rem)'));
});

test('Customer Smart Attention mobile CTA is full-width and clearly actionable', () => {
  assert.ok(attention.includes('.customer-smart-attention-actions .button { width: 100%; justify-content: center; min-height: 42px; }'));
  assert.ok(attention.includes('.customer-smart-attention-clear .customer-smart-attention-actions .button'));
  assert.ok(attention.includes('background: var(--color-selected)'));
});

test('Mobile micro-polish preserves Smart Attention destinations and acknowledgement behavior', () => {
  assert.ok(attention.includes("href: '/explore'"));
  assert.ok(attention.includes("mark_requirement_proposals_read: true"));
  assert.ok(attention.includes("mark_product_order_updates_read: true"));
  assert.ok(attention.includes('router.push(attention.href)'));
});

test('Mobile micro-polish remains presentation-only', () => {
  for (const term of ['CashfreeClient', 'createPayment', '/api/pay', '/api/recurrence']) {
    assert.ok(!dashboardCss.includes(term));
    assert.ok(!attention.includes(term));
  }
});
