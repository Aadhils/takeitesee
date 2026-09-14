import { ProviderAvailabilityManager } from '../../../components/provider/ProviderAvailabilityManager';
import styles from '../../../components/provider/ProviderScheduleResponsive.module.css';

export default function ProviderScheduleRoute() {
  return <div className={styles.scheduleJourney}><ProviderAvailabilityManager /></div>;
}
