import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';
import { ProviderJobsExperience } from '../../../components/jobs/ProviderJobsExperience';

export default function ProviderJobsPage() {
  return <LiveProviderShell active="/provider/jobs">
    <ProviderJobsExperience />
  </LiveProviderShell>;
}
