export type MarketplaceSearchIntent = {
  serviceQuery: string;
  locationQuery: string;
  nearMe: boolean;
};

function tidy(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalize(value: string) {
  return tidy(value.normalize('NFKC').toLocaleLowerCase());
}

const nearMePatterns = [
  /\b(?:near|nearby|nearest|closest|around)\s+(?:me|my location)\b/i,
  /\b(?:nearby|nearest|closest)\b/i,
  /(?:எனக்கு|என்)\s+(?:அருகில்|அருகிலுள்ள|அருகாமை)/u,
];

const searchQualityModifiers = new Set([
  'best', 'top', 'good', 'trusted', 'recommended', 'reliable', 'affordable', 'cheap', 'popular', 'highly', 'rated',
  'சிறந்த', 'நல்ல', 'நம்பகமான', 'பரிந்துரைக்கப்பட்ட', 'மலிவான', 'பிரபலமான',
]);

const englishLocationPattern = /^(.*?)\s+(?:in|at|near|around)\s+(.+?)\s*$/i;
const tamilLocationFirstPattern = /^(.+?)\s+(?:அருகில்|அருகிலுள்ள|அருகாமை)\s+(.+)$/u;
const tamilLocationLastPattern = /^(.+?)\s+([^\s]+)\s+(?:அருகில்|அருகிலுள்ள|அருகாமை)\s*$/u;

function stripNearMe(value: string) {
  let next = value;
  for (const pattern of nearMePatterns) next = next.replace(pattern, ' ');
  return tidy(next);
}

function stripSearchQualityModifiers(value: string) {
  return tidy(value
    .split(/\s+/u)
    .filter((token) => {
      const normalizedToken = normalize(token).replace(/[^\p{L}\p{N}]+/gu, '');
      return normalizedToken && !searchQualityModifiers.has(normalizedToken);
    })
    .join(' '));
}

function serviceIntent(value: string) {
  return stripSearchQualityModifiers(tidy(value));
}

export function parseMarketplaceSearchIntent(rawQuery: string): MarketplaceSearchIntent {
  const query = tidy(rawQuery);
  if (!query) return { serviceQuery: '', locationQuery: '', nearMe: false };

  const englishMatch = query.match(englishLocationPattern);
  if (englishMatch) {
    const serviceQuery = serviceIntent(englishMatch[1] || '');
    const locationQuery = tidy(englishMatch[2] || '');
    if (serviceQuery && locationQuery && !['me', 'my location'].includes(normalize(locationQuery))) {
      return { serviceQuery, locationQuery, nearMe: false };
    }
  }

  // Resolve explicit current-location intent before Tamil named-location parsing.
  // Otherwise phrases such as “எனக்கு அருகில் பிளம்பர்” can be misread as if
  // “எனக்கு” were a literal place name instead of the customer's current location.
  const normalizedQuery = normalize(query);
  const nearMe = nearMePatterns.some((pattern) => pattern.test(normalizedQuery));
  if (nearMe) {
    return {
      serviceQuery: serviceIntent(stripNearMe(query)),
      locationQuery: '',
      nearMe: true,
    };
  }

  const tamilFirstMatch = query.match(tamilLocationFirstPattern);
  if (tamilFirstMatch) {
    const locationQuery = tidy(tamilFirstMatch[1] || '');
    const serviceQuery = serviceIntent(tamilFirstMatch[2] || '');
    if (serviceQuery && locationQuery) return { serviceQuery, locationQuery, nearMe: false };
  }

  const tamilLastMatch = query.match(tamilLocationLastPattern);
  if (tamilLastMatch) {
    const serviceQuery = serviceIntent(tamilLastMatch[1] || '');
    const locationQuery = tidy(tamilLastMatch[2] || '');
    if (serviceQuery && locationQuery) return { serviceQuery, locationQuery, nearMe: false };
  }

  return { serviceQuery: serviceIntent(query), locationQuery: '', nearMe: false };
}
