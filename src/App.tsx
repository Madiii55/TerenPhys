/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, memo, Suspense, useCallback, useEffect, useState } from 'react';
import { Navbar, type NavTab } from './components/Navbar.tsx';
import { HomePage } from './components/HomePage.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext.tsx';
import { capturedAuthLink } from './auth/verification.ts';
import { usePageTransition } from './motion/usePageTransition.ts';
import { usePageFade } from './motion/usePageFade.ts';
import { usePageScroll } from './motion/usePageScroll.ts';
import { EinsteinAssistant } from './components/EinsteinAssistant.tsx';
import type { GuideActionId, StudyGuideContext } from './einstein/protocol.ts';
const StudyPage = lazy(() => import('./components/StudyPage.tsx').then(m => ({ default: memo(m.StudyPage) })));
const PostsPage = lazy(() => import('./components/PostsPage.tsx').then(m => ({ default: memo(m.PostsPage) })));
const ForumPage = lazy(() => import('./components/ForumPage.tsx').then(m => ({ default: memo(m.ForumPage) })));
const ProfilePage = lazy(() => import('./components/ProfilePage.tsx').then(m => ({ default: memo(m.ProfilePage) })));
const AuthModal = lazy(() => import('./components/AuthModal.tsx').then(m => ({ default: m.AuthModal })));
const EmailActionPage = lazy(() => import('./components/EmailActionPage.tsx').then(m => ({ default: m.EmailActionPage })));
const CosmicBackground = lazy(() => import('./components/CosmicBackground.tsx')
  .then((module) => ({ default: module.CosmicBackground }))
  .catch(() => ({ default: () => <div className="cosmic-background" aria-hidden="true" /> })));

function AppContent() {
  const { t, language } = useLanguage();
  const { user, authenticatedAccount } = useAuth();
  const [emailActionLink, setEmailActionLink] = useState(() => capturedAuthLink(window.location.href));
  const [navigation, setNavigation] = useState<{ tab: NavTab; id: number }>(() => ({ tab: new URL(window.location.href).searchParams.get('auth') === 'return' ? 'profile' : 'home', id: 0 }));
  // Load pages on first use; keep visited pages mounted to preserve drafts.
  const [visited, setVisited] = useState(() => new Set<NavTab>([navigation.tab]));
  useEffect(() => {
    // Keep one-time codes out of the address bar and subsequent navigations.
    if (emailActionLink) window.history.replaceState(null, '', window.location.pathname);
  }, [emailActionLink]);
  const activeTab = navigation.tab;
  const page = usePageTransition(activeTab, navigation.id);
  const pageSurface = usePageFade(page.phase, navigation.id, page.onPageClosed);
  const cancelScrollRestore = usePageScroll(page.tab, page.phase, pageSurface);
  const [studyContext, setStudyContext] = useState<StudyGuideContext>({ studyLevel: 'classes', availableActions: [] });
  const [guideAction, setGuideAction] = useState<{ requestId: number; id: GuideActionId } | undefined>();
  const [einsteinQuestion, setEinsteinQuestion] = useState<{ requestId: number; text: string }>();
  const askEinstein = useCallback((text: string) => setEinsteinQuestion(current => ({ requestId: (current?.requestId ?? 0) + 1, text })), []);
  const pageReady = page.phase === 'idle' || page.phase === 'entering';
  const navigate = useCallback((tab: NavTab) => {
    setVisited(current => current.has(tab) ? current : new Set([...current, tab]));
    setNavigation(current => current.tab === tab ? current : { tab, id: current.id + 1 });
  }, []);
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
        <CosmicBackground activeTab={page.scene.tab} transitionId={page.scene.id} onTransitionComplete={page.onSceneComplete} />
      </Suspense>

      {/* Global Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={navigate}
        onOpenAuth={handleOpenAuth}
      />

      {/* Each visited tab has its own Suspense boundary: one lazy page must not hide the others. */}
      <div ref={pageSurface} className="app-content page-reveal relative z-10" data-page-phase={page.phase} data-page-ready={pageReady} aria-busy={!pageReady} inert={!pageReady}>
        <div className={page.tab === 'home' ? 'block' : 'hidden'}>
          <HomePage />
        </div>
        <div className={page.tab === 'study' ? 'block' : 'hidden'}>
          {visited.has('study') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем раздел…")}</p>}><StudyPage active={pageReady && page.tab === 'study'} onContextChange={setStudyContext} guideAction={guideAction} onAskEinstein={askEinstein} /></Suspense>}
        </div>
        <div className={page.tab === 'posts' ? 'block' : 'hidden'}>
          {visited.has('posts') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем посты…")}</p>}><PostsPage active={activeTab === 'posts'} /></Suspense>}
        </div>
        <div className={page.tab === 'forum' ? 'block' : 'hidden'}>
          {visited.has('forum') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем форум…")}</p>}><ForumPage onOpenAuth={handleOpenAuth} active={activeTab === 'forum'} /></Suspense>}
        </div>
        <div className={page.tab === 'profile' ? 'block' : 'hidden'}>
          {visited.has('profile') && <Suspense fallback={<p className="p-8 text-slate-300" role="status">{t("Загружаем профиль…")}</p>}><ProfilePage
            onOpenAuth={handleOpenAuth}
          /></Suspense>}
        </div>
      </div>

      {/* Subtle Footer */}
      <footer className="site-footer relative z-10 border-t border-white/10 bg-slate-950/55 py-6 px-6 text-center text-xs text-slate-400 font-light backdrop-blur-md">
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

      <EinsteinAssistant prefill={einsteinQuestion} onBeforeGuide={cancelScrollRestore} context={{ page: page.tab, language, ...(page.tab === 'study' ? studyContext : {}), availableActions: [...['navigate-home', 'navigate-study', 'navigate-posts', 'navigate-forum', 'navigate-profile'].filter(id => id !== 'navigate-' + page.tab || (page.tab === 'study' && studyContext.studyLevel !== 'classes')), ...(page.tab === 'study' ? studyContext.availableActions : [])] }} ready={pageReady} navigationId={navigation.id} onOpenAuth={() => handleOpenAuth('login')} onAction={id => {
        cancelScrollRestore?.();
        if (id.startsWith('navigate-')) navigate(id.slice(9) as NavTab);
        setGuideAction(current => ({ requestId: (current?.requestId ?? 0) + 1, id }));
      }} />

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
