import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';
import { ProviderJobMarketplace } from '../../../components/jobs/ProviderJobMarketplace';

export default function ProviderJobsPage() {
  return <LiveProviderShell active="/provider/jobs"><ProviderJobMarketplace /></LiveProviderShell>;
}
