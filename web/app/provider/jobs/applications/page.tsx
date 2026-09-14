import { redirect } from 'next/navigation';
import { LiveProviderShell } from '../../../../components/provider/LiveProviderShell';
import { ProviderJobMarketplace } from '../../../../components/jobs/ProviderJobMarketplace';
import responsiveStyles from '../../../../components/jobs/ProfessionalJobsResponsive.module.css';
import { getProviderSessionOrNull } from '../../../../server/auth/session';

export default async function ProfessionalJobApplicationsPage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('professional')) redirect('/provider/jobs');

  return <LiveProviderShell active="/provider/jobs">
    <div className={responsiveStyles.professionalJobsJourney}>
      <ProviderJobMarketplace />
    </div>
  </LiveProviderShell>;
}
