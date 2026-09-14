import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(webRoot, relativePath), 'utf8');

const css = read('components/messages/MarketplaceMessagingResponsive.module.css');
const customerPage = read('components/messages/CustomerMessagesPage.tsx');
const providerPage = read('app/provider/messages/page.tsx');
const workspace = read('components/messages/MarketplaceMessagingWorkspace.tsx');

test('Customer and Provider message routes share the scoped responsive wrapper', () => {
  assert.match(customerPage, /MarketplaceMessagingResponsive\.module\.css/);
  assert.match(customerPage, /className=\{styles\.shell\}/);
  assert.match(providerPage, /MarketplaceMessagingResponsive\.module\.css/);
  assert.match(providerPage, /className=\{styles\.shell\}/);
});

test('message responsive CSS keeps tablet two-column and phone single-column layouts', () => {
  assert.match(css, /grid-template-columns: minmax\(270px, 0\.82fr\) minmax\(0, 1\.18fr\)/);
  assert.match(css, /@media \(max-width: 980px\) and \(min-width: 761px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) !important/);
});

test('phone inbox uses a compact horizontal conversation rail', () => {
  assert.match(css, /scroll-snap-type: x proximity/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /flex: 0 0 min\(82vw, 320px\)/);
  assert.match(css, /-webkit-line-clamp: 2/);
});

test('thread bubbles, composer and actions remain touch and wrap safe', () => {
  assert.match(css, /min-height: 44px/);
  assert.match(css, /max-width: 88% !important/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /min-height: 88px/);
  assert.match(css, /scroll-padding-bottom: 112px/);
});

test('responsive polish does not replace marketplace messaging semantics', () => {
  assert.match(workspace, /\/api\/messages\/\$\{encodeURIComponent\(selectedId\)\}/);
  assert.match(workspace, /MarketplaceReportForm/);
  assert.match(workspace, /toggleBlock/);
  assert.match(workspace, /canCompose/);
  assert.match(workspace, /marketplace-messages-attention-refresh/);
});
