import CustomerBookingConfirmation from '../../../components/booking/CustomerBookingConfirmation';

export default async function ConfirmationPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <CustomerBookingConfirmation bookingId={bookingId} />;
}
