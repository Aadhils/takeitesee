import type { BookingStatus } from '../types/booking';
import type { EntityId } from '../types/entities';
import type { PaymentStatus } from '../types/payment';
import type { ReviewStatus } from '../types/reviews';
import { discoveryBookings, discoveryBusinesses, discoveryServices, discoveryProfessionals, type DiscoveryBooking, type DiscoveryService } from './discovery-fixtures';

export type AdminProvider = {
  id: EntityId;
  name: string;
  type: 'professional' | 'business';
  verification: 'verified' | 'pending' | 'changes_requested' | 'suspended';
  account_status: 'active' | 'inactive' | 'suspended';
  rating: number;
  review_count: number;
  categories: string[];
  completed_bookings: number;
  activity_value: number;
  joined_label: string;
};

export type AdminCustomer = {
  id: EntityId;
  name: string;
  email: string;
  bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  review_count: number;
  joined_label: string;
  status: 'active' | 'inactive' | 'flagged';
};

export type AdminBooking = DiscoveryBooking & {
  customer_name: string;
  service_name: string;
  dispute: boolean;
};

export type AdminService = DiscoveryService & {
  listing_status: 'active' | 'pending_review' | 'paused' | 'rejected';
  availability_label: string;
};

export type AdminReview = {
  id: EntityId;
  reviewer_name: string;
  target_name: string;
  service_name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  excerpt: string;
  date_label: string;
  moderation_status: 'published' | 'pending' | 'flagged' | 'hidden';
};

const eid = (value: string) => value as EntityId;
const bookingWith = (booking: DiscoveryBooking, customer_name: string, service_name: string, dispute = false): AdminBooking => ({ ...booking, customer_name, service_name, dispute });

export const adminProviders: AdminProvider[] = [
  { id: discoveryBusinesses[0].id, name: 'Brightline Services', type: 'business', verification: 'verified', account_status: 'active', rating: 4.8, review_count: 334, categories: ['Home maintenance', 'Electrical'], completed_bookings: 312, activity_value: 98240, joined_label: 'Jan 14, 2026' },
  { id: discoveryProfessionals[0].id, name: 'Maya Thomas', type: 'professional', verification: 'verified', account_status: 'active', rating: 4.9, review_count: 86, categories: ['Brand design', 'Business help'], completed_bookings: 86, activity_value: 187500, joined_label: 'Feb 22, 2026' },
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1001'), name: 'Northstar Learning', type: 'business', verification: 'pending', account_status: 'active', rating: 4.7, review_count: 198, categories: ['Learning', 'Tutoring'], completed_bookings: 205, activity_value: 146800, joined_label: 'Mar 06, 2026' },
  { id: discoveryProfessionals[2].id, name: 'Nisha Menon', type: 'professional', verification: 'changes_requested', account_status: 'inactive', rating: 4.9, review_count: 43, categories: ['Events', 'Photography'], completed_bookings: 43, activity_value: 279500, joined_label: 'Apr 18, 2026' },
];

export const adminCustomers: AdminCustomer[] = [
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1002'), name: 'Ananya Srinivasan', email: 'ananya@example.com', bookings: 6, completed_bookings: 3, cancelled_bookings: 1, review_count: 1, joined_label: 'Mar 12, 2026', status: 'active' },
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1003'), name: 'Rahul Mehta', email: 'rahul@example.com', bookings: 3, completed_bookings: 1, cancelled_bookings: 0, review_count: 0, joined_label: 'May 04, 2026', status: 'active' },
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1004'), name: 'Meera Joseph', email: 'meera@example.com', bookings: 8, completed_bookings: 5, cancelled_bookings: 2, review_count: 3, joined_label: 'Jan 28, 2026', status: 'flagged' },
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1005'), name: 'Karthik Rao', email: 'karthik@example.com', bookings: 4, completed_bookings: 4, cancelled_bookings: 0, review_count: 2, joined_label: 'Jun 10, 2026', status: 'active' },
];

export const adminBookings: AdminBooking[] = [
  bookingWith(discoveryBookings[0], 'Ananya Srinivasan', 'Home electrical inspection'),
  bookingWith(discoveryBookings[1], 'Rahul Mehta', 'Brand identity starter kit'),
  bookingWith(discoveryBookings[2], 'Karthik Rao', 'Maths coaching for grades 8-10'),
  bookingWith(discoveryBookings[3], 'Meera Joseph', 'Deep home cleaning', true),
  bookingWith({ ...discoveryBookings[2], id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1006'), status: 'in_progress', date_label: 'Today', time: '2:00 PM', provider_name: 'Brightline Services' }, 'Priya Nair', 'Deep home cleaning'),
];

export const adminServices: AdminService[] = discoveryServices.map((service, index) => ({ ...service, listing_status: index === 1 ? 'pending_review' : index === 4 ? 'paused' : 'active', availability_label: service.availability }));

export const adminReviews: AdminReview[] = [
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1007'), reviewer_name: 'Karthik Rao', target_name: 'Brightline Services', service_name: 'Home electrical inspection', rating: 5, excerpt: 'Clear arrival updates and a careful explanation of what needed attention.', date_label: 'Aug 13, 2026', moderation_status: 'published' },
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1008'), reviewer_name: 'Meera Joseph', target_name: 'Brightline Services', service_name: 'Deep home cleaning', rating: 2, excerpt: 'The timing did not work out and the issue needs a closer look.', date_label: 'Aug 12, 2026', moderation_status: 'flagged' },
  { id: eid('aa4f8c1d-1234-4a5b-8c6d-7e8f9a0b1009'), reviewer_name: 'Ananya Srinivasan', target_name: 'Northstar Learning', service_name: 'Maths coaching for grades 8-10', rating: 5, excerpt: 'Clear, patient, and easy to follow from the first session.', date_label: 'Jul 26, 2026', moderation_status: 'pending' },
];

export const adminMetrics = {
  total_bookings: 428,
  active_providers: 74,
  customers: 1260,
  listed_services: 318,
  pending_provider_reviews: 7,
  pending_customer_reviews: 12,
  gross_activity: 1246800,
  completion_rate: 82,
};

export const adminStatusLabels: Record<BookingStatus, string> = {
  draft: 'Draft', requested: 'Requested', provider_review: 'Provider review', rejected: 'Rejected', accepted: 'Accepted', reschedule_requested: 'Reschedule requested', scheduled: 'Scheduled', in_progress: 'In progress', completion_pending: 'Completion pending', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show', refund_pending: 'Refund pending', closed: 'Closed',
};

export const adminPaymentLabels: Record<PaymentStatus, string> = {
  pending: 'Pending', initiated: 'Initiated', authorized: 'Authorized', captured: 'Paid', failed: 'Failed', cancelled: 'Cancelled', partially_refunded: 'Partially refunded', refunded: 'Refunded', disputed: 'Disputed', settled: 'Settled', closed: 'Closed',
};

export const adminReviewLabels: Record<ReviewStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', published: 'Published', hidden: 'Hidden', rejected: 'Rejected', removed: 'Removed',
};
