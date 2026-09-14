import ProviderSetupManager from '../../../components/provider/ProviderSetupManager';
import styles from '../../../components/provider/ProviderSetupResponsive.module.css';

export const dynamic = 'force-dynamic';

export default function ProviderSetupPage() {
  return <div className={styles.setupJourney}><ProviderSetupManager /></div>;
}
