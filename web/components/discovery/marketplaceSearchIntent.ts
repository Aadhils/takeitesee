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

const englishLocationPattern = /^(.*?)\s+(?:in|at|near|around)\s+(.+?)\s*$/i;
const tamilLocationFirstPattern = /^(.+?)\s+(?:அருகில்|அருகிலுள்ள|அருகாமை)\s+(.+)$/u;
const tamilLocationLastPattern = /^(.+?)\s+([^\s]+)\s+(?:அருகில்|அருகிலுள்ள|அருகாமை)\s*$/u;

function stripNearMe(value: string) {
  let next = value;
  for (const pattern of nearMePatterns) next = next.replace(pattern, ' ');
  return tidy(next);
}

export function parseMarketplaceSearchIntent(rawQuery: string): MarketplaceSearchIntent {
  const query = tidy(rawQuery);
  if (!query) return { serviceQuery: '', locationQuery: '', nearMe: false };

  const englishMatch = query.match(englishLocationPattern);
  if (englishMatch) {
    const serviceQuery = tidy(englishMatch[1] || '');
    const locationQuery = tidy(englishMatch[2] || '');
    if (serviceQuery && locationQuery && !['me', 'my location'].includes(normalize(locationQuery))) {
      return { serviceQuery, locationQuery, nearMe: false };
    }
  }

  const tamilFirstMatch = query.match(tamilLocationFirstPattern);
  if (tamilFirstMatch) {
    const locationQuery = tidy(tamilFirstMatch[1] || '');
    const serviceQuery = tidy(tamilFirstMatch[2] || '');
    if (serviceQuery && locationQuery) return { serviceQuery, locationQuery, nearMe: false };
  }

  const tamilLastMatch = query.match(tamilLocationLastPattern);
  if (tamilLastMatch) {
    const serviceQuery = tidy(tamilLastMatch[1] || '');
    const locationQuery = tidy(tamilLastMatch[2] || '');
    if (serviceQuery && locationQuery) return { serviceQuery, locationQuery, nearMe: false };
  }

  const normalizedQuery = normalize(query);
  const nearMe = nearMePatterns.some((pattern) => pattern.test(normalizedQuery));
  if (nearMe) {
    return {
      serviceQuery: stripNearMe(query),
      locationQuery: '',
      nearMe: true,
    };
  }

  return { serviceQuery: query, locationQuery: '', nearMe: false };
}
