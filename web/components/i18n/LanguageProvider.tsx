'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLocale = 'en-IN' | 'ta-IN';

const english = {
  'language.label': 'Language',
  'language.english': 'English',
  'language.tamil': 'தமிழ்',
  'nav.main': 'Main navigation',
  'nav.mobile': 'Mobile navigation',
  'nav.mobilePrimary': 'Mobile primary navigation',
  'nav.explore': 'Explore',
  'nav.bookings': 'Bookings',
  'nav.notifications': 'Notifications',
  'nav.categories': 'Categories',
  'nav.professionals': 'Professionals',
  'nav.businesses': 'Businesses',
  'nav.home': 'Home',
  'nav.account': 'Account',
  'nav.postRequirement': 'Post a requirement',
  'nav.createAccount': 'Create an account',
  'nav.toggleMenu': 'Toggle navigation menu',
  'nav.goHome': 'Go to takeitesee home',
  'footer.tagline': 'takeitesee connects people, professionals and businesses — simply, safely and quickly.',
  'footer.forCustomers': 'For customers',
  'footer.howItWorks': 'How it works',
  'footer.safety': 'Safety',
  'footer.helpSupport': 'Help & Support',
  'footer.forProfessionals': 'For professionals',
  'footer.joinProfessional': 'Join as a professional',
  'footer.professionalResources': 'Professional resources',
  'footer.successStories': 'Success stories',
  'footer.forBusinesses': 'For businesses',
  'footer.listBusiness': 'List your business',
  'footer.businessResources': 'Business resources',
  'footer.partnerships': 'Partnerships',
  'footer.connect': 'Connect with us',
  'footer.contact': 'Contact us',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
  'footer.cookies': 'Cookie Policy',
  'home.searchNeed': 'What do you need help with?',
  'home.searchNeedAria': 'Search for a service',
  'home.where': 'Where?',
  'home.locationPlaceholder': 'City or neighbourhood',
  'home.locationAria': 'Choose a location',
  'home.search': 'Search',
  'explore.eyebrow': 'Customer discovery',
  'explore.title': 'Find the right service for what comes next.',
  'explore.subtitle': 'Search live services published by verified professionals and businesses.',
  'explore.searchLabel': 'Search services',
  'explore.searchPlaceholder': 'Search services, categories or providers',
  'explore.category': 'Category',
  'explore.allCategories': 'All live categories',
  'explore.location': 'Location',
  'explore.locationPlaceholder': 'City or neighbourhood',
  'explore.price': 'Price range',
  'explore.anyPrice': 'Any price',
  'explore.under1000': 'Under INR 1,000',
  'explore.range1000to5000': 'INR 1,000-5,000',
  'explore.over5000': 'Over INR 5,000',
  'explore.rating': 'Rating',
  'explore.anyRating': 'Any rating',
  'explore.rating4': '4.0 and above',
  'explore.rating45': '4.5 and above',
  'explore.providerType': 'Provider type',
  'explore.anyProvider': 'Any provider',
  'explore.professional': 'Professional',
  'explore.business': 'Business',
  'explore.clearFilters': 'Clear filters',
  'explore.sort': 'Sort results',
  'explore.relevance': 'Most relevant',
  'explore.highestRated': 'Highest rated',
  'explore.lowestPrice': 'Lowest starting price',
  'explore.highestPrice': 'Highest starting price',
  'explore.marketplace': 'Live marketplace',
  'explore.loading': 'Loading services…',
  'explore.servicesToExplore': 'services to explore',
  'explore.match': 'match',
  'explore.matches': 'matches',
  'explore.forQuery': 'for',
  'explore.postRequirement': 'Post a requirement',
  'explore.disclaimer': 'Categories and locations on this page are generated from the live provider catalog. Draft, paused, and unverified listings are excluded.',
  'empty.noServicesFor': 'No services found for',
  'empty.noFilters': 'No services match these filters',
  'empty.help': 'Try clearing one filter or browse a live category to broaden your search.',
  'empty.browseCategories': 'Browse categories',
} as const;

export type TranslationKey = keyof typeof english;

const tamil: Record<TranslationKey, string> = {
  'language.label': 'மொழி',
  'language.english': 'English',
  'language.tamil': 'தமிழ்',
  'nav.main': 'முக்கிய வழிசெலுத்தல்',
  'nav.mobile': 'மொபைல் வழிசெலுத்தல்',
  'nav.mobilePrimary': 'மொபைல் முதன்மை வழிசெலுத்தல்',
  'nav.explore': 'சேவைகளை தேடுங்கள்',
  'nav.bookings': 'புக்கிங்ஸ்',
  'nav.notifications': 'அறிவிப்புகள்',
  'nav.categories': 'வகைகள்',
  'nav.professionals': 'நிபுணர்கள்',
  'nav.businesses': 'வணிகங்கள்',
  'nav.home': 'முகப்பு',
  'nav.account': 'கணக்கு',
  'nav.postRequirement': 'தேவையை பதிவிடுங்கள்',
  'nav.createAccount': 'கணக்கு உருவாக்குங்கள்',
  'nav.toggleMenu': 'வழிசெலுத்தல் மெனுவை திறக்க / மூட',
  'nav.goHome': 'takeitesee முகப்புக்கு செல்லுங்கள்',
  'footer.tagline': 'takeitesee மக்கள், நிபுணர்கள் மற்றும் வணிகங்களை எளிமையாகவும் பாதுகாப்பாகவும் விரைவாகவும் இணைக்கிறது.',
  'footer.forCustomers': 'வாடிக்கையாளர்களுக்கு',
  'footer.howItWorks': 'எப்படி செயல்படுகிறது',
  'footer.safety': 'பாதுகாப்பு',
  'footer.helpSupport': 'உதவி & ஆதரவு',
  'footer.forProfessionals': 'நிபுணர்களுக்கு',
  'footer.joinProfessional': 'நிபுணராக இணையுங்கள்',
  'footer.professionalResources': 'நிபுணர் வளங்கள்',
  'footer.successStories': 'வெற்றி கதைகள்',
  'footer.forBusinesses': 'வணிகங்களுக்கு',
  'footer.listBusiness': 'உங்கள் வணிகத்தை பட்டியலிடுங்கள்',
  'footer.businessResources': 'வணிக வளங்கள்',
  'footer.partnerships': 'கூட்டாண்மைகள்',
  'footer.connect': 'எங்களை தொடர்புகொள்ள',
  'footer.contact': 'தொடர்பு கொள்ளுங்கள்',
  'footer.privacy': 'தனியுரிமைக் கொள்கை',
  'footer.terms': 'சேவை விதிமுறைகள்',
  'footer.cookies': 'குக்கீ கொள்கை',
  'home.searchNeed': 'எந்த சேவை உதவி வேண்டும்?',
  'home.searchNeedAria': 'ஒரு சேவையை தேடுங்கள்',
  'home.where': 'எங்கே?',
  'home.locationPlaceholder': 'நகரம் அல்லது பகுதி',
  'home.locationAria': 'இடத்தை தேர்வு செய்யுங்கள்',
  'home.search': 'தேடுங்கள்',
  'explore.eyebrow': 'வாடிக்கையாளர் தேடல்',
  'explore.title': 'உங்களுக்கு தேவையான சரியான சேவையை கண்டுபிடியுங்கள்.',
  'explore.subtitle': 'சரிபார்க்கப்பட்ட நிபுணர்கள் மற்றும் வணிகங்களின் நேரடி சேவைகளை தேடுங்கள்.',
  'explore.searchLabel': 'சேவைகளை தேடுங்கள்',
  'explore.searchPlaceholder': 'சேவை, வகை அல்லது சேவை வழங்குநரை தேடுங்கள்',
  'explore.category': 'வகை',
  'explore.allCategories': 'அனைத்து நேரடி வகைகள்',
  'explore.location': 'இடம்',
  'explore.locationPlaceholder': 'நகரம் அல்லது பகுதி',
  'explore.price': 'விலை வரம்பு',
  'explore.anyPrice': 'எந்த விலையும்',
  'explore.under1000': 'INR 1,000-க்கு கீழ்',
  'explore.range1000to5000': 'INR 1,000-5,000',
  'explore.over5000': 'INR 5,000-க்கு மேல்',
  'explore.rating': 'மதிப்பீடு',
  'explore.anyRating': 'எந்த மதிப்பீடும்',
  'explore.rating4': '4.0 மற்றும் அதற்கு மேல்',
  'explore.rating45': '4.5 மற்றும் அதற்கு மேல்',
  'explore.providerType': 'சேவை வழங்குநர் வகை',
  'explore.anyProvider': 'எந்த வழங்குநரும்',
  'explore.professional': 'நிபுணர்',
  'explore.business': 'வணிகம்',
  'explore.clearFilters': 'வடிகட்டிகளை நீக்குங்கள்',
  'explore.sort': 'முடிவுகளை வரிசைப்படுத்துங்கள்',
  'explore.relevance': 'மிகப் பொருத்தமானவை',
  'explore.highestRated': 'அதிக மதிப்பீடு',
  'explore.lowestPrice': 'குறைந்த ஆரம்ப விலை',
  'explore.highestPrice': 'அதிக ஆரம்ப விலை',
  'explore.marketplace': 'நேரடி சந்தை',
  'explore.loading': 'சேவைகள் ஏற்றப்படுகின்றன…',
  'explore.servicesToExplore': 'சேவைகள் உள்ளன',
  'explore.match': 'பொருத்தம்',
  'explore.matches': 'பொருத்தங்கள்',
  'explore.forQuery': 'இதற்காக',
  'explore.postRequirement': 'தேவையை பதிவிடுங்கள்',
  'explore.disclaimer': 'இந்த பக்கத்தில் உள்ள வகைகள் மற்றும் இடங்கள் நேரடி சேவை பட்டியலிலிருந்து உருவாக்கப்படுகின்றன. வரைவு, இடைநிறுத்தப்பட்ட மற்றும் சரிபார்க்கப்படாத பட்டியல்கள் காட்டப்படாது.',
  'empty.noServicesFor': 'இதற்கான சேவைகள் கிடைக்கவில்லை',
  'empty.noFilters': 'இந்த வடிகட்டிகளுக்கு பொருந்தும் சேவைகள் இல்லை',
  'empty.help': 'ஒரு வடிகட்டியை நீக்கிப் பாருங்கள் அல்லது நேரடி வகைகளை உலாவுங்கள்.',
  'empty.browseCategories': 'வகைகளை பாருங்கள்',
};

const catalogs: Record<AppLocale, Record<TranslationKey, string>> = {
  'en-IN': english,
  'ta-IN': tamil,
};

const STORAGE_KEY = 'takeitesee_locale';
const COOKIE_KEY = 'takeitesee_locale';

function validLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en-IN' || value === 'ta-IN';
}

type LanguageContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('en-IN');

  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { /* storage may be unavailable */ }
    if (!validLocale(stored)) {
      const cookieLocale = document.cookie.split('; ').find((entry) => entry.startsWith(`${COOKIE_KEY}=`))?.split('=')[1];
      stored = cookieLocale ? decodeURIComponent(cookieLocale) : null;
    }
    if (validLocale(stored)) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: AppLocale) => {
    setLocaleState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* storage may be unavailable */ }
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
  };

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (key) => catalogs[locale][key] ?? english[key],
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
