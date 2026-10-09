/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, memo, Suspense, useCallback, useEffect, useState } from 'react';
import { Navbar, NavTab } from './components/Navbar.tsx';
import { HomePage } from './components/HomePage.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext.tsx';
import { capturedAuthLink } from './auth/verification.ts';
const StudyPage = lazy(() => import('./components/StudyPage.tsx').then(m => ({ default: memo(m.StudyPage) })));
const PostsPage = lazy(() => import('./components/PostsPage.tsx').then(m => ({ default: memo(m.PostsPage) })));
const ForumPage = lazy(() => import('./components/ForumPage.tsx').then(m => ({ default: memo(m.ForumPage) })));
const ProfilePage = lazy(() => import('./components/ProfilePage.tsx').then(m => ({ default: memo(m.ProfilePage) })));
const AuthModal = lazy(() => import('./components/AuthModal.tsx').then(m => ({ default: m.AuthModal })));
const EmailActionPage = lazy(() => import('./components/EmailActionPage.tsx').then(m => ({ default: m.EmailActionPage })));
const CosmicBackground = lazy(() => import('./components/CosmicBackground.tsx').then((module) => ({ default: module.CosmicBackground })));

function AppContent() {
  const { t } = useLanguage();
  const { user, authenticatedAccount } = useAuth();
  const [emailActionLink, setEmailActionLink] = useState(() => capturedAuthLink(window.location.href));
  const [navigation, setNavigation] = useState<{ tab: NavTab; id: number }>(() => ({ tab: new URL(window.location.href).searchParams.get('auth') === 'return' ? 'profile' : 'home', id: 0 }));
  // Load pages on first use; keep visited pages mounted to preserve drafts.
  const [visited, setVisited] = useState(() => new Set<NavTab>([navigation.tab]));
  useEffect(() => {
    // Keep one-time codes out of the address bar and subsequent navigations.
    if (emailActionLink) window.history.replaceState(null, '', window.location.pathname);
  }, [emailActionLink]);
  const [settledNavigation, setSettledNavigation] = useState(-1);
  const activeTab = navigation.tab;
  const pageReady = settledNavigation === navigation.id;
  const navigate = useCallback((tab: NavTab) => {
    setVisited(current => current.has(tab) ? current : new Set([...current, tab]));
    setNavigation(current => current.tab === tab ? current : { tab, id: current.id + 1 });
  }, []);
  const finishNavigation = useCallback((id: number) => setSettledNavigation(id), []);
  const [authModal, setAuthModal] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
  }>({
    isOpen: false,
    mode: 'login',
  });

  const handleOpenAuth = useCallback((mode: 'login' | 'register') => {
    setAuthModal({ isOpen: true, mode });
  }, []);
  const navigateStudy = useCallback(() => navigate('study'), [navigate]);

  const handleCloseAuth = useCallback(() => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  if (emailActionLink) return <Suspense fallback={<div className="email-action-page account-surface" role="status">{t("Открываем страницу…")}</div>}><EmailActionPage link={emailActionLink} onContinue={() => {
    // Discard action codes and untrusted continue URLs; return only to this app.
    window.history.replaceState(null, '', '/');
    setEmailActionLink(null);
    navigate('profile');
    if (!user && !authenticatedAccount) handleOpenAuth('login');
  }} /></Suspense>;

  return (
    <div className="app-shell relative isolate text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Suspense fallback={null}>
        <CosmicBackground activeTab={activeTab} transitionId={navigation.id} onTransitionComplete={finishNavigation} />
      </Suspense>

      {/* Global Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={navigate}
        onOpenAuth={handleOpenAuth}
      />

      {/* Each visited tab has its own Suspense boundary: one lazy page must not hide the others. */}
      <div className="app-content page-reveal relative z-10" data-page-ready={pageReady} aria-busy={!pageReady} aria-hidden={!pageReady} inert={!pageReady}>
        <div className={activeTab === 'home' ? 'block' : 'hidden'}>
          <HomePage onNavigate={navigate} />
        </div>
        <div className={activeTab === 'study' ? 'block' : 'hidden'}>
          {visited.has('study') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем раздел…")}</p>}><StudyPage /></Suspense>}
        </div>
        <div className={activeTab === 'posts' ? 'block' : 'hidden'}>
          {visited.has('posts') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем посты…")}</p>}><PostsPage onOpenAuth={handleOpenAuth} active={activeTab === 'posts'} /></Suspense>}
        </div>
        <div className={activeTab === 'forum' ? 'block' : 'hidden'}>
          {visited.has('forum') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем форум…")}</p>}><ForumPage onOpenAuth={handleOpenAuth} active={activeTab === 'forum'} /></Suspense>}
        </div>
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          {visited.has('profile') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем профиль…")}</p>}><ProfilePage
            onOpenAuth={handleOpenAuth}
            onNavigateStudy={navigateStudy}
          /></Suspense>}
        </div>
      </div>

      {/* Subtle Footer */}
      <footer className="page-reveal relative z-10 border-t border-white/10 bg-slate-950/55 py-6 px-6 text-center text-xs text-slate-400 font-light backdrop-blur-md" data-page-ready={pageReady} aria-hidden={!pageReady} inert={!pageReady}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>© 2026 TerenPhys.</span>
            <span>{t("Физика без границ.")}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <button
              onClick={() => navigate('study')}
              className="hover:text-white transition-colors cursor-pointer"
            >{t("Учёба")}</button>
            <button
              onClick={() => navigate('posts')}
              className="hover:text-white transition-colors cursor-pointer"
            >{t("Посты")}</button>
            <button
              onClick={() => navigate('forum')}
              className="hover:text-white transition-colors cursor-pointer"
            >{t("Форум")}</button>
            <a
              href="https://t.me/nisphysicshub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 hover:underline"
            >{t("Telegram-канал")}</a>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      {authModal.isOpen && <Suspense fallback={<div className="account-modal-backdrop text-white" role="status">{t("Открываем форму…")}</div>}><AuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        onClose={handleCloseAuth}
      /></Suspense>}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider><AuthProvider>
      <AppContent />
    </AuthProvider></LanguageProvider>
  );
}
