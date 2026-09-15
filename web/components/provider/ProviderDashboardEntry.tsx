'use client';

import { useEffect, useState } from 'react';
import ProviderDashboardManager from './ProviderDashboardManager';
import ProviderDashboardHandleCenter from './ProviderDashboardHandleCenter';
import ProviderDashboardLaunchCenter from './ProviderDashboardLaunchCenter';
import ProviderDashboardAvailabilityCenter from './ProviderDashboardAvailabilityCenter';
import ProviderLiveAvailabilityControl from './ProviderLiveAvailabilityControl';
import BusinessProductCatalogShortcut from './BusinessProductCatalogShortcut';
import BusinessProductOrderAttention from './BusinessProductOrderAttention';
import BusinessShopStatusControl from './BusinessShopStatusControl';

export default function ProviderDashboardEntry() {
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setWorkspaceVersion((value) => value + 1);
    window.addEventListener('provider-services-refresh', refresh);
    return () => window.removeEventListener('provider-services-refresh', refresh);
  }, []);

  return <>
    <ProviderDashboardManager key={workspaceVersion} />
    <ProviderDashboardHandleCenter />
    <ProviderDashboardLaunchCenter />
    <ProviderDashboardAvailabilityCenter key={`availability-${workspaceVersion}`} />
    <BusinessProductOrderAttention />
    <BusinessProductCatalogShortcut />
    <BusinessShopStatusControl />
    <ProviderLiveAvailabilityControl />
  </>;
}
