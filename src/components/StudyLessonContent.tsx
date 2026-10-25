import { Children, cloneElement, Fragment, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '../i18n/LanguageContext.tsx';
import type { StudyLesson } from '../learning/lessons.ts';
import { ThermalLesson } from '../learning/lessons/thermal.tsx';
import { Motion7Lesson } from '../learning/lessons/motion7.tsx';
import { Motion9Lesson } from '../learning/lessons/motion9.tsx';
import { Motion11Lesson } from '../learning/lessons/motion11.tsx';
import { lessonExcerpt, type LessonFragment } from '../einstein/lessonContext.ts';
import type { EinsteinLessonContext } from '../einstein/protocol.ts';

type OutlineEntry = Readonly<{ id: string; title: string }>;
const textOf = (node: ReactNode): string => Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child)
  ? textOf(child.props.children) : typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');

/** Read the immutable teaching tree, never DOM text, aria labels, image alt text or form values. */
export function lessonText(node: ReactNode): string {
  const read = (value: ReactNode): string => Children.toArray(value).map(child => {
    if (!isValidElement<{ children?: ReactNode; caption?: string; 'aria-hidden'?: boolean | 'true' }>(child)) return typeof child === 'string' || typeof child === 'number' ? String(child) : '';
    if (child.props['aria-hidden'] === true || child.props['aria-hidden'] === 'true'
      || ['img', 'svg', 'annotation', 'annotation-xml', 'input', 'textarea', 'button'].includes(String(child.type))) return '';
    // The English edition's pure Diagram component stores its visible caption here.
    const content = typeof child.type === 'function' && child.props.caption ? child.props.caption : read(child.props.children);
    if (child.type === 'sup') return '^(' + content + ')';
    if (child.type === 'sub') return '_(' + content + ')';
    return content + (/^(p|li|tr|h[3-6]|figcaption|div|section)$/.test(String(child.type)) ? '\n' : /^(td|th)$/.test(String(child.type)) ? ' | ' : '');
  }).join('');
  return read(node).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const flatChildren = (node: ReactNode): ReactNode[] => Children.toArray(node).flatMap(child => isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment ? flatChildren(child.props.children) : [child]);

/** Build both the outline and heading IDs from the same immutable content tree.
 * IDs depend on the selected reading edition and heading order, not translated slugs.
 */
export function outlineLesson(node: ReactNode, prefix: string) {
  const outline: OutlineEntry[] = [];
  const fragments: LessonFragment[] = [];
  const walk = (children: ReactNode): ReactNode => Children.map(children, child => {
    if (!isValidElement<{ children?: ReactNode; id?: string; tabIndex?: number }>(child)) return child;
    if (child.type === 'h3') {
      const id = `${prefix}-part-${outline.length + 1}`;
      outline.push({ id, title: textOf(child.props.children) });
      return cloneElement(child, { id, tabIndex: -1 });
    }
    if (child.type === 'section') {
      const parts = flatChildren(child.props.children);
      const heading = parts.find(part => isValidElement(part) && part.type === 'h3');
      if (heading) {
        const id = `${prefix}-part-${outline.length + 1}`;
        const blocks: LessonFragment['blocks'][number][] = [];
        const content = parts.map((part, index) => {
          if (isValidElement(part) && part.type === 'h3') return walk(part);
          const text = lessonText(part), blockId = `${id}-block-${index}`;
          if (text) blocks.push({ id: blockId, text });
          return <div key={blockId} id={blockId} className="study-lesson-block">{part}</div>;
        });
        fragments.push({ id, title: textOf(heading), blocks });
        return cloneElement(child, {}, content);
      }
    }
    return child.props.children === undefined ? child : cloneElement(child, {}, walk(child.props.children));
  });
  const content = walk(node);
  return { content, outline, fragments };
}

export default function StudyLessonContent({ lesson, active = true, onContextChange }: { lesson: StudyLesson; active?: boolean; onContextChange?: (context: EinsteinLessonContext) => void }) {
  const { t } = useLanguage();
  const language = lesson.language === 'en' ? 'ru' : lesson.language;
  const callback = useRef(onContextChange); callback.current = onContextChange;
  const prose = useRef<HTMLDivElement>(null);
  const reading = useMemo(() => {
  const content = lesson.content === 'thermal' ? ThermalLesson({ language })
    : lesson.content === 'motion7' ? Motion7Lesson({ language })
    : lesson.content === 'motion9-vectors' ? Motion9Lesson({ language, sectionId: '9.1A' })
    : lesson.content === 'motion9-kinematics' ? Motion9Lesson({ language, sectionId: '9.1B' })
    : lesson.content === 'motion11' ? Motion11Lesson()
    : <>
      <section><h3>{t('Основные понятия')}</h3><p>{t('Материальная точка — тело, размерами которого можно пренебречь в условиях данной задачи. Траектория — линия, вдоль которой движется тело.')}</p></section>
      <section><h3>{t('Равномерное движение')}</h3><p>{t('Скорость постоянна: v = const. Путь: s = v · t.')}</p></section>
      <section><h3>{t('Равноускоренное движение')}</h3><p>{t('Ускорение постоянно: a = const. Скорость: v(t) = v₀ + at. Перемещение: s = v₀t + at²/2.')}</p></section>
      <section><h3>{t('Движение по окружности')}</h3><p>{t('Центростремительное ускорение: a = v² / R = ω² · R. Период обращения: T = 2π / ω = 2πR / v.')}</p></section>
    </>;
    return outlineLesson(content, lesson.id);
  }, [lesson.id, lesson.content, language, t]);
  const signature = JSON.stringify(reading.fragments);
  useEffect(() => {
    if (!active) return;
    const metadata = { id: lesson.id, title: t(lesson.title).slice(0, 180), language: lesson.language };
    let last = '', frame = 0;
    const publish = (fragment?: LessonFragment, blockIndex = 0) => {
      const excerpt = fragment ? lessonExcerpt(fragment, blockIndex) : '';
      const context = { ...metadata, ...(fragment && excerpt ? { sectionTitle: fragment.title.slice(0, 180), excerpt } : {}) };
      const key = JSON.stringify(context);
      if (last !== key) { last = key; callback.current?.(context); }
    };
    publish(reading.fragments[0]);
    const update = () => {
      frame = 0;
      const container = prose.current, viewport = window.innerHeight;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      // Zero rectangles occur in non-layout test environments; real offscreen content is omitted.
      if (bounds.height <= 0) return;
      const header = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--site-header-height')) || 80;
      const top = Math.min(viewport - 1, header + 24);
      if (bounds.bottom <= top || bounds.top >= viewport) { publish(); return; }
      const line = top + Math.min(120, (viewport - top) * .25);
      let fragment = reading.fragments[0];
      for (const candidate of reading.fragments) {
        const heading = document.getElementById(candidate.id);
        if (heading && heading.getBoundingClientRect().top <= line) fragment = candidate;
        else break;
      }
      if (!fragment) { publish(); return; }
      let blockIndex = 0;
      fragment.blocks.forEach((block, index) => {
        const element = document.getElementById(block.id);
        if (element && element.getBoundingClientRect().top <= line) blockIndex = index;
      });
      publish(fragment, blockIndex);
    };
    const queue = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
    if (prose.current) observer?.observe(prose.current);
    window.addEventListener('scroll', queue, { passive: true }); window.addEventListener('resize', queue);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue); };
  }, [active, lesson.id, lesson.title, lesson.language, signature]);
  const [outlineOpen, setOutlineOpen] = useState(() => (typeof window === 'undefined' || window.innerWidth >= 700) && reading.outline.length <= 8);
  return <>
    {reading.outline.length > 1 && <details className="study-lesson-outline" open={outlineOpen} onToggle={event => setOutlineOpen(event.currentTarget.open)}>
      <summary>{t('В этом конспекте')}</summary>
      <nav aria-label={t('Оглавление конспекта')}><ol>{reading.outline.map(heading => <li key={heading.id}>
        <a href={`#${heading.id}`} onClick={event => {
          event.preventDefault();
          const target = document.getElementById(heading.id);
          target?.scrollIntoView?.({ block: 'start' });
          target?.focus({ preventScroll: true });
        }}>{heading.title}</a>
      </li>)}</ol></nav>
    </details>}
    <div ref={prose} className="study-lesson-prose">{reading.content}</div>
  </>;
}
