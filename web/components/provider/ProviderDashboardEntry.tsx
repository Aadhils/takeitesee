'use client';

import ProviderDashboardManager from './ProviderDashboardManager';
import ProviderLiveAvailabilityControl from './ProviderLiveAvailabilityControl';
import BusinessProductCatalogShortcut from './BusinessProductCatalogShortcut';

export default function ProviderDashboardEntry() {
  return <>
    <ProviderDashboardManager />
    <BusinessProductCatalogShortcut />
    <ProviderLiveAvailabilityControl />
  </>;
}
