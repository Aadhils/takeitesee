import { redirect } from 'next/navigation';
import ProfessionalResumeExport from '../../../../components/provider/ProfessionalResumeExport';
import { getProviderSessionOrNull } from '../../../../server/auth/session';

export default async function ProviderResumeExportRoute() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('professional')) redirect('/provider');

  return <ProfessionalResumeExport />;
}
