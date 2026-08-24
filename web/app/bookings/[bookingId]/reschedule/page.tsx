import CustomerBookingReschedule from '../../../../components/booking/CustomerBookingReschedule';

export default async function BookingRescheduleRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <CustomerBookingReschedule bookingId={bookingId} />;
}
