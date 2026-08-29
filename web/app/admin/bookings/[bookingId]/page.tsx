import AdminLiveBookingDetail from '../../../../components/admin/AdminLiveBookingDetail';
import { productionAuthProvider } from '../../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminBookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  await productionAuthProvider.requireAdmin();
  const { bookingId } = await params;
  return <AdminLiveBookingDetail bookingId={bookingId} />;
}
