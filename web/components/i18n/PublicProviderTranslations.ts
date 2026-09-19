'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'publicProvider.hero.verifiedBusinessFallback': 'Verified business on TakeItEsee',
  'publicProvider.hero.independentProfessionalFallback': 'Independent professional on TakeItEsee',
  'publicProvider.hero.breadcrumb': 'Breadcrumb',
  'publicProvider.hero.explore': 'Explore',
  'publicProvider.hero.business': 'Business',
  'publicProvider.hero.professional': 'Professional',
  'publicProvider.hero.identityAria': 'Public provider identity',
  'publicProvider.hero.businessLogoAlt': 'business logo',
  'publicProvider.hero.profilePictureAlt': 'profile picture',
  'publicProvider.hero.verifiedProfile': 'Verified profile',
  'publicProvider.hero.businessProvider': 'Business provider',
  'publicProvider.hero.professionalProvider': 'Professional provider',
  'publicProvider.hero.serviceAreaBooking': 'Service area confirmed during booking',
  'publicProvider.reviewTrust.marketplaceTrust': 'Marketplace trust',
  'publicProvider.reviewTrust.verifiedServiceReviews': 'Verified service reviews',
  'publicProvider.reviewTrust.reviewSingular': 'review',
  'publicProvider.reviewTrust.reviewPlural': 'reviews',
  'publicProvider.reviewTrust.intro': 'These reviews come from completed TakeItEsee service bookings. Provider replies are shown as official public responses.',
  'publicProvider.reviewTrust.verifiedCustomerReview': 'Verified customer review',
  'publicProvider.reviewTrust.completedBooking': 'Completed booking',
  'publicProvider.reviewTrust.noWrittenComment': 'Rating submitted without a written comment.',
  'publicProvider.reviewTrust.officialProviderResponse': 'Official provider response',
  'publicProvider.reviewTrust.providerReply': 'Provider reply',
  'publicProvider.reviewTrust.responded': 'Responded',
  'publicProvider.reviewTrust.viewService': 'View service',
  'publicProvider.reviewTrust.empty': 'No published service reviews yet.',
  'publicProvider.reviewTrust.outOfFiveStars': 'out of 5 stars',
} as const;

type PublicProviderKey = keyof typeof english;

const tamil: Record<PublicProviderKey, string> = {
  'publicProvider.hero.verifiedBusinessFallback': 'TakeItEsee-ல் சரிபார்க்கப்பட்ட வணிகம்',
  'publicProvider.hero.independentProfessionalFallback': 'TakeItEsee-ல் சுயாதீன நிபுணர்',
  'publicProvider.hero.breadcrumb': 'வழிசெலுத்தல்',
  'publicProvider.hero.explore': 'Explore',
  'publicProvider.hero.business': 'வணிகம்',
  'publicProvider.hero.professional': 'நிபுணர்',
  'publicProvider.hero.identityAria': 'Public provider identity',
  'publicProvider.hero.businessLogoAlt': 'business logo',
  'publicProvider.hero.profilePictureAlt': 'profile picture',
  'publicProvider.hero.verifiedProfile': 'சரிபார்க்கப்பட்ட profile',
  'publicProvider.hero.businessProvider': 'வணிக வழங்குநர்',
  'publicProvider.hero.professionalProvider': 'நிபுணர் வழங்குநர்',
  'publicProvider.hero.serviceAreaBooking': 'Booking போது service area உறுதிசெய்யப்படும்',
  'publicProvider.reviewTrust.marketplaceTrust': 'Marketplace நம்பிக்கை',
  'publicProvider.reviewTrust.verifiedServiceReviews': 'சரிபார்க்கப்பட்ட சேவை மதிப்புரைகள்',
  'publicProvider.reviewTrust.reviewSingular': 'review',
  'publicProvider.reviewTrust.reviewPlural': 'reviews',
  'publicProvider.reviewTrust.intro': 'இந்த reviews முடிந்த TakeItEsee service bookings-இலிருந்து வருகின்றன. Provider பதில்கள் அதிகாரப்பூர்வ public responses ஆக காட்டப்படும்.',
  'publicProvider.reviewTrust.verifiedCustomerReview': 'சரிபார்க்கப்பட்ட customer review',
  'publicProvider.reviewTrust.completedBooking': 'முடிந்த booking',
  'publicProvider.reviewTrust.noWrittenComment': 'எழுத்து comment இல்லாமல் rating அளிக்கப்பட்டுள்ளது.',
  'publicProvider.reviewTrust.officialProviderResponse': 'Provider அதிகாரப்பூர்வ பதில்',
  'publicProvider.reviewTrust.providerReply': 'Provider reply',
  'publicProvider.reviewTrust.responded': 'பதில் அளிக்கப்பட்டது',
  'publicProvider.reviewTrust.viewService': 'சேவையை பார்க்க',
  'publicProvider.reviewTrust.empty': 'இன்னும் published service reviews இல்லை.',
  'publicProvider.reviewTrust.outOfFiveStars': '5 stars-ல்',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function usePublicProviderTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: PublicProviderKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
