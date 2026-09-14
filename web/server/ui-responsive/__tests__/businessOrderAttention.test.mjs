import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [component, styles, entry, migration] = await Promise.all([
  readFile(new URL('components/provider/BusinessProductOrderAttention.tsx', root), 'utf8'),
  readFile(new URL('components/provider/BusinessProductOrderAttention.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardEntry.tsx', root), 'utf8'),
  readFile(new URL('database/migrations/20260914122000_business_product_order_detail_notification_links.sql', root), 'utf8'),
]);

test('Business dashboard attention only surfaces requested Product Orders and deep-links the latest order', () => {
  assert.match(component, /fetch\('\/api\/provider\/orders'/);
  assert.match(component, /order\.status === 'requested'/);
  assert.match(component, /sort\(\(left, right\) => new Date\(right\.created_at\)/);
  assert.match(component, /`\/provider\/orders\/\$\{encodeURIComponent\(latest\.id\)\}`/);
  assert.match(component, /window\.setInterval\(refresh, 60_000\)/);
  assert.match(entry, /<BusinessProductOrderAttention \/>/);
});

test('Business order attention remains compact above the mobile provider navigation', () => {
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?bottom:\s*calc\(var\(--responsive-mobile-nav-height, 72px\) \+ 14px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.actions :global\(\.button\)[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.actions\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.allOrders\s*\{\s*display:\s*none !important/);
});

test('Product Order notifications use the dedicated Customer and Business detail routes', () => {
  assert.match(migration, /notification_target := '\/provider\/orders\/' \|\| order_row\.id::text/);
  assert.match(migration, /notification_target := '\/orders\/' \|\| order_row\.id::text/);
  assert.match(migration, /replace\(target_path, '\/provider\/orders#order-', '\/provider\/orders\/'\)/);
  assert.match(migration, /replace\(target_path, '\/orders#order-', '\/orders\/'\)/);
});
