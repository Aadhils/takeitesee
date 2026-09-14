import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [routeSource, workspaceSource, managerSource, journeyCss, managerCss] = await Promise.all([
  readFile(new URL('app/provider/resume/page.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalResumeWorkspace.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalResumeManager.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalResumeResponsive.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalResumeManager.module.css', root), 'utf8'),
]);

test('Professional Resume route keeps Professional-only guard and responsive wrapper', () => {
  assert.ok(routeSource.includes('ProfessionalResumeResponsive.module.css'));
  assert.ok(routeSource.includes('resumeJourney'));
  assert.ok(routeSource.includes('getProviderSessionOrNull'));
  assert.ok(routeSource.includes("session.roles.includes('professional')"));
  assert.ok(routeSource.includes("redirect('/provider')"));
});

test('Professional Resume journey covers phone and tablet ergonomics', () => {
  assert.ok(journeyCss.includes('overflow-x: clip'));
  assert.ok(journeyCss.includes('overflow-wrap: anywhere'));
  assert.ok(journeyCss.includes('min-height: 44px'));
  assert.ok(journeyCss.includes('font-size: 16px'));
  assert.ok(journeyCss.includes("a[href='/provider/resume/export']"));
  assert.ok(journeyCss.includes('max-width: 760px'));
  assert.ok(journeyCss.includes('max-width: 560px'));
  assert.ok(journeyCss.includes('safe-area-inset-bottom'));
});

test('Professional Resume manager keeps responsive structured sections', () => {
  assert.ok(managerCss.includes('repeat(3, minmax(0, 1fr))'));
  assert.ok(managerCss.includes('grid-template-columns: 1fr'));
  assert.ok(managerCss.includes('word-break: break-word'));
  assert.ok(managerCss.includes('min-height: 44px'));
  assert.ok(managerCss.includes('max-width: 560px'));
});

test('Professional Resume data, visibility and export contracts remain present', () => {
  assert.ok(workspaceSource.includes("fetch('/api/provider/profile'"));
  assert.ok(workspaceSource.includes('href="/provider/resume/export"'));
  assert.ok(workspaceSource.includes('<ProfessionalResumeManager verified={profile.verified} />'));
  assert.ok(managerSource.includes("fetch('/api/provider/resume'"));
  assert.ok(managerSource.includes("send('PATCH', { section: 'profile'"));
  assert.ok(managerSource.includes("section: 'experience'"));
  assert.ok(managerSource.includes("section: 'education'"));
  assert.ok(managerSource.includes("section: 'certification'"));
  assert.ok(managerSource.includes("section: 'skill'"));
  assert.ok(managerSource.includes('public_resume_enabled'));
  assert.ok(managerSource.includes('window.confirm'));
});
