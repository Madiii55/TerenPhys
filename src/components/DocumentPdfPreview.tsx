import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { readPreviewBytes } from '../telegram/preview.ts';

/** Only draw PDF pages. Embedded actions, JavaScript, XFA and external links are never executed. */
export default function DocumentPdfPreview({ url, title }: { url: string; title: string }) {
  const { t } = useLanguage();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1), [zoom, setZoom] = useState(1), [width, setWidth] = useState(700);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [text, setText] = useState('');
  const container = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(240, Math.min(1100, element.clientWidth - 24)));
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const abort = new AbortController(); let alive = true, task: PDFDocumentLoadingTask | undefined;
    setFailed(false); setPdf(null); setLoading(true);
    const timeout = setTimeout(() => { abort.abort(); if (alive) setFailed(true); void task?.destroy(); }, 30000);
    void (async () => {
      try {
        const [library, response] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), fetch(url, { signal: abort.signal, credentials: 'omit' })]);
        const bytes = await readPreviewBytes(response);
        abort.signal.throwIfAborted(); library.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        task = library.getDocument({ data: new Uint8Array(bytes), enableXfa: false,
          maxImageSize: 12_000_000, canvasMaxAreaInBytes: 16 * 1024 * 1024, useWorkerFetch: false });
        const document = await task.promise;
        if (document.numPages > 200) throw new Error('Too many PDF pages');
        if (alive && !abort.signal.aborted) setPdf(document);
      } catch { if (alive) setFailed(true); }
      finally { clearTimeout(timeout); }
    })();
    return () => { alive = false; abort.abort(); clearTimeout(timeout); void task?.destroy(); };
  }, [url]);

  useEffect(() => {
    if (!pdf) return;
    let alive = true, render: RenderTask | undefined;
    setLoading(true); setText('');
    viewport.current?.scrollTo?.(0, 0);
    void (async () => {
      try {
        const source = await pdf.getPage(page);
        if (!alive || !canvas.current) return;
        const natural = source.getViewport({ scale: 1 });
        const view = source.getViewport({ scale: width * zoom / natural.width });
        const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (view.width * view.height)));
        const element = canvas.current;
        element.width = Math.ceil(view.width * density); element.height = Math.ceil(view.height * density);
        element.style.width = view.width + 'px'; element.style.height = view.height + 'px';
        render = source.render({ canvas: element, viewport: view, transform: [density, 0, 0, density, 0, 0] });
        await render.promise;
        if (!alive) return;
        const content = await source.getTextContent();
        if (alive) { setText(content.items.map(item => 'str' in item ? item.str : '').join(' ')); setLoading(false); }
      } catch { if (alive) { setFailed(true); setLoading(false); } }
    })();
    return () => { alive = false; render?.cancel(); };
  }, [pdf, page, width, zoom]);

  return <div className="study-pdf" ref={container}>
    {pdf && <nav className="study-pdf-toolbar" aria-label={t('Страницы PDF')}>
      <button type="button" disabled={page === 1 || failed} aria-label={t('Предыдущая страница')} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden="true"/></button>
      <span>{page} / {pdf.numPages}</span>
      <button type="button" disabled={page === pdf.numPages || failed} aria-label={t('Следующая страница')} onClick={() => setPage(page + 1)}><ChevronRight aria-hidden="true"/></button>
      <button type="button" disabled={zoom <= 1} aria-label={t('Уменьшить')} onClick={() => setZoom(Math.max(1, zoom - .25))}><Minus aria-hidden="true"/></button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" disabled={zoom >= 2} aria-label={t('Увеличить')} onClick={() => setZoom(Math.min(2, zoom + .25))}><Plus aria-hidden="true"/></button>
    </nav>}
    {failed ? <div className="attachment-state" role="alert">{t('Не удалось открыть предпросмотр. Можно скачать оригинал.')}</div>
      : <div className="study-pdf-page" ref={viewport} aria-busy={loading}>
        {loading && <div className="attachment-state" role="status"><span className="attachment-spinner" aria-hidden="true"/>{t('Открываем документ…')}</div>}
        <canvas key={`${page}-${width}-${zoom}`} ref={canvas} role="img" aria-label={title + ' — ' + t('Страница {page}', { page })} hidden={loading}/>
        {text && <p className="study-pdf-text">{text}</p>}
      </div>}
  </div>;
}
