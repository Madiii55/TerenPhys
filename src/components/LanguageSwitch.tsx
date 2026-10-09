import { useLanguage } from '../i18n/LanguageContext.tsx';

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();
  return <div className="language-switch" role="group" aria-label={t('Язык сайта')}>
    <button type="button" lang="ru" aria-label="Русский" aria-pressed={language === 'ru'} onClick={() => setLanguage('ru')}>Рус</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="kk" aria-label="Қазақша" aria-pressed={language === 'kk'} onClick={() => setLanguage('kk')}>Қаз</button>
  </div>;
}
