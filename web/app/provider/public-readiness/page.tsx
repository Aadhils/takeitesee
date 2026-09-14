import ProviderPublicReadinessManager from '../../../components/provider/ProfessionalPublicReadinessManager';
import styles from '../../../components/provider/ProviderPublicReadinessResponsive.module.css';
import { getProviderSessionOrNull } from '../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function ProviderPublicReadinessPage() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;

  return <div className={styles.readinessJourney}><ProviderPublicReadinessManager /></div>;
}
