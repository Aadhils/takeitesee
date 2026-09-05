import { EmployerApplicantFinder } from '../../../../components/jobs/EmployerApplicantFinder';
import { LiveProviderShell } from '../../../../components/provider/LiveProviderShell';

export default function EmployerApplicantFinderPage() {
  return <LiveProviderShell active="/provider/jobs">
    <EmployerApplicantFinder />
  </LiveProviderShell>;
}
