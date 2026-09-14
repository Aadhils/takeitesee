import ProviderBookingDetail from '../../../../components/provider/ProviderBookingDetail';
import styles from '../../../../components/provider/ProviderBookingsResponsive.module.css';

export default async function ProviderBookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <div className={styles.detailJourney}><ProviderBookingDetail bookingId={bookingId} /></div>;
}
