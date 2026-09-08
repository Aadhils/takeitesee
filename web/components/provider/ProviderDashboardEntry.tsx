'use client';

import ProviderDashboardManager from './ProviderDashboardManager';
import ProviderLiveAvailabilityControl from './ProviderLiveAvailabilityControl';
import BusinessProductCatalogShortcut from './BusinessProductCatalogShortcut';
import BusinessShopStatusControl from './BusinessShopStatusControl';

export default function ProviderDashboardEntry() {
  return <>
    <ProviderDashboardManager />
    <BusinessProductCatalogShortcut />
    <BusinessShopStatusControl />
    <ProviderLiveAvailabilityControl />
  </>;
}
