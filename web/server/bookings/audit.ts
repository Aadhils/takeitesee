import { createSupabaseServerClient } from '../../lib/supabase/server';

export type BookingAuditCategory = 'booking' | 'payment' | 'refund' | 'review' | 'support' | 'closeout';
export type BookingAuditActor = 'customer' | 'provider' | 'admin' | 'gateway' | 'system' | 'migration';

export interface BookingAuditEvent {
  id: string;
  category: BookingAuditCategory;
  actor: BookingAuditActor;
  status: string;
  title: string;
  detail: string;
  occurred_at: string;
}

export interface BookingAuditSummary {
  id: string; booking_reference: string; customer_id: string; service_id: string; service_name: string;
  provider_type: 'professional' | 'business'; provider_name: string; booking_date: string; start_time: string; timezone: string;
  duration_minutes: number; location: string; quoted_price: number; currency: string; status: string; payment_status: string; created_at: string; updated_at: string;
}
export interface BookingAuditReadModel { booking: BookingAuditSummary; events: BookingAuditEvent[]; }

function relatedName(value: unknown, key: 'name' | 'headline') {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' && key in row ? String((row as Record<string, unknown>)[key] ?? '') : '';
}
function stripPrefix(reason: string, prefix: string) { return reason.startsWith(prefix) ? reason.slice(prefix.length).trim() : ''; }
function parseRescheduleReason(reason: string) {
  if (!reason.startsWith('customer:reschedule |')) return null;
  const parts = reason.split(' | ');
  return { reason: parts[1] ?? '', from: (parts.find((part) => part.startsWith('from=')) ?? '').replace(/^from=/, ''), to: (parts.find((part) => part.startsWith('to=')) ?? '').replace(/^to=/, '') };
}
function bookingActor(reason: string): BookingAuditActor {
  if (reason.startsWith('customer:')) return 'customer';
  if (reason.startsWith('provider:')) return 'provider';
  if (reason.startsWith('admin:')) return 'admin';
  return 'system';
}
function bookingCopy(row: Record<string, unknown>) {
  const fromStatus = (row.from_status as string | null) ?? null;
  const toStatus = String(row.to_status ?? '');
  const reason = String(row.reason ?? '');
  if (toStatus === 'confirmed' && (fromStatus === 'rescheduled' || reason === 'provider:accept_reschedule')) return { title: 'New time confirmed', detail: 'The provider accepted the customer’s requested new time.' };
  if (toStatus === 'confirmed') return { title: 'Booking confirmed', detail: 'The provider accepted the booking request.' };
  if (toStatus === 'completed') return { title: 'Service completed', detail: 'The provider marked the scheduled service as completed.' };
  if (toStatus === 'rescheduled') {
    const parsed = parseRescheduleReason(reason);
    if (parsed) {
      const movement = parsed.from && parsed.to ? ` from ${parsed.from} to ${parsed.to}` : '';
      const why = parsed.reason ? ` Reason: ${parsed.reason}.` : '';
      return { title: 'New time requested', detail: `The customer requested a schedule change${movement}.${why} Provider confirmation is required.` };
    }
    return { title: 'Booking rescheduled', detail: 'The booking schedule changed and availability was revalidated.' };
  }
  if (toStatus === 'cancelled' && reason.startsWith('provider:decline')) {
    const why = stripPrefix(reason, 'provider:decline |');
    return { title: fromStatus === 'rescheduled' ? 'New time declined' : 'Booking declined', detail: why ? `The provider declined the request. Reason: ${why}` : 'The provider declined the request.' };
  }
  if (toStatus === 'cancelled' && reason.startsWith('customer:cancel')) {
    const why = stripPrefix(reason, 'customer:cancel |');
    return { title: 'Booking cancelled', detail: why ? `The customer cancelled the booking. Reason: ${why}` : 'The customer cancelled the booking.' };
  }
  if (toStatus === 'cancelled') return { title: 'Booking cancelled', detail: reason ? `Reason: ${reason}` : 'The booking was cancelled.' };
  return { title: `Booking status changed to ${toStatus.replaceAll('_', ' ')}`, detail: fromStatus ? `Previous booking status: ${fromStatus.replaceAll('_', ' ')}.` : 'Booking status updated.' };
}

function paymentActor(source: string): BookingAuditActor {
  if (source === 'admin') return 'admin';
  if (source === 'gateway') return 'gateway';
  if (source === 'migration') return 'migration';
  return 'system';
}
function paymentCopy(row: Record<string, unknown>) {
  const fromStatus = (row.from_status as string | null) ?? null;
  const toStatus = String(row.to_status ?? '');
  const amount = Number(row.amount ?? 0);
  const currency = String(row.currency ?? 'INR');
  let formattedAmount = `${currency} ${amount.toFixed(2)}`;
  try { formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount); } catch {}
  if (toStatus === 'unpaid' && !fromStatus) return { title: 'Payment not yet collected', detail: `The booking started with ${formattedAmount} due.` };
  if (toStatus === 'unpaid') return { title: 'Payment reset to unpaid', detail: `The payment state returned to unpaid for ${formattedAmount}.` };
  if (toStatus === 'pending') return { title: 'Payment processing', detail: `Payment of ${formattedAmount} is being processed.` };
  if (toStatus === 'paid') return { title: 'Payment recorded as paid', detail: `Payment of ${formattedAmount} was successfully recorded.` };
  if (toStatus === 'failed') return { title: 'Payment failed', detail: `Payment of ${formattedAmount} was not completed.` };
  if (toStatus === 'refunded') return { title: 'Payment refunded', detail: `Payment of ${formattedAmount} was recorded as refunded after verified gateway reconciliation.` };
  return { title: `Payment status changed to ${toStatus}`, detail: fromStatus ? `Previous payment status: ${fromStatus}.` : 'Payment status updated.' };
}

function relationRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? row as Record<string, unknown> : null;
}
function refundCopy(row: Record<string, unknown>) {
  const toStatus = String(row.to_status ?? '');
  const refund = relationRow(row.booking_refunds);
  const amountMinor = Number(refund?.amount_minor ?? 0);
  const currency = String(refund?.currency ?? 'INR');
  let formattedAmount = `${currency} ${(amountMinor / 100).toFixed(2)}`;
  try { formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amountMinor / 100); } catch {}
  if (toStatus === 'created') return { title: 'Full refund requested', detail: `A full refund of ${formattedAmount} was reserved for gateway processing.` };
  if (toStatus === 'pending') return { title: 'Refund processing', detail: `Cashfree is processing the full refund of ${formattedAmount}.` };
  if (toStatus === 'onhold') return { title: 'Refund on hold', detail: `The ${formattedAmount} refund is temporarily on hold with the payment gateway and needs follow-up.` };
  if (toStatus === 'succeeded') return { title: 'Refund completed', detail: `Cashfree confirmed the full refund of ${formattedAmount}. The booking payment is now refunded.` };
  if (toStatus === 'failed') return { title: 'Refund failed', detail: `The ${formattedAmount} refund was not completed by the payment gateway and needs finance follow-up.` };
  if (toStatus === 'cancelled') return { title: 'Refund cancelled', detail: `The ${formattedAmount} gateway refund was cancelled before completion.` };
  if (toStatus === 'requires_review') return { title: 'Refund requires finance review', detail: `The ${formattedAmount} refund was not sent because the provider payout has reached a protected transfer state. Finance recovery review is required first.` };
  return { title: `Refund status changed to ${toStatus}`, detail: `Refund processing status changed to ${toStatus.replaceAll('_', ' ')}.` };
}

function supportCopy(row: Record<string, unknown>) {
  const eventType = String(row.event_type ?? 'status_changed');
  const toStatus = String(row.to_status ?? 'open');
  const note = String(row.note ?? '').trim();
  if (eventType === 'opened') return { title: 'Support case opened', detail: note ? `Customer requested operations support. ${note}` : 'Customer requested operations support.' };
  if (eventType === 'note') return { title: 'Support note added', detail: note || 'A support note was added.' };
  return { title: `Support case ${toStatus.replaceAll('_', ' ')}`, detail: note ? `Operations updated the support case. ${note}` : `Operations changed the support case to ${toStatus.replaceAll('_', ' ')}.` };
}

function closeoutCopy(row: Record<string, unknown>) {
  const eventType = String(row.event_type ?? '');
  const note = String(row.note ?? '').trim();
  if (eventType === 'customer_completion_confirmed') return { title: 'Customer confirmed completion', detail: 'The customer acknowledged that the service was completed.' };
  if (eventType === 'customer_no_show_reported') return { title: 'Customer no-show recorded', detail: note ? `The provider recorded a customer no-show. ${note}` : 'The provider recorded a customer no-show after the grace period.' };
  if (eventType === 'provider_no_show_reported') return { title: 'Provider no-show reported', detail: note ? `The customer reported a provider no-show. ${note}` : 'The customer reported a provider no-show and support follow-up was opened.' };
  if (eventType === 'eligible_to_close') return { title: 'SLA window ended', detail: note || 'The booking reached final-close eligibility, subject to remaining blockers.' };
  if (eventType === 'closed') return { title: 'Booking lifecycle finally closed', detail: note || 'All required closeout conditions were satisfied.' };
  return { title: 'Closeout updated', detail: note || 'The booking closeout state changed.' };
}

export async function getBookingAuditReadModel(bookingId: string): Promise<BookingAuditReadModel | null> {
  const supabase = await createSupabaseServerClient();
  const { data: bookingRow, error: bookingError } = await supabase
    .from('bookings')
    .select('id,booking_reference,customer_id,service_id,service_name_snapshot,provider_type,business_id,professional_id,booking_date,start_time,timezone,duration_minutes,location,quoted_price,currency,status,payment_status,created_at,updated_at,businesses(name),professional_profiles(headline)')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingError) throw new Error(bookingError.message);
  if (!bookingRow) return null;

  const [statusResult, paymentResult, refundResult, riskResult, reviewResult, issueResult, issueEventResult, closeoutEventResult] = await Promise.all([
    supabase.from('booking_status_history').select('id,from_status,to_status,changed_by,reason,created_at').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('booking_payment_events').select('id,from_status,to_status,amount,currency,source,created_at').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('booking_refund_events').select('id,refund_id,from_status,to_status,status_description,recorded_at,booking_refunds(amount_minor,currency)').eq('booking_id', bookingId).order('recorded_at', { ascending: true }),
    supabase.rpc('get_booking_finance_risk_events', { target_booking_id: bookingId }),
    supabase.from('reviews').select('id,rating,status,provider_response,provider_responded_at,provider_response_updated_at,created_at').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('marketplace_issues').select('id,category,summary,status,created_at').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('marketplace_issue_events').select('id,issue_id,actor_type,event_type,from_status,to_status,note,created_at').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('booking_closeout_events').select('id,actor_type,event_type,note,created_at').eq('booking_id', bookingId).order('created_at', { ascending: true }),
  ]);

  for (const result of [statusResult, paymentResult, refundResult, riskResult, reviewResult, issueResult, issueEventResult, closeoutEventResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const providerType = bookingRow.provider_type as 'professional' | 'business';
  const providerName = providerType === 'business' ? relatedName(bookingRow.businesses, 'name') : relatedName(bookingRow.professional_profiles, 'headline');
  const openedIssueIds = new Set((issueEventResult.data ?? []).filter((row) => row.event_type === 'opened').map((row) => String(row.issue_id)));

  const events: BookingAuditEvent[] = [
    { id: `booking-created:${bookingRow.id}`, category: 'booking', actor: 'customer', status: 'pending', title: 'Booking requested', detail: 'The customer created the booking request.', occurred_at: String(bookingRow.created_at) },
    ...(statusResult.data ?? []).map((row): BookingAuditEvent => { const copy = bookingCopy(row as Record<string, unknown>); const reason = String(row.reason ?? ''); return { id: String(row.id), category: 'booking', actor: bookingActor(reason), status: String(row.to_status), title: copy.title, detail: copy.detail, occurred_at: String(row.created_at) }; }),
    ...(paymentResult.data ?? []).map((row): BookingAuditEvent => { const copy = paymentCopy(row as Record<string, unknown>); return { id: String(row.id), category: 'payment', actor: paymentActor(String(row.source ?? 'system')), status: String(row.to_status), title: copy.title, detail: copy.detail, occurred_at: String(row.created_at) }; }),
    ...(refundResult.data ?? []).map((row): BookingAuditEvent => { const copy = refundCopy(row as Record<string, unknown>); return { id: `refund:${String(row.id)}`, category: 'refund', actor: row.from_status == null ? 'admin' : 'gateway', status: String(row.to_status), title: copy.title, detail: copy.detail, occurred_at: String(row.recorded_at) }; }),
    ...(riskResult.data ?? []).map((row): BookingAuditEvent => ({ id: `risk:${String(row.id)}`, category: 'payment', actor: 'gateway', status: String(row.status), title: String(row.title), detail: String(row.detail), occurred_at: String(row.occurred_at) })),
    ...(reviewResult.data ?? []).flatMap((row): BookingAuditEvent[] => {
      const items: BookingAuditEvent[] = [{ id: `review:${row.id}`, category: 'review', actor: 'customer', status: String(row.status), title: 'Customer review submitted', detail: `The customer rated the completed service ${Number(row.rating)}/5.`, occurred_at: String(row.created_at) }];
      if (row.provider_response) items.push({ id: `review-response:${row.id}`, category: 'review', actor: 'provider', status: 'responded', title: 'Provider responded to review', detail: 'The provider published an official response to the customer review.', occurred_at: String(row.provider_response_updated_at || row.provider_responded_at || row.created_at) });
      return items;
    }),
    ...(issueResult.data ?? []).filter((row) => !openedIssueIds.has(String(row.id))).map((row): BookingAuditEvent => ({ id: `support-open-fallback:${row.id}`, category: 'support', actor: 'customer', status: String(row.status), title: 'Support case opened', detail: `${String(row.category)}: ${String(row.summary)}`, occurred_at: String(row.created_at) })),
    ...(issueEventResult.data ?? []).map((row): BookingAuditEvent => {
      const copy = supportCopy(row as Record<string, unknown>);
      const actor = ['customer','provider','admin','system'].includes(String(row.actor_type)) ? String(row.actor_type) as BookingAuditActor : 'system';
      return { id: String(row.id), category: 'support', actor, status: String(row.to_status || row.event_type), title: copy.title, detail: copy.detail, occurred_at: String(row.created_at) };
    }),
    ...(closeoutEventResult.data ?? []).map((row): BookingAuditEvent => {
      const copy = closeoutCopy(row as Record<string, unknown>);
      const actor = ['customer','provider','admin','system'].includes(String(row.actor_type)) ? String(row.actor_type) as BookingAuditActor : 'system';
      return { id: `closeout:${String(row.id)}`, category: 'closeout', actor, status: String(row.event_type), title: copy.title, detail: copy.detail, occurred_at: String(row.created_at) };
    }),
  ];

  events.sort((left, right) => {
    const time = new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime();
    if (time !== 0) return time;
    if (left.id.startsWith('booking-created:')) return -1;
    if (right.id.startsWith('booking-created:')) return 1;
    return left.category.localeCompare(right.category);
  });

  return {
    booking: {
      id: String(bookingRow.id), booking_reference: String(bookingRow.booking_reference), customer_id: String(bookingRow.customer_id), service_id: String(bookingRow.service_id), service_name: String(bookingRow.service_name_snapshot), provider_type: providerType,
      provider_name: providerName || (providerType === 'business' ? 'Business provider' : 'Professional provider'), booking_date: String(bookingRow.booking_date), start_time: String(bookingRow.start_time), timezone: String(bookingRow.timezone || 'Asia/Kolkata'), duration_minutes: Number(bookingRow.duration_minutes), location: String(bookingRow.location || ''), quoted_price: Number(bookingRow.quoted_price), currency: String(bookingRow.currency || 'INR'), status: String(bookingRow.status), payment_status: String(bookingRow.payment_status), created_at: String(bookingRow.created_at), updated_at: String(bookingRow.updated_at),
    },
    events,
  };
}
