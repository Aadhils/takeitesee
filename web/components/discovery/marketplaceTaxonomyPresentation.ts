export type MarketplaceTaxonomyPresentationCategory = {
  name?: string | null;
  group_name?: string | null;
  aliases?: string[] | null;
};

const tamilScriptPattern = /[\u0B80-\u0BFF]/u;

const tamilGroupLabels: Record<string, string> = {
  'Home Services': 'வீட்டு சேவைகள்',
  'Automotive & Mobility': 'வாகன & இயக்க சேவைகள்',
  'Care & Personal Services': 'பராமரிப்பு & தனிப்பட்ட சேவைகள்',
  'Food & Catering': 'உணவு & கேட்டரிங்',
  'Technology & Digital': 'தொழில்நுட்பம் & டிஜிட்டல்',
  'Health & Wellness': 'ஆரோக்கியம் & நலன்',
  'Education & Training': 'கல்வி & பயிற்சி',
  'Business & Professional Services': 'வணிக & தொழில்முறை சேவைகள்',
  'Retail & Local Shops': 'சில்லறை & உள்ளூர் கடைகள்',
  'Events & Creative Services': 'நிகழ்வுகள் & படைப்பாற்றல் சேவைகள்',
};

function normalizedLabel(value: unknown) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function marketplaceTaxonomyKey(value: unknown) {
  return normalizedLabel(value)
    .toLocaleLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function marketplaceTamilAlias(aliases: unknown) {
  if (!Array.isArray(aliases)) return '';
  for (const alias of aliases) {
    const label = normalizedLabel(alias);
    if (label && tamilScriptPattern.test(label)) return label;
  }
  return '';
}

export function localizedMarketplaceCategoryLabel(
  category: MarketplaceTaxonomyPresentationCategory,
  locale: string,
) {
  const canonicalName = normalizedLabel(category.name) || 'Other';
  if (locale !== 'ta-IN') return canonicalName;
  return marketplaceTamilAlias(category.aliases) || canonicalName;
}

export function localizedMarketplaceGroupLabel(groupName: unknown, locale: string) {
  const canonicalGroup = normalizedLabel(groupName);
  if (!canonicalGroup || locale !== 'ta-IN') return canonicalGroup;
  return tamilGroupLabels[canonicalGroup] || canonicalGroup;
}
