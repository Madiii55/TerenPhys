import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Download, FileText } from 'lucide-react';
import { supabase, supabaseUrl } from '../supabase.ts';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { loadTelegramPage, telegramRow, type TelegramCursor } from '../telegram/api.ts';
import type { Tables } from '../types/database.ts';
import type { SchoolGrade } from '../learning/catalogue.ts';
import { TELEGRAM_CHANNEL, TELEGRAM_TITLE, groupTelegramPosts, mergeTelegramPosts, safeTelegramLink,
  telegramMatchesGrade, telegramMediaUrl, telegramPostUrl, type TelegramPost, type TelegramAttachment, type TelegramEntity } from '../telegram/model.ts';
import { attachmentFormat, attachmentPreviewKind } from '../telegram/preview.ts';

const AttachmentViewer = lazy(() => import('./AttachmentViewer.tsx'));

// Telegram offsets are UTF-16, like JS strings. Imported HTML is never executed.
export function TelegramText({ text, entities }: { text: string; entities: TelegramEntity[] }) {
  const ranges = [...entities];
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
    if (!ranges.some(e => match.index >= e.offset && match.index < e.offset + e.length)) ranges.push({ type: 'url', offset: match.index, length: match[0].length });
  }
  const boundaries = [...new Set([0, text.length, ...ranges.flatMap(e => [e.offset, e.offset + e.length])])]
    .filter(n => n >= 0 && n <= text.length).sort((a, b) => a - b);
  return <>{boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1];
    const applicable = ranges.filter(e => e.offset <= start && e.offset + e.length >= end);
    let node: React.ReactNode = text.slice(start, end);
    for (const type of ['code', 'pre', 'bold', 'italic', 'underline', 'strikethrough', 'spoiler', 'blockquote']) {
      if (!applicable.some(e => e.type === type)) continue;
      if (type === 'bold') node = <strong>{node}</strong>;
      else if (type === 'italic') node = <em>{node}</em>;
      else if (type === 'underline') node = <u>{node}</u>;
      else if (type === 'strikethrough') node = <s>{node}</s>;
      else if (type === 'code' || type === 'pre') node = <code>{node}</code>;
      else if (type === 'spoiler') node = <span className="telegram-spoiler" tabIndex={0}>{node}</span>;
      else node = <span className="telegram-quote">{node}</span>;
    }
    const link = applicable.find(e => ['url', 'text_link', 'email', 'phone_number', 'mention'].includes(e.type));
    if (link) {
      const value = text.slice(link.offset, link.offset + link.length);
      const href = safeTelegramLink(link.type === 'text_link' ? (link.url || '') : link.type === 'email' ? 'mailto:' + value
        : link.type === 'phone_number' ? 'tel:' + value : link.type === 'mention' ? 'https://t.me/' + value.slice(1) : value);
      if (href) node = <a href={href} target="_blank" rel="noopener noreferrer">{node}</a>;
    }
    return <React.Fragment key={start}>{node}</React.Fragment>;
  })}</>;
}

function TelegramMedia({ item, source, onOpen }: { item: TelegramAttachment; source: string; onOpen: () => void }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const url = telegramMediaUrl(supabaseUrl, item.path);
  const fallback = <a className="telegram-file" href={source} target="_blank" rel="noopener noreferrer">
    <FileText aria-hidden="true"/><span>{item.name || t('Открыть вложение в Telegram')}</span><ArrowUpRight aria-hidden="true"/>
  </a>;
  if (!url || failed) return fallback;
  if (item.kind === 'photo') return <button type="button" className="telegram-photo" onClick={onOpen} aria-label={t('Открыть фото')}>
    <img src={url} alt={t('Фото из публикации')} loading="lazy" decoding="async" onError={() => setFailed(true)}/>
  </button>;
  if (item.kind === 'video') return <video className="telegram-video" src={url} controls playsInline preload="none" onError={() => setFailed(true)}/>;
  if (item.kind === 'audio') return <audio src={url} controls preload="none" onError={() => setFailed(true)}/>;
  return fallback;
}

function TelegramFile({ item, source, onOpen }: { item: TelegramAttachment; source: string; onOpen: () => void }) {
  const { t } = useLanguage();
  const url = telegramMediaUrl(supabaseUrl, item.path), canPreview = url && attachmentPreviewKind(item);
  const name = item.name || t('Вложение');
  const content = <><span className="telegram-file-format">{attachmentFormat(item)}</span><span className="telegram-file-name">{name}</span>
    <span className="telegram-file-action">{canPreview ? t('Открыть') : url ? t('Скачать') : t('В Telegram')}</span></>;
  return <div className="telegram-file-row">
    {canPreview ? <button type="button" className="telegram-file-open" onClick={onOpen} aria-label={t('Открыть {name}', { name })}>{content}</button>
      : <a className="telegram-file-open" href={url ? url + '?download=' + encodeURIComponent(name) : source} target="_blank" rel="noopener noreferrer">{content}</a>}
    {url && <a className="telegram-file-download" href={url + '?download=' + encodeURIComponent(name)} aria-label={t('Скачать {name}', { name })} title={t('Скачать')}><Download aria-hidden="true"/></a>}
  </div>;
}

export function TelegramEntry({ post, onPreview }: { post: TelegramPost; onPreview?: (items: TelegramAttachment[], index: number) => void }) {
  const { t, intlLocale } = useLanguage();
  const source = telegramPostUrl(post.message_id);
  const previews = post.attachments.filter(item => attachmentPreviewKind(item) && telegramMediaUrl(supabaseUrl, item.path));
  const files = post.attachments.filter(item => item.kind === 'document' || item.kind === 'unsupported');
  const media = post.attachments.filter(item => item.kind !== 'document' && item.kind !== 'unsupported');
  const open = (item: TelegramAttachment) => { const index = previews.indexOf(item); if (index >= 0) onPreview?.(previews, index); };
  return <article className="dispatch-entry telegram-entry">
    <header><span className="dispatch-author">{TELEGRAM_TITLE}</span>
      <time dateTime={post.published_at}>{new Intl.DateTimeFormat(intlLocale, {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(post.published_at))}</time>
    </header>
    {post.text && <div className="dispatch-text"><TelegramText text={post.text} entities={post.entities}/></div>}
    {media.length > 0 && <div className={'telegram-media' + (media.length > 1 ? ' telegram-media--album' : '')}>{media.map((item, i) =>
      <TelegramMedia key={item.path || i} item={item} source={telegramPostUrl(item.source_message_id || post.message_id)} onOpen={() => open(item)}/>)}</div>}
    {files.length > 0 && <div className="telegram-files"><div className="telegram-files-heading">{t('Файлы')}<span>{files.length}</span></div>
      {files.map((item, i) => <TelegramFile key={item.path || i} item={item} source={telegramPostUrl(item.source_message_id || post.message_id)} onOpen={() => open(item)}/>)}</div>}
    <a className="telegram-source" href={source} target="_blank" rel="noopener noreferrer">{t('В Telegram')}<ArrowUpRight aria-hidden="true"/></a>
  </article>;
}

export interface DispatchFeedEntry { key: string; publishedAt: string; content: React.ReactNode }
interface TelegramFeedProps {
  active: boolean;
  grade?: SchoolGrade;
  additionalEntries?: readonly DispatchFeedEntry[];
  additionalLoading?: boolean;
  additionalError?: string;
  children?: React.ReactNode;
}

export function TelegramFeed({ active, grade, additionalEntries = [], additionalLoading = false, additionalError = '', children }: TelegramFeedProps) {
  const { t, gradeLabel } = useLanguage();
  const [posts, setPosts] = useState<TelegramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<{ items: TelegramAttachment[]; index: number } | null>(null);
  const openViewer = useCallback((items: TelegramAttachment[], index: number) => setViewer({ items, index }), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const entries = useMemo(() => groupTelegramPosts(posts).filter(post => grade === undefined || telegramMatchesGrade(post, grade)), [posts, grade]);
  const timeline = useMemo(() => [...additionalEntries, ...entries.map(post => ({ key: 'telegram-' + post.message_id,
    publishedAt: post.published_at, content: <TelegramEntry post={post} onPreview={openViewer}/> }))]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.key.localeCompare(a.key, 'en', { numeric: true })),
  [additionalEntries, entries, openViewer]);
  const cursor = useRef<TelegramCursor | undefined>(undefined);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const loadingOlder = useRef(false);
  useEffect(() => {
    if (!active) { setViewer(null); return; }
    const current = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    let request = 0;
    const refresh = async () => {
      const version = ++request;
      try {
        const page = await loadTelegramPage(abort.signal, undefined, grade);
        if (current !== generation.current || version !== request) return;
        setPosts(existing => mergeTelegramPosts(existing, page.posts));
        if (!cursor.current) { cursor.current = page.posts.at(-1); setHasMore(page.hasMore); }
        setError('');
      } catch {
        if (!abort.signal.aborted && current === generation.current) setError('Не удалось загрузить посты. Попробуйте обновить страницу.');
      } finally { if (current === generation.current) setLoading(false); }
    };
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel('telegram-feed-' + (grade ?? 'general')).on('postgres_changes', {
      event: '*', schema: 'public', table: 'telegram_posts', filter: 'channel_username=eq.' + TELEGRAM_CHANNEL,
    }, payload => {
      if (current !== generation.current) return;
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { message_id?: number }).message_id;
        if (id) setPosts(existing => existing.filter(post => post.message_id !== id));
      } else {
        const row = payload.new as Tables<'telegram_posts'>;
        if (row.message_id) setPosts(existing => mergeTelegramPosts(existing, [telegramRow(row)]));
      }
      clearTimeout(timer); timer = setTimeout(() => void refresh(), 350);
    }).subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      generation.current++; abort.abort(); controller.current = null; clearTimeout(timer);
      loadingOlder.current = false; setMoreLoading(false);
      document.removeEventListener('visibilitychange', visible); void supabase.removeChannel(channel);
    };
  }, [active, grade]);
  const loadOlder = useCallback(async () => {
    if (!active || !hasMore || !cursor.current || loadingOlder.current || !controller.current) return;
    loadingOlder.current = true; setMoreLoading(true);
    const current = generation.current;
    try {
      const page = await loadTelegramPage(controller.current.signal, cursor.current, grade);
      if (current !== generation.current) return;
      setPosts(existing => mergeTelegramPosts(existing, page.posts));
      if (page.posts.length) cursor.current = page.posts.at(-1);
      setHasMore(page.hasMore); setError('');
    } catch { if (current === generation.current) setError('Не удалось загрузить посты. Попробуйте обновить страницу.'); }
    finally { if (current === generation.current) { loadingOlder.current = false; setMoreLoading(false); } }
  }, [active, hasMore, grade]);
  const busy = loading || additionalLoading;
  return <section className="dispatch-stream" aria-labelledby={'telegram-heading-' + (grade ?? 'general')} aria-busy={busy || moreLoading}>
    <header className="dispatch-header"><h1 id={'telegram-heading-' + (grade ?? 'general')}>{grade === undefined ? t('Общий чат') : gradeLabel(grade)}</h1></header>
    <div className="dispatch-feed">
      {busy ? <div className="dispatch-state" role="status"><span className="dispatch-loading" aria-hidden="true"/><p>{t('Загружаем публикации…')}</p></div>
        : !timeline.length && !error && !additionalError ? <div className="dispatch-empty"><h2>{t('Публикаций пока нет.')}</h2></div>
        : <div className="dispatch-entries">{timeline.map(entry => <React.Fragment key={entry.key}>{entry.content}</React.Fragment>)}</div>}
      {error && <p className="dispatch-error" role="alert">{t(error)}</p>}
      {additionalError && <p className="dispatch-error" role="alert">{t(additionalError)}</p>}
      {hasMore && <button className="telegram-more" type="button" onClick={() => void loadOlder()} disabled={moreLoading}>
        {moreLoading ? t('Загружаем публикации…') : t('Ранее')}<ArrowDown aria-hidden="true"/>
      </button>}
    </div>
    {children}
    {viewer && <Suspense fallback={<div className="account-modal-backdrop" role="status">{t('Открываем документ…')}</div>}>
      <AttachmentViewer items={viewer.items} initialIndex={viewer.index} onClose={closeViewer}/>
    </Suspense>}
  </section>;
}
