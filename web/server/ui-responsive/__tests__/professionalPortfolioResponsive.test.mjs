import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, workspaceSource, managerSource, journeyCss, mediaCss] = await Promise.all([
  readFile(new URL('app/provider/portfolio/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalPortfolioWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalPortfolioMediaManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalPortfolioResponsive.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalPortfolioMediaManager.module.css', root), 'utf8'),
]);

test('Professional Portfolio route keeps the Professional-only guard and responsive wrapper', () => {
  assert.ok(routeSource.includes('ProfessionalPortfolioResponsive.module.css'));
  assert.ok(routeSource.includes('portfolioJourney'));
  assert.ok(routeSource.includes('getProviderSessionOrNull'));
  assert.ok(routeSource.includes("session.roles.includes('professional')"));
  assert.ok(routeSource.includes("redirect('/provider')"));
});

test('Professional Portfolio journey covers narrow-screen form and action ergonomics', () => {
  assert.ok(journeyCss.includes('overflow-x: clip'));
  assert.ok(journeyCss.includes('overflow-wrap: anywhere'));
  assert.ok(journeyCss.includes("input[type='file']"));
  assert.ok(journeyCss.includes('min-height: 44px'));
  assert.ok(journeyCss.includes('font-size: 16px'));
  assert.ok(journeyCss.includes('max-width: 760px'));
  assert.ok(journeyCss.includes('max-width: 560px'));
  assert.ok(journeyCss.includes('safe-area-inset-bottom'));
});

test('Professional Portfolio media cards retain responsive gallery and editor hardening', () => {
  assert.ok(mediaCss.includes('repeat(2, minmax(0, 1fr))'));
  assert.ok(mediaCss.includes('grid-template-columns: 1fr'));
  assert.ok(mediaCss.includes('word-break: break-word'));
  assert.ok(mediaCss.includes('height: 210px'));
  assert.ok(mediaCss.includes('min-height: 44px'));
});

test('Professional Portfolio data, storage and moderation contracts remain present', () => {
  assert.ok(workspaceSource.includes("fetch('/api/provider/profile'"));
  assert.ok(workspaceSource.includes("fetch('/api/provider/profile/roles'"));
  assert.ok(managerSource.includes("const BUCKET = 'professional-portfolio-media'"));
  assert.ok(managerSource.includes("fetch('/api/provider/profile/media'"));
  assert.ok(managerSource.includes("method: 'POST'"));
  assert.ok(managerSource.includes("method: 'PATCH'"));
  assert.ok(managerSource.includes("method: 'DELETE'"));
  assert.ok(managerSource.includes("moderation_state: 'clear' | 'paused'"));
  assert.ok(managerSource.includes("image/jpeg,image/png,image/webp,video/mp4,video/webm"));
  assert.ok(managerSource.includes('imageMaxBytes = 8 * 1024 * 1024'));
  assert.ok(managerSource.includes('videoMaxBytes = 25 * 1024 * 1024'));
});
