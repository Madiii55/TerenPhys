import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import type { AuthResult } from '../context/AuthContext.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { LanguageSwitch } from './LanguageSwitch.tsx';

export function EmailActionPage({ link, onContinue }: { link: string; onContinue: () => void }) {
  const { t } = useLanguage();
  const { completeAuthCallback, changeRecoveredPassword, user, authenticatedAccount, profileError } = useAuth();
  const [state, setState] = useState<'checking' | 'ready' | 'working' | 'done' | 'error'>('checking');
  const [action, setAction] = useState<'email' | 'recovery' | 'oauth' | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const submitting = useRef(false);
  // A one-time link is processed only once even in React StrictMode.
  const preparation = useRef<Promise<AuthResult & { action?: 'email' | 'recovery' | 'oauth' }> | null>(null);
  useEffect(() => {
    let active = true;
    if (!preparation.current) preparation.current = completeAuthCallback(link);
    preparation.current.then(result => {
      if (!active) return;
      setAction(result.action || 'email');
      if (!result.success) { setError(result.error || 'Не удалось открыть ссылку.'); setState('error'); return; }
      setState(result.action === 'recovery' ? 'ready' : 'done');
    }).catch(() => { if (active) { setError('Не удалось проверить ссылку. Попробуйте снова.'); setState('error'); } });
    return () => { active = false; };
  }, [link, completeAuthCallback]);
  const finish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    if (password !== repeat) { setError('Пароли не совпадают.'); return; }
    submitting.current = true; setError(''); setState('working');
    try {
      const result = await changeRecoveredPassword(password);
      if (result.success) { setPassword(''); setRepeat(''); setState('done'); }
      else { setError(result.error || 'Не удалось изменить пароль.'); setState('ready'); }
    } catch { setError('Не удалось изменить пароль.'); setState('ready'); }
    finally { submitting.current = false; }
  };
  const title = state === 'error' ? 'Не удалось открыть ссылку'
    : action === 'recovery' ? (state === 'done' ? 'Пароль изменён' : 'Новый пароль')
    : action === 'oauth' ? 'Вход выполнен'
    : state === 'done' ? 'Почта подтверждена' : 'Подтверждение почты';
  return <main className="email-action-page account-surface"><section className="account-modal">
    <div className="account-modal-top"><p className="account-caption">{t("TerenPhys / Аккаунт")}</p><LanguageSwitch /></div>
    <h1>{t(title)}</h1>
    {state === 'checking' && <p role="status">{t("Проверяем ссылку…")}</p>}
    {state === 'done' && <p role="status">{action === 'recovery'
      ? t("Новый пароль сохранён. Вы можете вернуться в свой профиль.")
      : t("Всё готово. Вы можете перейти в свой профиль.")}</p>}
    {action === 'recovery' && (state === 'ready' || state === 'working') && <form className="account-form" onSubmit={finish}>
      <label className="account-field">{t("Пароль")}<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label className="account-field">{t("Повторите пароль")}<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={repeat} onChange={event => setRepeat(event.target.value)} /></label>
      <button type="submit" className="account-button account-button-primary" disabled={state === 'working'}>{state === 'working' ? t("Сохраняем…") : t("Сохранить пароль")}</button>
    </form>}
    {error && <p role="alert" className="account-error">{t(error)}</p>}
    {state === 'done' && profileError && <p role="alert" className="account-error">{t(profileError)}</p>}
    <button type="button" disabled={state === 'working'} className="account-link" onClick={onContinue}>{state === 'done' ? user || authenticatedAccount ? t("Перейти в профиль") : t("Перейти ко входу") : t("Вернуться на сайт")}</button>
  </section></main>;
}
