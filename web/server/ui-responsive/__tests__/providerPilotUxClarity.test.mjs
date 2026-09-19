import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const [launchSource, availabilitySource, reachSource] = await Promise.all([
  readFile(new URL('components/provider/ProviderDashboardLaunchCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderDashboardAvailabilityCenter.tsx', root), 'utf8'),
  readFile(new URL('components/provider/ProviderServiceReachControl.tsx', root), 'utf8'),
]);

test('provider service category choice is searchable and never silently preselected', () => {
  assert.ok(launchSource.includes("const [categoryQuery, setCategoryQuery] = useState('')"));
  assert.ok(launchSource.includes('const categoryMatches = useMemo'));
  assert.ok(launchSource.includes('<option value="">{copy.categoryChoose}</option>'));
  assert.ok(launchSource.includes('categorySearchPlaceholder'));
  assert.ok(!launchSource.includes('selectableCategories[0]?.id'));
});

test('provider can explicitly persist the currently displayed availability mode', () => {
  assert.ok(availabilitySource.includes('draftModeByService'));
  assert.ok(availabilitySource.includes("t('provider.availability.save')"));
  assert.ok(availabilitySource.includes('onClick={() => void saveMode(service)}'));
  assert.ok(availabilitySource.includes("method: 'PUT'"));
  assert.ok(availabilitySource.includes('setNoticeServiceId(service.id)'));
});

test('service reach save feedback stays beside the save action before location controls', () => {
  const saveIndex = reachSource.indexOf("t('provider.reach.save')");
  const noticeIndex = reachSource.indexOf('role="status"');
  const locationIndex = reachSource.indexOf('styles.locationGrid');
  assert.ok(saveIndex >= 0);
  assert.ok(noticeIndex > saveIndex);
  assert.ok(locationIndex > noticeIndex);
});
