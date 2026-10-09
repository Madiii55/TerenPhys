import React from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { NavTab } from './Navbar.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';

interface HomePageProps {
  onNavigate: (tab: NavTab) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate: _onNavigate }) => {
  const { t, language } = useLanguage();
  return (
    <main className="home-space relative min-h-[calc(100svh-5rem)] overflow-hidden flex items-center">
      <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
        {/* Left Column: Typography & Action - positioned slightly higher for optimal visibility */}
        <div className="home-copy max-w-xl xl:max-w-2xl flex flex-col justify-center select-none -translate-y-6 sm:-translate-y-10 lg:-translate-y-14">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-normal tracking-tight text-white leading-[1.12]">
            {language === 'kk' ? <><span className="text-sky-300">{t('с нами')}</span>{' '}{t('Готовься')}</> : <>{t('Готовься')}{' '}<span className="text-sky-300">{t('с нами')}</span></>}
          </h1>

          <div className="mt-8 space-y-1 text-lg sm:text-xl text-slate-300 font-light leading-relaxed">
            <p>{t("Физика — это не просто формулы.")}</p>
            <p>{t("Это способ смотреть на мир.")}</p>
          </div>

          {/* Telegram Link */}
          <div className="mt-10 flex items-center gap-6">
            <a
              href="https://t.me/nisphysicshub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-lg font-normal text-sky-300 hover:text-white transition-all group cursor-pointer"
            >
              {/* Blue Telegram Icon Badge */}
              <div className="w-11 h-11 rounded-full bg-[#0ea5e9] flex items-center justify-center text-white shadow-xs group-hover:bg-[#0284c7] transition-colors">
                <Send className="w-5 h-5 -ml-0.5 fill-white stroke-none" />
              </div>
              <span className="text-white group-hover:text-sky-300 transition-colors">
                Telegram
              </span>
              <ArrowRight className="w-5 h-5 text-sky-300 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};
