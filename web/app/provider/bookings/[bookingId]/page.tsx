import ProviderBookingDetail from '../../../../components/provider/ProviderBookingDetail';

export default async function ProviderBookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <ProviderBookingDetail bookingId={bookingId} />;
}
