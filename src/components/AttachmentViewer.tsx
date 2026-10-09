import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { supabaseUrl } from '../supabase.ts';
import { telegramMediaUrl, type TelegramAttachment } from '../telegram/model.ts';
import { attachmentFormat, attachmentPreviewKind, readPreviewBytes } from '../telegram/preview.ts';
import '../styles/attachments.css';

export default function AttachmentViewer({ items, initialIndex, onClose }: {
  items: TelegramAttachment[]; initialIndex: number; onClose: () => void;
}) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(initialIndex);
  const [documentHtml, setDocumentHtml] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedUrl, setFailedUrl] = useState('');
  const dialog = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const item = items[index], kind = attachmentPreviewKind(item), url = telegramMediaUrl(supabaseUrl, item.path);
  const failed = Boolean(url && failedUrl === url);
  const name = item.name || t('Вложение');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; closeButton.current?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],iframe,video,audio') || [])];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyDown);
    return () => { document.removeEventListener('keydown', keyDown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  useEffect(() => {
    setDocumentHtml(''); setDocumentUrl(''); setFailedUrl('');
    if (!url || kind !== 'docx') { setLoading(false); return; }
    const abort = new AbortController(); let alive = true;
    setLoading(true);
    const timeout = setTimeout(() => { abort.abort(); if (alive) { setFailedUrl(url); setLoading(false); } }, 30000);
    void (async () => {
      try {
        const response = await fetch(url, { signal: abort.signal, credentials: 'omit' });
        const bytes = await readPreviewBytes(response);
        const { renderDocxPreview } = await import('../telegram/docxPreview.ts');
        const html = await renderDocxPreview(bytes, abort.signal);
        if (alive && !abort.signal.aborted) { setDocumentHtml(html); setDocumentUrl(url); }
      } catch { if (alive) setFailedUrl(url); }
      finally { clearTimeout(timeout); if (alive) setLoading(false); }
    })();
    return () => { alive = false; abort.abort(); clearTimeout(timeout); };
  }, [url, kind]);
  const step = (next: number) => { setIndex(next); closeButton.current?.focus(); };
  return createPortal(<div className="attachment-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="attachment-viewer" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="attachment-title">
      <header className="attachment-toolbar">
        <div className="attachment-title"><span>{attachmentFormat(item)}</span><h2 id="attachment-title">{name}</h2></div>
        <div className="attachment-tools">
          {url && <a href={url + '?download=' + encodeURIComponent(name)} className="attachment-download" aria-label={t('Скачать {name}', { name })}><Download aria-hidden="true"/><span>{t('Скачать')}</span></a>}
          <button type="button" ref={closeButton} onClick={onClose} aria-label={t('Закрыть просмотр')}><X aria-hidden="true"/></button>
        </div>
      </header>
      {items.length > 1 && <nav className="attachment-navigation" aria-label={t('Вложения публикации')}>
        <button type="button" onClick={() => step(index - 1)} disabled={index === 0} aria-label={t('Предыдущий файл')}><ChevronLeft aria-hidden="true"/></button>
        <span>{index + 1} / {items.length}</span>
        <button type="button" onClick={() => step(index + 1)} disabled={index === items.length - 1} aria-label={t('Следующий файл')}><ChevronRight aria-hidden="true"/></button>
        <div className="attachment-tabs">{items.map((file, i) => <button type="button" key={i} aria-current={i === index ? 'true' : undefined} onClick={() => step(i)}>{file.name || t('Вложение')}</button>)}</div>
      </nav>}
      <div className={'attachment-content attachment-content--' + kind}>
        {kind === 'docx' && !failed && (loading || documentUrl !== url) ? <div className="attachment-state" role="status"><span className="attachment-spinner" aria-hidden="true"/>{t('Открываем документ…')}</div>
          : failed || !url ? <div className="attachment-state" role="alert"><p>{t('Не удалось открыть предпросмотр. Можно скачать оригинал.')}</p></div>
          : kind === 'pdf' ? <iframe key={url} src={url + '#view=FitH'} title={name} className="attachment-frame" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)}/>
          : kind === 'docx' && documentHtml && documentUrl === url ? <iframe key={url} srcDoc={documentHtml} sandbox="allow-same-origin" title={name} className="attachment-frame" referrerPolicy="no-referrer"
            onLoad={event => { event.currentTarget.contentDocument?.addEventListener('keydown', key => { if (key.key === 'Escape') onClose(); if (key.key === 'Tab') { key.preventDefault(); closeButton.current?.focus(); } }); }}/>
          : kind === 'image' ? <img src={url} alt={name} onError={() => setFailedUrl(url)}/>
          : kind === 'video' ? <video src={url} controls playsInline preload="metadata" onError={() => setFailedUrl(url)}/>
          : kind === 'audio' ? <audio src={url} controls preload="metadata" onError={() => setFailedUrl(url)}/>
          : null}
      </div>
      <footer className="attachment-footer"><span>{kind === 'docx' ? t('Предпросмотр Word. Точное оформление — в оригинале.') : kind === 'pdf' ? t('Если PDF не отображается, скачайте оригинал.') : name}</span></footer>
    </div>
  </div>, document.body);
}
