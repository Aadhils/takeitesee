import AdminLiveBookingDetail from '../../../../components/admin/AdminLiveBookingDetail';
import { getAdminSessionOrNull } from '../../../../server/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminBookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  if (!await getAdminSessionOrNull()) return null;
  const { bookingId } = await params;
  return <AdminLiveBookingDetail bookingId={bookingId} />;
}
