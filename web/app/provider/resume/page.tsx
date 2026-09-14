import { redirect } from 'next/navigation';
import ProfessionalResumeWorkspace from '../../../components/provider/ProfessionalResumeWorkspace';
import styles from '../../../components/provider/ProfessionalResumeResponsive.module.css';
import { getProviderSessionOrNull } from '../../../server/auth/session';

export default async function ProviderResumeRoute() {
  const session = await getProviderSessionOrNull();
  if (!session) return null;
  if (!session.roles.includes('professional')) redirect('/provider');

  return <div className={styles.resumeJourney}><ProfessionalResumeWorkspace /></div>;
}
