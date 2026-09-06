import { redirect } from 'next/navigation';
import ProfessionalResumeWorkspace from '../../../components/provider/ProfessionalResumeWorkspace';
import { getProviderSessionOrNull } from '../../../server/auth/session';

export default async function ProviderResumeRoute() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('professional')) redirect('/provider');

  return <ProfessionalResumeWorkspace />;
}
