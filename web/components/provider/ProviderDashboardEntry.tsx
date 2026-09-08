'use client';

import ProviderDashboardManager from './ProviderDashboardManager';
import ProviderLiveAvailabilityControl from './ProviderLiveAvailabilityControl';

export default function ProviderDashboardEntry() {
  return <>
    <ProviderDashboardManager />
    <ProviderLiveAvailabilityControl />
  </>;
}
