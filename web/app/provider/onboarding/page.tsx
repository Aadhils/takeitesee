import { Suspense } from 'react';
import { ProviderOnboarding } from '../../../components/provider/ProviderOnboarding';

export default function ProviderOnboardingRoute() {
  return (
    <Suspense fallback={<div className="auth-page"><section className="page-intro"><span className="eyebrow">Provider onboarding</span><h1>Loading onboarding...</h1></section></div>}>
      <ProviderOnboarding />
    </Suspense>
  );
}
