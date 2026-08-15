import type { BookingStatus } from '../types/booking';
import type { EntityId } from '../types/entities';
import type { PaymentStatus } from '../types/payment';
import type { Rating } from '../types/reviews';
import { discoveryBookings, discoveryServices, type DiscoveryBooking, type DiscoveryService } from './discovery-fixtures';

export type ProviderBooking = DiscoveryBooking & {
  customer_name: string;
  customer_note?: string;
};

export type ProviderScheduleDay = {
  day: string;
  date_label: string;
  working: boolean;
  ranges: { label: string; kind: 'available' | 'break' | 'blocked' | 'booked' }[];
};

export type ProviderTransaction = {
  id: EntityId;
  label: string;
  date_label: string;
  amount: number;
  status: PaymentStatus;
};

export type ProviderReview = {
  id: EntityId;
  customer_name: string;
  service_name: string;
  rating: Rating;
  comment: string;
  date_label: string;
  response?: string;
};

export type ProviderProfile = {
  id: EntityId;
  display_name: string;
  business_name: string;
  provider_type: 'professional' | 'business';
  email: string;
  phone: string;
  service_area: string;
  description: string;
  profile_completion: number;
  verification: 'Verified' | 'Verification review' | 'Not verified';
  working_hours: string;
};

const providerBooking = (booking: DiscoveryBooking, customer_name: string, customer_note?: string): ProviderBooking => ({ ...booking, customer_name, customer_note });

export const providerProfile: ProviderProfile = {
  id: '9d5e8b3c-98fa-4a0d-b4e3-7fa5c9d1b001' as EntityId,
  display_name: 'Brightline Services',
  business_name: 'Brightline Services',
  provider_type: 'business',
  email: 'hello@brightline.example',
  phone: '+91 90000 11223',
  service_area: 'Chennai within 18 km',
  description: 'A dependable local team for electrical checks, home maintenance, and careful service follow-through.',
  profile_completion: 86,
  verification: 'Verified',
  working_hours: 'Monday-Saturday, 9:00 AM-6:00 PM IST',
};

export const providerBookings: ProviderBooking[] = [
  providerBooking(discoveryBookings[0], 'Ananya Srinivasan', 'Please call when you are 15 minutes away.'),
  providerBooking({ ...discoveryBookings[0], booking_reference: 'TIE-DEMO-2403', date_label: 'Thu, Aug 20', date: '2026-08-20', time: '3:00 PM', status: 'provider_review', provider_name: providerProfile.display_name }, 'Rahul Mehta'),
  providerBooking({ ...discoveryBookings[2], service_id: discoveryServices[3].id, provider_name: providerProfile.display_name, status: 'in_progress', payment_status: 'captured', date_label: 'Today', time: '2:00 PM', location: 'Chennai, Tamil Nadu' }, 'Priya Nair'),
  providerBooking({ ...discoveryBookings[2], service_id: discoveryServices[0].id, provider_name: providerProfile.display_name, status: 'completed', date_label: 'Aug 12, 2026', time: '11:00 AM', location: 'Chennai, Tamil Nadu' }, 'Karthik Rao'),
  providerBooking({ ...discoveryBookings[3], provider_name: providerProfile.display_name }, 'Meera Joseph'),
];

export const providerSchedule: ProviderScheduleDay[] = [
  { day: 'Monday', date_label: 'Aug 17', working: true, ranges: [{ label: '9:00 AM - 1:00 PM', kind: 'available' }, { label: '1:00 PM - 2:00 PM', kind: 'break' }, { label: '2:00 PM - 6:00 PM', kind: 'available' }] },
  { day: 'Tuesday', date_label: 'Aug 18', working: true, ranges: [{ label: '9:00 AM - 12:00 PM', kind: 'available' }, { label: '12:00 PM - 1:00 PM', kind: 'blocked' }, { label: '1:00 PM - 6:00 PM', kind: 'available' }] },
  { day: 'Wednesday', date_label: 'Aug 19', working: true, ranges: [{ label: '9:00 AM - 10:00 AM', kind: 'available' }, { label: '10:00 AM - 11:30 AM', kind: 'booked' }, { label: '11:30 AM - 6:00 PM', kind: 'available' }] },
  { day: 'Thursday', date_label: 'Aug 20', working: true, ranges: [{ label: '9:00 AM - 1:00 PM', kind: 'available' }, { label: '1:00 PM - 2:00 PM', kind: 'break' }, { label: '2:00 PM - 6:00 PM', kind: 'available' }] },
  { day: 'Friday', date_label: 'Aug 21', working: true, ranges: [{ label: '9:00 AM - 12:00 PM', kind: 'available' }, { label: '12:00 PM - 6:00 PM', kind: 'blocked' }] },
  { day: 'Saturday', date_label: 'Aug 22', working: true, ranges: [{ label: '10:00 AM - 2:00 PM', kind: 'available' }] },
  { day: 'Sunday', date_label: 'Aug 23', working: false, ranges: [] },
];

export const providerTransactions: ProviderTransaction[] = [
  { id: '9d5e8b3c-98fa-4a0d-b4e3-7fa5c9d1b002' as EntityId, label: 'Home electrical inspection', date_label: 'Aug 15, 2026', amount: 850, status: 'captured' },
  { id: '9d5e8b3c-98fa-4a0d-b4e3-7fa5c9d1b003' as EntityId, label: 'Deep home cleaning', date_label: 'Aug 12, 2026', amount: 1200, status: 'settled' },
  { id: '9d5e8b3c-98fa-4a0d-b4e3-7fa5c9d1b004' as EntityId, label: 'Upcoming service', date_label: 'Aug 19, 2026', amount: 850, status: 'pending' },
];

export const providerReviews: ProviderReview[] = [
  { id: '9d5e8b3c-98fa-4a0d-b4e3-7fa5c9d1b005' as EntityId, customer_name: 'Karthik Rao', service_name: 'Home electrical inspection', rating: 5, comment: 'Clear arrival updates and a careful explanation of what needed attention.', date_label: 'Aug 13, 2026', response: 'Thank you, Karthik. We are glad the walkthrough was useful.' },
  { id: '9d5e8b3c-98fa-4a0d-b4e3-7fa5c9d1b006' as EntityId, customer_name: 'Divya Menon', service_name: 'Deep home cleaning', rating: 4, comment: 'The team was thorough and easy to coordinate with.', date_label: 'Aug 8, 2026' },
];

export const providerServices: DiscoveryService[] = discoveryServices.filter((service) => service.provider_name === providerProfile.display_name);
