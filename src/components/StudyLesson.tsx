import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Download } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { studyLessonsFor } from '../learning/lessons.ts';
import { studyDownloadUrl, type SectionMaterials } from '../learning/materials.ts';
import type { EinsteinLessonContext } from '../einstein/protocol.ts';

const StudyLessonContent = lazy(() => import('./StudyLessonContent.tsx'));

export default function StudyLesson({ grade, sectionId, materials, onOpenTrial, active = true, onContextChange }: {
  grade: number; sectionId: string | null; materials: SectionMaterials; onOpenTrial: (index?: number) => void;
  active?: boolean; onContextChange?: (context: EinsteinLessonContext | undefined) => void;
}) {
  const { t, language } = useLanguage();
  const lessons = studyLessonsFor(grade, sectionId, language, materials.notes);
  const [selectedId, setSelectedId] = useState(lessons[0]?.id);
  const selected = lessons.find(lesson => lesson.id === selectedId) || lessons[0];
  const [readingContext, setReadingContext] = useState<EinsteinLessonContext>();
  const callback = useRef(onContextChange); callback.current = onContextChange;
  const publicContext = selected ? readingContext?.id === selected.id ? readingContext : { id: selected.id, title: t(selected.title).slice(0, 180), language: selected.language } : undefined;
  const contextSignature = JSON.stringify(publicContext);
  useEffect(() => { if (active) callback.current?.(publicContext); }, [active, contextSignature]);
  const answerIndex = materials.trial?.files.findIndex(file => file.label.startsWith('Ответы')) ?? -1;
  const sources = [...new Set(selected?.originals.flatMap(file => file.sourceUrl ? [file.sourceUrl] : []) || [])];
  return <div className="study-lesson">
    {selected ? <article id="study-notes" data-einstein="study-notes" className="study-lesson-reading" tabIndex={-1} aria-labelledby="study-lesson-heading" lang={selected.language}>
      <header className="study-lesson-header" lang={language}>
        <h2 id="study-lesson-heading">{t('Конспект')}{selected.language === 'en' && <span className="study-lesson-language"> · English</span>}</h2>
        {materials.trial && <a className="study-lesson-trial-jump" href="#study-trial" onClick={event => {
          event.preventDefault();
          document.getElementById('study-trial')?.scrollIntoView?.({ block: 'start' });
          document.getElementById('study-trial-heading')?.focus({ preventScroll: true });
        }}>{t('К пробному СОРу')}<ArrowDown aria-hidden="true"/></a>}
      </header>
      {lessons.length > 1 && <div className="study-lesson-picker"><label htmlFor="study-lesson-select">{t('Выбрать конспект')}</label>
        <select id="study-lesson-select" value={selected.id} onChange={event => setSelectedId(event.target.value)}>
          {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.language === 'en' ? lesson.title + ' · English' : t(lesson.title)}</option>)}
        </select>
      </div>}
      {selected.content ? <Suspense fallback={<p className="study-lesson-state" role="status">{t('Открываем конспект…')}</p>}>
        <StudyLessonContent key={selected.id} lesson={selected} active={active} onContextChange={setReadingContext}/>
      </Suspense> : <p className="study-lesson-state">{t('Текстовая версия этого конспекта пока не подготовлена. Оригинал доступен ниже.')}</p>}
      {selected.originals.length > 0 && <details className="study-lesson-originals">
        <summary>{t('Оригинал конспекта')}</summary>
        <ul>{selected.originals.map((file, index) => <li key={file.url}>
          <a href={studyDownloadUrl(file)} download={file.downloadName}><Download aria-hidden="true"/>{t('Скачать оригинал')}
            {selected.originals.length > 1 && ` · ${t(file.label, { page: file.page ?? index + 1, number: file.number ?? index + 1 })}`}
            <span className="study-lesson-file-format">{file.format === 'image' ? 'JPG' : file.format.toUpperCase()}</span></a>
        </li>)}</ul>
        {sources.map(url => <a className="study-lesson-source" key={url} href={url} target="_blank" rel="noopener noreferrer">{t('Источник в Telegram')}<ArrowUpRight aria-hidden="true"/></a>)}
      </details>}
    </article> : <section className="study-lesson-empty" aria-labelledby="study-lesson-empty-title">
      <BookOpen aria-hidden="true"/><h2 id="study-lesson-empty-title">{t('Конспект')}</h2><p>{t('Конспект пока не добавлен.')}</p>
    </section>}

    <section id="study-trial" className="study-lesson-trial" aria-labelledby="study-trial-heading">
      <p className="learning-eyebrow">{t('Проверьте себя')}</p>
      <h2 id="study-trial-heading" tabIndex={-1}>{t('Пробный СОР')}</h2>
      {materials.trial ? <div className="study-lesson-trial-actions">
        <button type="button" className="study-lesson-trial-button" data-einstein="study-trial" onClick={() => onOpenTrial(0)}>{t('Перейти к пробному СОРу')}<ArrowRight aria-hidden="true"/></button>
        {answerIndex !== -1 && <button type="button" className="study-lesson-answer-link" onClick={() => onOpenTrial(answerIndex)}>{t('Ответы')}<ArrowUpRight aria-hidden="true"/></button>}
      </div> : <p className="study-lesson-state">{t('Пробный СОР пока не добавлен.')}</p>}
    </section>
  </div>;
}
