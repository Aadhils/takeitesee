import { redirect } from 'next/navigation';

export default async function BookingReviewRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  redirect(`/bookings/${encodeURIComponent(bookingId)}`);
}
