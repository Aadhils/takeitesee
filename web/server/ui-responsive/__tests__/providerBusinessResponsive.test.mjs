import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [dashboardCss, reachCss, locationCss, availabilityCss, portfolioCss, foundationCss] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardManager.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProviderServiceReachControl.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProviderLiveLocationControl.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProviderLiveAvailabilityControl.module.css', root), 'utf8'),
  readFile(new URL('components/provider/ProfessionalPortfolioMediaManager.module.css', root), 'utf8'),
  readFile(new URL('app/responsive-foundation.css', root), 'utf8'),
]);

test('provider dashboard cards retain compact tablet and phone contracts', () => {
  assert.match(dashboardCss, /\.providerActivityStrip\s*\{[\s\S]*?display:\s*flex/);
  assert.match(dashboardCss, /\.providerActivityItem\s*\{[\s\S]*?flex:\s*1 1 150px/);
  assert.match(dashboardCss, /\.providerActivityEmpty\s*\{[\s\S]*?flex:\s*1 1 100%/);
  assert.match(dashboardCss, /@media \(max-width: 780px\)[\s\S]*?\.providerActivityStrip\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(dashboardCss, /@media \(max-width: 780px\)[\s\S]*?\.providerActivityItem\s*\{[\s\S]*?min-width:\s*116px/);
  assert.match(dashboardCss, /\.nextServiceCompact\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(dashboardCss, /\.nextServiceAction\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(dashboardCss, /@media \(max-width: 560px\)[\s\S]*?\.nextServiceCompact\s*\{\s*grid-template-columns:\s*auto minmax\(0, 1fr\)/);
  assert.match(dashboardCss, /\.providerQuickPrimaryGrid,[\s\S]*?\.providerQuickMoreGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4/);
  assert.match(dashboardCss, /\.providerQuickMore > summary\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(dashboardCss, /@media \(max-width: 900px\)[\s\S]*?\.providerQuickPrimaryGrid,[\s\S]*?\.providerQuickMore\s*\{\s*display:\s*none/);
  assert.match(dashboardCss, /@media \(max-width: 900px\)[\s\S]*?\.providerQuickMobileRoleGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4/);
  assert.match(dashboardCss, /@media \(max-width: 560px\)[\s\S]*?\.providerQuickLink\s*\{[\s\S]*?min-height:\s*68px/);
  assert.doesNotMatch(dashboardCss, /\.providerQuickGrid\s*\{/);
  assert.match(dashboardCss, /\.followUpChip\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(dashboardCss, /\.followUpRail\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(dashboardCss, /@media \(max-width: 780px\)[\s\S]*?\.followUpQueue\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(dashboardCss, /\.followUps\s*\{/);
  assert.doesNotMatch(dashboardCss, /\.followUpLink\s*\{/);
});

test('service reach controls are touch safe and stack on narrow phones', () => {
  assert.match(reachCss, /\.toggle\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(reachCss, /\.distanceInput\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(reachCss, /\.primary,[\s\S]*?min-height:\s*44px/);
  assert.match(reachCss, /@media \(max-width: 520px\)[\s\S]*?\.actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test('live location controls use touch targets and phone-safe stacking', () => {
  assert.match(locationCss, /\.select\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(locationCss, /\.primaryButton,[\s\S]*?min-height:\s*44px/);
  assert.match(locationCss, /@media \(max-width: 430px\)[\s\S]*?\.controls\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(locationCss, /@media \(max-width: 430px\)[\s\S]*?\.header\s*\{[\s\S]*?flex-direction:\s*column/);
});

test('live availability panel clears the fixed mobile bottom navigation', () => {
  assert.match(availabilityCss, /\.closeButton\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(availabilityCss, /\.modeButton\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(availabilityCss, /@media \(max-width: 640px\)[\s\S]*?bottom:\s*calc\(var\(--responsive-mobile-nav-height, 72px\) \+ 14px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(availabilityCss, /@media \(max-width: 430px\)[\s\S]*?overscroll-behavior:\s*contain/);
});

test('provider portfolio and global provider layout remain responsive', () => {
  assert.match(portfolioCss, /@media \(max-width: 760px\)[\s\S]*?\.gallery\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.ok(foundationCss.includes('.provider-layout'));
  assert.ok(foundationCss.includes('.provider-sidebar'));
  assert.ok(foundationCss.includes('.provider-content'));
});
