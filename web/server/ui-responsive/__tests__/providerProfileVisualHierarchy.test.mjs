import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [shellSource, identitySource, cssSource] = await Promise.all([
  readFile(new URL('components/provider/LiveProviderShell.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardIdentityCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardIdentityCenter.module.css', root), 'utf8'),
]);

test('Provider Dashboard keeps the real media identity hero ahead of mobile navigation', () => {
  const mediaIndex = shellSource.indexOf('<RoleIdentityMediaHeader');
  const navigationIndex = shellSource.indexOf('<section className="provider-mobile-social-shell"');
  assert.ok(mediaIndex >= 0);
  assert.ok(navigationIndex > mediaIndex);
  assert.ok(shellSource.includes("active === '/provider' && provider"));
});

test('Profile details panel does not duplicate the banner hero avatar identity', () => {
  assert.ok(identitySource.includes("eyebrow: 'Profile details'"));
  assert.ok(identitySource.includes("title: 'Public profile details'"));
  assert.ok(identitySource.includes('className={styles.managementDisclosure}'));
  assert.ok(identitySource.includes('className={styles.managementSummary}'));
  assert.ok(!identitySource.includes('className={styles.avatar}'));
  assert.ok(!identitySource.includes('profile.display_name.slice(0, 2).toUpperCase()'));
  assert.ok(!cssSource.includes('.avatar {'));
});

test('Profile details preserve status, editing and role management contracts', () => {
  assert.ok(identitySource.includes("fetch('/api/provider/profile'"));
  assert.ok(identitySource.includes("fetch('/api/provider/profile/roles'"));
  assert.ok(identitySource.includes("method: 'PATCH'"));
  assert.ok(identitySource.includes('profile.provider_type === \'professional\''));
  assert.ok(identitySource.includes('profile.provider_type === \'business\''));
  assert.ok(identitySource.includes('/provider/public-readiness'));
  assert.ok(identitySource.includes('/provider/setup'));
});

test('Profile detail actions remain compact and touch friendly', () => {
  assert.ok(cssSource.includes('.managementSummary'));
  assert.ok(cssSource.includes('min-height: 64px'));
  assert.ok(cssSource.includes('.managementDisclosure[open] .managementCaret'));
  assert.ok(cssSource.includes('min-height: 44px'));
  assert.ok(cssSource.includes('@media (max-width: 700px)'));
  assert.ok(cssSource.includes('@media (max-width: 480px)'));
  assert.ok(cssSource.includes('safe-area-inset-bottom'));
});


test('Provider management sections use smart progressive disclosure', () => {
  assert.ok(identitySource.includes('const [profileManagerOpen, setProfileManagerOpen] = useState(false)'));
  assert.ok(identitySource.includes('const [rolesManagerOpen, setRolesManagerOpen] = useState(false)'));
  assert.ok(identitySource.includes('const [setupManagerOpen, setSetupManagerOpen] = useState(false)'));
  assert.ok(identitySource.includes('setProfileManagerOpen(!profileReady)'));
  assert.ok(identitySource.includes('if (nextRoles.length === 0) setRolesManagerOpen(true)'));
  assert.ok(identitySource.includes('open={profileManagerOpen}'));
  assert.ok(identitySource.includes('open={rolesManagerOpen}'));
  assert.ok(identitySource.includes('open={setupManagerOpen}'));
  assert.ok(identitySource.includes('setRolesManagerOpen(true)'));
});
