import { notFound } from 'next/navigation';
import { BookingSelection } from '../../../../components/detail/DetailPresentation';
import { discoveryServices } from '../../../../data/discovery-fixtures';

export default async function ServiceBookingPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const service = discoveryServices.find((item) => item.id === serviceId);
  if (!service) notFound();
  return <BookingSelection service={service} />;
}
