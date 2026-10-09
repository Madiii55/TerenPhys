import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, avatarUrl, googleProviderEnabled } from '../supabase.ts';
import { authCallbackFromLink, authCallbackKind, isVerifiedAccount, verificationError } from '../auth/verification.ts';
import { emailReturnUrl, oauthReturnUrl } from '../auth/localOrigin.ts';
import { clearRecovery, emailCooldown, matchesRecovery, rememberEmailSend, rememberRecovery, restoredRecovery, sessionIdentifier, type RecoveryState } from '../auth/browserState.ts';
import type { Tables } from '../types/database.ts';

export interface UserProfile {
  id: string; name: string; email: string; bio: string; avatarUrl?: string; avatarPath?: string;
  provider: 'google' | 'email'; createdAt: string; updatedAt?: string; emailVerified: boolean;
}
export interface AuthResult { success: boolean; error?: string; needsVerification?: boolean }
export interface AuthContextType {
  user: UserProfile | null; pendingEmail: string | null; sessionError: string; isLoading: boolean;
  authenticatedAccount: { id: string; email: string } | null; profileError: string; googleEnabled: boolean;
  retryProfile: () => Promise<AuthResult>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<AuthResult>;
  loginWithEmail: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogle: () => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  resendVerification: () => Promise<AuthResult>;
  refreshVerification: () => Promise<AuthResult>;
  completeAuthCallback: (link: string) => Promise<AuthResult & { action?: 'email' | 'recovery' | 'oauth' }>;
  changeRecoveredPassword: (password: string) => Promise<AuthResult>;
  updateProfile: (changes: { name?: string; bio?: string; avatarUrl?: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const pendingKey = 'terenphys.pending-email';
function storedPending(): string | null {
  try { return sessionStorage.getItem(pendingKey); } catch { return null; }
}
const returnUrl = (action: 'callback' | 'confirm' | 'reset-password' = 'callback') =>
  emailReturnUrl(window.location.href, import.meta.env.VITE_PUBLIC_SITE_URL, action);
function profileFromRow(account: User, row: Tables<'profiles'>): UserProfile {
  return {
    id: row.id, name: row.name, bio: row.bio, email: account.email || '',
    avatarPath: row.avatar_path || undefined, avatarUrl: avatarUrl(row.avatar_path, row.updated_at),
    provider: account.app_metadata.provider === 'google' ? 'google' : 'email',
    createdAt: row.created_at, updatedAt: row.updated_at, emailVerified: true,
  };
}
async function loadProfile(account: User): Promise<UserProfile> {
  const first = await supabase.from('profiles').select('*').eq('id', account.id).maybeSingle();
  if (first.error) throw first.error;
  let row = first.data;
  if (!row) {
    // Metadata is only display data; it never supplies roles or publishing rights.
    const raw = account.user_metadata.name || account.user_metadata.full_name || account.email?.split('@')[0] || 'Пользователь';
    const name = String(raw).trim().slice(0, 40);
    const insert = await supabase.from('profiles').insert({ id: account.id, name: name.length >= 2 ? name : 'Пользователь', bio: '' }).select('*').single();
    if (insert.error?.code === '23505') {
      const retry = await supabase.from('profiles').select('*').eq('id', account.id).single();
      if (retry.error) throw retry.error;
      row = retry.data;
    } else { if (insert.error) throw insert.error; row = insert.data; }
  }
  return profileFromRow(account, row);
}
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(storedPending);
  const [sessionError, setSessionError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [authenticatedAccount, setAuthenticatedAccount] = useState<{ id: string; email: string } | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const generation = useRef(0);
  const accountId = useRef<string | null | undefined>(undefined);
  const recovery = useRef<RecoveryState | null>(restoredRecovery());
  type SyncStatus = 'authenticated' | 'pending' | 'signed-out' | 'stale';
  const inFlight = useRef<{ id: string; version: number; promise: Promise<SyncStatus> } | null>(null);
  const rememberPending = useCallback((email: string | null) => {
    setPendingEmail(email);
    try { if (email) sessionStorage.setItem(pendingKey, email); else sessionStorage.removeItem(pendingKey); } catch { /* Optional UI persistence. */ }
  }, []);
  const selectAccount = useCallback((id: string | null) => {
    if (accountId.current === id) return;
    const previous = accountId.current;
    accountId.current = id; generation.current++; inFlight.current = null;
    setUser(null); setAuthenticatedAccount(null); setProfileError(''); setSessionError('');
    // Preserve a restored recovery marker only while initially discovering its session.
    if (previous !== undefined || (recovery.current && recovery.current.userId !== id)) {
      recovery.current = null; clearRecovery();
    }
  }, []);
  const synchronize = useCallback(async (expectedId?: string): Promise<SyncStatus> => {
    const before = generation.current;
    const current = await supabase.auth.getSession();
    if (before !== generation.current) return 'stale';
    if (current.error) { setSessionError(verificationError(current.error)); setIsLoading(false); throw current.error; }
    const session = current.data.session;
    if (expectedId && session?.user.id !== expectedId) return 'stale';
    selectAccount(session?.user.id || null);
    if (!session) { setIsLoading(false); return 'signed-out'; }
    const version = generation.current;
    const pending = inFlight.current;
    if (pending && pending.id === session.user.id && pending.version === version) return pending.promise;
    setIsLoading(true); setSessionError(''); setProfileError('');
    const task = (async () => {
      const fresh = await supabase.auth.getUser();
      if (version !== generation.current) return 'stale' as const;
      if (fresh.error) throw fresh.error;
      if (!fresh.data.user || fresh.data.user.id !== session.user.id) return 'stale' as const;
      const account = fresh.data.user;
      if (!isVerifiedAccount(account)) {
        setUser(null); setAuthenticatedAccount(null); rememberPending(account.email || '');
        return 'pending' as const;
      }
      rememberPending(null); setAuthenticatedAccount({ id: account.id, email: account.email || '' });
      try {
        const profile = await loadProfile(account);
        if (version !== generation.current) return 'stale' as const;
        setUser(profile);
      } catch {
        if (version !== generation.current) return 'stale' as const;
        setProfileError('Вы вошли в аккаунт, но профиль не загрузился. Повторите загрузку.');
      }
      return 'authenticated' as const;
    })().catch(cause => {
      if (version !== generation.current) return 'stale' as const;
      setUser(null); setAuthenticatedAccount(null); setSessionError(verificationError(cause));
      throw cause;
    }).finally(() => {
      if (version === generation.current) setIsLoading(false);
      if (inFlight.current?.promise === task) inFlight.current = null;
    });
    inFlight.current = { id: session.user.id, version, promise: task };
    return task;
  }, [rememberPending, selectAccount]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        selectAccount(null); generation.current++; inFlight.current = null; recovery.current = null; clearRecovery();
        setUser(null); setIsLoading(false); rememberPending(null); return;
      }
      selectAccount(session?.user.id || null);
      // Do not call another auth method inside the SDK's auth-lock callback.
      if (event !== 'TOKEN_REFRESHED') {
        clearTimeout(timer);
        timer = setTimeout(() => { if (active) void synchronize(session?.user.id).catch(() => {}); }, 0);
      }
    });
    void synchronize().catch(() => {});
    return () => { active = false; clearTimeout(timer); subscription.unsubscribe(); generation.current++; inFlight.current = null; };
  }, [synchronize, rememberPending, selectAccount]);
  useEffect(() => {
    let active = true;
    const check = () => { void googleProviderEnabled().then(enabled => { if (active) setGoogleEnabled(enabled); }).catch(() => { if (active) setGoogleEnabled(false); }); };
    check();
    window.addEventListener('focus', check);
    return () => { active = false; window.removeEventListener('focus', check); };
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && pendingEmail) void synchronize().catch(() => {}); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [pendingEmail, synchronize]);
  const registerWithEmail = async (name: string, email: string, password: string): Promise<AuthResult> => {
    const nickname = name.trim();
    if (nickname.length < 2 || nickname.length > 40) return { success: false, error: 'Никнейм должен содержать от 2 до 40 символов.' };
    if (password.length < 8 || password.length > 128) return { success: false, error: 'Пароль должен содержать от 8 до 128 символов.' };
    if (emailCooldown(email, 'signup')) return { success: false, error: 'Перед повторной отправкой немного подождите.' };
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: nickname }, emailRedirectTo: returnUrl('confirm') } });
      if (error) throw error;
      if (data.session) {
        // Confirm Email must also be enabled in the project, not just this UI.
        await supabase.auth.signOut();
        return { success: false, error: 'Подтверждение почты отключено на сервере. Администратору нужно включить Confirm Email в Supabase.' };
      }
      rememberEmailSend(email, 'signup'); rememberPending(email.trim()); setUser(null);
      return { success: true, needsVerification: true };
    } catch (cause) {
      if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes((cause as { code?: string })?.code || '')) rememberEmailSend(email, 'signup');
      return { success: false, error: verificationError(cause, 'email') };
    }
  };
  const loginWithEmail = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.code === 'email_not_confirmed') {
          rememberPending(email.trim());
          return { success: false, needsVerification: true, error: verificationError(error) };
        }
        throw error;
      }
      const status = await synchronize(data.user?.id);
      if (status === 'authenticated') return { success: true };
      if (status === 'pending') return { success: false, needsVerification: true, error: 'Подтвердите почту, чтобы войти.' };
      return { success: false, error: 'Аккаунт изменился во время входа. Повторите попытку.' };
    } catch (cause) { return { success: false, error: verificationError(cause) }; }
  };
  const loginWithGoogle = async (): Promise<AuthResult> => {
    try {
      const enabled = await googleProviderEnabled(); setGoogleEnabled(enabled);
      if (!enabled) return { success: false, error: 'Вход через Google ещё не настроен в Supabase. Пока используйте почту.' };
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: oauthReturnUrl(window.location.href), queryParams: { prompt: 'select_account' },
      } });
      if (error) throw error;
      return { success: true };
    } catch (cause) { return { success: false, error: verificationError(cause, 'oauth') }; }
  };
  const sendPasswordReset = async (email: string): Promise<AuthResult> => {
    if (emailCooldown(email, 'recovery')) return { success: false, error: 'Перед повторной отправкой немного подождите.' };
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: returnUrl('reset-password') });
      if (error) throw error;
      rememberEmailSend(email, 'recovery');
      return { success: true };
    } catch (cause) {
      if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes((cause as { code?: string })?.code || '')) rememberEmailSend(email, 'recovery');
      return { success: false, error: verificationError(cause, 'recovery') };
    }
  };
  const resendVerification = async (): Promise<AuthResult> => {
    if (!pendingEmail) return { success: false, error: 'Сначала укажите почту при регистрации или входе.' };
    if (emailCooldown(pendingEmail, 'signup')) return { success: false, error: 'Перед повторной отправкой немного подождите.' };
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail, options: { emailRedirectTo: returnUrl('confirm') } });
      if (error) throw error;
      rememberEmailSend(pendingEmail, 'signup');
      return { success: true };
    } catch (cause) {
      if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes((cause as { code?: string })?.code || '')) rememberEmailSend(pendingEmail, 'signup');
      return { success: false, error: verificationError(cause, 'email') };
    }
  };
  const refreshVerification = async (): Promise<AuthResult> => {
    try {
      if (await synchronize() === 'authenticated') return { success: true };
      return { success: false, error: 'Откройте ссылку из письма на этом устройстве. Если подтвердили почту в другом браузере, вернитесь ко входу и введите почту и пароль.' };
    } catch (cause) { return { success: false, error: verificationError(cause) }; }
  };
  const completeAuthCallback = async (link: string): Promise<AuthResult & { action?: 'email' | 'recovery' | 'oauth' }> => {
    let kind: 'email' | 'recovery' | 'oauth' = 'email';
    try {
      const url = new URL(link);
      kind = authCallbackKind(url);
      const bare = url.origin === window.location.origin && !url.username && !url.password
        && ['/auth/callback', '/auth/confirm', '/auth/reset-password'].includes(url.pathname) && !url.search && !url.hash;
      // Reloading an already completed sign-in must not try to consume its one-time code again.
      if (bare && kind !== 'recovery' && await synchronize() === 'authenticated') return { success: true, action: kind };
      if (bare && kind === 'recovery') {
        const session = await supabase.auth.getSession();
        if (session.error) throw session.error;
        const fresh = await supabase.auth.getUser();
        if (fresh.error) throw fresh.error;
        const account = fresh.data.user;
        const marker = recovery.current || restoredRecovery();
        if (!isVerifiedAccount(account) || session.data.session?.user.id !== account?.id
          || !matchesRecovery(marker, account!.id, sessionIdentifier(session.data.session?.access_token || ''))) {
          clearRecovery(); recovery.current = null;
          return { success: false, action: kind, error: 'Откройте новую ссылку сброса пароля из письма.' };
        }
        recovery.current = marker;
        if (await synchronize(account!.id) !== 'authenticated') return { success: false, action: kind, error: 'Аккаунт изменился во время входа. Повторите попытку.' };
        return { success: true, action: kind };
      }
      const action = authCallbackFromLink(link, window.location.origin);
      kind = action.kind;
      const response = action.method === 'otp'
        ? await supabase.auth.verifyOtp({ token_hash: action.tokenHash, type: action.type })
        : action.method === 'code' ? await supabase.auth.exchangeCodeForSession(action.code)
        : await supabase.auth.setSession({ access_token: action.accessToken, refresh_token: action.refreshToken });
      if (response.error) throw response.error;
      const fresh = await supabase.auth.getUser();
      if (fresh.error) throw fresh.error;
      if (!isVerifiedAccount(fresh.data.user)) return { success: false, needsVerification: true, error: 'Почта ещё не подтверждена.' };
      if (action.kind === 'recovery') {
        const session = response.data.session;
        const id = sessionIdentifier(session?.access_token || '');
        if (!id || session?.user.id !== fresh.data.user.id) throw new Error('Recovery session unavailable');
        recovery.current = rememberRecovery(fresh.data.user.id, id);
      }
      const status = await synchronize(fresh.data.user.id);
      if (status !== 'authenticated') return { success: false, action: kind, error: 'Аккаунт изменился во время входа. Повторите попытку.' };
      return { success: true, action: action.kind };
    } catch (cause) { return { success: false, action: kind, error: verificationError(cause, kind) }; }
  };
  const changeRecoveredPassword = async (password: string): Promise<AuthResult> => {
    if (password.length < 8 || password.length > 128) return { success: false, error: 'Пароль должен содержать от 8 до 128 символов.' };
    try {
      const version = generation.current;
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const session = await supabase.auth.getSession();
      if (session.error) throw session.error;
      if (version !== generation.current) return { success: false, error: 'Аккаунт изменился во время входа. Повторите попытку.' };
      if (!isVerifiedAccount(data.user) || session.data.session?.user.id !== data.user?.id
        || !matchesRecovery(recovery.current || restoredRecovery(), data.user!.id, sessionIdentifier(session.data.session?.access_token || '')))
        return { success: false, error: 'Откройте новую ссылку сброса пароля из письма.' };
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      recovery.current = null; clearRecovery();
      return { success: true };
    } catch (cause) { return { success: false, error: verificationError(cause, 'recovery') }; }
  };
  const updateProfile = async (changes: { name?: string; bio?: string; avatarUrl?: string }): Promise<AuthResult> => {
    const version = generation.current;
    if (!user) return { success: false, error: 'Сначала войдите в аккаунт.' };
    const name = changes.name === undefined ? user.name : changes.name.trim();
    const bio = changes.bio === undefined ? user.bio : changes.bio.trim();
    if (name.length < 2 || name.length > 40) return { success: false, error: 'Никнейм должен содержать от 2 до 40 символов.' };
    if (bio.length > 300) return { success: false, error: 'Описание может содержать до 300 символов.' };
    try {
      const fresh = await supabase.auth.getUser();
      if (fresh.error) throw fresh.error;
      if (!isVerifiedAccount(fresh.data.user) || fresh.data.user.id !== user.id) return { success: false, error: 'Войдите заново.' };
      let path = user.avatarPath || null;
      if (changes.avatarUrl !== undefined) {
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(changes.avatarUrl)) return { success: false, error: 'Выберите фотографию в поддерживаемом формате.' };
        const encoded = changes.avatarUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
        if (bytes.length > 524288) return { success: false, error: 'Фотография слишком большая.' };
        path = user.id + '/profile.jpg';
        const uploaded = await supabase.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '60', upsert: true });
        if (uploaded.error) throw uploaded.error;
      }
      const result = await supabase.from('profiles').update({ name, bio, avatar_path: path }).eq('id', user.id).select('*').single();
      if (result.error) throw result.error;
      if (version === generation.current) setUser(profileFromRow(fresh.data.user, result.data));
      return { success: true };
    } catch { return { success: false, error: 'Не удалось сохранить профиль. Попробуйте ещё раз.' }; }
  };
  const logout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    selectAccount(null); generation.current++; inFlight.current = null; recovery.current = null; clearRecovery();
    setUser(null); rememberPending(null); setSessionError('');
  };
  const retryProfile = async (): Promise<AuthResult> => {
    try { return { success: await synchronize() === 'authenticated' }; }
    catch (cause) { return { success: false, error: verificationError(cause) }; }
  };
  return <AuthContext.Provider value={{ user, pendingEmail, sessionError, isLoading, authenticatedAccount, profileError, googleEnabled, retryProfile,
    registerWithEmail, loginWithEmail, loginWithGoogle, sendPasswordReset, resendVerification,
    refreshVerification, completeAuthCallback, changeRecoveredPassword, updateProfile, logout }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
