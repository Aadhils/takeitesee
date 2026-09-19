import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [switcher, translations, css] = await Promise.all([
  readFile(new URL('components/account/WorkspaceSwitcher.tsx', root), 'utf8'),
  readFile(new URL('components/i18n/IdentityWorkspaceTranslations.ts', root), 'utf8'),
  readFile(new URL('components/account/WorkspaceSwitcher.module.css', root), 'utf8'),
]);

function occurrences(haystack, needle) { return haystack.split(needle).length - 1; }

const keys = [
  'workspace.switcher.unableLoad',
  'workspace.switcher.unableSwitch',
  'workspace.switcher.professionalSummary',
  'workspace.switcher.businessSummary',
  'workspace.switcher.heading',
  'workspace.switcher.description',
  'workspace.switcher.current',
  'workspace.switcher.verified',
  'workspace.switcher.youAreHere',
  'workspace.switcher.switching',
  'workspace.switcher.openWorkspace',
  'workspace.switcher.startEarning',
  'workspace.switcher.chooseProviderIdentity',
  'workspace.switcher.choose',
  'workspace.switcher.chooseProfessional',
  'workspace.switcher.chooseBusiness',
  'workspace.switcher.reviewHeading',
  'workspace.switcher.reviewBody',
  'workspace.switcher.reviewPending',
  'workspace.switcher.viewApplication',
  'workspace.switcher.finalIdentity',
  'workspace.switcher.finalBody',
];

test('Workspace Switcher uses shared Identity Workspace localization with exact EN/TA parity', () => {
  assert.ok(switcher.includes('useIdentityWorkspaceTranslations'));
  assert.ok(switcher.includes('const { t } = useIdentityWorkspaceTranslations()'));
  assert.ok(!switcher.includes('const tamil ='));
  assert.ok(!switcher.includes("locale.toLowerCase().startsWith('ta')"));
  assert.ok(!/[஀-௿]/u.test(switcher));
  for (const key of keys) {
    assert.equal(occurrences(translations, "'" + key + "':"), 2);
    assert.ok(switcher.includes("t('" + key + "')"));
  }
});

test('Workspace Switcher preserves workspace discovery, switching and exact redirect semantics', () => {
  assert.ok(switcher.includes("fetch('/api/account/workspaces', { cache: 'no-store' })"));
  assert.ok(switcher.includes("fetch('/api/account/workspaces', { method: 'POST'"));
  assert.ok(switcher.includes('body: JSON.stringify({ workspace })'));
  assert.ok(switcher.includes('if (workspace === active) return;'));
  assert.ok(switcher.includes('window.location.assign(payload.redirect)'));
  assert.ok(switcher.includes('setActive(currentWorkspace ?? payload.active)'));
});

test('Workspace Switcher preserves one final Provider identity lifecycle', () => {
  assert.ok(switcher.includes("workspace.id === 'professional' || workspace.id === 'business'"));
  assert.ok(switcher.includes('const pendingProfile = addableProfiles.find((profile) => profile.pending)'));
  assert.ok(switcher.includes('const choices = addableProfiles.filter((profile) => !profile.pending)'));
  assert.ok(switcher.includes("profile.id === 'professional' ? t('workspace.switcher.chooseProfessional') : t('workspace.switcher.chooseBusiness')"));
  assert.ok(switcher.includes("t('workspace.switcher.reviewBody').replace('{label}', pendingProfile.label)"));
  assert.ok(switcher.includes("t('workspace.switcher.finalBody').replace('{label}', providerWorkspace.label)"));
  assert.ok(switcher.includes('className={styles.finalityNote}'));
});

test('Workspace Switcher keeps compact and responsive presentation contracts', () => {
  assert.ok(switcher.includes('if (compact) return null;'));
  assert.ok(switcher.includes('disabled={selected || switching !== null}'));
  assert.ok(css.includes('.section:has(.finalityNote)'));
  assert.ok(css.includes('@media'));
});

test('Workspace Switcher localization does not activate finance or payment behavior', () => {
  assert.ok(!switcher.includes('Cashfree'));
  assert.ok(!switcher.includes('/api/pay'));
  assert.ok(!switcher.includes('refund'));
  assert.ok(!switcher.includes('payout'));
});
