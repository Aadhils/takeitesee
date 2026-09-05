import CustomerBookingDetail from '../../../components/booking/CustomerBookingDetail';
import { BookingCalendarAction } from '../../../components/booking/BookingCalendarAction';

export default async function BookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <BookingCalendarAction bookingId={bookingId} />
    <CustomerBookingDetail bookingId={bookingId} />
  </div>;
}
