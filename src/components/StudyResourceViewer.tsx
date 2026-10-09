import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { StudyResource } from '../learning/materials.ts';
import { readPreviewBytes } from '../telegram/preview.ts';
import '../styles/attachments.css';
import '../styles/study-materials.css';

export default function StudyResourceViewer({ resource, initialIndex = 0, onClose }: {
  resource: StudyResource; initialIndex?: number; onClose: () => void;
}) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(initialIndex);
  const [preview, setPreview] = useState<{ url: string; html: string } | null>(null);
  const [failedUrl, setFailedUrl] = useState('');
  const dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const file = resource.files[index], title = `${resource.code} — ${t(resource.title)}`;
  const fileLabel = t(file.label, { page: file.page ?? index + 1 });
  const failed = failedUrl === file.url;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],iframe') ?? [])];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  useEffect(() => {
    setPreview(null); setFailedUrl('');
    content.current?.scrollTo?.(0, 0);
    if (file.format !== 'docx') return;
    const abort = new AbortController(); let alive = true;
    const timeout = setTimeout(() => { abort.abort(); if (alive) setFailedUrl(file.url); }, 30000);
    void (async () => {
      try {
        const response = await fetch(file.url, { signal: abort.signal, credentials: 'omit' });
        const bytes = await readPreviewBytes(response);
        const { renderDocxPreview } = await import('../telegram/docxPreview.ts');
        const html = await renderDocxPreview(bytes, abort.signal);
        if (alive && !abort.signal.aborted) setPreview({ url: file.url, html });
      } catch { if (alive) setFailedUrl(file.url); }
      finally { clearTimeout(timeout); }
    })();
    return () => { alive = false; clearTimeout(timeout); abort.abort(); };
  }, [file]);
  const step = (next: number) => { setIndex(next); close.current?.focus(); };
  return createPortal(<div className="attachment-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className="attachment-viewer study-resource-viewer" role="dialog" aria-modal="true" aria-labelledby="study-resource-title">
      <header className="attachment-toolbar">
        <div className="attachment-title"><span>{file.format === 'docx' ? 'DOCX' : 'JPG'}</span><h2 id="study-resource-title">{title}</h2></div>
        <div className="attachment-tools">
          <a className="attachment-download" href={file.url} download={file.downloadName} aria-label={t('Скачать {name}', { name: title + ' — ' + fileLabel })}><Download aria-hidden="true"/><span>{t('Скачать')}</span></a>
          <button type="button" ref={close} onClick={onClose} aria-label={t('Закрыть просмотр')}><X aria-hidden="true"/></button>
        </div>
      </header>
      {resource.files.length > 1 && <nav className="attachment-navigation" aria-label={t('Материалы раздела')}>
        <button type="button" onClick={() => step(index - 1)} disabled={index === 0} aria-label={t('Предыдущий файл')}><ChevronLeft aria-hidden="true"/></button>
        <span>{index + 1} / {resource.files.length}</span>
        <button type="button" onClick={() => step(index + 1)} disabled={index === resource.files.length - 1} aria-label={t('Следующий файл')}><ChevronRight aria-hidden="true"/></button>
        <div className="attachment-tabs">{resource.files.map((item, i) => <button type="button" key={item.url} aria-current={i === index ? 'true' : undefined} onClick={() => step(i)}>{t(item.label, { page: item.page ?? i + 1 })}</button>)}</div>
      </nav>}
      <div ref={content} className={'attachment-content study-resource-content study-resource-content--' + file.format}>
        {failed ? <div role="alert" className="attachment-state">{t('Не удалось открыть предпросмотр. Можно скачать оригинал.')}</div>
          : file.format === 'image' ? <img key={file.url} src={file.url} alt={title + ' — ' + fileLabel} onError={() => setFailedUrl(file.url)}/>
          : preview?.url === file.url ? <iframe key={file.url} className="attachment-frame" srcDoc={preview.html} sandbox="allow-same-origin" title={title + ' — ' + fileLabel} referrerPolicy="no-referrer"
            onLoad={event => { event.currentTarget.contentDocument?.addEventListener('keydown', key => { if (key.key === 'Escape') onClose(); if (key.key === 'Tab') { key.preventDefault(); close.current?.focus(); } }); }}/>
          : <div className="attachment-state" role="status"><span className="attachment-spinner" aria-hidden="true"/>{t('Открываем документ…')}</div>}
      </div>
      <footer className="attachment-footer"><span>{file.format === 'docx' ? t('Предпросмотр Word. Точное оформление — в оригинале.') : fileLabel}</span></footer>
    </div>
  </div>, document.body);
}
