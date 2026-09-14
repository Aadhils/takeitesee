import ProviderProductsManager from '../../../components/provider/ProviderProductsManager';
import styles from '../../../components/provider/ProviderProductsResponsive.module.css';

export default function ProviderProductsRoute() {
  return <div className={styles.productsJourney}><ProviderProductsManager /></div>;
}
