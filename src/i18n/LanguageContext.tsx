import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { classLabel, intlLocale, isLanguage, LANGUAGE_KEY, savedLanguage, translate, type Language } from './locale.ts';

const languageApi = (language: Language) => ({
  language, intlLocale: intlLocale(language),
  t: (source: string, values?: Record<string, string | number>) => translate(language, source, values),
  gradeLabel: (grade: number) => classLabel(language, grade),
});
const fallback = { ...languageApi('ru'), setLanguage: (_language: Language) => {} };
export const LanguageContext = createContext(fallback);

export function LanguageProvider({ children, initialLanguage }: { children: React.ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    try { return savedLanguage(window.localStorage); } catch { return 'ru'; }
  });
  const setLanguage = useCallback((next: Language) => {
    if (isLanguage(next)) setLanguageState(next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, 'TerenPhys - Обучение физике');
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    const description = translate(language, 'Платформа для изучения физики: учебные материалы и посты для 7–12 классов.');
    for (const meta of document.querySelectorAll('meta[name="description"], meta[property="og:description"]')) meta.setAttribute('content', description);
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Still usable when storage is unavailable. */ }
  }, [language]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY && (event.newValue === null || isLanguage(event.newValue))) setLanguageState(event.newValue ?? 'ru');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(() => ({ ...languageApi(language), setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
