import { notFound } from 'next/navigation';
import { AccountShell, ReviewForm } from '../../../components/account/AccountPresentation';
import { discoveryBookings } from '../../../data/discovery-fixtures';

export default async function ReviewEntryRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = discoveryBookings.find((item) => item.id === bookingId && item.review_eligible);
  if (!booking) notFound();
  return <AccountShell active="/reviews"><section className="account-page-heading"><span className="eyebrow">Customer account</span><h1>Leave a review</h1><p>Your feedback stays in presentation state and is not submitted.</p></section><ReviewForm bookingId={booking.id} /></AccountShell>;
}
