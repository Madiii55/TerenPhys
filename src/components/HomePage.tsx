import React from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { useCursorAvoidance } from '../motion/useCursorAvoidance.ts';
import { useTelegramOrbit } from '../motion/useTelegramOrbit.ts';
import '../styles/home-motion.css';

function AvoidWords({ text, strength = 4 }: { text: string; strength?: number }) {
  return <>{text.split(/(\s+)/).map((word, index) => /\S/.test(word)
    ? <span className="home-word" data-cursor-avoid={strength} key={index}>{word}</span> : word)}</>;
}

export const HomePage: React.FC = () => {
  const { t, language } = useLanguage();
  const copyRef = useCursorAvoidance(language);
  const telegramRef = useTelegramOrbit();
  return (
    <main className="home-space relative min-h-[calc(100svh-5rem)] overflow-hidden flex items-center">
      <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
        {/* Left Column: Typography & Action - positioned slightly higher for optimal visibility */}
        <div ref={copyRef} className="home-copy max-w-xl xl:max-w-2xl flex flex-col justify-center select-none -translate-y-6 sm:-translate-y-10 lg:-translate-y-14">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-normal tracking-tight text-white leading-[1.12]">
            {language === 'kk' ? <><span className="text-sky-300"><AvoidWords text={t('с нами')} strength={4.5}/></span>{' '}<AvoidWords text={t('Готовься')} strength={4.5}/></> : <><AvoidWords text={t('Готовься')} strength={4.5}/>{' '}<span className="text-sky-300"><AvoidWords text={t('с нами')} strength={4.5}/></span></>}
          </h1>

          <div className="mt-8 space-y-1 text-lg sm:text-xl text-slate-300 font-light leading-relaxed">
            <p><AvoidWords text={t("Физика — это не просто формулы.")}/></p>
            <p><AvoidWords text={t("Это способ смотреть на мир.")}/></p>
          </div>

          {/* Telegram Link */}
          <div className="mt-10 flex items-center gap-6">
            <a
              ref={telegramRef}
              href="https://t.me/nisphysicshub"
              target="_blank"
              rel="noopener noreferrer"
              className="home-telegram inline-flex items-center gap-3 text-lg font-normal text-sky-300 cursor-pointer"
            >
              {/* Blue Telegram Icon Badge */}
              <div className="home-telegram-badge w-11 h-11 rounded-full bg-[#0ea5e9]" aria-hidden="true" />
              <span className="home-telegram-plane" aria-hidden="true"><Send className="fill-white stroke-none" /></span>
              <span className="home-telegram-label text-white">
                Telegram
              </span>
              <ArrowRight className="home-telegram-arrow w-5 h-5 text-sky-300" />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};
