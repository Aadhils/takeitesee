import { notFound } from 'next/navigation';
import { Badge, Card } from '../../../../components/ui/primitives';
import { ProviderShell, ProviderStatusBadge, ProviderPaymentBadge } from '../../../../components/provider/ProviderPresentation';
import { providerBookings } from '../../../../data/provider-fixtures';
import { formatMoney } from '../../../../types/money';

export default async function ProviderBookingDetailRoute({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = providerBookings.find((item) => item.id === bookingId);
  if (!booking) notFound();
  return <ProviderShell active="/provider/bookings"><section className="provider-page-heading"><div><span className="eyebrow">{booking.booking_reference}</span><h1>{booking.customer_name}</h1><p>Review this fixture booking before taking a presentation-only action.</p></div><ProviderStatusBadge status={booking.status} /></section><div className="provider-detail-grid"><Card className="provider-detail-card"><div className="section-heading"><div><span className="eyebrow">Booking</span><h2>Service details</h2></div><ProviderPaymentBadge status={booking.payment_status} /></div><dl className="provider-profile-details"><div><dt>Date and time</dt><dd>{booking.date_label}, {booking.time} IST</dd></div><div><dt>Service location</dt><dd>{booking.location}</dd></div><div><dt>Service value</dt><dd>{formatMoney(booking.price)}</dd></div><div><dt>Customer note</dt><dd>{booking.customer_note ?? 'No note provided'}</dd></div></dl><Badge tone="warning">Presentation fixture</Badge></Card><Card className="provider-detail-card"><span className="eyebrow">Next action</span><h2>Provider controls</h2><p className="provider-fixture-note">Accept, decline, start, and completion actions are demonstrated on the bookings list. They do not persist.</p><button className="button button-secondary" type="button" disabled>Open customer contact</button></Card></div></ProviderShell>;
}
