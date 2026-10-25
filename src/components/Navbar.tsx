import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Logo } from './Logo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { LanguageSwitch } from './LanguageSwitch.tsx';
import '../styles/navigation.css';

export type NavTab = 'home' | 'profile' | 'study' | 'posts' | 'forum';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'profile', label: 'Профиль' },
  { id: 'study', label: 'Учёба' },
  { id: 'posts', label: 'Посты' },
  { id: 'forum', label: 'Форум' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenAuth,
}) => {
  const { user, authenticatedAccount, isLoading, logout } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { t } = useLanguage();
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const style = document.documentElement.style;
    const previousHeight = style.getPropertyValue('--site-header-height');
    const measure = () => style.setProperty('--site-header-height', `${Math.ceil(header.getBoundingClientRect().height) || 80}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(header);
    if (!observer) window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      if (previousHeight) style.setProperty('--site-header-height', previousHeight);
      else style.removeProperty('--site-header-height');
    };
  }, []);
  const leave = async () => {
    if (leaving) return;
    setLeaving(true); setLogoutError('');
    try { await logout(); }
    catch { setLogoutError('Не удалось выйти. Попробуйте ещё раз.'); }
    finally { setLeaving(false); }
  };

  return (
    <header ref={headerRef} className="site-header sticky top-0 z-50 border-b border-white/10 text-slate-100">
      <div className="site-header-inner max-w-7xl mx-auto px-4 sm:px-6 min-h-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
        {/* Left: Brand Logo that opens Home */}
        <Logo onClick={() => onTabChange('home')} />

        {/* Center: Main Navigation */}
        <nav className="site-nav order-3 flex w-full items-center justify-center gap-5 text-sm md:order-2 md:w-auto md:gap-7 md:text-[15px]">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                data-einstein={'navigate-' + item.id}
                className={`relative py-2 transition-colors cursor-pointer font-normal ${
                  isActive
                    ? 'text-sky-200 font-medium'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t(item.label)}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-300 shadow-[0_0_12px_#38bdf866] rounded-full transition-all" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Auth buttons or User Profile Pill */}
        <div className="site-header-tools order-2 flex items-center gap-4 text-[15px] md:order-3">
          <LanguageSwitch />
          {user || authenticatedAccount ? (
            <div className="site-header-account flex items-center gap-4">
              <button
                onClick={() => onTabChange('profile')}
                className={`site-profile-button flex items-center gap-2.5 py-1.5 px-3 rounded-full border transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'border-sky-300/45 bg-sky-400/10 text-sky-200'
                    : 'border-white/15 hover:border-white/30 text-slate-200 hover:bg-white/5'
                }`}
                title={t("Перейти в личный кабинет")}
                aria-label={t("Перейти в личный кабинет")}
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#0284c7] text-white flex items-center justify-center text-xs font-medium">
                    {(user?.name || authenticatedAccount?.email || 'T').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="site-member-name text-sm font-medium max-w-[120px] truncate">
                  {user?.name.split(' ')[0] || t("Профиль")}
                </span>
              </button>

              <button
                onClick={leave}
                disabled={leaving}
                className="site-signout-button text-slate-400 hover:text-rose-300 p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                title={t("Выйти из аккаунта")}
                aria-label={leaving ? t("Подождите…") : t("Выйти из аккаунта")}
              ><LogOut className="site-signout-icon" aria-hidden="true"/><span>{leaving ? t("Подождите…") : t("Выйти")}</span></button>
            </div>
          ) : isLoading ? <span role="status">{t("Проверяем…")}</span> : (
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline text-slate-600 font-light select-none">|</span>
              <button
                onClick={() => onOpenAuth('login')}
                className="text-slate-300 hover:text-white transition-colors cursor-pointer"
              >{t("Войти")}</button>
              <button
                onClick={() => onOpenAuth('register')}
                className="site-register text-sky-300 hover:text-sky-100 font-medium transition-colors cursor-pointer"
              >{t("Регистрация")}</button>
            </div>
          )}
        </div>
      </div>
      {logoutError && <p role="alert" className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 text-sm text-rose-200">{t(logoutError)}</p>}
    </header>
  );
};
