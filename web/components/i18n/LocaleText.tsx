'use client';

import { useLanguage } from './LanguageProvider';

export function LocaleText({ en, ta }: { en: string; ta: string }) {
  const { locale } = useLanguage();
  return <>{locale === 'ta-IN' ? ta : en}</>;
}
