import React from 'react';
import { Logo } from './Logo.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { LogOut } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon.tsx';

export type NavTab = 'home' | 'profile' | 'study' | 'posts' | 'forum';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenAuth,
}) => {
  const { user, logout } = useAuth();

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'profile', label: 'Профиль' },
    { id: 'study', label: 'Учёба' },
    { id: 'posts', label: 'Посты' },
    { id: 'forum', label: 'Форум' },
  ];

  return (
    <header className="site-header sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 text-slate-100 shadow-[0_12px_40px_#02061735] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
        {/* Left: Brand Logo that opens Home */}
        <Logo onClick={() => onTabChange('home')} />

        {/* Center: Main Navigation */}
        <nav className="order-3 flex w-full items-center justify-center gap-5 text-sm md:order-2 md:w-auto md:gap-7 md:text-[15px]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative py-2 transition-colors cursor-pointer font-normal ${
                  isActive
                    ? 'text-sky-200 font-medium'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-300 shadow-[0_0_12px_#38bdf866] rounded-full transition-all" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Auth buttons or User Profile Pill */}
        <div className="order-2 flex items-center space-x-5 text-[15px] md:order-3">
          {user ? (
            <div className="flex items-center space-x-4">
              <button
                onClick={() => onTabChange('profile')}
                className={`flex items-center gap-2.5 py-1.5 px-3 rounded-full border transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'border-sky-300/45 bg-sky-400/10 text-sky-200'
                    : 'border-white/15 hover:border-white/30 text-slate-200 hover:bg-white/5'
                }`}
                title="Перейти в личный кабинет"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#0284c7] text-white flex items-center justify-center text-xs font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium max-w-[120px] truncate">
                  {user.name.split(' ')[0]}
                </span>
                {user.provider === 'google' && (
                  <GoogleIcon className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={logout}
                className="text-slate-400 hover:text-rose-300 p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                title="Выйти из аккаунта"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-5">
              <span className="text-slate-600 font-light select-none">|</span>
              <button
                onClick={() => onOpenAuth('login')}
                className="text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Войти
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="text-sky-300 hover:text-sky-100 font-medium transition-colors cursor-pointer"
              >
                Регистрация
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
