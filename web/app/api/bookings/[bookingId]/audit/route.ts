import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../../server/auth/session';
import { getBookingAuditReadModel } from '../../../../../server/bookings/audit';
import { loadPublicProviderIdentity } from '../../../../../server/marketplace/public-provider-identity';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await productionAuthProvider.getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { bookingId } = await params;
    const audit = await getBookingAuditReadModel(bookingId);
    if (!audit) return NextResponse.json({ error: 'Booking not found or not accessible.' }, { status: 404 });

    if (!audit.booking.provider_name) {
      const supabase = await createSupabaseServerClient();
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('provider_type,business_id,professional_id')
        .eq('id', bookingId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (booking) {
        const providerType = booking.provider_type === 'business' ? 'business' : 'professional';
        const providerId = providerType === 'business' ? booking.business_id : booking.professional_id;
        const identity = await loadPublicProviderIdentity(supabase, providerType, providerId ? String(providerId) : null);
        if (identity?.display_name) audit.booking.provider_name = identity.display_name;
      }
    }

    return NextResponse.json(audit);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load booking audit.' }, { status: 400 });
  }
}
