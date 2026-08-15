import { notFound } from 'next/navigation';
import { AdminBookingOperationalDetail } from '../../../../components/admin/AdminPresentation';
import { adminBookings } from '../../../../data/admin-fixtures';

export default async function AdminBookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  if (!adminBookings.some((booking) => booking.id === bookingId)) notFound();
  return <AdminBookingOperationalDetail bookingId={bookingId} />;
}
