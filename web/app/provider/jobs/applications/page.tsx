import { redirect } from 'next/navigation';
import { LiveProviderShell } from '../../../../components/provider/LiveProviderShell';
import { ProviderJobMarketplace } from '../../../../components/jobs/ProviderJobMarketplace';
import { getProviderSessionOrNull } from '../../../../server/auth/session';

export default async function ProfessionalJobApplicationsPage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('professional')) redirect('/provider/jobs');

  return <LiveProviderShell active="/provider/jobs">
    <ProviderJobMarketplace />
  </LiveProviderShell>;
}
