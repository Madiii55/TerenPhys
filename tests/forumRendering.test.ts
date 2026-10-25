import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import type { ForumApi } from '../src/forum/api.ts';
import type { ForumComment, ForumFilters, ForumTopic } from '../src/forum/model.ts';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

async function renderForum(api: ForumApi) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://terenphys.web.app' });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let root: ReturnType<typeof import('react-dom/client')['createRoot']> | undefined;
  const restore = async () => {
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    for (const [key, value] of previous) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
  try {
    const result = await build({
      stdin: { contents: `
        import React from 'react';
        import { useLanguage } from './src/i18n/LanguageContext.tsx';
        export { LanguageProvider } from './src/i18n/LanguageContext.tsx';
        export { ForumPage } from './src/components/ForumPage.tsx';
        export function Switch() { const {setLanguage} = useLanguage(); return <button id="switch" onClick={() => setLanguage('kk')}>Switch</button>; }
      `, resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx' },
      bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'], loader: { '.css': 'empty' },
      plugins: [{ name: 'isolated-forum', setup(builder) {
        builder.onLoad({ filter: /[\\/]context[\\/]AuthContext\.tsx$/ }, () => ({ contents: 'export function useAuth() { return { user: null }; }', loader: 'ts' }));
        builder.onLoad({ filter: /[\\/]src[\\/]supabase\.ts$/ }, () => ({ contents: 'export const supabase = {}; export function avatarUrl() { return undefined; }', loader: 'ts' }));
      } }],
    });
    const module = { exports: {} as Record<string, React.ComponentType<any>> };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
    const { LanguageProvider, ForumPage, Switch } = module.exports;
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    await act(async () => root!.render(React.createElement(LanguageProvider, { initialLanguage: 'ru' }, React.createElement(ForumPage, { api, onOpenAuth: () => {} }), React.createElement(Switch))));
    return {
      restore,
      waitForSearch: () => act(async () => { await new Promise(resolve => setTimeout(resolve, 330)); }),
      click: (node: HTMLElement) => act(async () => node.click()),
      typeSearch: (value: string) => act(async () => {
        const input = document.querySelector('input[type="search"]')!;
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      }),
    };
  } catch (error) { await restore(); throw error; }
}

const topic: ForumTopic = {
  id: 'topic', author_id: 'author', author_name: 'Автор', author_avatar_path: null,
  title: 'Обсуждение движения', body: 'Условие задачи и ход решения.', grade: 9, category: 'mechanics',
  created_at: '2026-10-09T12:00:00Z', view_count: 1, like_count: 0, comment_count: 0,
};
const baseApi: ForumApi = {
  list: async () => ({ topics: [topic], total: 1 }), topic: async () => topic,
  comments: async () => ({ comments: [], total: 0 }), recordView: async () => 1,
  liked: async () => false, setLike: async () => {}, createTopic: async () => topic,
  createComment: async () => { throw new Error('Guest test must not create comments'); }, subscribe: () => () => {},
};

test('forum fetches once initially and once per changed search; whitespace, reset and language switches do not duplicate requests', async () => {
  const requests: ForumFilters[] = [];
  const env = await renderForum({ ...baseApi, list: async filters => { requests.push({ ...filters }); return { topics: [topic], total: 1 }; } });
  try {
    await env.waitForSearch();
    assert.equal(requests.length, 1);
    await env.typeSearch('дви');
    await env.typeSearch('движение ');
    assert.equal(requests.length, 1);
    await env.waitForSearch();
    assert.deepEqual(requests.map(request => request.search), ['', 'движение']);
    await env.typeSearch(' движение  ');
    await env.waitForSearch();
    assert.equal(requests.length, 2);
    await env.click(document.querySelector('#switch')!);
    assert.equal(requests.length, 2);
    assert.equal((document.querySelector('input[type="search"]') as HTMLInputElement).value, ' движение  ');
    await env.click(document.querySelector('.forum-filter-heading button')!);
    await env.waitForSearch();
    assert.deepEqual(requests.map(request => request.search), ['', 'движение', '']);
  } finally { await env.restore(); }
});

test('forum replies resolve loaded parents, retain missing-parent text and update quotes after realtime edits', async () => {
  const comment = (id: string, parent_id: string | null, body: string): ForumComment => ({
    id, parent_id, body, topic_id: topic.id, author_id: id, author_name: 'Автор ' + id,
    author_avatar_path: null, created_at: topic.created_at,
  });
  let comments = [comment('parent', null, 'Исходный текст'), comment('reply', 'parent', 'Мой ответ'), comment('unloaded', 'absent', 'Другой ответ')];
  let refresh: (() => void) | undefined;
  const env = await renderForum({ ...baseApi,
    comments: async () => ({ comments, total: comments.length }),
    subscribe: (id, callback) => { if (id === topic.id) refresh = callback; return () => {}; },
  });
  try {
    await env.click(document.querySelector('.forum-topic-title')!);
    assert.equal(document.querySelector('#comment-reply blockquote')!.textContent, 'Автор parent Исходный текст');
    assert.equal(document.querySelector('#comment-unloaded blockquote')!.textContent, 'Ответ на комментарий выше');
    comments = [comment('parent', null, 'Обновлённый текст'), ...comments.slice(1)];
    await act(async () => refresh!());
    assert.equal(document.querySelector('#comment-reply blockquote')!.textContent, 'Автор parent Обновлённый текст');
  } finally { await env.restore(); }
});
