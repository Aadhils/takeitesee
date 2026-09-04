import { LiveProviderShell } from '../../../components/provider/LiveProviderShell';
import { EmployerApplicantResumeReview } from '../../../components/jobs/EmployerApplicantResumeReview';
import { ProviderJobMarketplace } from '../../../components/jobs/ProviderJobMarketplace';

export default function ProviderJobsPage() {
  return <LiveProviderShell active="/provider/jobs">
    <ProviderJobMarketplace />
    <EmployerApplicantResumeReview />
  </LiveProviderShell>;
}
