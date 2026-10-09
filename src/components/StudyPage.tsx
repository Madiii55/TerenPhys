import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowUpRight, Play, ChevronDown, ArrowLeft, X } from 'lucide-react';
import { SCHOOL_GRADES, STUDY_QUARTERS, STUDY_PROGRAMME, CLASS_NOTES, hasStudyMaterial, hasStudyQuarters, studySectionsFor, type QuarteredGrade, type StudyQuarter, type StudySection } from '../learning/catalogue.ts';
import { initialStudyNavigation, studyNavigationReducer } from '../learning/navigation.ts';
import { quarterMaterial, sectionMaterials, type SectionMaterials, type StudyResource } from '../learning/materials.ts';
import StudyResourceViewer from './StudyResourceViewer.tsx';
import '../styles/learning.css';
import '../styles/study-materials.css';
import { useLanguage } from '../i18n/LanguageContext.tsx';

export function StudyQuarterList({ grade, onSelect }: { grade: QuarteredGrade; onSelect: (quarter: StudyQuarter) => void }) {
  const { t } = useLanguage();
  return <div className="learning-index">
    <div className="learning-list-label"><span>{t('Четверти')}</span><span>{t('Разделы')}</span></div>
    <div className="learning-quarter-list" role="group" aria-label={t('Выбор четверти')}>
      {STUDY_QUARTERS.map(quarter => <button key={quarter} className="learning-class-row learning-quarter-row"
        aria-label={t('{quarter} четверть', { quarter })} onClick={() => onSelect(quarter)}>
        <span className="learning-class-number">{quarter}</span>
        <span className="learning-class-copy"><span>{t('четверть')}</span></span>
        <span className="learning-quarter-count" aria-hidden="true">{String(STUDY_PROGRAMME[grade][quarter].length).padStart(2, '0')}</span>
        <ArrowUpRight aria-hidden="true"/>
      </button>)}
    </div>
  </div>;
}

export function StudySectionList({ sections, onSelect }: { sections: readonly StudySection[]; onSelect: (sectionId: string) => void }) {
  const { t } = useLanguage();
  return <div className="learning-index learning-catalogue">
    <div className="learning-contents" role="group" aria-label={t('Выбор раздела')}>
      <div className="learning-list-label"><span>{t('Разделы')}</span><span>{String(sections.length).padStart(2, '0')}</span></div>
      {sections.map((section, index) => <button key={section.id} className="learning-content-row"
        aria-label={section.id.startsWith('12-') ? t(section.title) : section.id + ' — ' + t(section.title)}
        onClick={() => onSelect(section.id)}>
        <span className="learning-item-number learning-section-code">{section.id.startsWith('12-') ? String(index + 1).padStart(2, '0') : section.id}</span>
        <span>{t(section.title)}</span><ArrowRight aria-hidden="true"/>
      </button>)}
    </div>
  </div>;
}

export function StudyResourceCards({ materials, onOpen, onLegacyNotes }: {
  materials: SectionMaterials;
  onOpen: (kind: 'notes' | 'trial', index?: number) => void;
  onLegacyNotes?: () => void;
}) {
  const { t } = useLanguage();
  return <div className="learning-resources" aria-label={t('Материалы раздела')}>
    <section className="learning-resource" aria-labelledby="learning-notes-title">
      <span className="learning-resource-number" aria-hidden="true">01</span>
      <h2 id="learning-notes-title">{t('Конспект')}</h2>
      <p className="learning-resource-meta">{materials.notes ? t('3 страницы') : onLegacyNotes ? '' : t('Конспект пока не добавлен.')}</p>
      {(materials.notes || onLegacyNotes) && <div className="learning-resource-actions"><button type="button" onClick={() => materials.notes ? onOpen('notes') : onLegacyNotes?.()}>{t('Читать конспект')}<ArrowUpRight aria-hidden="true"/></button></div>}
    </section>
    <section className="learning-resource" aria-labelledby="learning-trial-title">
      <span className="learning-resource-number" aria-hidden="true">02</span>
      <h2 id="learning-trial-title">{t('Пробный СОР')}</h2>
      <p className="learning-resource-meta">{materials.trial ? 'DOCX' : t('Пробный СОР пока не добавлен.')}</p>
      {materials.trial && <div className="learning-resource-actions">
        <button type="button" onClick={() => onOpen('trial')}>{t('Открыть')}<ArrowUpRight aria-hidden="true"/></button>
        {materials.trial.files.some(file => file.label === 'Ответы') && <button type="button" onClick={() => onOpen('trial', materials.trial!.files.findIndex(file => file.label === 'Ответы'))}>{t('Ответы')}<ArrowRight aria-hidden="true"/></button>}
      </div>}
    </section>
  </div>;
}

export const StudyPage: React.FC = () => {
  const { t, gradeLabel, language } = useLanguage();
  const [navigation, dispatch] = useReducer(studyNavigationReducer, initialStudyNavigation);
  const { level, grade: selectedClass, quarter: selectedQuarter, sectionId } = navigation;
  const [showTheoryModal, setShowTheoryModal] = useState<boolean>(false);
  const [showMoreTasks, setShowMoreTasks] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, boolean | null>>({});
  const [openResource, setOpenResource] = useState<{ kind: 'notes' | 'trial' | 'quarter'; index: number } | null>(null);
  const closeResource = useCallback(() => setOpenResource(null), []);

  const theoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showTheoryModal) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    theoryRef.current?.querySelector('button')?.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowTheoryModal(false);
      if (event.key !== 'Tab') return;
      const buttons = [...(theoryRef.current?.querySelectorAll<HTMLButtonElement>('button') || [])];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyDown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyDown); previous?.focus(); };
  }, [showTheoryModal]);

  const tasks = [
    {
      id: 1,
      text: 'Тело движется по прямой с ускорением 2 м/с². Какова его скорость через 5 секунд, если начальная скорость равна 10 м/с?',
      answer: '20',
      hint: 'Используйте формулу скорости при равноускоренном движении: v = v₀ + a·t',
    },
    {
      id: 2,
      text: 'Автомобиль начинает движение с места и разгоняется равномерно с ускорением 1,5 м/с². Какой путь он пройдет за 8 секунд?',
      answer: '48',
      hint: 'Для движения без начальной скорости: S = (a · t²) / 2. (1.5 * 64) / 2 = 48 м.',
    },
    {
      id: 3,
      text: 'Точка движется по окружности радиусом 10 м. Период обращения 4 с. Найдите линейную скорость точки.',
      answer: '15.7',
      hint: 'v = (2 · π · R) / T = (2 · 3.14 · 10) / 4 ≈ 15.7 м/с.',
    },
    {
      id: 4,
      text: 'Снаряд вылетает из пушки со скоростью 500 м/с под углом 30° к горизонту. Найдите вертикальную составляющую начальной скорости.',
      answer: '250',
      hint: 'v_y = v₀ · sin(30°) = 500 · 0.5 = 250 м/с.',
    },
    {
      id: 5,
      text: 'С какой высоты падало свободно тело, если время падения составило 3 секунды? (g = 10 м/с²)',
      answer: '45',
      hint: 'h = (g · t²) / 2 = (10 · 9) / 2 = 45 м.',
    },
  ];

  const handleCheckAnswer = (id: number, correctAnswer: string) => {
    const val = (answers[id] || '').trim();
    if (val === correctAnswer || parseFloat(val) === parseFloat(correctAnswer)) {
      setFeedback((prev) => ({ ...prev, [id]: true }));
    } else {
      setFeedback((prev) => ({ ...prev, [id]: false }));
    }
  };

  const sectionList = studySectionsFor(selectedClass, selectedQuarter);
  const selectedSection = sectionList.find(section => section.id === sectionId);
  const materialAvailable = hasStudyMaterial(selectedClass, sectionId);
  const materials = sectionMaterials(selectedClass, sectionId, language);
  const quarterTrial = quarterMaterial(selectedClass, selectedQuarter, language);
  const viewedResource: StudyResource | undefined = openResource?.kind === 'quarter' ? quarterTrial
    : openResource ? materials[openResource.kind] : undefined;
  const quarterLabel = selectedQuarter === null ? '' : t('{quarter} четверть', { quarter: selectedQuarter });
  const title = level === 'classes' ? t('Учёба') : level === 'material' ? t(selectedSection?.title || 'Раздел')
    : level === 'sections' && selectedQuarter !== null ? quarterLabel : gradeLabel(selectedClass);
  const backLabel = level === 'material' ? t('Все разделы')
    : level === 'sections' && hasStudyQuarters(selectedClass) ? t('Все четверти') : t('Все классы');
  const selectSection = (id: string) => {
    dispatch({ type: 'select-section', sectionId: id });
    setShowTheoryModal(false); setShowMoreTasks(false); setAnswers({}); setFeedback({});
  };

  return (
    <main className="study-page learning-editorial" data-study-level={level}>
      <div className="learning-layout">
        <header className="learning-masthead">
          <div>
            <p className="learning-eyebrow">TerenPhys / {level === 'material' ? t("Раздел") : t("Учебная библиотека")}</p>
            <h1>{title}<span>.</span></h1>
          </div>
          {level !== 'classes' && <button className="learning-back" onClick={() => dispatch({ type: 'back' })}><ArrowLeft aria-hidden="true"/>{backLabel}</button>}
        </header>

        <div className="learning-body">
        {level !== 'classes' && <nav className="learning-breadcrumbs" aria-label={t("Навигация по учебным материалам")}>
          <button onClick={() => dispatch({ type: 'classes' })}>{t("Учёба")}</button><span aria-hidden="true">/</span>
          {level === 'quarters' || (level === 'sections' && !hasStudyQuarters(selectedClass)) ? <span aria-current="page">{gradeLabel(selectedClass)}</span>
            : <button onClick={() => dispatch({ type: 'grade' })}>{gradeLabel(selectedClass)}</button>}
          {level !== 'quarters' && selectedQuarter !== null && <><span aria-hidden="true">/</span>
            {level === 'sections' ? <span aria-current="page">{quarterLabel}</span> : <button onClick={() => dispatch({ type: 'quarter' })}>{quarterLabel}</button>}
          </>}
          {level === 'material' && <><span aria-hidden="true">/</span><span aria-current="page">{t(selectedSection?.title || 'Раздел')}</span></>}
        </nav>}

        {level === 'classes' && <div className="learning-index">
          <div className="learning-list-label"><span>{t("Классы")}</span><span>{String(SCHOOL_GRADES.length).padStart(2, '0')}</span></div>
          <div className="learning-class-list" role="group" aria-label={t("Выбор класса")}>
            {SCHOOL_GRADES.map(cls => <button key={cls} className="learning-class-row" aria-label={gradeLabel(cls)}
              onClick={() => dispatch({ type: 'select-grade', grade: cls })}>
              <span className="learning-class-number">{cls}</span>
              <span className="learning-class-copy"><span>{t("класс")}</span><small>{t(CLASS_NOTES[cls])}</small></span>
              <ArrowUpRight aria-hidden="true"/>
            </button>)}
          </div>
        </div>}

        {level === 'quarters' && hasStudyQuarters(selectedClass) && <StudyQuarterList grade={selectedClass} onSelect={quarter => dispatch({ type: 'select-quarter', quarter })}/>}

        {level === 'sections' && <>
          <StudySectionList sections={sectionList} onSelect={selectSection}/>
          {selectedQuarter !== null && <div className="learning-quarter-trial"><button type="button" disabled={!quarterTrial} onClick={() => setOpenResource({ kind: 'quarter', index: 0 })}>
            <span>{t('Пробный СОЧ')}</span>{quarterTrial ? <ArrowUpRight aria-hidden="true"/> : <small>{t('Пока не добавлен')}</small>}
          </button></div>}
        </>}

        {level === 'material' && <StudyResourceCards materials={materials}
          onOpen={(kind, index = 0) => setOpenResource({ kind, index })}
          onLegacyNotes={materialAvailable ? () => setShowTheoryModal(true) : undefined}/>}

        {level === 'material' && materialAvailable && <div className="learning-lesson-grid">
          <div className="learning-main-column">
            <section className="learning-video-note" aria-label={t("Видеоурок")}>
              <Play aria-hidden="true"/><div><span className="learning-eyebrow">{t("Видеоурок")}</span><p>{t("Видео к этому разделу пока не добавлено.")}</p></div>
            </section>
            <section aria-labelledby="learning-tasks-heading">
              <div className="learning-section-heading"><h2 id="learning-tasks-heading">{t("Практика")}</h2><span>{String(tasks.length).padStart(2, '0')}{' '}{t("заданий")}</span></div>
              <div className="learning-task-list">
                {(showMoreTasks ? tasks : tasks.slice(0, 3)).map(task => <article key={task.id} className="learning-task">
                  <span className="learning-task-number">{String(task.id).padStart(2, '0')}</span>
                  <div>
                    <p>{t(task.text)}</p>
                    <form className="learning-answer" onSubmit={event => { event.preventDefault(); handleCheckAnswer(task.id, task.answer); }}>
                      <input type="text" inputMode="decimal" placeholder={t("Ваш ответ")} aria-label={t('Ответ на задание {id}', { id: task.id })}
                        value={answers[task.id] || ''} onChange={event => setAnswers({ ...answers, [task.id]: event.target.value })}/>
                      <button type="submit">{t("Проверить")}{' '}<ArrowRight aria-hidden="true"/></button>
                    </form>
                    {feedback[task.id] === true && <p role="status" className="learning-feedback learning-correct">{t("Верно. Можно двигаться дальше.")}</p>}
                    {feedback[task.id] === false && <p role="status" className="learning-feedback learning-incorrect">{t("Попробуйте ещё раз.")}{' '}{t(task.hint)}</p>}
                  </div>
                </article>)}
              </div>
              <button className="learning-more" onClick={() => setShowMoreTasks(!showMoreTasks)} aria-expanded={showMoreTasks}>
                {showMoreTasks ? t("Скрыть дополнительные задания") : t("Показать ещё задания")}<ChevronDown aria-hidden="true" style={{ transform: showMoreTasks ? 'rotate(180deg)' : undefined }}/>
              </button>
            </section>
          </div>
          <aside className="learning-lesson-aside">
            <section>
              <span className="learning-eyebrow">{t("Коротко о главном")}</span>
              <p>{t("Кинематика описывает движение тел без учёта причин, которые вызывают это движение.")}</p>
              <button className="learning-text-link" onClick={() => setShowTheoryModal(true)}>{t("Читать конспект")}{' '}<ArrowUpRight aria-hidden="true"/></button>
            </section>
            <section>
              <h2>{t("На полях")}</h2>
              <p className="learning-small">{t("Ключевые формулы")}</p>
              <div className="learning-formulas"><p>v = v₀ + a · t</p><p>S = v₀ · t + ½ a · t²</p><p>v² − v₀² = 2 · a · S</p></div>
            </section>
          </aside>
        </div>}
        </div>
      </div>

      {openResource && viewedResource && <StudyResourceViewer key={viewedResource.id} resource={viewedResource} initialIndex={openResource.index} onClose={closeResource}/>}

      {showTheoryModal && createPortal(
        <div className="learning-theory-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setShowTheoryModal(false); }}>
          <div ref={theoryRef} role="dialog" aria-modal="true" aria-labelledby="study-theory-title" className="learning-theory">
            <header><span className="learning-eyebrow">{t("TerenPhys / Конспект")}</span><button onClick={() => setShowTheoryModal(false)} aria-label={t("Закрыть конспект")}><X aria-hidden="true"/></button></header>
            <h2 id="study-theory-title">{t("Кинематика.")}</h2>
            <section><h3>{t("Основные понятия")}</h3><p>{t("Материальная точка — тело, размерами которого можно пренебречь в условиях данной задачи. Траектория — линия, вдоль которой движется тело.")}</p></section>
            <section><h3>{t("Равномерное движение")}</h3><p>{t("Скорость постоянна: v = const. Путь: s = v · t.")}</p></section>
            <section><h3>{t("Равноускоренное движение")}</h3><p>{t("Ускорение постоянно: a = const. Скорость: v(t) = v₀ + at. Перемещение: s = v₀t + at²/2.")}</p></section>
            <section><h3>{t("Движение по окружности")}</h3><p>{t("Центростремительное ускорение: a = v² / R = ω² · R. Период обращения: T = 2π / ω = 2πR / v.")}</p></section>
            <button className="learning-text-link" onClick={() => setShowTheoryModal(false)}>{t("Вернуться к заданиям")}{' '}<ArrowRight aria-hidden="true"/></button>
          </div>
        </div>, document.body,
      )}
    </main>
  );
};
