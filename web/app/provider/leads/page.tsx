import { ProviderRequirementLeadsManager } from '../../../components/provider/ProviderRequirementLeadsManager';
import styles from '../../../components/provider/ProviderRequirementLeadsResponsive.module.css';

export default function ProviderLeadsRoute() {
  return <div className={styles.journey}><ProviderRequirementLeadsManager /></div>;
}
