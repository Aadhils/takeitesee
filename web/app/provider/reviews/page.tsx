import ProviderReviewsManager from '../../../components/provider/ProviderReviewsManager';
import styles from '../../../components/provider/ProviderReviewsResponsive.module.css';

export default function ProviderReviewsRoute() {
  return <div className={styles.reviewsJourney}><ProviderReviewsManager /></div>;
}
