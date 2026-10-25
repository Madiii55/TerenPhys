import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, Send, Square, Trash2, X, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { supabase } from '../supabase.ts';
import { guideTargetFor, safeHighlightBounds, type HighlightBounds } from '../einstein/guide.ts';
import { parseEinsteinResponse, type EinsteinContext, type EinsteinMessage, type EinsteinAction, type GuideActionId } from '../einstein/protocol.ts';
import '../styles/einstein-assistant.css';

const EinsteinAvatar = lazy(() => import('./EinsteinAvatar.tsx'));
type ChatEntry = EinsteinMessage & { actions?: EinsteinAction[]; contextKey?: string; contextLabel?: string };
export function EinsteinAssistant({ context, ready, navigationId, onAction, onOpenAuth, onBeforeGuide, prefill }: {
  context: EinsteinContext; ready: boolean; navigationId: number; onAction: (id: GuideActionId) => void;
  onOpenAuth: () => void; onBeforeGuide?: () => void;
  prefill?: { requestId: number; text: string };
}) {
  const { user } = useAuth();
  const { t, gradeLabel } = useLanguage();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(''), [entries, setEntries] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [pending, setPending] = useState<{ text: string; contextLabel?: string }>();
  const [guide, setGuide] = useState<GuideActionId | null>(null), [bounds, setBounds] = useState<HighlightBounds | null>(null);
  const [guideDirection, setGuideDirection] = useState<'left' | 'right'>('left');
  const figure = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null), chat = useRef<HTMLDivElement>(null), launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const guideCue = useRef<HTMLDivElement>(null), followChat = useRef(true);
  const previousEntryCount = useRef(0);
  const previousUserId = useRef(user?.id);
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;
  const sameAccount = previousUserId.current === user?.id;
  // Reading position is deliberately absent: scrolling must never cancel inference.
  const contextKey = JSON.stringify([context.page, context.language, context.grade, context.quarter, context.sectionId, context.studyLevel, context.lesson?.id, context.view]);
  useEffect(() => {
    controller.current?.abort(); controller.current = null; setBusy(false); setPending(undefined); setError(''); setGuide(null);
  }, [contextKey, navigationId, user?.id]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!prefill) return;
    controller.current?.abort(); controller.current = null; setBusy(false); setPending(undefined); setError('');
    setQuestion(prefill.text.trim().slice(0, 1800)); setOpen(true); setGuide(null);
  }, [prefill?.requestId]);
  useEffect(() => {
    if (previousUserId.current === user?.id) return;
    previousUserId.current = user?.id;
    setEntries([]); setQuestion(''); followChat.current = true;
  }, [user?.id]);
  useEffect(() => {
    if (!open) return;
    const target = window.matchMedia('(pointer: fine)').matches ? input.current ?? closeButton.current : closeButton.current;
    target?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    const grew = entries.length > previousEntryCount.current;
    previousEntryCount.current = entries.length;
    const container = chat.current;
    if (!followChat.current || !container) return;
    if (busy) container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
    else if (grew) {
      const answer = container.querySelectorAll<HTMLElement>('.einstein-message--assistant').item(Math.max(0, entries.filter(entry => entry.role === 'assistant').length - 1));
      if (answer) container.scrollTo({ top: Math.max(0, container.scrollTop + answer.getBoundingClientRect().top - container.getBoundingClientRect().top), behavior: 'instant' });
    }
  }, [entries, busy]);
  useEffect(() => {
    if (!guide || !ready) { setBounds(null); return; }
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = guideTargetFor(guide);
      setBounds(element ? safeHighlightBounds(element.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }) : null);
      if (element && figure.current) {
        const target = element.getBoundingClientRect(), avatar = figure.current.getBoundingClientRect();
        setGuideDirection(target.left + target.width / 2 < avatar.left + avatar.width / 2 ? 'left' : 'right');
      }
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    const finish = () => { if (guideCue.current?.contains(document.activeElement)) closeButton.current?.focus({ preventScroll: true }); setGuide(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); finish(); } };
    const element = guideTargetFor(guide);
    element?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
    if (element) observer?.observe(element);
    update();
    window.addEventListener('scroll', queue, { passive: true }); window.addEventListener('resize', queue); window.addEventListener('keydown', escape);
    const timeout = setTimeout(finish, 6500);
    return () => { clearTimeout(timeout); cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue); window.removeEventListener('keydown', escape); };
  }, [guide, ready]);

  const label = (id: string) => {
    const names: Record<string, string> = {
      'navigate-study': 'Учёба', 'navigate-posts': 'Посты', 'navigate-forum': 'Форум',
      'navigate-profile': 'Профиль', 'navigate-home': 'Главная',
      'show-notes': 'Читать конспект', 'show-trial': 'Пробный СОР',
      'show-quarter-exam': 'Пробный СОЧ', 'show-practice': 'Практика', 'show-post-files': 'Файлы поста',
    };
    if (names[id]) return t(names[id]);
    if (id.startsWith('select-grade-')) return gradeLabel(Number(id.slice(13)));
    if (id.startsWith('select-quarter-')) return t('{quarter} четверть', { quarter: Number(id.slice(15)) });
    return id;
  };
  const available = context.availableActions;
  const readingLabel = context.view === 'trial' ? t('Пробный СОР') : context.view === 'quarter-exam' ? t('Пробный СОЧ') : context.lesson?.sectionTitle || context.lesson?.title || context.topic;
  const topic = [label('navigate-' + context.page), readingLabel || (context.grade ? gradeLabel(context.grade) : '')].filter(Boolean).join(' · ');
  const prompts = ['Объясни проще', 'Разбери пример', 'Проверь меня'];
  const promptText = ['Объясни этот фрагмент конспекта проще, с коротким примером.', 'Разбери пример по этому фрагменту конспекта. Начни с первого шага.', 'Задай один вопрос по этому фрагменту конспекта и подожди моего ответа.'];
  const point = (id: GuideActionId) => { onBeforeGuide?.(); setGuide(current => current === id ? null : id); closeButton.current?.focus({ preventScroll: true }); };
  const controls = (actions: EinsteinAction[]) => <div className="einstein-actions">{actions.filter(action => available.includes(action.id)).map(action => <div key={action.id}>
    <button type="button" disabled={!ready} onClick={() => { setGuide(null); onAction(action.id); }}><span>{action.label}</span></button>
    <button type="button" disabled={!ready} className="einstein-point" onClick={() => point(action.id)} aria-label={t('Показать кнопку «{label}»', { label: action.label })} title={t("Показать на сайте")}><Eye aria-hidden="true"/></button>
  </div>)}</div>;
  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !question.trim() || !user || previousUserId.current !== user.id || !ready) return;
    const requestUserId = user.id;
    const snapshot = { ...context, availableActions: [...available], ...(context.lesson ? { lesson: { ...context.lesson } } : {}) };
    const contextLabel = snapshot.lesson?.sectionTitle;
    const text = question.trim(), request = new AbortController(); controller.current?.abort(); controller.current = request;
    const messages: EinsteinMessage[] = [...entries.map(({ role, content }) => ({ role, content: content.slice(0, 1800) })), { role: 'user' as const, content: text }].slice(-8);
    while (messages.reduce((sum, item) => sum + item.content.length, 0) > 8000 && messages.length > 1) messages.shift();
    setError(''); followChat.current = true; setPending({ text, contextLabel }); setBusy(true);
    try {
      const result = await supabase.functions.invoke('einstein-assistant', { body: { messages, context: snapshot }, signal: request.signal });
      if (request.signal.aborted || controller.current !== request || currentUserId.current !== requestUserId) return;
      if (result.error) {
        let code = '';
        try { code = (await result.error.context?.json())?.error?.code || ''; } catch { /* Generic connection message. */ }
        throw new Error(code);
      }
      const reply = parseEinsteinResponse(result.data, available, 'gemini');
      if (!reply) throw new Error('invalid_response');
      setEntries(current => [...current, { role: 'user', content: text }, { role: 'assistant', content: reply.answer, actions: reply.actions, contextKey, contextLabel }]);
      setQuestion('');
    } catch (failure) {
      if (request.signal.aborted || controller.current !== request || currentUserId.current !== requestUserId) return;
      const code = failure instanceof Error ? failure.message : '';
      setError(code === 'rate_limited' ? t('Бесплатная квота исчерпана. Попробуй позже.')
        : code === 'auth_required' || code === 'email_unverified' ? t("Войди с подтверждённой почтой, чтобы задать вопрос.")
        : t('Не удалось получить ответ. Попробуй отправить вопрос ещё раз.'));
    } finally { if (controller.current === request) { controller.current = null; setBusy(false); setPending(undefined); } }
  };
  const stop = () => { controller.current?.abort(); controller.current = null; setBusy(false); setPending(undefined); };
  const close = () => { setOpen(false); setGuide(null); launcher.current?.focus({ preventScroll: true }); };
  return <>
    {bounds && guide && <div className="einstein-highlight" aria-hidden="true" style={bounds}/>}
    <aside className="einstein-dock" aria-label={t("Помощник Эйнштейн")}>
      {open && <section id="einstein-panel" className={'einstein-panel' + (guide && bounds ? ' einstein-panel--guiding' : '') + (user ? ' einstein-panel--authenticated' : '') + (sameAccount && (entries.length || busy) ? ' einstein-panel--chatting' : '') + (context.page === 'study' ? ' einstein-panel--study' : '')} aria-labelledby="einstein-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (guide && bounds) { setGuide(null); closeButton.current?.focus({ preventScroll: true }); } else close(); } }}>
        <header>
          <div ref={figure} className="einstein-figure"><Suspense fallback={null}><EinsteinAvatar mode={guide && bounds ? 'guide' : 'idle'} guideDirection={guideDirection} active={ready}/></Suspense></div>
          <div className="einstein-heading"><h2 id="einstein-title">{t('Эйнштейн')}</h2><p className="einstein-topic" title={topic}>{topic}</p></div>
          <div className="einstein-toolbar">{sameAccount && entries.length > 0 && <details className="einstein-clear"><summary aria-label={t('Очистить чат')} title={t('Очистить чат')}><Trash2 aria-hidden="true"/></summary><button type="button" onClick={() => { stop(); setEntries([]); setError(''); followChat.current = true; input.current?.focus({ preventScroll: true }); }}>{t('Очистить переписку?')}</button></details>}
          <button type="button" ref={closeButton} onClick={close} aria-label={t("Закрыть помощника")}><X aria-hidden="true"/></button></div>
        </header>
        {guide && bounds && <div ref={guideCue} className="einstein-cue" role="status">{t("Вот нужная кнопка")}<button type="button" onClick={() => { setGuide(null); closeButton.current?.focus({ preventScroll: true }); }}><MessageCircle aria-hidden="true"/>{t("Вернуться к чату")}</button></div>}
        <div className="einstein-conversation" hidden={!!guide && !!bounds}>
        <div className="einstein-chat" ref={chat} onScroll={event => { const element = event.currentTarget; followChat.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72; }}>
          {user && (!sameAccount || !entries.length) && !busy && <div className="einstein-empty"><p>{t('Что разберём?')}</p>{context.lesson?.excerpt && <div className="einstein-prompts">{prompts.map((prompt, index) => <button key={prompt} type="button" onClick={() => { setQuestion(t(promptText[index])); input.current?.focus({ preventScroll: true }); }}>{t(prompt)}</button>)}</div>}</div>}
          {(sameAccount ? entries : []).map((entry, index) => <div key={index} className={'einstein-message einstein-message--' + entry.role}><span className="einstein-sr">{entry.role === 'user' ? t("Ты") : t('Эйнштейн')}</span>{entry.contextLabel && <small className="einstein-message-context">{entry.contextLabel}</small>}<p>{entry.content}</p>{entry.contextKey === contextKey && entry.actions && controls(entry.actions.map(action => ({ ...action, label: label(action.id) })))}</div>)}
          {sameAccount && busy && pending && <div className="einstein-message einstein-message--user einstein-pending"><span className="einstein-sr">{t('Ты')}</span><p>{pending.text}</p></div>}
          {sameAccount && busy && <p role="status" className="einstein-thinking">{t('Думаю…')}</p>}
          {error && <p role="alert" className="einstein-error">{error}</p>}
        </div>
        {user ? <form onSubmit={ask}><label className="einstein-sr" htmlFor="einstein-question">{t("Вопрос по физике")}</label><textarea ref={input} id="einstein-question" rows={2} maxLength={1800} value={sameAccount ? question : ''} disabled={busy} placeholder={t("Спроси о физике…")} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>{busy ? <button type="button" onClick={stop} aria-label={t('Остановить ответ')} title={t('Остановить ответ')}><Square aria-hidden="true"/></button> : <button type="submit" disabled={!question.trim() || !ready} aria-label={t("Отправить вопрос")}><Send aria-hidden="true"/></button>}<details className="einstein-privacy"><summary>{t('О данных и ответах')}</summary><p>{t('Вопрос, переписка и фрагмент конспекта отправляются Gemini. На бесплатном тарифе Google может использовать их для улучшения своих продуктов. Не отправляй личные данные. Проверяй важные расчёты.')}</p></details></form>
          : <div className="einstein-signin"><p>{t('Войди, чтобы задать вопрос по физике.')}</p><button type="button" onClick={() => { close(); onOpenAuth(); }}>{t("Войти и задать вопрос")}<ArrowRight aria-hidden="true"/></button></div>}
        </div>
      </section>}
      <button type="button" ref={launcher} className="einstein-launcher" aria-label={t("Помощник Эйнштейн")} aria-expanded={open} aria-controls={open ? 'einstein-panel' : undefined} onClick={() => { if (open) close(); else setOpen(true); }}>{open ? <X aria-hidden="true"/> : <MessageCircle aria-hidden="true"/>}</button>
    </aside>
  </>;
}
