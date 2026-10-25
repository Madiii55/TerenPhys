import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { sectionMaterials } from '../src/learning/materials.ts';
import { studyLessonsFor } from '../src/learning/lessons.ts';
import { STUDY_PROGRAMME } from '../src/learning/catalogue.ts';
import { TELEGRAM_STUDY_CATALOGUE } from '../src/learning/telegramCatalogue.ts';

const require = createRequire(import.meta.url);
let compiled: Promise<Record<string, any>> | undefined;
function components() {
  return compiled ??= (async () => {
    const result = await build({ stdin: { contents: `
      export {default as Content, outlineLesson, lessonText} from './src/components/StudyLessonContent.tsx';
      export {default as Lesson} from './src/components/StudyLesson.tsx';
      export {StudyPage} from './src/components/StudyPage.tsx';
      export {LanguageProvider, useLanguage} from './src/i18n/LanguageContext.tsx';
    `, resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx' },
      bundle: true, write: false, platform: 'node', format: 'cjs',
      external: ['react', 'react-dom', 'react-dom/*', 'pdfjs-dist', 'pdfjs-dist/*'], loader: { '.css': 'empty' },
    });
    const module = { exports: {} as Record<string, any> };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
    return module.exports;
  })();
}

test('every existing note original has an explicit native reading edition in its own language and quarter', () => {
  for (const language of ['ru', 'kk'] as const) {
    const originalUrls = new Set<string>();
    for (const grade of [7,8,9,10,11] as const) for (const quarter of [1,2,3,4] as const) {
      for (const section of STUDY_PROGRAMME[grade][quarter]) {
        const notes = sectionMaterials(grade, section.id, language).notes;
        const lessons = studyLessonsFor(grade, section.id, language, notes);
        if (quarter !== 1) assert.deepEqual(lessons, []);
        if (!notes) continue;
        assert.ok(lessons.length > 0, section.id);
        for (const lesson of lessons) {
          assert.ok(lesson.content, `reading edition missing: ${lesson.id}`);
          assert.ok(lesson.language === language || lesson.language === 'en');
          for (const file of lesson.originals) {
            assert.ok(notes.files.includes(file), 'an edition retains its exact original metadata');
            originalUrls.add(file.url);
          }
        }
        for (const file of notes.files) assert.ok(lessons.some(lesson => lesson.originals.includes(file)), file.url);
      }
    }
    for (const entry of TELEGRAM_STUDY_CATALOGUE.filter(entry => entry.kind === 'notes' && (entry.language === language || entry.language === 'en'))) {
      assert.ok([...originalUrls].some(url => url.endsWith(entry.path!)), entry.id);
    }
    assert.deepEqual(studyLessonsFor(12, '12-mechanics', language), []);
    assert.deepEqual(studyLessonsFor(7, '8.1A', language, sectionMaterials(8, '8.1A', language).notes), []);
    const kinematics = studyLessonsFor(9, '9.1B', language, sectionMaterials(9, '9.1B', language).notes);
    assert.equal(kinematics[0].content, 'motion9-kinematics', 'the full source is the default');
    assert.equal(kinematics[1].content, 'kinematics-summary');
  }
});

test('assistant extraction keeps native formulas and captions once while omitting accessibility duplicates and input values', async () => {
  const { lessonText } = await components();
  const node = React.createElement('section', {},
    React.createElement('p', {}, 'v = v', React.createElement('sub', {}, '0'), ' + at', React.createElement('sup', {}, '2')),
    React.createElement('figure', {}, React.createElement('img', { alt: 'Repeated caption' }), React.createElement('figcaption', {}, 'Unique caption')),
    React.createElement('span', { 'aria-hidden': true }, 'accessibility duplicate'),
    React.createElement('annotation', {}, 'MathML duplicate'),
    React.createElement('input', { value: 'private-answer', readOnly: true }),
    React.createElement('p', { 'aria-label': 'aria duplicate' }, 'Visible explanation'));
  const text = lessonText(node);
  assert.match(text, /v = v_\(0\) \+ at\^\(2\)/);
  assert.equal(text.match(/Unique caption/g)?.length, 1);
  assert.match(text, /Visible explanation/);
  assert.doesNotMatch(text, /Repeated caption|accessibility duplicate|MathML duplicate|private-answer|aria duplicate/);
});

test('reading editions preserve all source sections, tables, figures and substantial native text, with working outline targets', async () => {
  const { Content, LanguageProvider } = await components();
  const expectations = [
    { grade: 8, section: '8.1A', headings: 6, tables: 2, figures: 0, minText: 2400 },
    { grade: 7, section: '7.1B', headings: 27, tables: 8, figures: 10, minText: 7300 },
    { grade: 9, section: '9.1A', headings: 5, tables: 0, figures: 7, minText: 2300 },
    { grade: 9, section: '9.1B', headings: 28, tables: 1, figures: 10, minText: 9700 },
    { grade: 11, section: '11.1B', headings: 23, tables: 2, figures: 5, minText: 10000 },
  ];
  for (const language of ['ru', 'kk'] as const) for (const expected of expectations) {
    const lesson = studyLessonsFor(expected.grade, expected.section, language, sectionMaterials(expected.grade, expected.section, language).notes)[0];
    const markup = renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: language }, React.createElement(Content, { lesson })));
    const dom = new JSDOM(markup), document = dom.window.document;
    try {
      const prose = document.querySelector('.study-lesson-prose')!;
      assert.equal(prose.querySelectorAll('h3').length, expected.headings, lesson.id);
      assert.equal(prose.querySelectorAll('table').length, expected.tables, lesson.id);
      assert.equal(prose.querySelectorAll('figure').length, expected.figures, lesson.id);
      assert.ok(prose.textContent!.length >= expected.minText, lesson.id + ': incomplete source text');
      assert.equal(prose.querySelector('iframe,canvas,object,embed'), null);
      for (const table of prose.querySelectorAll<HTMLElement>('.study-lesson-table')) {
        assert.equal(table.tabIndex,0); assert.ok(table.getAttribute('aria-label'));
      }
      assert.equal(document.querySelector('details')!.open, expected.headings <= 8);
      if (expected.grade === 9) for (const heading of prose.querySelectorAll('h3')) assert.doesNotMatch(heading.textContent!, /^\d+\./);
      const headings = [...prose.querySelectorAll('h3')];
      const links = [...document.querySelectorAll<HTMLAnchorElement>('.study-lesson-outline a')];
      assert.deepEqual(links.map(link => link.hash.slice(1)), headings.map(heading => heading.id));
      assert.equal(new Set(headings.map(heading => heading.id)).size, headings.length);
      for (const image of prose.querySelectorAll('img')) {
        const path = image.getAttribute('src')!;
        assert.ok(path.startsWith('/study/lessons/'));
        assert.ok(image.alt.length > 10);
        assert.ok(existsSync(new URL('../public' + path, import.meta.url)), path);
      }
      if (lesson.content === 'motion9-kinematics') {
        assert.match(prose.textContent!, /17 м\/с/);
        assert.match(prose.textContent!, /13 м\/с/);
        assert.match(prose.textContent!, language === 'ru' ? /сопротивление воздуха/ : /ауа кедергі/);
        assert.ok(prose.querySelectorAll('ol li').length >= 21, 'experimental and scientific-method steps survive');
      }
      if (lesson.content === 'motion11') {
        assert.match(prose.textContent!, /negative acceleration does not necessarily mean/);
        assert.match(prose.textContent!, /same vertical level/);
        assert.match(prose.textContent!, /Δx = 36 m/);
        assert.match(prose.textContent!, /v = 13 m\/s/);
      }
    } finally { dom.window.close(); }
  }
});

function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/', pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return { dom, restore() { dom.window.close(); for (const [key, value] of previous) {
    if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
  } } };
}

test('multiple native notes select the complete source first, English stays explicit, and unknown future formats stay honest', async () => {
  const ui = await components(), env = environment();
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  const render = async (grade: number, sectionId: string, language: 'ru' | 'kk', materials = sectionMaterials(grade, sectionId, language)) => act(async () => {
    root.render(React.createElement(ui.LanguageProvider, { key: language, initialLanguage: language },
      React.createElement(ui.Lesson, { key: `${sectionId}-${language}`, grade, sectionId, materials, onOpenTrial() {} })));
    await new Promise(resolve => setTimeout(resolve, 10));
  });
  try {
    await render(9, '9.1B', 'ru');
    assert.equal(document.querySelectorAll('.study-lesson-prose h3').length, 28);
    assert.equal(document.querySelector('iframe,canvas,[role="dialog"]'), null);
    const select = document.querySelector<HTMLSelectElement>('#study-lesson-select')!;
    await act(() => { select.value = '9.1B-ru-summary'; select.dispatchEvent(new env.dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelectorAll('.study-lesson-prose h3').length, 4);
    assert.match(document.querySelector('.study-lesson-prose')!.textContent!, /Материальная точка/);
    await render(11, '11.1B', 'kk');
    assert.equal(document.querySelector<HTMLElement>('article')!.lang, 'en');
    assert.match(document.querySelector('.study-lesson-header')!.textContent!, /English/);
    assert.match(document.querySelector('.study-lesson-prose')!.textContent!, /Basic Kinematic Quantities/);
    assert.equal(document.querySelector('[data-einstein="study-trial"]'), null);
    assert.match(document.querySelector('#study-trial')!.textContent!, /әзірге қосылмаған/);
    await render(7, '7.1B', 'ru', { notes: { id: 'future', code: '7.1B', title: 'Конспект', files: [{
      url: '/future.docx', format: 'docx', downloadName: 'future.docx', label: 'Конспект',
    }] } });
    assert.equal(document.querySelector('.study-lesson-prose'), null);
    assert.match(document.querySelector('#study-notes')!.textContent!, /Текстовая версия этого конспекта пока не подготовлена/);
    assert.equal(document.querySelector('a[download]')!.getAttribute('href'), '/future.docx');
  } finally { await act(() => root.unmount()); env.restore(); }
});

test('a newly selected section starts at the beginning and language changes replace the previous native text', async () => {
  const ui = await components(), env = environment();
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  const scrolls: ScrollToOptions[] = [];
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 1600 });
  window.scrollTo = ((options: ScrollToOptions) => { scrolls.push(options); Object.defineProperty(window, 'scrollY', { value: options.top || 0 }); }) as typeof window.scrollTo;
  const Switch = () => {
    const { language, setLanguage } = ui.useLanguage();
    return React.createElement('button', { id: 'language-switch', onClick: () => setLanguage(language === 'ru' ? 'kk' : 'ru') }, 'switch');
  };
  const click = (selector: string) => act(async () => {
    document.querySelector<HTMLButtonElement>(selector)!.click(); await new Promise(resolve => setTimeout(resolve, 10));
  });
  try {
    await act(() => root.render(React.createElement(ui.LanguageProvider, { initialLanguage: 'ru' }, React.createElement(ui.StudyPage), React.createElement(Switch))));
    await click('[data-einstein="grade-8"]');
    await click('[data-einstein="quarter-1"]');
    await click('[data-einstein="section-8.1A"]');
    assert.deepEqual(scrolls, [{ left: 0, top: 0, behavior: 'instant' }]);
    assert.match(document.querySelector('.study-lesson-prose')!.textContent!, /Броуновское движение/);
    await click('#language-switch');
    assert.match(document.querySelector('.study-lesson-prose')!.textContent!, /Броундық қозғалыс/);
    assert.doesNotMatch(document.querySelector('.study-lesson-prose')!.textContent!, /Броуновское движение/);
    assert.equal(scrolls.length, 1, 'changing language does not restart lesson navigation');
  } finally { await act(() => root.unmount()); env.restore(); }
});

test('reading styles keep a single readable column, responsive tables, light diagram insets and header-safe anchors', () => {
  const css = readFileSync(new URL('../src/styles/study-materials.css', import.meta.url), 'utf8');
  assert.match(css, /max-width:820px/);
  assert.match(css, /study-lesson-prose\s*\{[^}]*17px\/1\.8/);
  assert.match(css, /study-lesson-table\s*\{[^}]*overflow-x:auto/);
  assert.match(css, /study-lesson-prose figure\s*\{[^}]*background:#f5f8fc/);
  assert.match(css, /scroll-margin-top:calc\(var\(--site-header-height,80px\) \+ 28px\)/);
});
