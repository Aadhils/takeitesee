/**
 * Review and rating domain foundation.
 *
 * Review eligibility is represented explicitly so server-side policy can
 * require a valid completed booking before publication.
 */

import type { BookingId, BookingStatus } from './booking';
import type { EntityId } from './entities';

export type ReviewId = EntityId;
export type Rating = 1 | 2 | 3 | 4 | 5;

export type ReviewStatus =
  | 'draft'
  | 'submitted'
  | 'published'
  | 'hidden'
  | 'rejected'
  | 'removed';

export type ReviewTarget =
  | { target_type: 'professional'; target_id: EntityId }
  | { target_type: 'business'; target_id: EntityId }
  | { target_type: 'service'; target_id: EntityId };

export interface ReviewReviewer {
  user_id: EntityId;
}

export interface BookingReviewEligibility {
  booking_id: BookingId;
  booking_status: BookingStatus;
  reviewer_user_id: EntityId;
  eligible: boolean;
  reason: 'completed_booking' | 'not_completed' | 'not_participant' | 'already_reviewed' | 'policy_denied';
  checked_at: Date;
}

export interface Review {
  id: ReviewId;
  booking_id: BookingId;
  reviewer: ReviewReviewer;
  target: ReviewTarget;
  rating: Rating;
  comment?: string;
  status: ReviewStatus;
  eligibility: BookingReviewEligibility;
  created_at: Date;
  updated_at: Date;
  published_at?: Date;
  moderated_at?: Date;
  moderated_by?: EntityId;
}

export interface ReviewSubmission {
  booking_id: BookingId;
  reviewer: ReviewReviewer;
  target: ReviewTarget;
  rating: Rating;
  comment?: string;
}

export interface ReviewPolicy {
  completed_booking_required: true;
  reviewer_must_be_booking_participant: true;
  one_review_per_reviewer_target_booking: true;
  publication_requires_moderation_policy: true;
}

export interface ReviewAuthorizationRequest {
  reviewer_user_id: EntityId;
  booking_id: BookingId;
  target: ReviewTarget;
}

export interface ReviewEligibilityService {
  check(request: ReviewAuthorizationRequest): Promise<BookingReviewEligibility>;
}

export interface ReviewRepository {
  get_review(review_id: ReviewId): Promise<Review | null>;
  list_for_target(target: ReviewTarget): Promise<readonly Review[]>;
  save_review(review: Review): Promise<Review>;
}

export interface ReviewAuditEvent {
  id: EntityId;
  review_id: ReviewId;
  event_type: 'review_submitted' | 'review_published' | 'review_hidden' | 'review_rejected' | 'review_removed';
  actor_user_id: EntityId;
  occurred_at: Date;
  reason?: string;
}

export interface ReviewAuditWriter {
  append(event: ReviewAuditEvent): Promise<void>;
}
