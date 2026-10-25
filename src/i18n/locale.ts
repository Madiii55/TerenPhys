import { KAZAKH_MESSAGES } from './messages.ts';

export const LANGUAGE_KEY = 'terenphys.language';
export type Language = 'ru' | 'kk';
export const intlLocale = (language: Language) => language === 'kk' ? 'kk-KZ' : 'ru-RU';
export const isLanguage = (value: unknown): value is Language => value === 'ru' || value === 'kk';

export function savedLanguage(storage?: Pick<Storage, 'getItem'>): Language {
  try { const value = storage?.getItem(LANGUAGE_KEY); return isLanguage(value) ? value : 'ru'; }
  catch { return 'ru'; }
}

export function translate(language: Language, source: string, values?: Record<string, string | number>): string {
  // Only explicitly marked interface text is translated. Never traverse user content or the DOM.
  const text = language === 'kk' && Object.hasOwn(KAZAKH_MESSAGES, source) ? KAZAKH_MESSAGES[source] : source;
  return values ? text.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token) : text;
}

export const classLabel = (language: Language, grade: number) => translate(language, '{grade} класс', { grade });
