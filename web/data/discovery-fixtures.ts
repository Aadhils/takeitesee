import { createEntityId, type Business, type Category, type EntityId, type ProfessionalProfile, type Service } from '../types/entities';
import { createMoney, type ServicePricing } from '../types/money';
import type { BookingStatus } from '../types/booking';
import type { NotificationStatus, NotificationType } from '../types/notifications';
import type { PaymentStatus } from '../types/payment';
import type { ReviewStatus } from '../types/reviews';
import type { ServiceOwner } from '../types/ownership';

export type DiscoveryCategory = Pick<Category, 'id' | 'name' | 'slug'> & {
  description: string;
  icon: string;
  service_count: number;
};

export type DiscoveryService = Pick<Service, 'id' | 'category_id' | 'service_name' | 'description' | 'pricing'> & {
  provider_name: string;
  provider_type: ServiceOwner['owner_type'];
  provider_id: EntityId;
  location: string;
  availability: 'Available today' | 'Next available tomorrow' | 'Remote delivery';
  rating: number;
  review_count: number;
  verified: boolean;
  duration_minutes: number;
  service_area: string;
  long_description: string;
  highlights: string[];
  inclusions: string[];
  policy: string;
};

export type DiscoveryProfessional = Pick<ProfessionalProfile, 'id' | 'headline' | 'availability_mode' | 'status'> & {
  display_name: string;
  specialty: string;
  location: string;
  rating: number;
  review_count: number;
  verified: boolean;
  summary: string;
  experience_years: number;
  service_area: string;
  services: string[];
  availability_summary: string;
  reviews: DiscoveryReview[];
};

export type DiscoveryAvailability = {
  date: string;
  label: string;
  slots: { time: string; available: boolean }[];
};

export type DiscoveryReview = {
  id: string;
  reviewer_name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  date: string;
  verified_booking: boolean;
};

export type DiscoveryBooking = {
  id: EntityId;
  booking_reference: string;
  service_id: EntityId;
  provider_name: string;
  provider_type: ServiceOwner['owner_type'];
  status: BookingStatus;
  payment_status: PaymentStatus;
  date: string;
  date_label: string;
  time: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  price: ServicePricing['base_price'];
  notes?: string;
  review_eligible: boolean;
  timeline: { status: BookingStatus; label: string; detail: string; complete: boolean }[];
};

export type DiscoveryNotification = {
  id: EntityId;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  body: string;
  created_label: string;
  reference_type: 'booking' | 'payment' | 'service' | 'review' | 'none';
  reference_id?: EntityId;
};

export type DiscoveryCustomerProfile = {
  id: EntityId;
  display_name: string;
  email: string;
  phone: string;
  location: string;
  service_regions: string[];
  member_since: string;
  profile_completion: number;
  preferred_language: 'English' | 'Tamil' | 'Hindi' | 'Malayalam';
};

export type DiscoveryCustomerReview = {
  id: EntityId;
  booking_id: EntityId;
  service_id: EntityId;
  provider_name: string;
  service_name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  status: ReviewStatus;
  date_label: string;
};

export type DiscoveryBusiness = Pick<Business, 'id' | 'business_name' | 'status'> & {
  category: string;
  location: string;
  rating: number;
  review_count: number;
  verified: boolean;
  service_summary: string;
};

const categoryIds = {
  home: '3d5f1e1d-32c3-4f4a-8e5e-1a41f2c7a001',
  learning: '3d5f1e1d-32c3-4f4a-8e5e-1a41f2c7a002',
  business: '3d5f1e1d-32c3-4f4a-8e5e-1a41f2c7a003',
  wellness: '3d5f1e1d-32c3-4f4a-8e5e-1a41f2c7a004',
  events: '3d5f1e1d-32c3-4f4a-8e5e-1a41f2c7a005',
  technology: '3d5f1e1d-32c3-4f4a-8e5e-1a41f2c7a006',
} as const;

const serviceIds = {
  electrical: '4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b001',
  design: '4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b002',
  tutoring: '4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b003',
  cleaning: '4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b004',
  photography: '4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b005',
  software: '4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b006',
} as const;

const professionalIds = {
  maya: '5f7a3b3f-54e5-4f6c-a070-3c63f4e9c001',
  arjun: '5f7a3b3f-54e5-4f6c-a070-3c63f4e9c002',
  nisha: '5f7a3b3f-54e5-4f6c-a070-3c63f4e9c003',
} as const;

const businessIds = {
  brightline: '6a8b4c4a-65f6-4f7d-b181-4d74f5fad001',
  northstar: '6a8b4c4a-65f6-4f7d-b181-4d74f5fad002',
  pixelcraft: '6a8b4c4a-65f6-4f7d-b181-4d74f5fad003',
} as const;

const id = (value: string): EntityId => createEntityId(value);
const text = (value: string) => ({ default_locale: 'en' as const, values: { en: value } });
const price = (amount: number, pricing_model: ServicePricing['pricing_model'] = 'fixed'): ServicePricing => ({
  base_price: createMoney(amount, 'INR'),
  pricing_model,
});

export const discoveryCategories: DiscoveryCategory[] = [
  { id: id(categoryIds.home), name: text('Home & repair'), slug: 'home-repair', description: 'Practical help for the spaces you live in.', icon: '⌂', service_count: 184 },
  { id: id(categoryIds.learning), name: text('Learning'), slug: 'learning', description: 'Tutors, coaches, and mentors for every goal.', icon: '↗', service_count: 96 },
  { id: id(categoryIds.business), name: text('Business help'), slug: 'business-help', description: 'Specialists to help your work move forward.', icon: '▦', service_count: 132 },
  { id: id(categoryIds.wellness), name: text('Wellness'), slug: 'wellness', description: 'Make time for your health and wellbeing.', icon: '✦', service_count: 78 },
  { id: id(categoryIds.events), name: text('Events'), slug: 'events', description: 'Bring your next gathering together.', icon: '○', service_count: 64 },
  { id: id(categoryIds.technology), name: text('Technology'), slug: 'technology', description: 'Reliable support for your digital life.', icon: '◇', service_count: 110 },
];

const serviceDefaults = { duration_minutes: 90, service_area: 'Chennai, Tamil Nadu', long_description: 'A considered, practical service delivered with clear communication from the first conversation through completion. This presentation fixture describes the expected experience; final scope and timing will be confirmed later.', highlights: ['Clear scope before work begins', 'Experienced service team', 'Simple follow-up guidance'], inclusions: ['Initial consultation', 'Service delivery', 'Completion notes'], policy: 'Free rescheduling up to 24 hours before the selected time. Cancellation and final eligibility will be confirmed by the future booking service.' };

export const discoveryServices: DiscoveryService[] = [
  { ...serviceDefaults, id: id(serviceIds.electrical), category_id: id(categoryIds.home), service_name: text('Home electrical inspection'), description: text('A careful safety check for switches, wiring, and common electrical issues.'), pricing: price(850), provider_name: 'Brightline Services', provider_type: 'business', provider_id: id(businessIds.brightline), location: 'Chennai, Tamil Nadu', availability: 'Available today', rating: 4.8, review_count: 124, verified: true, duration_minutes: 90 },
  { ...serviceDefaults, service_area: 'Remote delivery across India', id: id(serviceIds.design), category_id: id(categoryIds.business), service_name: text('Brand identity starter kit'), description: text('A focused identity system to help a new business show up with confidence.'), pricing: price(4500), provider_name: 'Maya Thomas', provider_type: 'professional', provider_id: id(professionalIds.maya), location: 'Remote delivery', availability: 'Remote delivery', rating: 4.9, review_count: 86, verified: true, duration_minutes: 240, highlights: ['Discovery call', 'Two focused design directions', 'Ready-to-use starter files'] },
  { ...serviceDefaults, service_area: 'Bengaluru and online', id: id(serviceIds.tutoring), category_id: id(categoryIds.learning), service_name: text('Maths coaching for grades 8-10'), description: text('Patient, structured coaching with a plan for stronger fundamentals.'), pricing: price(600, 'hourly'), provider_name: 'Northstar Learning', provider_type: 'business', provider_id: id(businessIds.northstar), location: 'Bengaluru, Karnataka', availability: 'Next available tomorrow', rating: 4.7, review_count: 59, verified: true, duration_minutes: 60 },
  { ...serviceDefaults, id: id(serviceIds.cleaning), category_id: id(categoryIds.home), service_name: text('Deep home cleaning'), description: text('A detailed reset for kitchens, bathrooms, and high-use living spaces.'), pricing: price(1200), provider_name: 'Brightline Services', provider_type: 'business', provider_id: id(businessIds.brightline), location: 'Chennai, Tamil Nadu', availability: 'Available today', rating: 4.6, review_count: 210, verified: true, duration_minutes: 180 },
  { ...serviceDefaults, service_area: 'Kochi and nearby areas', id: id(serviceIds.photography), category_id: id(categoryIds.events), service_name: text('Small event photography'), description: text('Warm, natural coverage for intimate events and milestone days.'), pricing: price(6500), provider_name: 'Nisha Menon', provider_type: 'professional', provider_id: id(professionalIds.nisha), location: 'Kochi, Kerala', availability: 'Next available tomorrow', rating: 4.9, review_count: 43, verified: false, duration_minutes: 240 },
  { ...serviceDefaults, service_area: 'Remote delivery across India', id: id(serviceIds.software), category_id: id(categoryIds.technology), service_name: text('Small business website setup'), description: text('A clear, maintainable website foundation for a growing local business.'), pricing: price(12000, 'negotiable'), provider_name: 'PixelCraft Studio', provider_type: 'business', provider_id: id(businessIds.pixelcraft), location: 'Remote delivery', availability: 'Remote delivery', rating: 4.8, review_count: 71, verified: true, duration_minutes: 300 },
];

export const discoveryAvailability: DiscoveryAvailability[] = [
  { date: '2026-08-19', label: 'Wed, Aug 19', slots: [{ time: '10:00 AM', available: true }, { time: '1:30 PM', available: false }, { time: '4:00 PM', available: true }] },
  { date: '2026-08-20', label: 'Thu, Aug 20', slots: [{ time: '9:00 AM', available: true }, { time: '11:30 AM', available: true }, { time: '3:00 PM', available: false }] },
  { date: '2026-08-21', label: 'Fri, Aug 21', slots: [{ time: '10:30 AM', available: false }, { time: '2:00 PM', available: true }, { time: '5:00 PM', available: true }] },
];

export const discoveryBookings: DiscoveryBooking[] = [
  {
    id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a001'), booking_reference: 'TIE-DEMO-2401', service_id: id(serviceIds.electrical), provider_name: 'Brightline Services', provider_type: 'business', status: 'scheduled', payment_status: 'pending', date: '2026-08-19', date_label: 'Wed, Aug 19', time: '10:00 AM', timezone: 'Asia/Kolkata', duration_minutes: 90, location: 'Chennai, Tamil Nadu', price: createMoney(850, 'INR'), review_eligible: false,
    timeline: [{ status: 'requested', label: 'Request received', detail: 'Your selection is ready for provider review.', complete: true }, { status: 'accepted', label: 'Provider accepted', detail: 'The provider has accepted this fixture booking.', complete: true }, { status: 'scheduled', label: 'Scheduled', detail: 'Wed, Aug 19 at 10:00 AM IST.', complete: true }, { status: 'in_progress', label: 'Service day', detail: 'This step is shown as future progress.', complete: false }],
  },
  {
    id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a002'), booking_reference: 'TIE-DEMO-2402', service_id: id(serviceIds.design), provider_name: 'Maya Thomas', provider_type: 'professional', status: 'provider_review', payment_status: 'pending', date: '2026-08-21', date_label: 'Fri, Aug 21', time: '2:00 PM', timezone: 'Asia/Kolkata', duration_minutes: 240, location: 'Remote delivery across India', price: createMoney(4500, 'INR'), review_eligible: false,
    timeline: [{ status: 'requested', label: 'Request received', detail: 'The provider is reviewing this fixture request.', complete: true }, { status: 'provider_review', label: 'Provider review', detail: 'A response has not been recorded in this presentation data.', complete: true }, { status: 'scheduled', label: 'Scheduled', detail: 'Shown as the next possible step.', complete: false }],
  },
  {
    id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a003'), booking_reference: 'TIE-DEMO-2398', service_id: id(serviceIds.tutoring), provider_name: 'Northstar Learning', provider_type: 'business', status: 'completed', payment_status: 'captured', date: '2026-07-25', date_label: 'Sat, Jul 25', time: '11:30 AM', timezone: 'Asia/Kolkata', duration_minutes: 60, location: 'Bengaluru and online', price: createMoney(600, 'INR'), review_eligible: true,
    timeline: [{ status: 'requested', label: 'Request received', detail: 'The request was received.', complete: true }, { status: 'scheduled', label: 'Scheduled', detail: 'The session was scheduled.', complete: true }, { status: 'in_progress', label: 'Service delivered', detail: 'The coaching session took place.', complete: true }, { status: 'completed', label: 'Completed', detail: 'This fixture booking is eligible for a review.', complete: true }],
  },
  {
    id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a004'), booking_reference: 'TIE-DEMO-2394', service_id: id(serviceIds.cleaning), provider_name: 'Brightline Services', provider_type: 'business', status: 'cancelled', payment_status: 'refunded', date: '2026-07-12', date_label: 'Sun, Jul 12', time: '4:00 PM', timezone: 'Asia/Kolkata', duration_minutes: 180, location: 'Chennai, Tamil Nadu', price: createMoney(1200, 'INR'), review_eligible: false,
    timeline: [{ status: 'requested', label: 'Request received', detail: 'The request was received.', complete: true }, { status: 'cancelled', label: 'Cancelled', detail: 'This fixture booking was cancelled before service.', complete: true }],
  },
];

export const discoveryCustomerProfile: DiscoveryCustomerProfile = {
  id: id('8c4f7a2b-87e9-4f9c-a3d2-6f94c8e0b001'), display_name: 'Ananya Srinivasan', email: 'ananya@example.com', phone: '+91 98765 43210', location: 'Chennai, Tamil Nadu', service_regions: ['Chennai', 'Remote delivery'], member_since: 'March 2026', profile_completion: 78, preferred_language: 'English',
};

export const discoveryNotifications: DiscoveryNotification[] = [
  { id: id('8c4f7a2b-87e9-4f9c-a3d2-6f94c8e0b002'), type: 'booking_accepted', status: 'pending', title: 'Your electrical inspection is scheduled', body: 'Brightline Services accepted your fixture booking for Wed, Aug 19 at 10:00 AM.', created_label: 'Today, 10:24 AM', reference_type: 'booking', reference_id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a001') },
  { id: id('8c4f7a2b-87e9-4f9c-a3d2-6f94c8e0b003'), type: 'payment_status_changed', status: 'read', title: 'Payment status is still pending', body: 'No payment has been made for your presentation booking.', created_label: 'Yesterday', reference_type: 'payment' },
  { id: id('8c4f7a2b-87e9-4f9c-a3d2-6f94c8e0b004'), type: 'review_requested', status: 'read', title: 'How was your maths coaching session?', body: 'Your completed fixture booking is eligible for a presentation-only review.', created_label: 'Jul 26, 2026', reference_type: 'review', reference_id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a003') },
  { id: id('8c4f7a2b-87e9-4f9c-a3d2-6f94c8e0b005'), type: 'service_completed', status: 'dismissed', title: 'Booking marked complete', body: 'Your Northstar Learning session is now in completed fixture history.', created_label: 'Jul 25, 2026', reference_type: 'booking', reference_id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a003') },
];

export const discoveryCustomerReviews: DiscoveryCustomerReview[] = [
  { id: id('8c4f7a2b-87e9-4f9c-a3d2-6f94c8e0b006'), booking_id: id('7b9d5f1a-76e8-4f8b-92c1-5e83b7d9a003'), service_id: id(serviceIds.tutoring), provider_name: 'Northstar Learning', service_name: 'Maths coaching for grades 8-10', rating: 5, comment: 'Clear, patient, and easy to follow from the first session.', status: 'published', date_label: 'Jul 26, 2026' },
];

export function createDiscoveryBookingPreview(service: DiscoveryService, date: string, time: string): DiscoveryBooking {
  return {
    id: service.id,
    booking_reference: `TIE-DEMO-${service.id.slice(0, 8).toUpperCase()}`,
    service_id: service.id,
    provider_name: service.provider_name,
    provider_type: service.provider_type,
    status: 'requested',
    payment_status: 'pending',
    date,
    date_label: date,
    time,
    timezone: 'Asia/Kolkata',
    duration_minutes: service.duration_minutes,
    location: service.location,
    price: service.pricing.base_price,
    review_eligible: false,
    timeline: [{ status: 'requested', label: 'Request preview', detail: 'This local fixture demonstrates the first booking state.', complete: true }, { status: 'provider_review', label: 'Provider review', detail: 'A future server response would appear here.', complete: false }],
  };
}

export const discoveryProfessionals: DiscoveryProfessional[] = [
  { id: id(professionalIds.maya), display_name: 'Maya Thomas', headline: 'Independent brand designer', specialty: 'Brand identity & visual design', location: 'Remote · Based in Chennai', rating: 4.9, review_count: 86, verified: true, availability_mode: 'project_based', status: 'active', summary: 'Maya helps early-stage businesses turn a good idea into a clear, confident visual identity.', experience_years: 8, service_area: 'Remote across India', services: ['Brand identity starter kit'], availability_summary: 'Usually replies within one business day', reviews: [{ id: 'maya-review-1', reviewer_name: 'Ananya S.', rating: 5, comment: 'Thoughtful process and a starter kit that made our launch feel real.', date: 'July 2026', verified_booking: true }] },
  { id: id(professionalIds.arjun), display_name: 'Arjun Rao', headline: 'Certified electrical technician', specialty: 'Home electrical inspection', location: 'Chennai, Tamil Nadu', rating: 4.8, review_count: 124, verified: true, availability_mode: 'full_time', status: 'active', summary: 'Arjun focuses on careful residential inspections and straightforward safety guidance.', experience_years: 11, service_area: 'Chennai within 18 km', services: ['Home electrical inspection'], availability_summary: 'Available weekdays and selected Saturdays', reviews: [] },
  { id: id(professionalIds.nisha), display_name: 'Nisha Menon', headline: 'Event photographer', specialty: 'Portraits & intimate events', location: 'Kochi, Kerala', rating: 4.9, review_count: 43, verified: false, availability_mode: 'part_time', status: 'active', summary: 'Nisha documents small gatherings with a relaxed, natural approach and a warm eye for people.', experience_years: 6, service_area: 'Kochi and nearby areas', services: ['Small event photography'], availability_summary: 'Accepting a limited number of events each month', reviews: [] },
];

export const discoveryBusinesses: DiscoveryBusiness[] = [
  { id: id(businessIds.brightline), business_name: 'Brightline Services', category: 'Home maintenance', location: 'Chennai · Serving 18 km', rating: 4.8, review_count: 334, verified: true, status: 'active', service_summary: 'Electrical, plumbing, and home cleaning from one dependable local team.' },
  { id: id(businessIds.northstar), business_name: 'Northstar Learning', category: 'Tutoring & coaching', location: 'Bengaluru · Online available', rating: 4.7, review_count: 198, verified: true, status: 'active', service_summary: 'Small-group and one-to-one academic coaching for school learners.' },
  { id: id(businessIds.pixelcraft), business_name: 'PixelCraft Studio', category: 'Web & technology', location: 'Remote · India-wide', rating: 4.8, review_count: 71, verified: true, status: 'active', service_summary: 'Websites, digital setup, and practical technology support for small teams.' },
];

export const categoryName = (categoryId: EntityId) => discoveryCategories.find((category) => category.id === categoryId)?.name.values.en ?? 'Services';
export const displayText = (value: { values: Partial<Record<string, string>>; default_locale: string }) => value.values[value.default_locale] ?? Object.values(value.values)[0] ?? '';
