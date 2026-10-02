import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, MailCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { GoogleIcon } from './GoogleIcon.tsx';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
}

type Mode = 'login' | 'register' | 'reset' | 'verify';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialMode, onClose }) => {
  const {
    registerWithEmail, loginWithEmail, loginWithGoogle, sendPasswordReset,
    resendVerification, refreshVerification,
  } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setPassword('');
      setError('');
      setNotice('');
    }
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const changeMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setError('');
    setNotice('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'register') {
        const result = await registerWithEmail(nickname, email, password);
        if (result.success) {
          changeMode('verify');
          if (result.error) setError(result.error);
        }
        else setError(result.error || 'Не удалось создать аккаунт.');
      } else if (mode === 'login') {
        const result = await loginWithEmail(email, password);
        if (result.success) {
          if (result.needsVerification) changeMode('verify');
          else onClose();
        } else setError(result.error || 'Не удалось войти.');
      } else if (mode === 'reset') {
        const result = await sendPasswordReset(email);
        if (result.success) setNotice('Если аккаунт существует, письмо для сброса пароля придёт на почту.');
        else setError(result.error || 'Не удалось отправить письмо.');
      }
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setError('');
    const result = await loginWithGoogle();
    setBusy(false);
    if (result.success) onClose();
    else if (result.error !== 'Вход через Google отменён.') setError(result.error || 'Не удалось войти через Google.');
  };

  const handleVerification = async (action: 'send' | 'refresh') => {
    setBusy(true);
    setError('');
    setNotice('');
    const result = action === 'send' ? await resendVerification() : await refreshVerification();
    setBusy(false);
    if (result.success) {
      if (action === 'refresh') onClose();
      else setNotice('Новое письмо отправлено. Проверьте также папку «Спам».');
    } else setError(result.error || 'Не удалось подтвердить почту.');
  };

  const title = {
    login: 'Вход в аккаунт',
    register: 'Создать аккаунт',
    reset: 'Сбросить пароль',
    verify: 'Подтвердите почту',
  }[mode];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-[28px] border border-white/70 bg-white p-7 shadow-2xl sm:p-9">
        <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>

        {mode === 'verify' ? (
          <div className="pt-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-[#0284c7]">
              <MailCheck className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Мы отправили ссылку на {email || 'вашу почту'}. Откройте письмо и подтвердите адрес, затем вернитесь сюда.
            </p>
            <button type="button" disabled={busy} onClick={() => handleVerification('refresh')} className="mt-7 w-full rounded-xl bg-[#0284c7] px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
              {busy ? 'Проверяем…' : 'Я подтвердил почту'}
            </button>
            <button type="button" disabled={busy} onClick={() => handleVerification('send')} className="mt-3 text-sm font-medium text-[#0284c7] hover:underline disabled:opacity-60">
              Отправить письмо ещё раз
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0284c7]">TerenPhys</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {mode === 'reset' ? 'Укажите почту, и мы отправим ссылку для смены пароля.' : 'Физика начинается здесь.'}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === 'register' && (
                <label className="block text-sm font-medium text-slate-700">
                  Никнейм
                  <input autoComplete="nickname" required minLength={2} maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Как к вам обращаться?" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-sky-100" />
                </label>
              )}
              <label className="block text-sm font-medium text-slate-700">
                Электронная почта
                <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-sky-100" />
              </label>
              {mode !== 'reset' && (
                <label className="block text-sm font-medium text-slate-700">
                  Пароль
                  <div className="relative mt-2">
                    <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'Не менее 8 символов' : 'Введите пароль'} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-slate-900 outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-sky-100" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-700">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </label>
              )}
              {mode === 'login' && (
                <button type="button" onClick={() => changeMode('reset')} className="text-sm text-[#0284c7] hover:underline">
                  Забыли пароль?
                </button>
              )}
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0284c7] px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {mode === 'login' ? 'Войти' : mode === 'register' ? 'Зарегистрироваться' : 'Отправить ссылку'}
              </button>
            </form>

            {mode !== 'reset' && (
              <>
                <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />или<span className="h-px flex-1 bg-slate-200" />
                </div>
                <button type="button" disabled={busy} onClick={signInWithGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <GoogleIcon className="h-4 w-4" />Продолжить с Google
                </button>
              </>
            )}
            <div className="mt-6 text-center text-sm text-slate-500">
              {mode === 'login' ? (
                <>Нет аккаунта? <button type="button" onClick={() => changeMode('register')} className="font-medium text-[#0284c7] hover:underline">Регистрация</button></>
              ) : (
                <>Уже есть аккаунт? <button type="button" onClick={() => changeMode('login')} className="font-medium text-[#0284c7] hover:underline">Войти</button></>
              )}
            </div>
          </>
        )}
        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
      </div>
    </div>
  );
};
