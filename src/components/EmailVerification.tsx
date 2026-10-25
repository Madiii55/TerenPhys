import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { useEmailCooldown } from '../auth/browserState.ts';

export function EmailVerification({ onVerified }: { onVerified?: () => void }) {
  const { t } = useLanguage();
  const { pendingEmail, user, resendVerification, refreshVerification, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cooldown = useEmailCooldown(pendingEmail || '', 'signup');
  useEffect(() => { if (user?.emailVerified) onVerified?.(); }, [user?.emailVerified, onVerified]);
  const perform = async (action: 'send' | 'refresh') => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = action === 'send' ? await resendVerification() : await refreshVerification();
      if (!result.success) setError(result.error || 'Не удалось подтвердить почту.');
      else if (action === 'send') { setNotice('Письмо отправлено. Проверьте входящие и папку «Спам».'); }
      else { setNotice('Почта подтверждена. Теперь можно войти в аккаунт.'); onVerified?.(); }
    } finally { setBusy(false); }
  };
  return <section className="account-verification">
    <h2>{t("Подтвердите почту")}</h2>
    <p>{pendingEmail ? t('Откройте ссылку из письма, отправленного на {email}. До подтверждения личный кабинет недоступен.', { email: pendingEmail }) : t('Откройте ссылку из письма. До подтверждения личный кабинет недоступен.')}</p>
    <div className="account-actions">
      <button type="button" className="account-button account-button-primary" disabled={busy} onClick={() => perform('refresh')}>{busy ? t("Проверяем…") : t("Я подтвердил почту")}</button>
      <button type="button" className="account-link" disabled={busy || cooldown > 0} onClick={() => perform('send')}>{cooldown ? t('Отправить снова через {seconds} с', { seconds: cooldown }) : t("Отправить письмо ещё раз")}</button>
    </div>
    {error && <p role="alert" className="account-error">{t(error)}</p>}
    {notice && <p role="status" className="account-notice">{t(notice)}</p>}
    <button type="button" className="account-link verification-leave" disabled={busy} onClick={() => void logout().then(() => onVerified?.()).catch(() => setError('Не удалось выйти. Повторите попытку.'))}>{t("Выйти и использовать другую почту")}</button>
  </section>;
}
