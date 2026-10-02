import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut,
  updateProfile as updateAuthProfile, type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase.ts';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
  createdAt: string;
  updatedAt?: string;
  emailVerified: boolean;
}

interface AuthResult {
  success: boolean;
  error?: string;
  needsVerification?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  registerWithEmail: (name: string, email: string, password: string) => Promise<AuthResult>;
  loginWithEmail: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogle: () => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  resendVerification: () => Promise<AuthResult>;
  refreshVerification: () => Promise<AuthResult>;
  updateProfile: (changes: { name?: string; bio?: string; avatarUrl?: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readableAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use': return 'Аккаунт с этой почтой уже существует. Попробуйте войти.';
    case 'auth/invalid-email': return 'Введите корректный адрес электронной почты.';
    case 'auth/weak-password': return 'Пароль слишком простой. Используйте не менее 8 символов.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Неверная почта или пароль.';
    case 'auth/too-many-requests': return 'Слишком много попыток. Попробуйте позже.';
    case 'auth/network-request-failed': return 'Нет соединения с сервером. Проверьте интернет.';
    case 'auth/operation-not-allowed': return 'Этот способ входа пока не включён в настройках Firebase.';
    case 'auth/unauthorized-domain': return 'Этот адрес сайта не разрешён для входа в настройках Firebase.';
    case 'auth/account-exists-with-different-credential': return 'Аккаунт с этой почтой уже существует. Войдите другим способом.';
    case 'auth/popup-blocked': return 'Браузер заблокировал окно Google. Разрешите всплывающие окна.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'Вход через Google отменён.';
    default: return 'Не удалось выполнить действие. Попробуйте ещё раз.';
  }
}

async function loadProfile(firebaseUser: FirebaseUser): Promise<UserProfile> {
  const email = firebaseUser.email || '';
  const profileRef = doc(db, 'users', firebaseUser.uid);
  let data: Record<string, unknown> | null = null;
  let profileExists = false;
  try {
    const snapshot = await getDoc(profileRef);
    profileExists = snapshot.exists();
    data = profileExists ? snapshot.data() ?? null : null;
  } catch (error) {
    console.warn('Profile storage is unavailable:', error);
  }
  const provider = firebaseUser.providerData.some((item) => item.providerId === 'google.com') ? 'google' : 'email';
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id: firebaseUser.uid,
    name: typeof data?.name === 'string' && data.name.trim()
      ? data.name : firebaseUser.displayName || email.split('@')[0] || 'Пользователь',
    email,
    bio: typeof data?.bio === 'string' ? data.bio : '',
    avatarUrl: typeof data?.avatarUrl === 'string' ? data.avatarUrl : firebaseUser.photoURL || undefined,
    provider,
    createdAt: typeof data?.createdAt === 'string' ? data.createdAt : firebaseUser.metadata.creationTime || now,
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : undefined,
    emailVerified: firebaseUser.emailVerified,
  };
  // Old e-mail/password documents are never imported into the new authentication scheme.
  if (!profileExists) {
    try {
      await setDoc(profileRef, {
        id: profile.id, name: profile.name, email: profile.email, bio: profile.bio,
        avatarUrl: profile.avatarUrl || '', provider: profile.provider,
        createdAt: profile.createdAt, updatedAt: now,
      });
    } catch (error) {
      console.warn('Could not save profile:', error);
    }
  }
  return profile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem('terenphys_active_session_v3');
    let active = true;
    let unsubscribe = () => {};
    const restore = async () => {
      // A one-time sign-out clears Google sessions persisted by the old scheme.
      if (localStorage.getItem('terenphys_auth_schema_v4') !== '1') {
        await signOut(auth);
        localStorage.setItem('terenphys_auth_schema_v4', '1');
      }
      if (!active) return;
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          if (active) { setUser(null); setIsLoading(false); }
          return;
        }
        try {
          const profile = await loadProfile(firebaseUser);
          if (active) setUser(profile);
        } catch (error) {
          console.error('Could not load profile:', error);
          if (active) setUser(null);
        } finally {
          if (active) setIsLoading(false);
        }
      });
    };
    restore().catch((error) => {
      console.error('Could not restore authentication:', error);
      if (active) setIsLoading(false);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const registerWithEmail = async (name: string, email: string, password: string): Promise<AuthResult> => {
    const nickname = name.trim();
    if (nickname.length < 2 || nickname.length > 40) {
      return { success: false, error: 'Никнейм должен содержать от 2 до 40 символов.' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Пароль должен содержать не менее 8 символов.' };
    }
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateAuthProfile(credential.user, { displayName: nickname });
      const now = new Date().toISOString();
      try {
        await setDoc(doc(db, 'users', credential.user.uid), {
          id: credential.user.uid, name: nickname,
          email: credential.user.email || email.trim(),
          bio: '', avatarUrl: '', provider: 'email',
          createdAt: credential.user.metadata.creationTime || now, updatedAt: now,
        });
      } catch (error) {
        console.warn('Could not save new profile:', error);
      }
      setUser({ ...(await loadProfile(credential.user)), name: nickname });
      try {
        await sendEmailVerification(credential.user);
      } catch {
        return { success: true, needsVerification: true, error: 'Аккаунт создан, но письмо не отправлено. Попробуйте отправить его ещё раз.' };
      }
      return { success: true, needsVerification: true };
    } catch (error) {
      return { success: false, error: readableAuthError(error) };
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(await loadProfile(credential.user));
      return { success: true, needsVerification: !credential.user.emailVerified };
    } catch (error) {
      return { success: false, error: readableAuthError(error) };
    }
  };

  const loginWithGoogle = async (): Promise<AuthResult> => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      setUser(await loadProfile(credential.user));
      return { success: true };
    } catch (error) {
      return { success: false, error: readableAuthError(error) };
    }
  };

  const sendPasswordReset = async (email: string): Promise<AuthResult> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (error) {
      return { success: false, error: readableAuthError(error) };
    }
  };

  const resendVerification = async (): Promise<AuthResult> => {
    if (!auth.currentUser) return { success: false, error: 'Сначала войдите в аккаунт.' };
    try {
      await sendEmailVerification(auth.currentUser);
      return { success: true };
    } catch (error) {
      return { success: false, error: readableAuthError(error) };
    }
  };

  const refreshVerification = async (): Promise<AuthResult> => {
    if (!auth.currentUser) return { success: false, error: 'Сначала войдите в аккаунт.' };
    try {
      await reload(auth.currentUser);
      setUser(await loadProfile(auth.currentUser));
      return auth.currentUser.emailVerified
        ? { success: true }
        : { success: false, error: 'Почта ещё не подтверждена. Откройте ссылку из письма.' };
    } catch (error) {
      return { success: false, error: readableAuthError(error) };
    }
  };

  const updateProfile = async (changes: { name?: string; bio?: string; avatarUrl?: string }): Promise<AuthResult> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !user || firebaseUser.uid !== user.id) {
      return { success: false, error: 'Сначала войдите в аккаунт.' };
    }
    const name = changes.name === undefined ? user.name : changes.name.trim();
    const bio = changes.bio === undefined ? user.bio : changes.bio.trim();
    if (name.length < 2 || name.length > 40) {
      return { success: false, error: 'Никнейм должен содержать от 2 до 40 символов.' };
    }
    if (bio.length > 300) {
      return { success: false, error: 'Описание может содержать до 300 символов.' };
    }
    try {
      if (name !== user.name) await updateAuthProfile(firebaseUser, { displayName: name });
      const updatedAt = new Date().toISOString();
      const next = { ...user, name, bio, avatarUrl: changes.avatarUrl ?? user.avatarUrl, updatedAt };
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        id: firebaseUser.uid, email: user.email, name, bio,
        avatarUrl: next.avatarUrl || '', provider: user.provider,
        createdAt: user.createdAt, updatedAt,
      });
      setUser(next);
      return { success: true };
    } catch {
      return { success: false, error: 'Не удалось сохранить профиль. Попробуйте ещё раз.' };
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user, isLoading, registerWithEmail, loginWithEmail, loginWithGoogle,
      sendPasswordReset, resendVerification, refreshVerification, updateProfile, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
