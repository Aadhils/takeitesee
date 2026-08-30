# TakeItEsee localization foundation

## Current supported UI locales

- `en-IN` — English (India), default
- `ta-IN` — Tamil (India)

The current foundation localizes selected application chrome on the existing canonical URLs. The language preference is persisted in browser storage plus a non-sensitive first-party cookie, and the client updates the document `lang` attribute after the saved preference is restored.

## Included in the first localization slice

- Global desktop and mobile navigation
- Global footer navigation and policy labels
- Global language switcher
- Homepage marketplace search controls
- Explore search/filter/sort controls and result/empty-state chrome

## Content that is intentionally not auto-translated

TakeItEsee must not fabricate translations for user- or provider-authored marketplace content. The following stay in the language in which they were authored until explicit localized fields or a reviewed translation workflow exists:

- Provider/business names and descriptions
- Service names and descriptions
- Customer requirements and proposals
- Marketplace messages
- Reviews
- Moderation/report content

## SEO boundary

Public canonical URLs, server-rendered metadata, structured data, sitemap URLs and search-engine locale signals remain English-first for this client-preference phase. Do not add `hreflang` or claim Tamil server-rendered pages until TakeItEsee has stable locale-addressable public routes and server-rendered localized metadata/content.

A later localization phase may introduce locale-addressable routes and reviewed public-page translations. That change must preserve canonical/alternate correctness and must not duplicate indexable pages with identical untranslated content.

## Persistence and privacy

The locale preference contains no sensitive data. It may be stored in:

- `localStorage` key: `takeitesee_locale`
- first-party cookie: `takeitesee_locale`

No account profile mutation is required for the first slice, so anonymous visitors and signed-in users can both choose a language without changing authentication or marketplace permissions.
