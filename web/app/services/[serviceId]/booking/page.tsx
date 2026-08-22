import { notFound } from 'next/navigation';
import LiveBookingSelection from '../../../../components/detail/LiveBookingSelection';
import { discoveryServices } from '../../../../data/discovery-fixtures';

export default async function ServiceBookingPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const service = discoveryServices.find((item) => item.id === serviceId);
  if (!service) notFound();
  return <LiveBookingSelection service={service} />;
}
