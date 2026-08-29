import { createSupabaseServerClient } from '../../lib/supabase/server';

export type CloseoutState = 'in_progress' | 'awaiting_review' | 'reviewed' | 'support_open' | 'support_resolved' | 'cancelled';

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

export interface BookingCloseoutReadModel {
  booking_id: string;
  booking_reference: string;
  service_name: string;
  booking_status: string;
  payment_status: string;
  state: CloseoutState;
  review: BookingCloseoutReview | null;
  issues: BookingCloseoutIssue[];
  active_issue: BookingCloseoutIssue | null;
  can_open_support: boolean;
}

const activeIssueStatuses = new Set(['open', 'investigating', 'awaiting_information']);

export async function getBookingCloseoutReadModel(bookingId: string, viewerUserId: string): Promise<BookingCloseoutReadModel | null> {
  const supabase = await createSupabaseServerClient();
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id,booking_reference,customer_id,service_name_snapshot,status,payment_status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) throw new Error(bookingError.message);
  if (!booking) return null;

  const [{ data: review, error: reviewError }, { data: issues, error: issueError }] = await Promise.all([
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
  ]);

  if (reviewError) throw new Error(reviewError.message);
  if (issueError) throw new Error(issueError.message);

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

  const bookingStatus = String(booking.status);
  let state: CloseoutState = 'in_progress';
  if (activeIssue) state = 'support_open';
  else if (bookingStatus === 'completed' && mappedReview) state = mappedIssues.length ? 'support_resolved' : 'reviewed';
  else if (bookingStatus === 'completed') state = mappedIssues.length ? 'support_resolved' : 'awaiting_review';
  else if (bookingStatus === 'cancelled') state = mappedIssues.length ? 'support_resolved' : 'cancelled';

  return {
    booking_id: String(booking.id),
    booking_reference: String(booking.booking_reference),
    service_name: String(booking.service_name_snapshot),
    booking_status: bookingStatus,
    payment_status: String(booking.payment_status),
    state,
    review: mappedReview,
    issues: mappedIssues,
    active_issue: activeIssue,
    can_open_support: String(booking.customer_id) === viewerUserId && !activeIssue,
  };
}
