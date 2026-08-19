import { notFound } from 'next/navigation';
import RealBookingReview from '../../../../components/booking/RealBookingReview';
import { getCatalogService } from '../../../../services/catalog-repository';

export default async function BookingReviewPage({ params, searchParams }: { params: Promise<{ serviceId: string }>; searchParams: Promise<{ date?: string; dateLabel?: string; time?: string }> }) {
  const [{ serviceId }, query] = await Promise.all([params, searchParams]);
  const service = await getCatalogService(serviceId);
  if (!service || !query.date || !query.time) notFound();
  return <RealBookingReview service={service} date={query.date} dateLabel={query.dateLabel} time={query.time} />;
}
