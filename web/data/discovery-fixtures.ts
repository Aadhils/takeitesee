import { createEntityId, type Business, type Category, type EntityId, type ProfessionalProfile, type Service } from '../types/entities';
import { createMoney, type ServicePricing } from '../types/money';
import type { ServiceOwner } from '../types/ownership';

export type DiscoveryCategory = Pick<Category, 'id' | 'name' | 'slug'> & {
  description: string;
  icon: string;
  service_count: number;
};

export type DiscoveryService = Pick<Service, 'id' | 'category_id' | 'service_name' | 'description' | 'pricing'> & {
  provider_name: string;
  provider_type: ServiceOwner['owner_type'];
  location: string;
  availability: 'Available today' | 'Next available tomorrow' | 'Remote delivery';
  rating: number;
  review_count: number;
  verified: boolean;
};

export type DiscoveryProfessional = Pick<ProfessionalProfile, 'id' | 'headline' | 'availability_mode' | 'status'> & {
  display_name: string;
  specialty: string;
  location: string;
  rating: number;
  review_count: number;
  verified: boolean;
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

export const discoveryServices: DiscoveryService[] = [
  { id: id(serviceIds.electrical), category_id: id(categoryIds.home), service_name: text('Home electrical inspection'), description: text('A careful safety check for switches, wiring, and common electrical issues.'), pricing: price(850), provider_name: 'Brightline Services', provider_type: 'business', location: 'Chennai, Tamil Nadu', availability: 'Available today', rating: 4.8, review_count: 124, verified: true },
  { id: id(serviceIds.design), category_id: id(categoryIds.business), service_name: text('Brand identity starter kit'), description: text('A focused identity system to help a new business show up with confidence.'), pricing: price(4500), provider_name: 'Maya Thomas', provider_type: 'professional', location: 'Remote delivery', availability: 'Remote delivery', rating: 4.9, review_count: 86, verified: true },
  { id: id(serviceIds.tutoring), category_id: id(categoryIds.learning), service_name: text('Maths coaching for grades 8-10'), description: text('Patient, structured coaching with a plan for stronger fundamentals.'), pricing: price(600, 'hourly'), provider_name: 'Northstar Learning', provider_type: 'business', location: 'Bengaluru, Karnataka', availability: 'Next available tomorrow', rating: 4.7, review_count: 59, verified: true },
  { id: id(serviceIds.cleaning), category_id: id(categoryIds.home), service_name: text('Deep home cleaning'), description: text('A detailed reset for kitchens, bathrooms, and high-use living spaces.'), pricing: price(1200), provider_name: 'Brightline Services', provider_type: 'business', location: 'Chennai, Tamil Nadu', availability: 'Available today', rating: 4.6, review_count: 210, verified: true },
  { id: id(serviceIds.photography), category_id: id(categoryIds.events), service_name: text('Small event photography'), description: text('Warm, natural coverage for intimate events and milestone days.'), pricing: price(6500), provider_name: 'Nisha Menon', provider_type: 'professional', location: 'Kochi, Kerala', availability: 'Next available tomorrow', rating: 4.9, review_count: 43, verified: false },
  { id: id(serviceIds.software), category_id: id(categoryIds.technology), service_name: text('Small business website setup'), description: text('A clear, maintainable website foundation for a growing local business.'), pricing: price(12000, 'negotiable'), provider_name: 'PixelCraft Studio', provider_type: 'business', location: 'Remote delivery', availability: 'Remote delivery', rating: 4.8, review_count: 71, verified: true },
];

export const discoveryProfessionals: DiscoveryProfessional[] = [
  { id: id(professionalIds.maya), display_name: 'Maya Thomas', headline: 'Independent brand designer', specialty: 'Brand identity & visual design', location: 'Remote · Based in Chennai', rating: 4.9, review_count: 86, verified: true, availability_mode: 'project_based', status: 'active' },
  { id: id(professionalIds.arjun), display_name: 'Arjun Rao', headline: 'Certified electrical technician', specialty: 'Home electrical inspection', location: 'Chennai, Tamil Nadu', rating: 4.8, review_count: 124, verified: true, availability_mode: 'full_time', status: 'active' },
  { id: id(professionalIds.nisha), display_name: 'Nisha Menon', headline: 'Event photographer', specialty: 'Portraits & intimate events', location: 'Kochi, Kerala', rating: 4.9, review_count: 43, verified: false, availability_mode: 'part_time', status: 'active' },
];

export const discoveryBusinesses: DiscoveryBusiness[] = [
  { id: id(businessIds.brightline), business_name: 'Brightline Services', category: 'Home maintenance', location: 'Chennai · Serving 18 km', rating: 4.8, review_count: 334, verified: true, status: 'active', service_summary: 'Electrical, plumbing, and home cleaning from one dependable local team.' },
  { id: id(businessIds.northstar), business_name: 'Northstar Learning', category: 'Tutoring & coaching', location: 'Bengaluru · Online available', rating: 4.7, review_count: 198, verified: true, status: 'active', service_summary: 'Small-group and one-to-one academic coaching for school learners.' },
  { id: id(businessIds.pixelcraft), business_name: 'PixelCraft Studio', category: 'Web & technology', location: 'Remote · India-wide', rating: 4.8, review_count: 71, verified: true, status: 'active', service_summary: 'Websites, digital setup, and practical technology support for small teams.' },
];

export const categoryName = (categoryId: EntityId) => discoveryCategories.find((category) => category.id === categoryId)?.name.values.en ?? 'Services';
export const displayText = (value: { values: Partial<Record<string, string>>; default_locale: string }) => value.values[value.default_locale] ?? Object.values(value.values)[0] ?? '';
