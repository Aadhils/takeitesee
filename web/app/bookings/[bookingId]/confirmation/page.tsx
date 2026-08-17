import CustomerBookingConfirmation from '../../../../components/booking/CustomerBookingConfirmation';

export default async function BookingConfirmationRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <CustomerBookingConfirmation bookingId={bookingId} />;
}