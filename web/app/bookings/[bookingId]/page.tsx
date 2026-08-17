import CustomerBookingDetail from '../../../components/booking/CustomerBookingDetail';

export default async function BookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <CustomerBookingDetail bookingId={bookingId} />;
}
