import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import '../styles/dispatches.css';
import { supabase, avatarUrl } from '../supabase.ts';
import { useAuth } from '../context/AuthContext.tsx';

import { SCHOOL_GRADES, type SchoolGrade } from '../learning/catalogue.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { createDateFormatter } from '../i18n/formatters.ts';
import { TelegramFeed } from './TelegramFeed.tsx';

export interface ClassPost {
  id: string;
  text: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
}

interface PostsPageProps {
  active?: boolean;
}

const formatDate = createDateFormatter({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatPublishedAt = (value: string, locale: string, t: (source: string) => string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('только что');

  return formatDate(date, locale);
};

export function PostEntry({ post }: { post: ClassPost }) {
  const { t, intlLocale } = useLanguage();
  return <article className="dispatch-entry">
    <header>
      <span className="dispatch-avatar" aria-hidden="true">
        {post.authorAvatarUrl ? <img src={post.authorAvatarUrl} alt="" loading="lazy" decoding="async"/>
          : post.authorName?.charAt(0)?.toUpperCase() || 'T'}
      </span>
      <span className="dispatch-author">{post.authorName || t("Автор TerenPhys")}</span>
      <time dateTime={post.createdAt}>{formatPublishedAt(post.createdAt, intlLocale, t)}</time>
    </header>
    <p className="dispatch-text">{post.text}</p>
  </article>;
}

function ClassPostsFeed({ selectedGrade, active: pageActive }: { selectedGrade: SchoolGrade; active: boolean }) {
  const { t } = useLanguage();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [posts, setPosts] = useState<ClassPost[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [isAuthorLoading, setIsAuthorLoading] = useState(false);
  const [postText, setPostText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const additionalEntries = useMemo(() => posts.map(post => ({ key: 'site-' + post.id,
    publishedAt: post.createdAt, content: <PostEntry post={post}/> })), [posts]);

  useEffect(() => {
    if (!pageActive) return;
    setIsPostsLoading(true);
    setPostsError('');

    let active = true;
    let request = 0;
    const abort = new AbortController();
    const loadPosts = async () => {
      const version = ++request;
      const { data, error } = await supabase.from('posts').select('id,text,author_name,author_avatar_path,created_at')
        .eq('grade', selectedGrade).order('created_at', { ascending: false })
        .order('id', { ascending: false }).limit(100).abortSignal(abort.signal);
      if (!active || version !== request) return;
      if (error) {
        setPostsError('Не удалось загрузить посты. Попробуйте обновить страницу.');
      } else {
        setPostsError('');
        setPosts((data || []).map(post => ({ id: String(post.id), text: post.text, authorName: post.author_name,
          authorAvatarUrl: avatarUrl(post.author_avatar_path, post.created_at), createdAt: post.created_at })));
      }
      setIsPostsLoading(false);
    };
    void loadPosts();
    const channel = supabase.channel('class-posts-' + selectedGrade)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: 'grade=eq.' + selectedGrade }, () => void loadPosts())
      .subscribe(status => { if (status === 'SUBSCRIBED') void loadPosts(); });
    const refresh = () => { if (document.visibilityState === 'visible') void loadPosts(); };
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; request++; abort.abort(); document.removeEventListener('visibilitychange', refresh); void supabase.removeChannel(channel); };
  }, [selectedGrade, pageActive]);

  useEffect(() => {
    if (!pageActive) return;
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
        const { data, error } = await supabase.from('post_authors').select('is_active')
          .eq('user_id', user.id).eq('grade', selectedGrade).maybeSingle();
        if (error) throw error;
        if (isCurrent) setCanPublish(data?.is_active === true);
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
  }, [selectedGrade, user?.id, user?.emailVerified, pageActive]);

  const composerState = isAuthLoading || isAuthorLoading ? 'loading' : !user ? 'guest' : !canPublish ? 'restricted' : 'ready';

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
      const { error } = await supabase.from('posts').insert({
        grade: selectedGrade,
        text,
        author_id: user.id,
      });
      if (error) throw error;
      setPostText('');
    } catch {
      setPublishError('Пост не удалось опубликовать. Повторите попытку.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
        <TelegramFeed key={selectedGrade} grade={selectedGrade} active={pageActive}
          additionalEntries={additionalEntries}
          additionalLoading={isPostsLoading} additionalError={postsError}>
          {composerState !== 'guest' && <footer className="dispatch-composer">
            {composerState === 'loading' ? <p className="dispatch-permission" role="status">{t("Проверяем права автора…")}</p>
              : composerState === 'restricted' ? <p className="dispatch-permission">{t("Публиковать материалы для этого класса могут назначенные авторы.")}</p>
              : <form onSubmit={handlePublish}>
                <label htmlFor="post-text" className="dispatch-label">{t("Новая публикация")}</label>
                <textarea id="post-text" value={postText} onChange={event => setPostText(event.target.value)}
                  maxLength={2000} rows={4} placeholder={t('Напишите пост для {grade} класса…', { grade: selectedGrade })}/>
                <div className="dispatch-compose-actions">
                  <span>{postText.length} / 2000</span>
                  <button type="submit" className="dispatch-publish" disabled={!postText.trim() || isPublishing}>
                    {isPublishing ? t("Публикуем…") : t("Опубликовать")}<ArrowUpRight aria-hidden="true"/>
                  </button>
                </div>
              </form>}
            {publishError && <p className="dispatch-error" role="alert">{t(publishError)}</p>}
          </footer>}
        </TelegramFeed>
  );
}

export const PostsPage: React.FC<PostsPageProps> = ({ active = true }) => {
  const { t, gradeLabel } = useLanguage();
  const [selectedGrade, setSelectedGrade] = useState<SchoolGrade>(7);
  const [isGeneral, setIsGeneral] = useState(true);
  return <main className="posts-page dispatch-page">
    <div className="dispatch-layout">
      <aside className="dispatch-sidebar">
        <p className="dispatch-label">{t("Посты")}</p>
        <nav className="dispatch-grades" aria-label={t("Классы публикаций")}>
          <button type="button" className="dispatch-general" aria-pressed={isGeneral} onClick={() => setIsGeneral(true)}>
            <span>{t("Общий чат")}</span><ArrowUpRight aria-hidden="true"/>
          </button>
          {SCHOOL_GRADES.map(grade => <button key={grade} type="button" aria-pressed={!isGeneral && selectedGrade === grade}
            onClick={() => { setSelectedGrade(grade); setIsGeneral(false); }} aria-label={gradeLabel(grade)}>
            <span className="dispatch-grade-number">{grade}</span><span>{t("класс")}</span><ArrowUpRight aria-hidden="true"/>
          </button>)}
        </nav>
      </aside>
      <div className="dispatch-panel" hidden={!isGeneral}><TelegramFeed active={active && isGeneral}/></div>
      <div className="dispatch-panel" hidden={isGeneral}><ClassPostsFeed selectedGrade={selectedGrade} active={active && !isGeneral}/></div>
    </div>
  </main>;
};
