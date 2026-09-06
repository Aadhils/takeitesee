import { redirect } from 'next/navigation';
import { EmployerApplicantFinder } from '../../../../components/jobs/EmployerApplicantFinder';
import { LiveProviderShell } from '../../../../components/provider/LiveProviderShell';
import { getProviderSessionOrNull } from '../../../../server/auth/session';

export default async function EmployerApplicantFinderPage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('business_owner')) redirect('/provider/jobs');

  return <LiveProviderShell active="/provider/jobs">
    <EmployerApplicantFinder />
  </LiveProviderShell>;
}
