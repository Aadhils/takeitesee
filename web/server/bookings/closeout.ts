import { createSupabaseServerClient } from '../../lib/supabase/server';

export type CloseoutState =
  | 'in_progress'
  | 'awaiting_review'
  | 'reviewed'
  | 'support_open'
  | 'support_resolved'
  | 'cancelled'
  | 'customer_no_show'
  | 'provider_no_show'
  | 'eligible_to_close'
  | 'closed';

export type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';

export interface BookingCloseoutReview {
  id: string;
  rating: number;
  comment?: string;
  status: string;
  provider_response?: string;
  provider_responded_at?: string;
  created_at: string;
}

export interface BookingCloseoutIssue {
  id: string;
  category: string;
  summary: string;
  details?: string;
  priority: string;
  status: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface BookingCloseoutPolicy {
  no_show_grace_minutes: number;
  completion_confirmation_hours: number;
  review_window_days: number;
  support_window_days: number;
  auto_close_days: number;
}

export interface BookingCloseoutReadModel {
  booking_id: string;
  booking_reference: string;
  service_name: string;
  booking_status: string;
  payment_status: string;
  state: CloseoutState;
  attendance_outcome: AttendanceOutcome;
  review: BookingCloseoutReview | null;
  issues: BookingCloseoutIssue[];
  active_issue: BookingCloseoutIssue | null;
  policy: BookingCloseoutPolicy;
  service_completed_at?: string;
  customer_completion_confirmed_at?: string;
  customer_no_show_reported_at?: string;
  provider_no_show_reported_at?: string;
  no_show_available_at?: string;
  completion_confirmation_due_at?: string;
  review_due_at?: string;
  support_due_at?: string;
  close_eligible_at?: string;
  closed_at?: string;
  can_confirm_completion: boolean;
  can_report_provider_no_show: boolean;
  can_report_customer_no_show: boolean;
  can_open_support: boolean;
  review_window_open: boolean;
  support_window_open: boolean;
  completion_confirmation_overdue: boolean;
  close_blockers: string[];
}

const activeIssueStatuses = new Set(['open', 'investigating', 'awaiting_information']);

function relatedValue(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' && key in row ? String((row as Record<string, unknown>)[key] ?? '') : '';
}

function zonedDateTimeToEpoch(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.slice(0, 8).split(':').map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = targetUtc;
  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    guess += targetUtc - representedUtc;
  }
  return guess;
}

function addHours(value: string | undefined, hours: number) {
  return value ? new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString() : undefined;
}

function addDays(value: string | undefined, days: number) {
  return value ? new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000).toISOString() : undefined;
}

export async function getBookingCloseoutReadModel(bookingId: string, viewerUserId: string): Promise<BookingCloseoutReadModel | null> {
  const supabase = await createSupabaseServerClient();

  // Opportunistically apply deterministic SLA closure rules whenever an authorized participant opens closeout state.
  // A dedicated sweep RPC exists at the database layer for future scheduled execution.
  await supabase.rpc('apply_booking_closeout_rules', { target_booking_id: bookingId });

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id,booking_reference,customer_id,service_name_snapshot,status,payment_status,booking_date,start_time,timezone,duration_minutes,updated_at,provider_type,businesses(owner_user_id),professional_profiles(user_id)')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) throw new Error(bookingError.message);
  if (!booking) return null;

  const [{ data: review, error: reviewError }, { data: issues, error: issueError }, { data: closeout, error: closeoutError }, { data: policy, error: policyError }] = await Promise.all([
    supabase
      .from('reviews')
      .select('id,rating,comment,status,provider_response,provider_responded_at,created_at')
      .eq('booking_id', bookingId)
      .maybeSingle(),
    supabase
      .from('marketplace_issues')
      .select('id,category,summary,details,priority,status,resolution_note,created_at,updated_at,resolved_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }),
    supabase
      .from('booking_closeouts')
      .select('attendance_outcome,state,service_completed_at,customer_completion_confirmed_at,customer_no_show_reported_at,provider_no_show_reported_at,close_eligible_at,closed_at,closed_reason,updated_at')
      .eq('booking_id', bookingId)
      .maybeSingle(),
    supabase
      .from('booking_closeout_policies')
      .select('no_show_grace_minutes,completion_confirmation_hours,review_window_days,support_window_days,auto_close_days')
      .eq('policy_key', 'default')
      .single(),
  ]);

  if (reviewError) throw new Error(reviewError.message);
  if (issueError) throw new Error(issueError.message);
  if (closeoutError) throw new Error(closeoutError.message);
  if (policyError || !policy) throw new Error(policyError?.message ?? 'Closeout policy is unavailable.');

  const mappedIssues: BookingCloseoutIssue[] = (issues ?? []).map((issue) => ({
    id: String(issue.id),
    category: String(issue.category),
    summary: String(issue.summary),
    details: issue.details ? String(issue.details) : undefined,
    priority: String(issue.priority),
    status: String(issue.status),
    resolution_note: issue.resolution_note ? String(issue.resolution_note) : undefined,
    created_at: String(issue.created_at),
    updated_at: String(issue.updated_at),
    resolved_at: issue.resolved_at ? String(issue.resolved_at) : undefined,
  }));

  const activeIssue = mappedIssues.find((issue) => activeIssueStatuses.has(issue.status)) ?? null;
  const mappedReview: BookingCloseoutReview | null = review ? {
    id: String(review.id),
    rating: Number(review.rating),
    comment: review.comment ? String(review.comment) : undefined,
    status: String(review.status),
    provider_response: review.provider_response ? String(review.provider_response) : undefined,
    provider_responded_at: review.provider_responded_at ? String(review.provider_responded_at) : undefined,
    created_at: String(review.created_at),
  } : null;

  const mappedPolicy: BookingCloseoutPolicy = {
    no_show_grace_minutes: Number(policy.no_show_grace_minutes),
    completion_confirmation_hours: Number(policy.completion_confirmation_hours),
    review_window_days: Number(policy.review_window_days),
    support_window_days: Number(policy.support_window_days),
    auto_close_days: Number(policy.auto_close_days),
  };

  const bookingStatus = String(booking.status);
  const attendanceOutcome = (closeout?.attendance_outcome ? String(closeout.attendance_outcome) : 'pending') as AttendanceOutcome;
  const serviceCompletedAt = closeout?.service_completed_at ? String(closeout.service_completed_at) : undefined;
  const customerNoShowAt = closeout?.customer_no_show_reported_at ? String(closeout.customer_no_show_reported_at) : undefined;
  const providerNoShowAt = closeout?.provider_no_show_reported_at ? String(closeout.provider_no_show_reported_at) : undefined;
  const closeEligibleAt = closeout?.close_eligible_at ? String(closeout.close_eligible_at) : undefined;
  const closedAt = closeout?.closed_at ? String(closeout.closed_at) : undefined;
  const customerConfirmedAt = closeout?.customer_completion_confirmed_at ? String(closeout.customer_completion_confirmed_at) : undefined;

  const providerUserId = String(booking.provider_type) === 'business'
    ? relatedValue(booking.businesses, 'owner_user_id')
    : relatedValue(booking.professional_profiles, 'user_id');
  const isCustomer = String(booking.customer_id) === viewerUserId;
  const isProvider = providerUserId === viewerUserId;
  const now = Date.now();
  const scheduledStart = zonedDateTimeToEpoch(String(booking.booking_date), String(booking.start_time), String(booking.timezone || 'Asia/Kolkata'));
  const noShowAvailableAt = new Date(scheduledStart + mappedPolicy.no_show_grace_minutes * 60_000).toISOString();
  const completionConfirmationDueAt = addHours(serviceCompletedAt, mappedPolicy.completion_confirmation_hours);
  const reviewDueAt = addDays(serviceCompletedAt, mappedPolicy.review_window_days);
  const supportBase = customerNoShowAt ?? serviceCompletedAt ?? (bookingStatus === 'cancelled' ? String(booking.updated_at) : undefined);
  const supportDueAt = addDays(supportBase, mappedPolicy.support_window_days);

  const supportWindowOpen = !closedAt && (!supportDueAt || now <= new Date(supportDueAt).getTime());
  const reviewWindowOpen = bookingStatus === 'completed' && !mappedReview && !closedAt && !!reviewDueAt && now <= new Date(reviewDueAt).getTime();
  const completionConfirmationOverdue = bookingStatus === 'completed' && !customerConfirmedAt && !!completionConfirmationDueAt && now > new Date(completionConfirmationDueAt).getTime();
  const canReportNoShow = bookingStatus === 'confirmed' && attendanceOutcome === 'pending' && now >= new Date(noShowAvailableAt).getTime();

  let state: CloseoutState = 'in_progress';
  if (closedAt || closeout?.state === 'closed') state = 'closed';
  else if (activeIssue) state = 'support_open';
  else if (attendanceOutcome === 'provider_no_show') state = 'provider_no_show';
  else if (attendanceOutcome === 'customer_no_show') state = closeout?.state === 'eligible_to_close' ? 'eligible_to_close' : 'customer_no_show';
  else if (closeout?.state === 'eligible_to_close') state = 'eligible_to_close';
  else if (bookingStatus === 'completed' && mappedReview) state = mappedIssues.length ? 'support_resolved' : 'reviewed';
  else if (bookingStatus === 'completed') state = mappedIssues.length ? 'support_resolved' : 'awaiting_review';
  else if (bookingStatus === 'cancelled') state = mappedIssues.length ? 'support_resolved' : 'cancelled';

  const closeBlockers: string[] = [];
  if (activeIssue) closeBlockers.push('active_support');
  if (!['paid', 'refunded'].includes(String(booking.payment_status))) closeBlockers.push('payment_unsettled');
  if (closeEligibleAt && now < new Date(closeEligibleAt).getTime()) closeBlockers.push('sla_window_open');

  return {
    booking_id: String(booking.id),
    booking_reference: String(booking.booking_reference),
    service_name: String(booking.service_name_snapshot),
    booking_status: bookingStatus,
    payment_status: String(booking.payment_status),
    state,
    attendance_outcome: attendanceOutcome,
    review: mappedReview,
    issues: mappedIssues,
    active_issue: activeIssue,
    policy: mappedPolicy,
    service_completed_at: serviceCompletedAt,
    customer_completion_confirmed_at: customerConfirmedAt,
    customer_no_show_reported_at: customerNoShowAt,
    provider_no_show_reported_at: providerNoShowAt,
    no_show_available_at: noShowAvailableAt,
    completion_confirmation_due_at: completionConfirmationDueAt,
    review_due_at: reviewDueAt,
    support_due_at: supportDueAt,
    close_eligible_at: closeEligibleAt,
    closed_at: closedAt,
    can_confirm_completion: isCustomer && bookingStatus === 'completed' && attendanceOutcome === 'service_completed' && !customerConfirmedAt && !closedAt,
    can_report_provider_no_show: isCustomer && canReportNoShow,
    can_report_customer_no_show: isProvider && canReportNoShow,
    can_open_support: isCustomer && !activeIssue && supportWindowOpen,
    review_window_open: reviewWindowOpen,
    support_window_open: supportWindowOpen,
    completion_confirmation_overdue: completionConfirmationOverdue,
    close_blockers: closeBlockers,
  };
}
