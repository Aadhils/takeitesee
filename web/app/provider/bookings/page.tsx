import ProviderBookingsManager from '../../../components/provider/ProviderBookingsManager';
import styles from '../../../components/provider/ProviderBookingsResponsive.module.css';

export default function ProviderBookingsRoute() {
  return <div className={styles.bookingsJourney}><ProviderBookingsManager /></div>;
}
