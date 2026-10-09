import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PrivacyPolicyModal } from './PrivacyPolicyModal.tsx';
import { EmailVerification } from './EmailVerification.tsx';
import { compressAvatarImage } from '../utils/imageCompressor.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { GoogleIcon } from './GoogleIcon.tsx';

interface ProfilePageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onNavigateStudy?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenAuth }) => {
  const { t } = useLanguage();
  const { user, pendingEmail, sessionError, profileError, authenticatedAccount, googleEnabled, isLoading, logout, updateProfile, loginWithGoogle, retryProfile } = useAuth();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setEditing(false); setNickname(''); setBio(''); setError(''); setNotice('');
  }, [user?.id]);

  const signInWithGoogle = async () => {
    setBusy(true); setError('');
    try {
      const result = await loginWithGoogle();
      if (!result.success && !result.needsVerification && result.error !== 'Вход через Google отменён.') setError(result.error || 'Не удалось войти через Google.');
    } finally { setBusy(false); }
  };
  const beginEdit = () => {
    if (!user) return;
    setNickname(user.name); setBio(user.bio); setError(''); setNotice(''); setEditing(true);
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await updateProfile({ name: nickname, bio });
      if (result.success) { setEditing(false); setNotice('Изменения сохранены.'); }
      else setError(result.error || 'Не удалось сохранить профиль.');
    } finally { setBusy(false); }
  };
  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try {
      const avatarUrl = await compressAvatarImage(file, 256, 0.8);
      const result = await updateProfile({ avatarUrl });
      if (result.success) setNotice('Фотография обновлена.');
      else setError(result.error || 'Не удалось загрузить фотографию.');
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Не удалось обработать изображение.'); }
    finally { setBusy(false); }
  };
  const leave = async () => {
    setBusy(true);
    try { await logout(); setEditing(false); setNotice(''); }
    catch { setError('Не удалось выйти. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  };
  const retry = async () => {
    setBusy(true); setError('');
    try { const result = await retryProfile(); if (!result.success && result.error) setError(result.error); }
    finally { setBusy(false); }
  };

  return <main className="profile-page account-surface">
    <div className="profile-layout">
      <header className="profile-page-header"><p>{t("TerenPhys / Личный кабинет")}</p></header>
      {pendingEmail !== null ? <div className="profile-pending"><EmailVerification /></div>
        : isLoading ? <p role="status" className="profile-loading">{t("Загружаем профиль…")}</p>
        : authenticatedAccount && !user ? <section className="profile-signin">
          <h1>{t("Вход выполнен")}</h1><p>{authenticatedAccount.email}</p>
          <p role="alert">{t(profileError || 'Вы вошли в аккаунт, но профиль не загрузился. Повторите загрузку.')}</p>
          <div className="account-actions"><button type="button" disabled={busy} className="account-button" onClick={retry}>{t("Повторить загрузку")}</button><button type="button" disabled={busy} className="account-link" onClick={leave}>{t("Выйти из аккаунта")}</button></div>
        </section>
        : !user ? <section className="profile-welcome">
          <div className="profile-intro"><h1>{t("Ваш профиль.")}</h1><p>{t("Имя, фотография")}<br />{t("и несколько слов о себе.")}</p></div>
          <div className="profile-signin">
            <h2>{t("Войти в TerenPhys")}</h2><p>{googleEnabled ? t("Используйте почту или аккаунт Google.") : t("Войти по почте")}</p>
            <button type="button" className="account-button account-button-primary" onClick={() => onOpenAuth('login')}>{t("Войти по почте")}</button>
            {googleEnabled && <button type="button" className="account-button account-google" disabled={busy} onClick={signInWithGoogle}><GoogleIcon />{busy ? t("Подождите…") : t("Продолжить с Google")}</button>}
            <div className="profile-register"><span>{t("Ещё нет аккаунта?")}</span><button type="button" className="account-link" onClick={() => onOpenAuth('register')}>{t("Зарегистрироваться")}</button></div>
            <button type="button" className="account-link profile-privacy" onClick={() => setPolicyOpen(true)}>{t("Политика конфиденциальности")}</button>
          </div>
        </section> : <section className="profile-member">
          <aside className="profile-photo-column">
            <div className="profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt={t('Аватар {name}', { name: user.name })} /> : <span aria-label={t("Аватар пока не загружен")}>{user.name.charAt(0).toUpperCase()}</span>}</div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} className="hidden" aria-label={t("Фотография профиля")} />
            <button type="button" className="account-link" disabled={busy} onClick={() => fileInputRef.current?.click()}>{t("Изменить фото")}</button>
          </aside>
          <div className="profile-details">
            {editing ? <form onSubmit={save} className="profile-edit-form">
              <h1>{t("Редактирование профиля")}</h1>
              <label className="account-field">{t("Никнейм")}<input autoComplete="nickname" required minLength={2} maxLength={40} value={nickname} onChange={event => setNickname(event.target.value)} /></label>
              <label className="account-field">{t("Описание")}<textarea maxLength={300} rows={4} value={bio} onChange={event => setBio(event.target.value)} placeholder={t("Чем вы увлекаетесь?")} /><span className="account-caption">{bio.length} / 300</span></label>
              <div className="account-actions"><button type="submit" className="account-button account-button-primary" disabled={busy}>{busy ? t("Сохраняем…") : t("Сохранить")}</button><button type="button" className="account-link" disabled={busy} onClick={() => setEditing(false)}>{t("Отмена")}</button></div>
            </form> : <>
              <div className="profile-name-row"><h1>{user.name}</h1><button type="button" className="account-link" onClick={beginEdit}>{t("Редактировать")}</button></div>
              <p className="profile-email">{user.email}</p>
              <div className="profile-about"><h2>{t("О себе")}</h2><p>{user.bio || t("Здесь пока нет описания.")}</p>{!user.bio && <button type="button" className="account-link" onClick={beginEdit}>{t("Добавить описание")}</button>}</div>
            </>}
            <footer className="profile-account-footer"><span>{t("Почта подтверждена")}</span><button type="button" className="account-link" disabled={busy} onClick={leave}>{t("Выйти из аккаунта")}</button></footer>
          </div>
        </section>}
      {(error || sessionError) && <p role="alert" className="account-error">{t(error || sessionError)}</p>}
      {profileError && user && <p role="alert" className="account-error">{t(profileError)} <button type="button" disabled={busy} className="account-link" onClick={retry}>{t("Повторить загрузку")}</button></p>}
      {notice && <p role="status" className="account-notice">{t(notice)}</p>}
    </div>
    <PrivacyPolicyModal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} />
  </main>;
};
