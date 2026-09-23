import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const easConfig = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
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

test('EAS preview build is device-installable and production build is store-ready', () => {
  assert.equal(easConfig.cli.requireCommit, true);

  assert.equal(easConfig.build.preview.distribution, 'internal');
  assert.equal(easConfig.build.preview.environment, 'preview');
  assert.equal(easConfig.build.preview.android.buildType, 'apk');

  assert.equal(easConfig.build.production.environment, 'production');
  assert.equal(easConfig.build.production.android.buildType, 'app-bundle');
});

test('release foundation does not introduce frozen finance or recovery configuration', () => {
  const releaseConfig = `${JSON.stringify(appConfig)}\n${JSON.stringify(easConfig)}`.toLowerCase();
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
