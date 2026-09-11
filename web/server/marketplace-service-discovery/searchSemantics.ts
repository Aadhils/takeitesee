const searchIntentTokens = new Set([
  'near', 'nearby', 'nearest', 'closest', 'around', 'me', 'my',
  'available', 'now', 'service', 'services', 'provider', 'providers',
  'அருகில்', 'அருகிலுள்ள', 'அருகாமை', 'எனக்கு', 'இப்போது', 'சேவை', 'சேவைகள்',
  'கிடைக்கும்', 'கிடைக்கிறார்', 'கிடைக்கிறது',
]);

export function normalizeMarketplaceServiceSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeMarketplaceServiceSearch(query: string) {
  return normalizeMarketplaceServiceSearchText(query)
    // Unicode marks are part of Tamil graphemes (for example the vowel mark in “பிளம்பர்”).
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((token) => token && !searchIntentTokens.has(token));
}

export function resolveMarketplaceServiceSearchSemantics(query: string) {
  const tokens = tokenizeMarketplaceServiceSearch(query);
  return {
    tokens,
    semanticQuery: tokens.join(' '),
  };
}
