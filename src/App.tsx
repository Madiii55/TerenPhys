/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useCallback, useState } from 'react';
import { Navbar, NavTab } from './components/Navbar.tsx';
import { HomePage } from './components/HomePage.tsx';
import { StudyPage } from './components/StudyPage.tsx';
import { PostsPage } from './components/PostsPage.tsx';
import { ForumPage } from './components/ForumPage.tsx';
import { ProfilePage } from './components/ProfilePage.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
const CosmicBackground = lazy(() => import('./components/CosmicBackground.tsx').then((module) => ({ default: module.CosmicBackground })));

function AppContent() {
  const [navigation, setNavigation] = useState<{ tab: NavTab; id: number }>({ tab: 'home', id: 0 });
  const [settledNavigation, setSettledNavigation] = useState(-1);
  const activeTab = navigation.tab;
  const pageReady = settledNavigation === navigation.id;
  const navigate = useCallback((tab: NavTab) => {
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

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthModal({ isOpen: true, mode });
  };

  const handleCloseAuth = () => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="relative isolate min-h-screen flex flex-col text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Suspense fallback={null}>
        <CosmicBackground activeTab={activeTab} transitionId={navigation.id} onTransitionComplete={finishNavigation} />
      </Suspense>

      {/* Global Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={navigate}
        onOpenAuth={handleOpenAuth}
      />

      {/* Main Content View - persistent rendered tabs to eliminate any blank white transitions or re-renders */}
      <div className="page-reveal flex-1 relative z-10" data-page-ready={pageReady} aria-busy={!pageReady} aria-hidden={!pageReady} inert={!pageReady}>
        <div className={activeTab === 'home' ? 'block' : 'hidden'}>
          <HomePage onNavigate={navigate} />
        </div>
        <div className={activeTab === 'study' ? 'block' : 'hidden'}>
          <StudyPage />
        </div>
        <div className={activeTab === 'posts' ? 'block' : 'hidden'}>
          <PostsPage onOpenAuth={handleOpenAuth} />
        </div>
        <div className={activeTab === 'forum' ? 'block' : 'hidden'}>
          <ForumPage />
        </div>
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <ProfilePage
            onOpenAuth={handleOpenAuth}
            onNavigateStudy={() => navigate('study')}
          />
        </div>
      </div>

      {/* Subtle Footer */}
      <footer className="page-reveal relative z-10 border-t border-white/10 bg-slate-950/55 py-6 px-6 text-center text-xs text-slate-400 font-light backdrop-blur-md" data-page-ready={pageReady} aria-hidden={!pageReady} inert={!pageReady}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>© 2026 TerenPhys.</span>
            <span>Физика без границ.</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('study')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Учёба
            </button>
            <button
              onClick={() => navigate('posts')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Посты
            </button>
            <button
              onClick={() => navigate('forum')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Форум
            </button>
            <a
              href="https://t.me/nisphysicshub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 hover:underline"
            >
              Telegram-канал
            </a>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        onClose={handleCloseAuth}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
