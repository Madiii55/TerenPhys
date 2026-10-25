import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { guideTargetFor, safeHighlightBounds, type StudyGuideAction } from '../src/einstein/guide.ts';
import type { StudyGuideContext } from '../src/einstein/protocol.ts';

test('guide lookup accepts fixed action IDs only and ignores hidden, inert and disabled copies', () => {
  const dom = new JSDOM(`<div hidden><button data-einstein="grade-8"></button></div>
    <div inert><button data-einstein="grade-8"></button></div>
    <button disabled data-einstein="grade-8"></button>
    <div style="display:none"><button data-einstein="grade-8"></button></div>
    <button id="visible" data-einstein="grade-8"></button>`);
  try {
    for (const button of dom.window.document.querySelectorAll('button')) {
      button.getBoundingClientRect = () => ({ left: 12, top: 20, width: 90, height: 40 } as DOMRect);
    }
    assert.equal(guideTargetFor('select-grade-8', dom.window.document)?.id, 'visible');
    for (const action of ['[data-einstein="grade-8"]', 'constructor', 'select-grade-13', 'show-notes"] input', { id: 'select-grade-8' }]) {
      assert.equal(guideTargetFor(action, dom.window.document), null);
    }
    dom.window.document.getElementById('visible')!.setAttribute('aria-hidden', 'true');
    assert.equal(guideTargetFor('select-grade-8', dom.window.document), null);
  } finally { dom.window.close(); }
});

test('highlight bounds stay inside the viewport and reject invisible or nonfinite targets', () => {
  const viewport = { width: 100, height: 80 };
  assert.deepEqual(safeHighlightBounds({ left: -5, top: -3, width: 80, height: 50 }, viewport),
    { left: 0, top: 0, width: 83, height: 55 });
  assert.deepEqual(safeHighlightBounds({ left: 90, top: 70, width: 50, height: 50 }, viewport),
    { left: 82, top: 62, width: 18, height: 18 });
  for (const rect of [{ left: 101, top: 0, width: 20, height: 20 }, { left: 0, top: -30, width: 20, height: 20 },
    { left: 0, top: 0, width: 0, height: 20 }, { left: NaN, top: 0, width: 20, height: 20 },
    { left: 0, top: 0, width: Infinity, height: 20 }]) assert.equal(safeHighlightBounds(rect, viewport), null);
  assert.equal(safeHighlightBounds({ left: 0, top: 0, width: 20, height: 20 }, { width: 0, height: 80 }), null);
});

let compiled: Promise<Record<string, React.ComponentType<any>>> | undefined;
function components() {
  return compiled ??= (async () => {
    const result = await build({
      stdin: { contents: "export { StudyPage } from './src/components/StudyPage.tsx'; export { LanguageProvider } from './src/i18n/LanguageContext.tsx';", resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
      bundle: true, write: false, platform: 'node', format: 'cjs',
      external: ['react', 'react/*', 'react-dom', 'react-dom/*', 'pdfjs-dist', 'pdfjs-dist/*'], loader: { '.css': 'empty' },
    });
    const module = { exports: {} as Record<string, React.ComponentType<any>> };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    return module.exports;
  })();
}

async function studyFixture() {
  const ui = await components();
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/', pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  const contexts: StudyGuideContext[] = [];
  const questions: string[] = [];
  const scrolled: string[] = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this.id); };
  const contextChanged = (context: StudyGuideContext) => { contexts.push(context); };
  let action: StudyGuideAction | null = null;
  let active = true;
  const render = () => act(() => root.render(React.createElement(ui.LanguageProvider, { initialLanguage: 'ru' },
    React.createElement(ui.StudyPage, { active, onContextChange: contextChanged, guideAction: action, onAskEinstein: (question: string) => { questions.push(question); } }))));
  return {
    dom, contexts, questions, scrolled,
    context: () => contexts.at(-1)!,
    render,
    guide: async (id: string, requestId: number) => { action = { id, requestId } as StudyGuideAction; await render(); },
    active: async (value: boolean) => { active = value; await render(); },
    click: (selector: string) => act(() => {
      const button = document.querySelector<HTMLButtonElement>(selector);
      assert.ok(button, selector); button.click();
    }),
    cleanup: async () => {
      await act(() => root.unmount());
      assert.equal(document.querySelector('[role="dialog"]'), null);
      assert.equal(document.body.style.overflow, '');
      dom.window.close();
      for (const [key, value] of previous) {
        if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('Study exposes catalogue metadata, validates guide steps and focuses inline notes once per explicit request', async () => {
  const app = await studyFixture();
  try {
    await app.render();
    assert.deepEqual(Object.keys(app.context()).sort(), ['availableActions', 'studyLevel']);
    assert.equal(app.context().availableActions.length, 6);
    await app.guide('select-grade-8', 1);
    assert.equal(app.context().grade, 8); assert.equal(app.context().studyLevel, 'quarters');
    assert.deepEqual(app.context().availableActions, ['select-quarter-1', 'select-quarter-2', 'select-quarter-3', 'select-quarter-4']);
    await app.guide('select-quarter-1', 2);
    await app.click('[data-einstein="section-8.1A"]');
    assert.equal(app.context().sectionId, '8.1A');
    assert.equal(app.context().topic, 'Тепловая физика');
    assert.ok(app.context().availableActions.includes('show-notes'));
    assert.ok(app.context().availableActions.includes('show-trial'));
    assert.ok(!app.context().availableActions.includes('show-practice'));
    await app.guide('select-grade-13', 3);
    await app.guide('select-grade-9', 4); // Valid ID, but its grade button is not enabled on this screen.
    assert.equal(app.context().sectionId, '8.1A');
    await app.guide('show-notes', 5);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.activeElement?.id, 'study-notes');
    assert.deepEqual(app.scrolled, ['study-notes']);
    await app.guide('show-notes', 5);
    assert.deepEqual(app.scrolled, ['study-notes'], 're-rendering a handled action cannot repeat the scroll');
    const payload = JSON.stringify(app.context());
    for (const privateKey of ['email', 'answers', 'feedback', 'draft', 'profile', 'openResource']) assert.ok(!payload.includes(privateKey));
    assert.deepEqual(Object.keys(app.context()).sort(), ['availableActions', 'grade', 'lesson', 'quarter', 'sectionId', 'studyLevel', 'topic', 'view']);
    assert.equal(app.context().lesson?.id, '8.1A-ru-reading');
    assert.match(app.context().lesson?.excerpt || '', /Молекулярно-кинетическая теория/);
    assert.equal(app.context().view, 'notes');
  } finally { await app.cleanup(); }
});

test('empty quarters do not expose unavailable files and grade twelve keeps its flat section index', async () => {
  const app = await studyFixture();
  try {
    await app.render();
    await app.guide('select-grade-8', 1);
    await app.guide('select-quarter-2', 2);
    assert.ok(!app.context().availableActions.includes('show-quarter-exam'));
    await app.click('[data-einstein="section-8.2A"]');
    assert.deepEqual(app.context().availableActions, []);
    await app.guide('show-notes', 3);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await app.guide('navigate-study', 4);
    assert.equal(app.context().studyLevel, 'classes');
    await app.guide('select-grade-12', 5);
    assert.equal(app.context().studyLevel, 'sections');
    assert.equal(app.context().grade, 12);
    assert.equal(app.context().quarter, undefined);
    await app.guide('select-quarter-1', 6);
    assert.equal(app.context().studyLevel, 'sections');
    assert.equal(app.context().quarter, undefined);
  } finally { await app.cleanup(); }
});

test('hiding Study closes portalled trials, suppresses hidden context, and retains the inline lesson and answer draft', async () => {
  const app = await studyFixture();
  try {
    await app.render();
    await app.guide('select-grade-8', 1);
    await app.guide('select-quarter-1', 2);
    await app.click('[data-einstein="section-8.1A"]');
    await app.guide('show-trial', 3);
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.equal(app.context().view, 'trial');
    assert.equal(app.context().lesson, undefined, 'an open trial does not share note text as file contents');
    const count = app.contexts.length;
    await app.active(false);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.body.style.overflow, '');
    assert.equal(app.contexts.length, count, 'hidden Study does not overwrite the current page context');
    await app.active(true);
    assert.equal(app.context().sectionId, '8.1A');
    assert.equal(app.context().view, 'notes');
    assert.ok(app.context().lesson?.excerpt, 'returning to notes restores the bounded reading fragment');
    await app.guide('navigate-study', 4);
    await app.guide('select-grade-9', 5);
    await app.guide('select-quarter-1', 6);
    await app.click('[data-einstein="section-9.1B"]');
    assert.ok(app.context().availableActions.includes('show-practice'));
    const answer = document.querySelector<HTMLInputElement>('.learning-answer input')!;
    const setValue = Object.getOwnPropertyDescriptor(app.dom.window.HTMLInputElement.prototype, 'value')!.set!;
    await act(() => {
      setValue.call(answer, '314159');
      answer.dispatchEvent(new app.dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(answer.value, '314159');
    assert.ok(!JSON.stringify(app.context()).includes('314159'), 'answer drafts never enter the public guide context');
    const select = document.querySelector<HTMLSelectElement>('#study-lesson-select')!;
    assert.ok(document.querySelectorAll('.study-lesson-prose h3').length > 20, 'the complete source is selected first');
    await act(() => { select.value = '9.1B-ru-summary'; select.dispatchEvent(new app.dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelectorAll('.study-lesson-prose h3').length, 4);
    assert.equal(app.context().lesson?.id, '9.1B-ru-summary');
    assert.equal(app.context().lesson?.sectionTitle, 'Основные понятия');
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await app.active(false);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.body.style.overflow, '');
    await app.active(true);
    assert.equal(app.context().sectionId, '9.1B');
    assert.equal(document.querySelector<HTMLInputElement>('.learning-answer input')!.value, '314159', 'a normal page hide/show preserves the answer draft');
  } finally { await app.cleanup(); }
});

test('task help prefills only its public problem after an explicit click and never includes the learner answer draft', async () => {
  const app = await studyFixture();
  try {
    await app.render();
    await app.guide('select-grade-9', 1);
    await app.guide('select-quarter-1', 2);
    await app.click('[data-einstein="section-9.1B"]');
    const firstTask = document.querySelector<HTMLElement>('.learning-task')!;
    const input = firstTask.querySelector<HTMLInputElement>('input')!;
    const setValue = Object.getOwnPropertyDescriptor(app.dom.window.HTMLInputElement.prototype, 'value')!.set!;
    await act(() => {
      setValue.call(input, '123456-secret-answer');
      input.dispatchEvent(new app.dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(app.questions.length, 0, 'viewing a task and typing an answer never contact the assistant');
    const problem = firstTask.querySelector('div > p')!.textContent!;
    const help = firstTask.querySelector<HTMLButtonElement>('.learning-text-link')!;
    assert.equal(help.type, 'button', 'asking for a hint never submits the answer-check form');
    assert.equal(help.textContent, 'Помощь Эйнштейна');
    await act(() => help.click());
    assert.deepEqual(app.questions, [`Помоги разобраться в задаче: ${problem}. Сначала дай подсказку и объясни, с чего начать.`]);
    assert.ok(!app.questions[0].includes(input.value));
    assert.equal(firstTask.querySelector('[role="status"]'), null, 'prefilling help does not evaluate the learner answer');
  } finally { await app.cleanup(); }
});
