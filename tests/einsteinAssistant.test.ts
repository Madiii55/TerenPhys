import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import type { EinsteinContext, EinsteinRequest } from '../src/einstein/protocol.ts';

const require = createRequire(import.meta.url);
type RequestOptions = { body: EinsteinRequest; signal: AbortSignal };
type MockResult = { data?: unknown; error?: unknown };
let compiled: Promise<Record<string, any>> | undefined;
function components() {
  return compiled ??= (async () => {
    const result = await build({
      stdin: { contents: `
        export { EinsteinAssistant } from './src/components/EinsteinAssistant.tsx';
        export { LanguageProvider } from './src/i18n/LanguageContext.tsx';
        export { setFixtureUser } from './src/context/AuthContext.tsx';
        export { setFixtureInvoke } from './src/supabase.ts';
      `, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
      bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react/*'], loader: { '.css': 'empty' },
      plugins: [{ name: 'isolated-assistant', setup(builder) {
        builder.onLoad({ filter: /[\\/]context[\\/]AuthContext\.tsx$/ }, () => ({ contents: 'let user = null; export const setFixtureUser = value => {user = value}; export const useAuth = () => ({user});', loader: 'js' }));
        builder.onLoad({ filter: /[\\/]src[\\/]supabase\.ts$/ }, () => ({ contents: 'let invoke; export const setFixtureInvoke = value => {invoke = value}; export const supabase = {functions: {invoke: (...args) => invoke(...args)}};', loader: 'js' }));
        builder.onLoad({ filter: /[\\/]EinsteinAvatar\.tsx$/ }, () => ({ contents: 'import React from "react"; export default function Avatar({mode}) {return React.createElement("div", {"data-test-avatar": mode});}', loader: 'js' }));
      } }],
    });
    const module = { exports: {} as Record<string, any> };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
    return module.exports;
  })();
}

async function fixture({ coarse = false, language = 'ru', userId = 'reader-a' }: { coarse?: boolean; language?: 'ru' | 'kk'; userId?: string | null } = {}) {
  const ui = await components();
  const dom = new JSDOM('<button data-einstein="navigate-study" id="study-target">Study</button><div id="root"></div>', { url: 'https://example.test/', pretendToBeVisual: true });
  const chatScrolls: ScrollToOptions[] = [], guideTimeouts: (() => void)[] = [];
  dom.window.HTMLElement.prototype.scrollTo = function (options) { if (this.classList.contains('einstein-chat')) chatScrolls.push(options as ScrollToOptions); };
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.matchMedia = ((query: string) => ({ matches: query === '(pointer: fine)' && !coarse })) as typeof window.matchMedia;
  dom.window.document.getElementById('study-target')!.getBoundingClientRect = () => ({ left: 20, top: 160, width: 80, height: 44 } as DOMRect);
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const nativeTimeout = globalThis.setTimeout;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    setTimeout: (callback: () => void, delay?: number, ...args: unknown[]) => { if (delay === 6500) { guideTimeouts.push(callback); return 0; } return nativeTimeout(callback, delay, ...args); },
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let context: EinsteinContext = { page: 'home', language, availableActions: ['navigate-study', 'navigate-posts', 'navigate-forum'] };
  const requests: RequestOptions[] = [];
  let invoke: (options: RequestOptions) => Promise<MockResult> = async () => ({ data: { answer: 'Ответ по физике', actions: [] } });
  ui.setFixtureUser(userId ? { id: userId } : null);
  ui.setFixtureInvoke((name: string, options: RequestOptions) => { assert.equal(name, 'einstein-assistant'); requests.push(options); return invoke(options); });
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  const render = () => act(async () => root.render(React.createElement(ui.LanguageProvider, { initialLanguage: language },
    React.createElement(ui.EinsteinAssistant, { context, navigationId: 0, ready: true, onAction: () => {}, onOpenAuth: () => {} }))));
  await render();
  return {
    requests, chatScrolls, guideTimeouts,
    setInvoke: (next: typeof invoke) => { invoke = next; },
    changeUser: async (id: string | null) => { ui.setFixtureUser(id ? { id } : null); await render(); },
    changeContext: async (next: Partial<EinsteinContext>) => { context = { ...context, ...next }; await render(); },
    click: (selector: string) => act(async () => {
      const button = document.querySelector<HTMLButtonElement>(selector); assert.ok(button, selector); button.click();
    }),
    type: (value: string) => act(async () => {
      const input = document.querySelector('textarea')!;
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }),
    submit: () => act(async () => { document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }),
    cleanup: async () => {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, value] of previous) {
        if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('a failed assistant request preserves its draft and retry sends one user message without duplicated history', async () => {
  const env = await fixture();
  try {
    env.setInvoke(async () => ({ error: new Error('offline') }));
    await env.click('.einstein-launcher'); await env.type('Почему меняется скорость?'); await env.submit();
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, 'Почему меняется скорость?');
    assert.equal(document.querySelectorAll('.einstein-message').length, 0);
    assert.ok(document.querySelector('[role="alert"]'));
    env.setInvoke(async () => ({ data: { answer: 'Скорость меняется при ускорении.', actions: [] } }));
    await env.submit();
    assert.equal(env.requests.length, 2);
    for (const request of env.requests) assert.deepEqual(request.body.messages, [{ role: 'user', content: 'Почему меняется скорость?' }]);
    assert.equal(document.querySelectorAll('.einstein-message--user').length, 1);
    assert.equal(document.querySelectorAll('.einstein-message--assistant').length, 1);
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, '');
  } finally { await env.cleanup(); }
});

test('account changes erase chat and draft, abort old requests, and never transmit or display the previous account history', async () => {
  const env = await fixture();
  try {
    await env.click('.einstein-launcher'); await env.type('Личный вопрос первого аккаунта'); await env.submit();
    await env.type('Несохранённый черновик');
    await env.changeUser('reader-b');
    assert.equal(document.querySelectorAll('.einstein-message').length, 0);
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, '');
    let resolveOld: (result: MockResult) => void = () => {};
    env.setInvoke(() => new Promise(resolve => { resolveOld = resolve; }));
    await env.type('Вопрос второго аккаунта'); await env.submit();
    assert.deepEqual(env.requests[1].body.messages, [{ role: 'user', content: 'Вопрос второго аккаунта' }]);
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, 'Вопрос второго аккаунта');
    await env.changeUser(null);
    assert.equal(env.requests[1].signal.aborted, true);
    await act(async () => resolveOld({ data: { answer: 'Запоздалый личный ответ', actions: [] } }));
    assert.equal(document.querySelectorAll('.einstein-message').length, 0);
    assert.doesNotMatch(document.body.textContent!, /Запоздалый личный ответ|Вопрос второго аккаунта/);
    await env.changeUser('reader-c');
    env.setInvoke(async () => ({ data: { answer: 'Новый ответ', actions: [] } }));
    await env.type('Новый независимый вопрос'); await env.submit();
    assert.deepEqual(env.requests[2].body.messages, [{ role: 'user', content: 'Новый независимый вопрос' }]);
  } finally { await env.cleanup(); }
});

test('one icon button opens the avatar and chat in the same panel; guiding and closing preserve the conversation', async () => {
  const env = await fixture({ coarse: true });
  try {
    env.setInvoke(async () => ({ data: { answer: 'Материалы находятся в Учёбе.', actions: [{ id: 'navigate-study', label: 'Перейти к материалам' }] } }));
    const launcher = document.querySelector('.einstein-launcher')!;
    assert.equal(launcher.textContent, '', 'collapsed control contains only an icon');
    assert.equal(launcher.getAttribute('aria-label'), 'Помощник Эйнштейн');
    assert.equal(launcher.getAttribute('aria-expanded'), 'false');
    assert.equal(document.querySelector('.einstein-figure'), null, 'the avatar must not float outside a closed panel');
    await env.click('.einstein-launcher');
    assert.equal(launcher.getAttribute('aria-expanded'), 'true');
    assert.ok(document.querySelector('.einstein-panel .einstein-figure [data-test-avatar]'));
    assert.ok(document.querySelector('.einstein-panel > header .einstein-figure'));
    assert.equal(document.querySelector('#einstein-title')!.textContent, 'Эйнштейн');
    assert.equal(document.querySelectorAll('.einstein-actions').length, 0, 'no unsolicited navigation cards');
    assert.equal(document.activeElement, document.querySelector('[aria-label="Закрыть помощника"]'));
    await env.type('Где искать материалы?'); await env.submit();
    assert.ok(document.querySelector('.einstein-panel--chatting'), 'conversation state makes room for full-width replies');
    assert.equal(document.querySelector('#einstein-title')!.textContent, 'Эйнштейн');
    await env.click('.einstein-point');
    assert.ok(document.querySelector('.einstein-panel'));
    assert.ok(document.querySelector('.einstein-highlight'));
    assert.equal(document.querySelector('.einstein-panel [data-test-avatar]')!.getAttribute('data-test-avatar'), 'guide');
    assert.ok(document.querySelector('.einstein-panel .einstein-cue'));
    assert.ok(document.querySelector('.einstein-panel--guiding'), 'the same panel has a compact guide state');
    assert.equal(document.querySelector<HTMLElement>('.einstein-conversation')!.hidden, true, 'guiding temporarily compacts the same panel to reveal its target');
    assert.equal(document.activeElement, document.querySelector('[aria-label="Закрыть помощника"]'));
    await env.click('.einstein-cue button');
    assert.equal(document.querySelector<HTMLElement>('.einstein-conversation')!.hidden, false);
    assert.equal(document.querySelectorAll('.einstein-message').length, 2);
    await env.type('Продолжим разбор');
    await env.click('[aria-label="Закрыть помощника"]');
    assert.equal(document.querySelector('.einstein-panel'), null);
    assert.equal(document.querySelector('[data-test-avatar]'), null);
    assert.equal(document.querySelector('.einstein-highlight'), null);
    assert.equal(document.activeElement, launcher);
    await env.click('.einstein-launcher');
    assert.equal(document.querySelectorAll('.einstein-message').length, 2);
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, 'Продолжим разбор');
    await env.changeContext({ page: 'study', studyLevel: 'classes', availableActions: ['navigate-study', 'select-grade-8'] });
    assert.equal(document.querySelector('.einstein-message--assistant .einstein-actions'), null, 'old answer actions must not follow a changed page context');
  } finally { await env.cleanup(); }
});

test('guests get a compact sign-in invitation without navigation cards or inactive lesson prompts', async () => {
  const env = await fixture({ userId: null });
  try {
    await env.changeContext({ page: 'study', studyLevel: 'classes', availableActions: [7, 8, 9, 10, 11, 12].map(grade => `select-grade-${grade}`) as EinsteinContext['availableActions'] });
    await env.click('.einstein-launcher');
    assert.equal(document.querySelectorAll('.einstein-actions,.einstein-prompts').length, 0);
    assert.equal(document.querySelector('textarea'), null);
    assert.equal(document.querySelector('.einstein-signin p')!.textContent, 'Войди, чтобы задать вопрос по физике.');
    assert.equal(document.querySelector('.einstein-empty'), null);
    assert.equal(env.requests.length, 0);
  } finally { await env.cleanup(); }
});

test('Kazakh assistant labels use the shared dictionary and grade grammar', async () => {
  const env = await fixture({ language: 'kk', userId: null, coarse: true });
  try {
    await env.click('.einstein-launcher');
    assert.equal(document.querySelector('#einstein-title')!.textContent, 'Эйнштейн');
    await env.changeContext({ page: 'study', studyLevel: 'classes', availableActions: ['select-grade-8'] });
    assert.equal(document.querySelector('.einstein-topic')!.textContent, 'Оқу');
    assert.equal(document.querySelector('.einstein-signin button')!.textContent, 'Кіріп, сұрақ қою');
  } finally { await env.cleanup(); }
});

test('guide dismissal restores focus and Escape returns to chat before closing the panel', async () => {
  const env = await fixture({ coarse: true });
  try {
    env.setInvoke(async () => ({ data: { answer: 'Открой Учёбу.', actions: [{ id: 'navigate-study', label: 'Учёба' }] } }));
    await env.click('.einstein-launcher'); await env.type('Где Учёба?'); await env.submit(); await env.click('.einstein-point');
    document.querySelector<HTMLButtonElement>('.einstein-cue button')!.focus();
    await act(async () => env.guideTimeouts.at(-1)!());
    assert.equal(document.querySelector('.einstein-cue'), null);
    assert.equal(document.activeElement, document.querySelector('[aria-label="Закрыть помощника"]'));
    await env.click('.einstein-point');
    await act(async () => document.activeElement!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.ok(document.querySelector('.einstein-panel'));
    assert.equal(document.querySelector('.einstein-cue'), null);
    assert.equal(document.querySelector<HTMLElement>('.einstein-conversation')!.hidden, false);
    await act(async () => document.activeElement!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(document.querySelector('.einstein-panel'), null);
    assert.equal(document.activeElement, document.querySelector('.einstein-launcher'));
  } finally { await env.cleanup(); }
});

test('an arriving reply keeps an older-message reading position while an explicit submission follows the chat', async () => {
  const env = await fixture();
  try {
    await env.click('.einstein-launcher'); await env.type('Первый вопрос'); await env.submit();
    let resolveReply: (result: MockResult) => void = () => {};
    env.setInvoke(() => new Promise(resolve => { resolveReply = resolve; }));
    const beforeSubmit = env.chatScrolls.length;
    await env.type('Второй вопрос'); await env.submit();
    assert.ok(env.chatScrolls.length > beforeSubmit, 'own submission follows the conversation');
    const chatElement = document.querySelector<HTMLElement>('.einstein-chat')!;
    for (const [name, value] of Object.entries({ scrollHeight: 1200, clientHeight: 200, scrollTop: 100 })) Object.defineProperty(chatElement, name, { configurable: true, writable: true, value });
    await act(async () => chatElement.dispatchEvent(new window.Event('scroll', { bubbles: true })));
    const beforeReply = env.chatScrolls.length;
    await act(async () => resolveReply({ data: { answer: 'Новый ответ не должен сдвигать старую переписку.', actions: [] } }));
    assert.equal(env.chatScrolls.length, beforeReply);
    env.setInvoke(async () => ({ data: { answer: 'Продолжим.', actions: [] } }));
    await env.type('Продолжим'); await env.submit();
    assert.ok(env.chatScrolls.length > beforeReply, 'a new explicit submission resumes following');
  } finally { await env.cleanup(); }
});

const readingContext: Partial<EinsteinContext> = { page: 'study', studyLevel: 'material', grade: 8, quarter: 1, sectionId: '8.1A', view: 'notes',
  lesson: { id: '8.1A-ru-reading', title: 'Тепловая физика', language: 'ru', sectionTitle: 'Количество теплоты', excerpt: 'Q = cmΔT. Масса измеряется в килограммах.' } };

test('lesson prompts only fill the draft and an in-flight question keeps its submitted fragment while scrolling', async () => {
  const env = await fixture();
  try {
    await env.changeContext(readingContext); await env.click('.einstein-launcher');
    assert.equal(document.querySelectorAll('.einstein-prompts button').length, 3);
    await env.click('.einstein-prompts button');
    assert.match(document.querySelector<HTMLTextAreaElement>('textarea')!.value, /этот фрагмент/);
    assert.equal(env.requests.length, 0, 'opening, reading and prefilling never invoke AI');
    let resolveReply: (result: MockResult) => void = () => {};
    env.setInvoke(() => new Promise(resolve => { resolveReply = resolve; }));
    await env.submit();
    await env.changeContext({ lesson: { ...readingContext.lesson!, sectionTitle: 'Плавление', excerpt: 'Q = λm.' } });
    assert.equal(env.requests[0].signal.aborted, false, 'scrolling does not cancel inference');
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.disabled, true);
    assert.equal(env.requests[0].body.context.lesson?.excerpt, readingContext.lesson?.excerpt);
    assert.match(document.querySelector('.einstein-topic')!.textContent!, /Плавление/);
    await act(async () => resolveReply({ data: { answer: 'Начнём с формулы Q = cmΔT.', actions: [] } }));
    assert.equal(document.querySelector('.einstein-message-context')!.textContent, 'Количество теплоты', 'reply remains tied to the submitted location');
    await env.type('А здесь?'); await env.submit();
    assert.equal(env.requests[1].body.context.lesson?.excerpt, 'Q = λm.');
  } finally { await env.cleanup(); }
});

test('stop preserves the draft, late answers stay hidden, and changing a reading edition cancels inference', async () => {
  const env = await fixture();
  try {
    await env.changeContext(readingContext); await env.click('.einstein-launcher'); await env.type('Объясни эту формулу');
    let resolveReply: (result: MockResult) => void = () => {};
    env.setInvoke(() => new Promise(resolve => { resolveReply = resolve; }));
    await env.submit(); await env.click('[aria-label="Остановить ответ"]');
    assert.equal(env.requests[0].signal.aborted, true);
    assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')!.value, 'Объясни эту формулу');
    await act(async () => resolveReply({ data: { answer: 'Отменённый ответ', actions: [] } }));
    assert.equal(document.querySelectorAll('.einstein-message').length, 0);
    await env.submit();
    await env.changeContext({ lesson: { ...readingContext.lesson!, id: '8.1A-kk-reading', language: 'kk' } });
    assert.equal(env.requests[1].signal.aborted, true);
    assert.equal(document.querySelector('[aria-label="Остановить ответ"]'), null);
    assert.equal(env.requests.length, 2);
  } finally { await env.cleanup(); }
});

test('new long replies open at their beginning and clearing history requires a separate confirmation', async () => {
  const env = await fixture();
  try {
    await env.click('.einstein-launcher'); await env.type('Объясни движение');
    let resolveReply: (result: MockResult) => void = () => {};
    env.setInvoke(() => new Promise(resolve => { resolveReply = resolve; }));
    await env.submit();
    const chat = document.querySelector<HTMLElement>('.einstein-chat')!;
    chat.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
    const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
    window.HTMLElement.prototype.getBoundingClientRect = function () { return this.classList.contains('einstein-message--assistant') ? { top: 160 } as DOMRect : originalRect.call(this); };
    await act(async () => resolveReply({ data: { answer: 'Шаг за шагом.\n'.repeat(50), actions: [] } }));
    assert.equal(env.chatScrolls.at(-1)?.top, 60, 'scroll targets the answer start, not its end');
    await env.click('.einstein-clear summary');
    assert.equal(document.querySelectorAll('.einstein-message').length, 2);
    await env.click('.einstein-clear > button');
    assert.equal(document.querySelectorAll('.einstein-message').length, 0);
    assert.equal(env.requests.length, 1, 'clearing never invokes AI');
  } finally { await env.cleanup(); }
});
