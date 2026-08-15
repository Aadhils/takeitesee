import { notFound } from 'next/navigation';
import { ConfirmationPanel } from '../../../components/booking/BookingPresentation';
import { createDiscoveryBookingPreview, discoveryBookings, discoveryServices } from '../../../data/discovery-fixtures';

export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ date?: string; time?: string }> }) {
  const { bookingId } = await params;
  const query = await searchParams;
  const existingBooking = discoveryBookings.find((item) => item.id === bookingId);
  const previewService = discoveryServices.find((item) => `demo-${item.id}` === bookingId);
  const booking = existingBooking ?? (previewService ? createDiscoveryBookingPreview(previewService, query.date ?? 'Selected date', query.time ?? 'Selected time') : undefined);
  const service = booking ? discoveryServices.find((item) => item.id === booking.service_id) : undefined;
  if (!booking || !service) notFound();
  return <ConfirmationPanel booking={booking} service={service} />;
}
