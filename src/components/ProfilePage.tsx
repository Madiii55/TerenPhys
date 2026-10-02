import React, { useRef, useState } from 'react';
import { Camera, Check, LoaderCircle, LogIn, LogOut, MailCheck, Pencil, Satellite, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { GoogleIcon } from './GoogleIcon.tsx';
import { PrivacyPolicyModal } from './PrivacyPolicyModal.tsx';
import { compressAvatarImage } from '../utils/imageCompressor.ts';

interface ProfilePageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onNavigateStudy?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenAuth }) => {
  const { user, isLoading, logout, updateProfile, loginWithGoogle, resendVerification, refreshVerification } = useAuth();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const signInWithGoogle = async () => {
    setBusy(true);
    setError('');
    const result = await loginWithGoogle();
    setBusy(false);
    if (!result.success && result.error !== 'Вход через Google отменён.') {
      setError(result.error || 'Не удалось войти через Google.');
    }
  };

  const beginEdit = () => {
    if (!user) return;
    setNickname(user.name);
    setBio(user.bio);
    setError('');
    setNotice('');
    setEditing(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await updateProfile({ name: nickname, bio });
    setBusy(false);
    if (result.success) {
      setEditing(false);
      setNotice('Профиль обновлён.');
    } else setError(result.error || 'Не удалось сохранить профиль.');
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const avatarUrl = await compressAvatarImage(file, 256, 0.8);
      const result = await updateProfile({ avatarUrl });
      if (result.success) setNotice('Аватар обновлён.');
      else setError(result.error || 'Не удалось загрузить аватар.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Не удалось обработать изображение.');
    } finally {
      setBusy(false);
    }
  };

  const verifyEmail = async (sendAgain: boolean) => {
    setBusy(true);
    setError('');
    setNotice('');
    const result = sendAgain ? await resendVerification() : await refreshVerification();
    setBusy(false);
    if (result.success) setNotice(sendAgain ? 'Письмо отправлено.' : 'Почта подтверждена.');
    else setError(result.error || 'Не удалось проверить почту.');
  };

  return (
    <main className="relative flex min-h-[calc(100svh-5rem)] items-center justify-center overflow-hidden px-5 py-14 sm:py-20">
      {isLoading ? (
        <LoaderCircle className="relative z-10 h-7 w-7 animate-spin text-[#0284c7]" aria-label="Загружаем профиль" />
      ) : !user ? (
        <div className="relative z-10 w-full max-w-md rounded-[30px] border border-white bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(2,132,199,0.12)] backdrop-blur-xl sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-[#0284c7]">
            <Satellite className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Личный кабинет</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Сохраните свой профиль и присоединяйтесь к сообществу TerenPhys.</p>
          <div className="mt-8 space-y-3">
            <button type="button" onClick={() => onOpenAuth('login')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0284c7] px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700">
              <LogIn className="h-4 w-4" />Войти
            </button>
            <button type="button" onClick={() => onOpenAuth('register')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-[#0284c7]">
              <UserPlus className="h-4 w-4" />Создать аккаунт
            </button>
            <div className="flex items-center gap-3 py-1 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />или<span className="h-px flex-1 bg-slate-200" /></div>
            <button type="button" disabled={busy} onClick={signInWithGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <GoogleIcon className="h-4 w-4" />Продолжить с Google
            </button>
          </div>
          {error && <p role="alert" className="mt-5 text-sm text-rose-600">{error}</p>}
          <p className="mt-7 text-xs leading-5 text-slate-400">
            Продолжая, вы принимаете <button type="button" onClick={() => setPolicyOpen(true)} className="text-[#0284c7] hover:underline">политику конфиденциальности</button>.
          </p>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-2xl">
          {!user.emailVerified && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/95 p-4 text-sm text-amber-950 shadow-sm">
              <div className="flex items-start gap-3">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Подтвердите почту</p>
                  <p className="mt-1 leading-5">Откройте ссылку в письме, отправленном на {user.email}.</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <button type="button" disabled={busy} onClick={() => verifyEmail(false)} className="font-medium underline disabled:opacity-50">Я подтвердил почту</button>
                    <button type="button" disabled={busy} onClick={() => verifyEmail(true)} className="font-medium underline disabled:opacity-50">Отправить ещё раз</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <section className="overflow-hidden rounded-[32px] border border-white bg-white/90 shadow-[0_24px_90px_rgba(15,91,151,0.14)] backdrop-blur-xl">
            <div className="h-28 bg-gradient-to-r from-sky-100 via-blue-50 to-slate-100 sm:h-32" />
            <div className="px-7 pb-8 sm:px-10">
              <div className="-mt-12 flex items-end justify-between gap-4">
                <div className="relative">
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} className="hidden" />
                  <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} aria-label="Сменить аватар" className="group relative block h-28 w-28 overflow-hidden rounded-full border-[5px] border-white bg-[#0284c7] shadow-lg disabled:opacity-60 sm:h-32 sm:w-32">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-4xl font-light text-white">{user.name.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      {busy ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                    </span>
                  </button>
                  <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} aria-label="Загрузить фотографию" className="absolute bottom-1 right-0 rounded-full border border-slate-100 bg-white p-2 text-[#0284c7] shadow-md hover:bg-sky-50 disabled:opacity-60">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <button type="button" onClick={() => logout()} className="mb-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:border-rose-200 hover:text-rose-600">
                  <LogOut className="h-4 w-4" />Выйти
                </button>
              </div>

              {editing ? (
                <form onSubmit={save} className="mt-8 space-y-5">
                  <label className="block text-sm font-medium text-slate-600">
                    Никнейм
                    <input required minLength={2} maxLength={40} value={nickname} onChange={(event) => setNickname(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg text-slate-900 outline-none focus:border-[#0284c7]" />
                  </label>
                  <label className="block text-sm font-medium text-slate-600">
                    Описание
                    <textarea maxLength={300} rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Пара слов о себе и вашем интересе к физике…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-[#0284c7]" />
                    <span className="mt-1 block text-right text-xs text-slate-400">{bio.length}/300</span>
                  </label>
                  <div className="flex gap-3">
                    <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#0284c7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Сохранить
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                      <X className="h-4 w-4" />Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-7">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="break-words text-3xl font-semibold tracking-tight text-slate-950">{user.name}</h1>
                    <button type="button" onClick={beginEdit} aria-label="Редактировать профиль" className="rounded-xl p-2 text-slate-400 hover:bg-sky-50 hover:text-[#0284c7]">
                      <Pencil className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{user.email}</p>
                  <div className="mt-7 border-t border-slate-100 pt-6">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0284c7]">О себе</h2>
                    <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-slate-700">
                      {user.bio || 'Расскажите немного о себе.'}
                    </p>
                    {!user.bio && <button type="button" onClick={beginEdit} className="mt-2 text-sm font-medium text-[#0284c7] hover:underline">Добавить описание</button>}
                  </div>
                </div>
              )}
            </div>
          </section>
          {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>
      )}
      <PrivacyPolicyModal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} />
    </main>
  );
};
