import ProviderPublicReadinessManager from '../../../components/provider/ProfessionalPublicReadinessManager';
import { getProviderSessionOrNull } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProviderPublicReadinessPage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;

  return <ProviderPublicReadinessManager />;
}
