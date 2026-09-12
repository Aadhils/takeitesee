import type { AppLocale } from '../i18n/LanguageProvider';

const english = {
  eyebrow: 'Service taxonomy',
  unavailableTitle: 'Browse TakeItEsee service categories.',
  unavailableAlertTitle: 'Category directory temporarily unavailable',
  unavailableAlertBody: 'The approved service taxonomy could not be loaded. Explore remains available for live marketplace search.',
  title: 'Browse approved TakeItEsee service categories.',
  subtitle: 'Approved specialties stay discoverable even before local supply goes live. Live counts show only active services from verified marketplace-ready providers.',
  canonicalEyebrow: 'Canonical marketplace taxonomy',
  summary: '{approved} approved specialties · {live} live now',
  serviceGroup: 'Service group',
  liveCategory: 'Live category',
  approvedCategory: 'Approved category',
  liveCountUnavailable: 'Live count unavailable',
  activeServiceOne: '{count} active service',
  activeServiceMany: '{count} active services',
  liveDescription: 'Search verified Professionals and Businesses currently offering {category}.',
  approvedDescription: 'This approved specialty is ready for marketplace discovery. Matching verified Providers will appear automatically when active supply becomes available.',
  unifiedSearch: 'Professional + Business unified search',
  searchCategory: 'Search category',
  emptyTitle: 'No approved service categories are available yet.',
  exploreMarketplace: 'Explore marketplace',
} as const;

export type CategoriesTranslationKey = keyof typeof english;

const tamil: Record<CategoriesTranslationKey, string> = {
  eyebrow: 'சேவை வகைப்பாடு',
  unavailableTitle: 'TakeItEsee சேவை வகைகளை பார்க்கவும்.',
  unavailableAlertTitle: 'வகை அடைவு தற்காலிகமாக கிடைக்கவில்லை',
  unavailableAlertBody: 'அங்கீகரிக்கப்பட்ட சேவை வகைப்பாட்டை ஏற்ற முடியவில்லை. நேரடி மார்க்கெட்ப்ளேஸ் தேடலுக்கு Explore தொடர்ந்து கிடைக்கும்.',
  title: 'அங்கீகரிக்கப்பட்ட TakeItEsee சேவை வகைகளை பார்க்கவும்.',
  subtitle: 'உள்ளூர் சேவைகள் இன்னும் live ஆகாதிருந்தாலும் அங்கீகரிக்கப்பட்ட சேவை வகைகளை இங்கே பார்க்கலாம். Live count-ல் verified marketplace-ready providers-ன் active services மட்டும் கணக்கிடப்படும்.',
  canonicalEyebrow: 'அங்கீகரிக்கப்பட்ட marketplace வகைப்பாடு',
  summary: '{approved} அங்கீகரிக்கப்பட்ட சேவை வகைகள் · {live} இப்போது live',
  serviceGroup: 'சேவை குழு',
  liveCategory: 'Live வகை',
  approvedCategory: 'அங்கீகரிக்கப்பட்ட வகை',
  liveCountUnavailable: 'Live count கிடைக்கவில்லை',
  activeServiceOne: '{count} active சேவை',
  activeServiceMany: '{count} active சேவைகள்',
  liveDescription: '{category} வழங்கும் verified Professionals மற்றும் Businesses-ஐ தேடவும்.',
  approvedDescription: 'இந்த அங்கீகரிக்கப்பட்ட சேவை வகை marketplace discovery-க்கு தயாராக உள்ளது. Active supply கிடைக்கும் போது பொருந்தும் verified Providers தானாக தோன்றுவர்.',
  unifiedSearch: 'Professional + Business ஒருங்கிணைந்த தேடல்',
  searchCategory: 'வகையை தேட',
  emptyTitle: 'இன்னும் அங்கீகரிக்கப்பட்ட சேவை வகைகள் இல்லை.',
  exploreMarketplace: 'Marketplace-ஐ பார்க்க',
};

const catalogs: Record<AppLocale, Record<CategoriesTranslationKey, string>> = {
  'en-IN': english,
  'ta-IN': tamil,
};

export function categoriesTranslation(locale: AppLocale, key: CategoriesTranslationKey) {
  return catalogs[locale][key] ?? english[key];
}

export function formatCategoriesTranslation(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}
