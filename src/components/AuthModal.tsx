import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { EmailVerification } from './EmailVerification.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { LanguageSwitch } from './LanguageSwitch.tsx';
import { useEmailCooldown } from '../auth/browserState.ts';
import { GoogleIcon } from './GoogleIcon.tsx';

interface AuthModalProps { isOpen: boolean; initialMode: 'login' | 'register'; onClose: () => void }
type Mode = 'login' | 'register' | 'reset' | 'verify';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialMode, onClose }) => {
  const { t } = useLanguage();
  const { registerWithEmail, loginWithEmail, loginWithGoogle, sendPasswordReset, pendingEmail, googleEnabled } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const submitting = useRef(false);
  const cooldown = useEmailCooldown(email, mode === 'reset' ? 'recovery' : 'signup');
  useEffect(() => {
    requestId.current++; submitting.current = false; setBusy(false);
    if (isOpen) {
      setMode(pendingEmail !== null ? 'verify' : initialMode);
      setPassword(''); setShowPassword(false); setError(''); setNotice('');
    }
    // Resume pending verification when opening; later state changes do not reset the form.
  }, [initialMode, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, a[href]') || [])].filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const changeMode = (next: Mode) => { setMode(next); setPassword(''); setShowPassword(false); setError(''); setNotice(''); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; const request = ++requestId.current;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'reset') {
        const result = await sendPasswordReset(email);
        if (request !== requestId.current) return;
        if (result.success) setNotice('Если аккаунт существует, письмо для сброса пароля придёт на почту.');
        else setError(result.error || 'Не удалось отправить письмо.');
      } else {
        const result = mode === 'register' ? await registerWithEmail(nickname, email, password) : await loginWithEmail(email, password);
        if (request !== requestId.current) return;
        if (result.needsVerification) { changeMode('verify'); if (result.error) setError(result.error); }
        else if (result.success) onClose();
        else setError(result.error || 'Не удалось войти.');
      }
    } catch { if (request === requestId.current) setError('Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.'); }
    finally { if (request === requestId.current) { submitting.current = false; setBusy(false); } }
  };
  const google = async () => {
    if (submitting.current) return;
    submitting.current = true; const request = ++requestId.current;
    setBusy(true); setError('');
    try {
      const result = await loginWithGoogle();
      if (request !== requestId.current) return;
      if (result.needsVerification) changeMode('verify');
      else if (result.success) onClose();
      else if (result.error !== 'Вход через Google отменён.') setError(result.error || 'Не удалось войти.');
    } catch { if (request === requestId.current) setError('Не удалось войти через Google.'); }
    finally { if (request === requestId.current) { submitting.current = false; setBusy(false); } }
  };
  const title = { login: 'Вход', register: 'Регистрация', reset: 'Сброс пароля', verify: 'Подтвердите почту' }[mode];
  return createPortal(<div className="account-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t(title)} className="account-modal account-surface">
      <div className="account-modal-top"><span>TerenPhys</span><LanguageSwitch /><button type="button" className="account-link" onClick={onClose}>{t("Закрыть")}</button></div>
      {mode === 'verify' ? <EmailVerification onVerified={onClose} /> : <>
        <h2>{t(title)}</h2>
        {mode === 'reset' && <p>{t("Укажите почту, чтобы получить ссылку для смены пароля.")}</p>}
        <form onSubmit={submit} className="account-form">
          {mode === 'register' && <label className="account-field">{t("Никнейм")}<input disabled={busy} autoComplete="nickname" required minLength={2} maxLength={40} value={nickname} onChange={event => setNickname(event.target.value)} /></label>}
          <label className="account-field">{t("Электронная почта")}<input disabled={busy} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          {mode !== 'reset' && <label className="account-field"><span className="account-field-label">{t("Пароль")}<button type="button" className="account-link" onClick={() => setShowPassword(value => !value)}>{showPassword ? t("Скрыть") : t("Показать")}</button></span><input disabled={busy} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 8 : undefined} maxLength={mode === 'register' ? 128 : undefined} value={password} onChange={event => setPassword(event.target.value)} />{mode === 'register' && <span className="account-caption">{t("Не менее 8 символов")}</span>}</label>}
          {mode === 'login' && <button type="button" disabled={busy} className="account-link account-forgot" onClick={() => changeMode('reset')}>{t("Забыли пароль?")}</button>}
          <button type="submit" disabled={busy || (mode !== 'login' && cooldown > 0)} className="account-button account-button-primary">{busy ? t("Подождите…") : mode !== 'login' && cooldown ? t('Отправить снова через {seconds} с', { seconds: cooldown }) : mode === 'login' ? t("Войти") : mode === 'register' ? t("Создать аккаунт") : t("Отправить ссылку")}</button>
        </form>
        {mode !== 'reset' && googleEnabled && <button type="button" className="account-button account-google" disabled={busy} onClick={google}><GoogleIcon />{t("Продолжить с Google")}</button>}
        <div className="account-switch">{mode === 'login' ? <>{t("Нет аккаунта?")}{' '}<button type="button" disabled={busy} className="account-link" onClick={() => changeMode('register')}>{t("Регистрация")}</button></> : <button type="button" disabled={busy} className="account-link" onClick={() => changeMode('login')}>{t("Вернуться ко входу")}</button>}</div>
      </>}
      {error && <p role="alert" className="account-error">{t(error)}</p>}
      {notice && <p role="status" className="account-notice">{t(notice)}</p>}
    </div>
  </div>, document.body);
};
