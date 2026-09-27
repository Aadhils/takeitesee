import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const easConfig = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const packageConfig = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expo = appConfig.expo;

test('native store identity is explicit and aligned across Android and iOS', () => {
  assert.equal(expo.name, 'TakeItEsee');
  assert.equal(expo.slug, 'takeitesee');
  assert.match(expo.version, /^\d+\.\d+\.\d+$/);

  assert.equal(expo.android.package, 'com.uvmart.takeitesee');
  assert.equal(expo.ios.bundleIdentifier, 'com.uvmart.takeitesee');
  assert.equal(expo.android.package, expo.ios.bundleIdentifier);

  assert.ok(Number.isInteger(expo.android.versionCode));
  assert.ok(expo.android.versionCode >= 1);
  assert.match(expo.ios.buildNumber, /^\d+(?:\.\d+)*$/);
});

test('native launcher branding uses the bundled official TakeItEsee asset', () => {
  assert.equal(expo.icon, './assets/official-takeitesee-logo.png');
  assert.equal(expo.android.adaptiveIcon.foregroundImage, './assets/official-takeitesee-logo.png');
  assert.equal(expo.android.adaptiveIcon.backgroundColor, '#F8F7FF');
});

test('Expo project ownership and EAS project link are explicit', () => {
  assert.equal(expo.owner, 'uvmart-takeitesee');
  assert.equal(expo.extra?.eas?.projectId, 'aee79da4-1e18-4cdb-b5bd-421180d0decd');
});

test('EAS preview build is device-installable and production build is store-ready', () => {
  assert.equal(easConfig.cli.version, '>= 16.18.0');
  assert.equal(easConfig.cli.requireCommit, true);
  assert.equal(easConfig.cli.appVersionSource, 'remote');

  assert.equal(easConfig.build.preview.distribution, 'internal');
  assert.equal(easConfig.build.preview.environment, 'preview');
  assert.equal(easConfig.build.preview.android.buildType, 'apk');

  assert.equal(easConfig.build.production.environment, 'production');
  assert.equal(easConfig.build.production.autoIncrement, true);
  assert.equal(easConfig.build.production.android.buildType, 'app-bundle');
  assert.deepEqual(easConfig.submit.production, { android: { track: 'internal' } });
});

test('release commands expose explicit EAS account, preview, and production handoffs', () => {
  assert.equal(packageConfig.scripts['eas:whoami'], 'npx eas-cli@latest whoami');
  assert.equal(packageConfig.scripts['eas:project:info'], 'npx eas-cli@latest project:info');
  assert.equal(
    packageConfig.scripts['build:android:preview'],
    'npx eas-cli@latest build --platform android --profile preview',
  );
  assert.equal(
    packageConfig.scripts['build:android:production'],
    'npx eas-cli@latest build --platform android --profile production',
  );
  assert.equal(
    packageConfig.scripts['submit:android:internal'],
    'npx eas-cli@latest submit --platform android --profile production',
  );
  assert.equal(
    packageConfig.scripts['build:ios:production'],
    'npx eas-cli@latest build --platform ios --profile production',
  );
});

test('release foundation does not introduce frozen finance or recovery configuration', () => {
  const releaseConfig = `${JSON.stringify(appConfig)}\n${JSON.stringify(easConfig)}\n${JSON.stringify(packageConfig.scripts)}`.toLowerCase();
  for (const forbidden of [
    'cashfree',
    'refund',
    'payout',
    'settlement',
    'reconciliation',
    'requirementoccurrencerecoverypanel',
  ]) {
    assert.equal(releaseConfig.includes(forbidden), false, `release config must not introduce ${forbidden}`);
  }
});


test('Play Store listing source keeps external release blockers explicit', () => {
  const listing = readFileSync(new URL('../PLAY_STORE_LISTING.md', import.meta.url), 'utf8');
  assert.match(listing, /App name: TakeItEsee/);
  assert.match(listing, /Android package: com\.uvmart\.takeitesee/);
  assert.match(listing, /512 × 512 px/);
  assert.match(listing, /1024 × 500 px/);
  assert.match(listing, /Data safety answers checked against actual app code/);
  assert.match(listing, /Account deletion declarations/);
  assert.match(listing, /reviewer credentials/);
  assert.match(listing, /Do not upload the current rectangular bundled logo/);
});
