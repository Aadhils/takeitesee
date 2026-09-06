import { redirect } from 'next/navigation';
import ProfessionalPortfolioWorkspace from '../../../components/provider/ProfessionalPortfolioWorkspace';
import { getProviderSessionOrNull } from '../../../server/auth/session';

export default async function ProviderPortfolioPage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('professional')) redirect('/provider');

  return <ProfessionalPortfolioWorkspace />;
}
