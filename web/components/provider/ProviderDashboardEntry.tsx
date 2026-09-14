'use client';

import ProviderDashboardManager from './ProviderDashboardManager';
import ProviderLiveAvailabilityControl from './ProviderLiveAvailabilityControl';
import BusinessProductCatalogShortcut from './BusinessProductCatalogShortcut';
import BusinessProductOrderAttention from './BusinessProductOrderAttention';
import BusinessShopStatusControl from './BusinessShopStatusControl';

export default function ProviderDashboardEntry() {
  return <>
    <ProviderDashboardManager />
    <BusinessProductOrderAttention />
    <BusinessProductCatalogShortcut />
    <BusinessShopStatusControl />
    <ProviderLiveAvailabilityControl />
  </>;
}
