export const locales = ['en', 'cs', 'sk'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  cs: 'Čeština',
  sk: 'Slovenčina',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  cs: '🇨🇿',
  sk: '🇸🇰',
};
