import { ProviderCatalogManager } from '../../../components/provider/ProviderCatalogManager';
import styles from '../../../components/provider/ProviderServicesResponsive.module.css';

export default function ProviderServicesRoute() {
  return <div className={styles.servicesJourney}><ProviderCatalogManager /></div>;
}
