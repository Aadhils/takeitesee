import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '../../../../components/ui/primitives';
import { discoveryBookings, discoveryServices, displayText } from '../../../../data/discovery-fixtures';

export default async function BookingReviewRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = discoveryBookings.find((item) => item.id === bookingId);
  const service = booking ? discoveryServices.find((item) => item.id === booking.service_id) : undefined;
  if (!booking || !service || !booking.review_eligible) notFound();
  return <div className="review-entry-page"><Card><span className="eyebrow">Presentation review</span><Badge tone="success">Completed booking</Badge><h1>Share your experience</h1><p className="detail-copy">A review form will be connected to eligible completed bookings in a later phase. No review is submitted from this screen.</p><h2>{displayText(service.service_name)}</h2><p>{booking.provider_name} · {booking.booking_reference}</p><Link href={`/bookings/${booking.id}`} className="button button-secondary">Back to booking</Link></Card></div>;
}
