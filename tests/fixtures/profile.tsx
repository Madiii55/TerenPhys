// Isolated UI fixture. Not imported by the app or included in its production build.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext, type AuthContextType, type UserProfile } from '../../src/context/AuthContext.tsx';
import { ProfilePage } from '../../src/components/ProfilePage.tsx';
import { AuthModal } from '../../src/components/AuthModal.tsx';
import { CosmicBackground } from '../../src/components/CosmicBackground.tsx';
import '../../src/index.css';

if (!import.meta.env.DEV) throw new Error('UI fixture is development-only.');
const initialProfile: UserProfile = {
  id: 'ui-demo', name: 'Александр', email: 'student@example.test',
  bio: 'Изучаю физику и готовлюсь к олимпиадам.\nБольше всего интересуют астрофизика и механика.',
  provider: 'email', createdAt: '2026-10-02T00:00:00.000Z', emailVerified: true,
};
function Fixture() {
  const [mode, setMode] = useState<'member' | 'guest' | 'pending'>('member');
  const [profile, setProfile] = useState(initialProfile);
  const [modal, setModal] = useState<'login' | 'register' | null>(null);
  const unavailable = async () => ({ success: false, error: 'Это демонстрация. Запросы в Supabase не отправляются.' });
  const context: AuthContextType = {
    user: mode === 'member' ? profile : null,
    pendingEmail: mode === 'pending' ? initialProfile.email : null,
    sessionError: '', isLoading: false, authenticatedAccount: mode === 'member' ? { id: profile.id, email: profile.email } : null,
    profileError: '', googleEnabled: true, retryProfile: unavailable,
    registerWithEmail: unavailable, loginWithEmail: unavailable, loginWithGoogle: unavailable,
    sendPasswordReset: unavailable, resendVerification: unavailable,
    refreshVerification: async () => ({ success: false, error: 'Почта ещё не подтверждена. Откройте ссылку из письма.' }),
    completeAuthCallback: unavailable, changeRecoveredPassword: unavailable,
    updateProfile: async changes => { setProfile(current => ({ ...current, ...changes })); return { success: true }; },
    logout: async () => { setMode('guest'); },
  };
  return <AuthContext.Provider value={context}>
    <CosmicBackground activeTab="profile" transitionId={0} onTransitionComplete={() => {}} />
    <nav style={{ position: 'relative', zIndex: 20, display: 'flex', flexWrap: 'wrap', gap: 20, padding: '16px 24px', background: '#11151e', color: '#eee', font: '14px Arial' }}>
      <span>UI-проверка · демонстрационные данные</span>
      <button onClick={() => setMode('member')}>Профиль</button>
      <button onClick={() => setMode('guest')}>Гость</button>
      <button onClick={() => setMode('pending')}>Подтверждение</button>
    </nav>
    <ProfilePage onOpenAuth={setModal} />
    <AuthModal isOpen={modal !== null} initialMode={modal || 'login'} onClose={() => setModal(null)} />
  </AuthContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
