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
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function usePublicProviderTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: PublicProviderKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
