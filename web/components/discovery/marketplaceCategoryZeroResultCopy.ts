import type { AppLocale } from '../i18n/LanguageProvider';

type MarketplaceCategoryZeroResultCopy = {
  title: string;
  help: string;
  browseRelated: string;
};

const english: MarketplaceCategoryZeroResultCopy = {
  title: 'No live providers yet for “{category}”',
  help: 'This approved category is ready for discovery, but no live provider is available yet. Browse related services or post a requirement so providers can respond.',
  browseRelated: 'Browse related services',
};

const tamil: MarketplaceCategoryZeroResultCopy = {
  title: '“{category}” வகையில் இன்னும் நேரடி சேவை வழங்குநர்கள் இல்லை',
  help: 'இந்த அங்கீகரிக்கப்பட்ட வகை தேடலுக்கு தயாராக உள்ளது; ஆனால் தற்போது நேரடி சேவை வழங்குநர் இல்லை. தொடர்புடைய சேவைகளை பார்க்கலாம் அல்லது வழங்குநர்கள் பதிலளிக்க தேவையை பதிவிடலாம்.',
  browseRelated: 'தொடர்புடைய சேவைகளை பாருங்கள்',
};

function formatCategory(template: string, category: string) {
  return template.replace('{category}', category.trim());
}

export function marketplaceCategoryZeroResultCopy(
  locale: AppLocale,
  category: string,
): MarketplaceCategoryZeroResultCopy {
  const copy = locale === 'ta-IN' ? tamil : english;
  return {
    ...copy,
    title: formatCategory(copy.title, category),
  };
}
