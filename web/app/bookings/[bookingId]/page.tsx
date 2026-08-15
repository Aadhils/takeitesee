import { notFound } from 'next/navigation';
import { BookingDetail } from '../../../components/booking/BookingPresentation';
import { createDiscoveryBookingPreview, discoveryBookings, discoveryServices } from '../../../data/discovery-fixtures';

export default async function BookingDetailRoute({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ date?: string; time?: string }> }) {
  const { bookingId } = await params;
  const query = await searchParams;
  const booking = discoveryBookings.find((item) => item.id === bookingId) ?? (() => {
    const service = discoveryServices.find((item) => item.id === bookingId);
    return service ? createDiscoveryBookingPreview(service, query.date ?? 'Selected date', query.time ?? 'Selected time') : undefined;
  })();
  if (!booking) notFound();
  return <BookingDetail booking={booking} />;
}
