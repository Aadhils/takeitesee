import { redirect } from 'next/navigation';
import ProfessionalPublicReadinessManager from '../../../components/provider/ProfessionalPublicReadinessManager';
import { getProviderSessionOrNull } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProfessionalPublicReadinessPage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('professional')) redirect('/provider');

  return <ProfessionalPublicReadinessManager />;
}
