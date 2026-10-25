import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CornerDownRight, Eye, Heart, MessageCircle, Plus, Search, Send, X } from 'lucide-react';
import { useAuth, type UserProfile } from '../context/AuthContext.tsx';
import { avatarUrl } from '../supabase.ts';
import { SCHOOL_GRADES } from '../learning/catalogue.ts';
import { forumApi, type ForumApi } from '../forum/api.ts';
import { FORUM_CATEGORIES, FORUM_PAGE_SIZE, categoryLabel, formatForumDate, formatForumNumber, forumCount, validateTopic,
  type ForumCategory, type ForumComment, type ForumFilters, type ForumSort, type ForumTopic, type TopicDraft } from '../forum/model.ts';
import '../forum/forum.css';
import { useLanguage } from '../i18n/LanguageContext.tsx';

type OpenAuth = (mode: 'login' | 'register') => void;
interface ForumPageProps { onOpenAuth: OpenAuth; active?: boolean; api?: ForumApi }
const SORTS: { id: ForumSort; label: string; hint: string }[] = [
  { id:'latest',label:'Последние',hint:'Сначала новые темы' },
  { id:'popular',label:'Популярные',hint:'По количеству просмотров' },
  { id:'best',label:'Лучшие',hint:'По количеству лайков' },
];
function Avatar({ name, path }: { name: string; path: string | null }) {
  const url = avatarUrl(path);
  return <span className="forum-avatar" aria-hidden="true">{url ? <img src={url} alt="" loading="lazy" /> : name.slice(0,1).toUpperCase()}</span>;
}
function Metrics({ topic }: { topic: ForumTopic }) {
  const { t, intlLocale } = useLanguage();
  return <div className="forum-metrics">
    <span title={t("Просмотры")} aria-label={forumCount(topic.view_count,[t('просмотр'),t('просмотра'),t('просмотров')],intlLocale)}><Eye />{formatForumNumber(topic.view_count,intlLocale)}</span>
    <span title={t("Лайки")} aria-label={forumCount(topic.like_count,[t('лайк'),t('лайка'),t('лайков')],intlLocale)}><Heart />{formatForumNumber(topic.like_count,intlLocale)}</span>
    <span title={t("Комментарии")} aria-label={forumCount(topic.comment_count,[t('комментарий'),t('комментария'),t('комментариев')],intlLocale)}><MessageCircle />{formatForumNumber(topic.comment_count,intlLocale)}</span>
  </div>;
}
function TopicForm({ api, user, onOpenAuth, onBack, onCreated, initialGrade, initialCategory }:
  {api:ForumApi;user:UserProfile|null;onOpenAuth:OpenAuth;onBack:()=>void;onCreated:(topic:ForumTopic)=>void;initialGrade:number|null;initialCategory:ForumCategory|null}) {
  const { t, gradeLabel, intlLocale } = useLanguage();
  const [draft,setDraft] = useState<TopicDraft>({title:'',body:'',grade:initialGrade,category:initialCategory || 'general'});
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const titleInput = useRef<HTMLInputElement>(null), sending = useRef(false);
  useEffect(() => { titleInput.current?.focus(); },[]);
  const submit = async (event:React.FormEvent) => {
    event.preventDefault();
    if (!user) { onOpenAuth('login'); return; }
    const invalid = validateTopic(draft);
    if (invalid) { setError(invalid); return; }
    if (sending.current) return;
    sending.current=true;setBusy(true);setError('');
    try { onCreated(await api.createTopic(draft,user.id)); }
    catch { setError('Не удалось опубликовать тему. Проверьте соединение и попробуйте ещё раз. Текст сохранён в форме.'); }
    finally {sending.current=false;setBusy(false);}
  };
  return <section className="forum-editor">
    <button className="forum-back" onClick={onBack} disabled={busy}><ArrowLeft />{t("К обсуждениям")}</button>
    <div className="forum-editor-heading"><span className="forum-eyebrow">{t("Новая тема")}</span><h2>{t("О чём поговорим?")}</h2><p>{t("Сформулируйте вопрос и расскажите, что уже удалось понять.")}</p></div>
    <form onSubmit={submit}>
      <label className="forum-field">{t("Заголовок")}<input ref={titleInput} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} minLength={6} maxLength={160} required placeholder={t("Например: почему спутник не падает на Землю?")} /></label>
      <div className="forum-field-pair">
        <label className="forum-field">{t("Класс")}<select value={draft.grade ?? ''} onChange={e=>setDraft({...draft,grade:e.target.value ? Number(e.target.value) : null})}><option value="">{t("Для всех классов")}</option>{SCHOOL_GRADES.map(n=><option key={n} value={n}>{gradeLabel(n)}</option>)}</select></label>
        <label className="forum-field">{t("Раздел")}<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value as ForumCategory})}>{FORUM_CATEGORIES.map(c=><option key={c.id} value={c.id}>{t(c.label)}</option>)}</select></label>
      </div>
      <label className="forum-field">{t("Текст темы")}<textarea value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} minLength={20} maxLength={12000} required rows={9} placeholder={t("Условие задачи, ваше решение или идея. Формулы можно написать обычным текстом: F = ma.")} /></label>
      <div className="forum-editor-bottom"><p>{t("Пишите по делу и уважайте собеседников.")}<br/><span>{t('{count} / 12 000 символов', { count: draft.body.length.toLocaleString(intlLocale) })}</span></p>
        <button className="forum-primary" type="submit" disabled={busy}>{busy ? t("Публикуем…") : user ? t("Опубликовать тему") : t("Войти и опубликовать")}<ArrowUpRight /></button></div>
      {error && <p className="forum-error" role="alert">{t(error)}</p>}
    </form>
  </section>;
}
function TopicDetail({ id,api,user,onOpenAuth,onBack,active }: {id:string;api:ForumApi;user:UserProfile|null;onOpenAuth:OpenAuth;onBack:()=>void;active:boolean}) {
  const { t, gradeLabel, intlLocale } = useLanguage();
  const [topic,setTopic] = useState<ForumTopic|null>(null), [comments,setComments] = useState<ForumComment[]>([]);
  const commentsById = useMemo(() => new Map(comments.map(comment => [comment.id, comment])), [comments]);
  const [total,setTotal] = useState(0), [limit,setLimit] = useState(40), [loading,setLoading] = useState(true);
  const [error,setError] = useState(''), [writeError,setWriteError] = useState('');
  const [liked,setLiked] = useState(false), [likeBusy,setLikeBusy] = useState(false), [sending,setSending] = useState(false);
  const [body,setBody] = useState(''), [reply,setReply] = useState<ForumComment|null>(null), [revision,setRevision] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null), title = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true), busy = useRef(false), likePending = useRef(false);
  const countedViews = useRef<number | null>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    if (!active) return;
    let current=true, request=0;
    const load=async()=>{
      const version=++request;
      try {
        const [post,result]=await Promise.all([api.topic(id),api.comments(id,limit)]);
        if (!current || version!==request) return;
        setTopic(post && countedViews.current !== null ? {...post,view_count:Math.max(post.view_count,countedViews.current)} : post);
        setComments(result.comments);setTotal(result.total);setError('');
      } catch { if(current && version===request) setError('Обсуждение не загрузилось. Попробуйте ещё раз.'); }
      finally {if(current && version===request) setLoading(false);}
    };
    void load();
    const unsubscribe=api.subscribe(id,()=>void load());
    const refresh=()=>{if(document.visibilityState==='visible') void load();};
    document.addEventListener('visibilitychange',refresh);
    return()=>{current=false;request++;unsubscribe();document.removeEventListener('visibilitychange',refresh);};
  },[api,id,limit,active,revision]);
  useEffect(()=>{
    if (!active) return;
    let current=true;
    void api.recordView(id).then(count=>{if(current && count!==null) {countedViews.current=count;setTopic(t=>t ? {...t,view_count:Math.max(t.view_count,count)} : t);}}).catch(()=>{});
    return()=>{current=false;};
  },[api,id,active]);
  useEffect(()=>{setLiked(false);},[id,user?.id]);
  useEffect(()=>{
    let current=true;
    if(user && active) void api.liked(id,user.id).then(value=>{if(current)setLiked(value);}).catch(()=>{if(current)setWriteError('Не удалось проверить ваш лайк. Обновите обсуждение.');});
    return()=>{current=false;};
  },[api,id,user?.id,active,revision]);
  useEffect(()=>{if(!loading)title.current?.focus({preventScroll:true});},[loading]);
  const toggleLike=async()=>{
    if(!user){onOpenAuth('login');return;}
    if(likePending.current)return;
    likePending.current=true;setLikeBusy(true);setWriteError('');
    try {await api.setLike(id,user.id,!liked);if(alive.current){setLiked(!liked);setRevision(v=>v+1);}}
    catch{if(alive.current)setWriteError('Лайк не сохранился. Попробуйте ещё раз.');}
    finally{likePending.current=false;if(alive.current)setLikeBusy(false);}
  };
  const respond=(comment:ForumComment)=>{
    if(!user){onOpenAuth('login');return;}
    setReply(comment);input.current?.focus();input.current?.scrollIntoView({behavior:'smooth',block:'center'});
  };
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!user){onOpenAuth('login');return;}
    if(!body.trim() || body.trim().length>4000 || busy.current)return;
    busy.current=true;setSending(true);setWriteError('');
    try{
      await api.createComment(id,body,reply?.id || null,user.id);
      if(alive.current){setBody('');setReply(null);setRevision(v=>v+1);}
    }catch{if(alive.current)setWriteError('Комментарий не отправлен. Текст остался в поле — попробуйте ещё раз.');}
    finally{busy.current=false;if(alive.current)setSending(false);}
  };
  return <section className="forum-thread">
    <button className="forum-back" onClick={onBack}><ArrowLeft />{t("Все обсуждения")}</button>
    {loading ? <div className="forum-loading" role="status">{t("Загружаем обсуждение…")}</div> : error ? <div className="forum-empty"><h2>{t("Не удалось загрузить")}</h2><p role="alert">{t(error)}</p><button className="forum-secondary" onClick={()=>setRevision(v=>v+1)}>{t("Повторить")}</button></div> : !topic ? <div className="forum-empty"><h2>{t("Тема не найдена")}</h2><p>{t("Возможно, она была удалена.")}</p></div> : <>
      <article className="forum-article">
        <div className="forum-topic-tags"><span>{t(categoryLabel(topic.category))}</span><span>{topic.grade ? gradeLabel(topic.grade) : t("Все классы")}</span></div>
        <h2 ref={title} tabIndex={-1}>{topic.title}</h2>
        <div className="forum-author"><Avatar name={topic.author_name} path={topic.author_avatar_path}/><strong>{topic.author_name}</strong><time dateTime={topic.created_at}>{formatForumDate(topic.created_at,intlLocale)}</time></div>
        <div className="forum-prose">{topic.body}</div>
        <div className="forum-article-footer"><button className="forum-like" aria-pressed={liked} onClick={toggleLike} disabled={likeBusy}><Heart fill={liked ? 'currentColor' : 'none'}/>{liked ? t("Вам нравится") : t("Нравится")}<span>{formatForumNumber(topic.like_count,intlLocale)}</span></button><span className="forum-views"><Eye/>{forumCount(topic.view_count,[t('просмотр'),t('просмотра'),t('просмотров')],intlLocale)}</span></div>
      </article>
      <section className="forum-discussion" aria-label={t("Комментарии")}>
        <div className="forum-discussion-heading"><h3>{t("Обсуждение")}{' '}<span>{formatForumNumber(total,intlLocale)}</span></h3><span>{t("По порядку")}</span></div>
        {comments.length<total && <button className="forum-older" onClick={()=>setLimit(n=>n+40)}>{t("Показать более ранние комментарии")}<ChevronLeft/></button>}
        {!comments.length && <p className="forum-no-comments">{t("Ответов пока нет. Можно начать с вашей мысли.")}</p>}
        {comments.map(comment=>{
          const parent=comment.parent_id ? commentsById.get(comment.parent_id) : undefined;
          return <article className="forum-comment" key={comment.id} id={'comment-'+comment.id}>
            <Avatar name={comment.author_name} path={comment.author_avatar_path}/>
            <div className="forum-comment-main"><div className="forum-comment-heading"><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{formatForumDate(comment.created_at,intlLocale)}</time></div>
              {comment.parent_id && <blockquote><CornerDownRight/><span>{parent ? <><strong>{parent.author_name}</strong> {parent.body.slice(0,140)}{parent.body.length>140?'…':''}</> : t("Ответ на комментарий выше")}</span></blockquote>}
              <p>{comment.body}</p><button className="forum-text-button" onClick={()=>respond(comment)}>{t("Ответить")}<CornerDownRight/></button>
            </div>
          </article>;
        })}
        <div className="forum-reply-box">
          {user ? <form onSubmit={submit}>
            <label htmlFor="forum-reply">{t("Ваш комментарий")}</label>
            {reply && <div className="forum-replying"><CornerDownRight/><span>{t('Ответ для {name}', { name: reply.author_name })}</span><button type="button" aria-label={t("Отменить ответ")} onClick={()=>setReply(null)}><X/></button></div>}
            <textarea ref={input} id="forum-reply" value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} required rows={4} placeholder={t("Объясните ход мысли или задайте уточняющий вопрос…")} />
            <div className="forum-reply-bottom"><span>{body.length.toLocaleString(intlLocale)} / 4 000</span><button className="forum-primary" type="submit" disabled={sending || !body.trim()}>{sending?t("Отправляем…"):t("Отправить")}<Send/></button></div>
          </form> : <div className="forum-join"><div><h4>{t("Есть что добавить?")}</h4><p>{t("Войдите, чтобы отвечать и участвовать в обсуждении.")}</p></div><button className="forum-secondary" onClick={()=>onOpenAuth('login')}>{t("Войти")}<ArrowUpRight/></button></div>}
        </div>
        {writeError && <p role="alert" className="forum-error">{t(writeError)}</p>}
      </section>
    </>}
  </section>;
}

export const ForumPage: React.FC<ForumPageProps> = ({onOpenAuth,active=true,api=forumApi}) => {
  const { t, gradeLabel, intlLocale } = useLanguage();
  const {user}=useAuth();
  const [filters,setFilters]=useState<ForumFilters>({search:'',grade:null,category:null,sort:'latest'});
  const [search,setSearch]=useState(''),[page,setPage]=useState(0),[topics,setTopics]=useState<ForumTopic[]>([]);
  const [total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [selected,setSelected]=useState<string|null>(null),[composing,setComposing]=useState(false),[revision,setRevision]=useState(0);
  const searchInput=useRef<HTMLInputElement>(null), surface=useRef<HTMLElement>(null);
  useEffect(()=>{
    const trimmed = search.trim();
    if (trimmed === filters.search) return;
    const timer=setTimeout(()=>{setFilters(f=>({...f,search:trimmed}));setPage(0);},300);
    return()=>clearTimeout(timer);
  },[search,filters.search]);
  useEffect(()=>{
    if(!active || selected || composing)return;
    let current=true,request=0;
    setLoading(true);
    const load=async()=>{
      const version=++request;
      try{const result=await api.list(filters,page);if(current && version===request){setTopics(result.topics);setTotal(result.total);setError('');}}
      catch{if(current && version===request)setError('Не удалось загрузить темы. Проверьте соединение и попробуйте ещё раз.');}
      finally{if(current && version===request)setLoading(false);}
    };
    void load();
    const unsubscribe=api.subscribe(null,()=>void load());
    const refresh=()=>{if(document.visibilityState==='visible')void load();};
    document.addEventListener('visibilitychange',refresh);
    return()=>{current=false;request++;unsubscribe();document.removeEventListener('visibilitychange',refresh);};
  },[api,active,selected,composing,filters,page,revision]);
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if(!active || selected || composing || event.key!=='/' || event.ctrlKey || event.metaKey || event.altKey)return;
      if((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable],[role="dialog"]'))return;
      event.preventDefault();searchInput.current?.focus();
    };
    document.addEventListener('keydown',shortcut);return()=>document.removeEventListener('keydown',shortcut);
  },[active,selected,composing]);
  const changeFilters=(change:Partial<ForumFilters>)=>{setFilters(f=>({...f,...change}));setPage(0);};
  const reset=()=>{setSearch('');setFilters({search:'',grade:null,category:null,sort:filters.sort});setPage(0);};
  const top=()=>surface.current?.scrollIntoView({block:'start',behavior:'instant'});
  const open=(id:string)=>{setSelected(id);setComposing(false);top();};
  const start=()=>{if(!user){onOpenAuth('login');return;}setComposing(true);setSelected(null);top();};
  const back=useCallback(()=>{setSelected(null);setComposing(false);top();},[]);
  const filtered=!!filters.search || filters.grade!==null || !!filters.category;
  return <main className="forum-page" ref={surface}>
    <div className="forum-layout">
      <header className="forum-masthead">
        <div><p className="forum-eyebrow">{t("TerenPhys / Сообщество")}</p><h1>{t("Форум")}<span>.</span></h1></div>
        <button className="forum-primary forum-create" onClick={start}><Plus/>{t("Новая тема")}</button>
      </header>
      {composing ? <TopicForm api={api} user={user} onOpenAuth={onOpenAuth} onBack={back} initialGrade={filters.grade} initialCategory={filters.category} onCreated={topic=>{setComposing(false);open(topic.id);}}/>
      : selected ? <TopicDetail key={selected} id={selected} api={api} user={user} onOpenAuth={onOpenAuth} onBack={back} active={active}/>
      : <>
        <div className="forum-tools"><div className="forum-search"><Search/><input aria-label={t("Поиск обсуждений")} ref={searchInput} value={search} onChange={e=>setSearch(e.target.value)} maxLength={200} placeholder={t("Найти обсуждение…")} type="search"/>{search ? <button aria-label={t("Очистить поиск")} onClick={()=>setSearch('')}><X/></button> : <kbd aria-hidden="true">/</kbd>}</div>
          <div className="forum-sort" aria-label={t("Сортировка")}>{SORTS.map(sort=><button key={sort.id} aria-pressed={filters.sort===sort.id} title={t(sort.hint)} onClick={()=>changeFilters({sort:sort.id})}>{t(sort.label)}</button>)}</div>
        </div>
        <div className="forum-columns">
          <aside className="forum-sidebar" aria-label={t("Фильтры форума")}>
            <div className="forum-filter-heading"><h2>{t("Класс")}</h2>{filtered && <button onClick={reset}>{t("Сбросить")}</button>}</div>
            <div className="forum-grades">{[null,...SCHOOL_GRADES].map(grade=><button key={grade ?? 'all'} aria-label={grade === null ? t("Все классы") : gradeLabel(grade)} aria-pressed={filters.grade===grade} onClick={()=>changeFilters({grade})}>{grade ?? t("Все")}</button>)}</div>
            <h2 className="forum-section-label">{t("Разделы")}</h2>
            <nav className="forum-categories" aria-label={t("Основные разделы")}><button aria-current={!filters.category ? 'true' : undefined} onClick={()=>changeFilters({category:null})}><span className="forum-category-mark">—</span><span>{t("Все обсуждения")}</span>{!filters.category && <ArrowRight/>}</button>
              {FORUM_CATEGORIES.map(c=><button key={c.id} aria-current={filters.category===c.id ? 'true' : undefined} onClick={()=>changeFilters({category:c.id})}><span className="forum-category-mark">{c.symbol}</span><span>{t(c.label)}</span>{filters.category===c.id && <ArrowRight/>}</button>)}
            </nav>
            <div className="forum-margin-note"><span>{t("Хороший вопрос")}</span><p>{t("Добавьте условие задачи и свой ход решения — так вам будет проще помочь.")}</p><span className="forum-note-line"/></div>
          </aside>
          <section className="forum-feed" aria-label={t("Обсуждения")} aria-busy={loading}>
            <div className="forum-feed-heading"><h2>{filters.search ? t("Результаты поиска") : filters.category ? t(categoryLabel(filters.category)) : t("Все обсуждения")}</h2><span aria-live="polite">{loading ? '…' : total.toLocaleString(intlLocale)}</span></div>
            <p className="forum-sort-caption">{t(SORTS.find(s=>s.id===filters.sort)?.hint || '')}{filters.grade ? ' · '+gradeLabel(filters.grade) : ''}</p>
            {loading ? <div className="forum-loading" role="status"><span/>{t("Загружаем обсуждения…")}</div>
            : error ? <div className="forum-empty"><h3>{t("Связь прервалась")}</h3><p role="alert">{t(error)}</p><button className="forum-secondary" onClick={()=>setRevision(v=>v+1)}>{t("Попробовать ещё раз")}<ArrowRight/></button></div>
            : topics.length===0 ? <div className="forum-empty"><span className="forum-empty-symbol" aria-hidden="true">{filtered ? <Search/> : '“'}</span><h3>{filtered ? t("Пока ничего не нашлось") : t("Первый вопрос — за вами")}</h3><p>{filtered ? t("Попробуйте другие слова или снимите фильтры.") : t("Здесь будут вопросы, решения и идеи участников. Начните первое обсуждение.")}</p><button className="forum-secondary" onClick={filtered ? reset : start}>{filtered ? t("Сбросить фильтры") : t("Создать тему")}<ArrowUpRight/></button></div>
            : <div className="forum-topic-list">{topics.map(topic=><article className="forum-topic-row" key={topic.id}>
                <div className="forum-topic-tags"><span>{t(categoryLabel(topic.category))}</span><span>{topic.grade ? gradeLabel(topic.grade) : t("Все классы")}</span></div>
                <button className="forum-topic-title" onClick={()=>open(topic.id)}><h3>{topic.title}</h3><ArrowUpRight/></button>
                <p className="forum-excerpt">{topic.body}</p>
                <div className="forum-row-bottom"><div className="forum-row-author"><Avatar name={topic.author_name} path={topic.author_avatar_path}/><span>{topic.author_name}</span><time dateTime={topic.created_at}>{formatForumDate(topic.created_at,intlLocale)}</time></div><Metrics topic={topic}/></div>
              </article>)}</div>}
            {!loading && !error && total>FORUM_PAGE_SIZE && <div className="forum-pagination"><button aria-label={t("Предыдущая страница")} disabled={page===0} onClick={()=>{setPage(p=>p-1);top();}}><ChevronLeft/></button><span>{page+1} / {Math.ceil(total/FORUM_PAGE_SIZE)}</span><button aria-label={t("Следующая страница")} disabled={(page+1)*FORUM_PAGE_SIZE>=total} onClick={()=>{setPage(p=>p+1);top();}}><ChevronRight/></button></div>}
            {!user && topics.length>0 && <div className="forum-reader-note"><Check/><p>{t('Читать можно без регистрации.')}{' '}<button onClick={()=>onOpenAuth('login')}>{t('Войти, чтобы присоединиться')}</button></p></div>}
          </section>
        </div>
      </>}
    </div>
  </main>;
};
