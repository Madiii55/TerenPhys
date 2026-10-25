import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, ArrowLeft, BookOpen, ClipboardCheck } from 'lucide-react';
import { SCHOOL_GRADES, STUDY_QUARTERS, STUDY_PROGRAMME, CLASS_NOTES, hasStudyMaterial, hasStudyQuarters, isSchoolGrade, studySectionsFor, type QuarteredGrade, type StudyQuarter, type StudySection } from '../learning/catalogue.ts';
import { initialStudyNavigation, studyNavigationReducer } from '../learning/navigation.ts';
import { quarterMaterial, quarterSectionTrial, sectionMaterials, quarterMaterialAvailability, sectionMaterialAvailability, type MaterialAvailability, type StudyResource } from '../learning/materials.ts';
import StudyResourceViewer from './StudyResourceViewer.tsx';
import StudyLesson from './StudyLesson.tsx';
import '../styles/learning.css';
import '../styles/study-materials.css';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import { isGuideActionId, type GuideActionId, type StudyGuideContext, type EinsteinLessonContext } from '../einstein/protocol.ts';
import type { StudyGuideAction } from '../einstein/guide.ts';

const KINEMATICS_TASKS = [
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

function MaterialStatus({ id, availability }: { id: string; availability: MaterialAvailability }) {
  const { t } = useLanguage();
  return <span id={id} className="learning-material-status">
    {availability.notes && <span className="learning-material-icon learning-notes-icon" data-material="notes" title={t('Есть конспекты')}>
      <BookOpen aria-hidden="true"/><span className="learning-material-description">{t('Есть конспекты')}</span>
    </span>}
    {availability.trials && <span className="learning-material-icon learning-trials-icon" data-material="trials" title={t('Есть пробники')}>
      <ClipboardCheck aria-hidden="true"/><span className="learning-material-description">{t('Есть пробники')}</span>
    </span>}
    {!availability.notes && !availability.trials && <span className="learning-material-description">{t('Материалы пока не добавлены')}</span>}
  </span>;
}

export function StudyQuarterList({ grade, onSelect }: { grade: QuarteredGrade; onSelect: (quarter: StudyQuarter) => void }) {
  const { t, language } = useLanguage();
  return <div className="learning-index">
    <div className="learning-list-label"><span>{t('Четверти')}</span><span>{t('Разделы')}</span></div>
    <div className="learning-quarter-list" data-einstein="study-quarters" role="group" aria-label={t('Выбор четверти')}>
      {STUDY_QUARTERS.map((quarter, index) => <button key={quarter} className="learning-class-row learning-quarter-row"
        data-einstein={`quarter-${quarter}`}
        style={{ '--learning-order': index } as React.CSSProperties}
        aria-label={t('{quarter} четверть', { quarter })} aria-describedby={`study-quarter-materials-${grade}-${quarter}`} onClick={() => onSelect(quarter)}>
        <span className="learning-class-number">{quarter}</span>
        <span className="learning-class-copy"><span>{t('четверть')}</span></span>
        <MaterialStatus id={`study-quarter-materials-${grade}-${quarter}`} availability={quarterMaterialAvailability(grade, quarter, language)}/>
        <span className="learning-quarter-count" aria-hidden="true">{String(STUDY_PROGRAMME[grade][quarter].length).padStart(2, '0')}</span>
        <ArrowUpRight aria-hidden="true"/>
      </button>)}
    </div>
  </div>;
}

export function StudySectionList({ sections, onSelect }: { sections: readonly StudySection[]; onSelect: (sectionId: string) => void }) {
  const { t, language } = useLanguage();
  return <div className="learning-index learning-catalogue">
    <div className="learning-contents" data-einstein="study-sections" role="group" aria-label={t('Выбор раздела')}>
      <div className="learning-list-label"><span>{t('Разделы')}</span><span>{String(sections.length).padStart(2, '0')}</span></div>
      {sections.map((section, index) => <button key={section.id} className="learning-content-row"
        data-einstein={`section-${section.id}`}
        style={{ '--learning-order': index } as React.CSSProperties}
        aria-label={section.id.startsWith('12-') ? t(section.title) : section.id + ' — ' + t(section.title)}
        aria-describedby={`study-section-materials-${section.id}`}
        onClick={() => onSelect(section.id)}>
        <span className="learning-item-number learning-section-code">{section.id.startsWith('12-') ? String(index + 1).padStart(2, '0') : section.id}</span>
        <span className="learning-section-title">{t(section.title)}</span>
        <MaterialStatus id={`study-section-materials-${section.id}`} availability={sectionMaterialAvailability(Number(section.id.split('.')[0]), section.id, language)}/>
        <ArrowRight aria-hidden="true"/>
      </button>)}
    </div>
  </div>;
}

interface StudyPageProps {
  active?: boolean;
  onContextChange?: (context: StudyGuideContext) => void;
  guideAction?: StudyGuideAction | null;
  onAskEinstein?: (question: string) => void;
}

export const StudyPage: React.FC<StudyPageProps> = ({ active = true, onContextChange, guideAction, onAskEinstein }) => {
  const { t, gradeLabel, language } = useLanguage();
  const [navigation, dispatch] = useReducer(studyNavigationReducer, initialStudyNavigation);
  const { level, grade: selectedClass, quarter: selectedQuarter, sectionId } = navigation;
  const lessonKey = `${sectionId}-${language}`;
  const [lessonContext, setLessonContext] = useState<{ key: string; lesson: EinsteinLessonContext | undefined }>();
  const onLessonContext = useCallback((lesson: EinsteinLessonContext | undefined) => setLessonContext({ key: lessonKey, lesson }), [lessonKey]);
  useLayoutEffect(() => {
    if (level === 'material' && window.scrollY > 0) window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  }, [level, selectedClass, selectedQuarter, sectionId]);
  const [showMoreTasks, setShowMoreTasks] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, boolean | null>>({});
  const [openResource, setOpenResource] = useState<{ kind: 'trial' | 'quarter' | 'quarterTrial'; index: number } | null>(null);
  const closeResource = useCallback(() => setOpenResource(null), []);
  const contextCallback = useRef(onContextChange);
  contextCallback.current = onContextChange;
  const handledGuideRequest = useRef(-1);
  useEffect(() => {
    if (!active) setOpenResource(null);
  }, [active]);

  const handleCheckAnswer = (id: number, correctAnswer: string) => {
    const val = (answers[id] || '').trim();
    setFeedback((prev) => ({ ...prev, [id]: val === correctAnswer || parseFloat(val) === parseFloat(correctAnswer) }));
  };

  const sectionList = studySectionsFor(selectedClass, selectedQuarter);
  const selectedSection = sectionList.find(section => section.id === sectionId);
  const materialAvailable = hasStudyMaterial(selectedClass, sectionId);
  const materials = sectionMaterials(selectedClass, sectionId, language);
  const quarterTrial = quarterMaterial(selectedClass, selectedQuarter, language);
  const unassignedTrial = quarterSectionTrial(selectedClass, selectedQuarter, language);
  const viewedResource: StudyResource | undefined = openResource?.kind === 'quarter' ? quarterTrial
    : openResource?.kind === 'quarterTrial' ? unassignedTrial
    : openResource ? materials[openResource.kind] : undefined;
  const quarterLabel = selectedQuarter === null ? '' : t('{quarter} четверть', { quarter: selectedQuarter });
  const title = level === 'classes' ? t('Учёба') : level === 'material' ? t(selectedSection?.title || 'Раздел')
    : level === 'sections' && selectedQuarter !== null ? quarterLabel : gradeLabel(selectedClass);
  const backLabel = level === 'material' ? t('Все разделы')
    : level === 'sections' && hasStudyQuarters(selectedClass) ? t('Все четверти') : t('Все классы');
  const selectSection = (id: string) => {
    dispatch({ type: 'select-section', sectionId: id });
    setOpenResource(null); setShowMoreTasks(false); setAnswers({}); setFeedback({});
  };

  const availableActions: GuideActionId[] = level === 'classes'
    ? SCHOOL_GRADES.map(grade => `select-grade-${grade}` as GuideActionId)
    : level === 'quarters' && hasStudyQuarters(selectedClass)
      ? STUDY_QUARTERS.map(quarter => `select-quarter-${quarter}` as GuideActionId)
      : level === 'sections'
        ? [...(quarterTrial ? ['show-quarter-exam' as const] : []), ...(unassignedTrial ? ['show-trial' as const] : [])]
        : level === 'material'
          ? [...(materials.notes || materialAvailable ? ['show-notes' as const] : []),
            ...(materials.trial ? ['show-trial' as const] : []), ...(materialAvailable ? ['show-practice' as const] : [])]
          : [];
  const publicContext: StudyGuideContext = {
    studyLevel: level,
    ...(level !== 'classes' ? { grade: selectedClass } : {}),
    ...(level !== 'classes' && level !== 'quarters' && selectedQuarter !== null ? { quarter: selectedQuarter } : {}),
    ...(level === 'material' && selectedSection ? { sectionId: selectedSection.id, topic: t(selectedSection.title) } : {}),
    ...(level === 'material' ? { view: openResource ? openResource.kind === 'quarter' ? 'quarter-exam' as const : 'trial' as const : 'notes' as const } : {}),
    ...(level === 'material' && !openResource && lessonContext?.key === lessonKey && lessonContext.lesson ? { lesson: lessonContext.lesson } : {}),
    availableActions,
  };
  const contextSignature = JSON.stringify(publicContext);
  useEffect(() => { if (active) contextCallback.current?.(publicContext); }, [active, contextSignature]);
  useEffect(() => {
    if (!active || !guideAction || !Number.isSafeInteger(guideAction.requestId)
      || guideAction.requestId <= handledGuideRequest.current || !isGuideActionId(guideAction.id)) return;
    handledGuideRequest.current = guideAction.requestId;
    const id = guideAction.id;
    if (id === 'navigate-study') {
      dispatch({ type: 'classes' }); setOpenResource(null);
      return;
    }
    if (!availableActions.includes(id)) return;
    const grade = /^select-grade-(7|8|9|10|11|12)$/.exec(id);
    if (grade && isSchoolGrade(Number(grade[1]))) {
      dispatch({ type: 'select-grade', grade: Number(grade[1]) as typeof selectedClass });
      return;
    }
    const quarter = /^select-quarter-([1-4])$/.exec(id);
    if (quarter && hasStudyQuarters(selectedClass)) {
      dispatch({ type: 'select-quarter', quarter: Number(quarter[1]) as StudyQuarter });
      return;
    }
    if (id === 'show-notes') {
      const notes = document.getElementById('study-notes');
      notes?.scrollIntoView?.({ block: 'start' });
      notes?.focus({ preventScroll: true });
    } else if (id === 'show-trial') {
      if (level === 'sections' && unassignedTrial) setOpenResource({ kind: 'quarterTrial', index: 0 });
      else if (level === 'material' && materials.trial) setOpenResource({ kind: 'trial', index: 0 });
    } else if (id === 'show-quarter-exam' && quarterTrial) setOpenResource({ kind: 'quarter', index: 0 });
  }, [active, guideAction, contextSignature]);

  return (
    <main className="study-page learning-editorial" data-study-level={level}>
      <div className="learning-layout" key={`${level}-${selectedClass}-${selectedQuarter}-${sectionId}`}>
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
          <div className="learning-class-list" data-einstein="study-grades" role="group" aria-label={t("Выбор класса")}>
            {SCHOOL_GRADES.map((cls, index) => <button key={cls} className="learning-class-row" aria-label={gradeLabel(cls)}
              data-einstein={`grade-${cls}`}
              style={{ '--learning-order': index } as React.CSSProperties}
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
          {selectedQuarter !== null && <div className="learning-quarter-trial"><button type="button" data-einstein="study-quarter-exam" disabled={!quarterTrial} onClick={() => setOpenResource({ kind: 'quarter', index: 0 })}>
            <span>{t('Пробный СОЧ')}</span>{quarterTrial ? <ArrowUpRight aria-hidden="true"/> : <small>{t('Пока не добавлен')}</small>}
          </button></div>}
          {unassignedTrial && <div className="learning-quarter-trial"><button type="button" data-einstein="study-trial" onClick={() => setOpenResource({ kind: 'quarterTrial', index: 0 })}>
            <span>{t('Пробный СОР за четверть')}</span><ArrowUpRight aria-hidden="true"/>
          </button><p className="learning-resource-meta">{t('Раздел в источнике не уточнён.')}</p></div>}
        </>}

        {level === 'material' && <StudyLesson key={`${sectionId}-${language}`} grade={selectedClass} sectionId={sectionId} materials={materials}
          active={active && !openResource} onContextChange={onLessonContext}
          onOpenTrial={(index = 0) => setOpenResource({ kind: 'trial', index })}/>}

        {level === 'material' && materialAvailable && <div className="learning-lesson-grid">
          <div className="learning-main-column">
            <section data-einstein="study-practice" aria-labelledby="learning-tasks-heading">
              <div className="learning-section-heading"><h2 id="learning-tasks-heading">{t("Практика")}</h2><span>{String(KINEMATICS_TASKS.length).padStart(2, '0')}{' '}{t("заданий")}</span></div>
              <div className="learning-task-list">
                {(showMoreTasks ? KINEMATICS_TASKS : KINEMATICS_TASKS.slice(0, 3)).map(task => <article key={task.id} className="learning-task">
                  <span className="learning-task-number">{String(task.id).padStart(2, '0')}</span>
                  <div>
                    <p>{t(task.text)}</p>
                    <form className="learning-answer" onSubmit={event => { event.preventDefault(); handleCheckAnswer(task.id, task.answer); }}>
                      <input type="text" inputMode="decimal" placeholder={t("Ваш ответ")} aria-label={t('Ответ на задание {id}', { id: task.id })}
                        value={answers[task.id] || ''} onChange={event => setAnswers({ ...answers, [task.id]: event.target.value })}/>
                      <button type="submit">{t("Проверить")}{' '}<ArrowRight aria-hidden="true"/></button>
                      {onAskEinstein && <button type="button" className="learning-text-link" onClick={() => onAskEinstein(t('Помоги разобраться в задаче: {text}. Сначала дай подсказку и объясни, с чего начать.', { text: t(task.text) }))}>
                        {t('Помощь Эйнштейна')}<ArrowUpRight aria-hidden="true"/>
                      </button>}
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
        </div>}
        </div>
      </div>

      {openResource && viewedResource && <StudyResourceViewer key={viewedResource.id} resource={viewedResource} initialIndex={openResource.index} onClose={closeResource}/>}

    </main>
  );
};
