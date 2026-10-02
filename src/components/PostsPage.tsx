import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { BookOpen, LoaderCircle, LockKeyhole, Send } from 'lucide-react';
import { db } from '../firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';

type Grade = 7 | 8 | 9;

interface ClassPost {
  id: string;
  grade: Grade;
  text: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
}

interface PostsPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const GRADES: Grade[] = [7, 8, 9];

const formatPublishedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'только что';

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const PostsPage: React.FC<PostsPageProps> = ({ onOpenAuth }) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [selectedGrade, setSelectedGrade] = useState<Grade>(7);
  const [posts, setPosts] = useState<ClassPost[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [isAuthorLoading, setIsAuthorLoading] = useState(false);
  const [postText, setPostText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  useEffect(() => {
    setIsPostsLoading(true);
    setPostsError('');

    const postsQuery = query(
      collection(db, 'posts'),
      where('grade', '==', selectedGrade),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = snapshot.docs
          .map((postDoc) => ({ id: postDoc.id, ...postDoc.data() }) as ClassPost)
          .sort((first, second) => second.createdAt.localeCompare(first.createdAt));

        setPosts(nextPosts);
        setIsPostsLoading(false);
      },
      () => {
        setPosts([]);
        setPostsError('Не удалось загрузить посты. Попробуйте обновить страницу.');
        setIsPostsLoading(false);
      }
    );

    return unsubscribe;
  }, [selectedGrade]);

  useEffect(() => {
    let isCurrent = true;

    const checkAuthorAccess = async () => {
      setCanPublish(false);
      setPublishError('');

      if (!user?.id || !user.emailVerified) {
        setIsAuthorLoading(false);
        return;
      }

      setIsAuthorLoading(true);
      try {
        const authorSnapshot = await getDoc(
          doc(db, 'postAuthors', user.id)
        );
        const author = authorSnapshot.data();
        const allowedGrades = Array.isArray(author?.grades) ? author.grades : [];
        const hasAccess = authorSnapshot.exists() &&
          author?.isActive !== false &&
          allowedGrades.includes(selectedGrade);

        if (isCurrent) setCanPublish(hasAccess);
      } catch {
        if (isCurrent) {
          setPublishError('Не удалось проверить права автора.');
        }
      } finally {
        if (isCurrent) setIsAuthorLoading(false);
      }
    };

    checkAuthorAccess();
    return () => {
      isCurrent = false;
    };
  }, [selectedGrade, user?.id, user?.emailVerified]);

  const composerState = useMemo(() => {
    if (isAuthLoading || isAuthorLoading) return 'loading';
    if (!user) return 'guest';
    if (!canPublish) return 'restricted';
    return 'ready';
  }, [canPublish, isAuthLoading, isAuthorLoading, user]);

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = postText.trim();

    if (!user || !canPublish || !text || isPublishing) return;
    if (text.length > 2000) {
      setPublishError('Один пост может содержать до 2 000 символов.');
      return;
    }

    setIsPublishing(true);
    setPublishError('');
    try {
      await addDoc(collection(db, 'posts'), {
        grade: selectedGrade,
        text,
        authorId: user.id,
        authorName: user.name,
        authorAvatarUrl: user.avatarUrl || '',
        createdAt: new Date().toISOString(),
      });
      setPostText('');
    } catch {
      setPublishError('Пост не удалось опубликовать. Повторите попытку.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <main className="relative min-h-[calc(100svh-5rem)] py-8 sm:py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
          <aside className="rounded-2xl border border-white/15 bg-slate-950/65 p-3 shadow-xl backdrop-blur-md h-fit">
            <p className="px-3 pt-2 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Классы
            </p>
            <div className="space-y-1">
              {GRADES.map((grade) => {
                const isSelected = grade === selectedGrade;

                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSelectedGrade(grade)}
                    className={
                      isSelected
                        ? 'w-full rounded-xl bg-[#0284c7] px-4 py-4 text-left text-white transition-colors cursor-pointer'
                        : 'w-full rounded-xl px-4 py-4 text-left text-slate-200 hover:bg-white/10 hover:text-sky-300 transition-colors cursor-pointer'
                    }
                  >
                    <span className="block text-3xl font-light leading-none">{grade}</span>
                    <span className="mt-1 block text-sm opacity-80">класс</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-white/15 bg-slate-950/55 shadow-xl backdrop-blur-[1px]">
            <header className="border-b border-white/10 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-medium text-white">{selectedGrade} класс</h2>
            </header>

            <div className="min-h-[390px] p-4 sm:p-6">
              {isPostsLoading ? (
                <div className="flex min-h-[340px] items-center justify-center text-sm text-slate-300">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Загружаем посты…
                </div>
              ) : postsError ? (
                <div className="flex min-h-[340px] items-center justify-center text-center text-sm text-rose-300">
                  {postsError}
                </div>
              ) : posts.length === 0 ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-400/15 text-sky-300 shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-base font-medium text-slate-100">Пока здесь тихо</p>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-300">
                    Первый пост для {selectedGrade} класса появится здесь.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <article key={post.id} className="rounded-2xl border border-white/10 bg-slate-900/85 p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        {post.authorAvatarUrl ? (
                          <img
                            src={post.authorAvatarUrl}
                            alt={post.authorName}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0284c7] text-sm font-medium text-white">
                            {post.authorName?.charAt(0)?.toUpperCase() || 'T'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="font-medium text-white">{post.authorName || 'Автор TerenPhys'}</p>
                            <time className="text-xs text-slate-400">{formatPublishedAt(post.createdAt)}</time>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
                            {post.text}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-slate-950/40 p-4 sm:p-5">
              {composerState === 'loading' ? (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Проверяем права автора…
                </div>
              ) : composerState === 'guest' ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-300">Войдите, чтобы получить доступ к публикации.</p>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('login')}
                    className="rounded-xl bg-[#0284c7] px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 transition-colors cursor-pointer"
                  >
                    Войти
                  </button>
                </div>
              ) : composerState === 'restricted' ? (
                <div className="flex items-start gap-3 text-sm text-slate-300">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <p>Публикация доступна только авторам, которым назначен этот класс.</p>
                </div>
              ) : (
                <form onSubmit={handlePublish}>
                  <label htmlFor="post-text" className="sr-only">Текст поста</label>
                  <textarea
                    id="post-text"
                    value={postText}
                    onChange={(event) => setPostText(event.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder={'Напишите пост для ' + selectedGrade + ' класса…'}
                    className="w-full resize-y rounded-xl border border-white/15 bg-slate-900/85 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">{postText.length}/2000</span>
                    <button
                      type="submit"
                      disabled={!postText.trim() || isPublishing}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0284c7] px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isPublishing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Опубликовать
                    </button>
                  </div>
                </form>
              )}
              {publishError && <p className="mt-3 text-sm text-rose-300">{publishError}</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};
