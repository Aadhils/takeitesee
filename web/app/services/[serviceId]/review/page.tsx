import { notFound } from 'next/navigation';
import { BookingReview } from '../../../../components/booking/BookingPresentation';
import { discoveryServices } from '../../../../data/discovery-fixtures';

export default async function BookingReviewPage({ params, searchParams }: { params: Promise<{ serviceId: string }>; searchParams: Promise<{ date?: string; dateLabel?: string; time?: string }> }) {
  const [{ serviceId }, query] = await Promise.all([params, searchParams]);
  const service = discoveryServices.find((item) => item.id === serviceId);
  if (!service || !query.date || !query.time) notFound();
  return <BookingReview service={service} date={query.date} dateLabel={query.dateLabel} time={query.time} />;
}
