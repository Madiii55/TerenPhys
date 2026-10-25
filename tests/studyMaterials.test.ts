import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { sectionMaterials, quarterMaterial } from '../src/learning/materials.ts';
import { STUDY_PROGRAMME } from '../src/learning/catalogue.ts';
import { assertDocxBudget } from '../src/telegram/preview.ts';

const require = createRequire(import.meta.url), { JSDOM } = require('jsdom');
const JSZip = createRequire(require.resolve('docx-preview'))('jszip');
const asset = (url: string) => new URL('../public' + url, import.meta.url);
const bytes = (url: string) => { const buffer = readFileSync(asset(url)); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); };

test('8.1A has three language-specific note pages and a trial without invented answers; 8.1B has trials and answers, but no borrowed notes', () => {
  for (const language of ['ru', 'kk'] as const) {
    const a = sectionMaterials(8, '8.1A', language), b = sectionMaterials(8, '8.1B', language);
    assert.equal(a.notes!.files.length, 3); assert.deepEqual(a.notes!.files.map(file => file.page), [1, 2, 3]);
    assert.equal(a.trial!.files.length, 1); assert.equal(b.notes, undefined);
    assert.deepEqual(b.trial!.files.map(file => file.label), ['Задания', 'Ответы']);
    assert.ok(a.notes!.files.every(file => file.url.includes(`notes-${language}-`)));
    assert.ok(b.trial!.files.every(file => file.url.includes(`-${language}.docx`)));
    assert.equal(quarterMaterial(8, 1, language)!.title, 'Пробный СОЧ');
    for (const resource of [a.notes!, a.trial!, b.trial!, quarterMaterial(8, 1, language)!]) {
      for (const file of resource.files) {
        if (!file.url.startsWith('/study/')) continue; // Audited channel resources are checked in telegramStudy.test.ts.
        assert.equal(existsSync(asset(file.url)), true, file.url);
        if (file.format === 'docx') assert.doesNotThrow(() => assertDocxBudget(bytes(file.url)));
      }
    }
  }
});

test('existing 8.1 files never leak into other grades, quarters or sections', () => {
  for (const grade of [7,8,9,10,11] as const) for (const quarter of [1,2,3,4] as const) {
    for (const section of STUDY_PROGRAMME[grade][quarter]) {
      const materials = sectionMaterials(grade, section.id, 'ru');
      for (const resource of Object.values(materials)) for (const file of resource.files) {
        if (file.url.startsWith('/study/8/1/')) assert.equal(section.id.startsWith('8.1'), true);
      }
    }
    for (const file of quarterMaterial(grade, quarter, 'kk')?.files || []) {
      if (file.url.startsWith('/study/8/1/')) assert.equal(grade === 8 && quarter === 1, true);
    }
  }
  assert.deepEqual(sectionMaterials(7, '8.1A', 'ru'), {});
  assert.equal(quarterMaterial(8, null, 'ru'), undefined);
});

test('the full translated SOCh preserves all media, six tables, seventeen native equations, all three variants and assessment scores', async () => {
  const original = await JSZip.loadAsync(bytes('/study/8/1/quarter/soch-ru.docx'));
  const translated = await JSZip.loadAsync(bytes('/study/8/1/quarter/soch-kk.docx'));
  assert.deepEqual(Object.keys(translated.files), Object.keys(original.files));
  for (const name of Object.keys(original.files)) if (name !== 'word/document.xml') {
    assert.deepEqual(await translated.file(name).async('uint8array'), await original.file(name).async('uint8array'), name);
  }
  const source = await original.file('word/document.xml').async('string');
  const target = await translated.file('word/document.xml').async('string');
  for (const [pattern, count] of [[/<w:tbl\b/g,6],[/<m:oMath\b/g,17],[/<w:p\b/g,642]] as const) assert.equal([...target.matchAll(pattern)].length,count);
  const parser = new JSDOM().window.DOMParser;
  const text = (xml: string) => new parser().parseFromString(xml,'application/xml').documentElement.textContent!;
  assert.deepEqual(text(target).match(/\[\d+\]/g), text(source).match(/\[\d+\]/g));
  assert.equal(text(target).match(/жиынтық бағалау тапсырмалары/gi)!.length, 3);
  assert.match(text(target), /Спирт толық жанғанда қанша энергия бөлінеді/);
  assert.match(text(target), /Жалпы балл: \[40\]/);
  assert.doesNotMatch(text(target), /Задания|Напишите|температура по|сгорания|Количество теплоты|Общий балл/);
});

async function compiled(source: string, mockDocx = false) {
  const result = await build({ stdin: { contents: source, resolveDir: fileURLToPath(new URL('..', import.meta.url)), sourcefile: 'study-test.tsx', loader: 'tsx' },
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react','react-dom','react-dom/*','docx-preview','dompurify'], loader: { '.css':'empty' },
    plugins: [{ name: 'study-preview-test', setup(builder) {
      builder.onResolve({ filter: /^pdfjs-dist\/legacy\/build\/pdf.worker.mjs\?url$/ }, () => ({ path: 'worker', namespace: 'pdf-worker-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'pdf-worker-test' }, () => ({ contents: 'export default "/test-pdf-worker.mjs";', loader: 'js' }));
      builder.onResolve({ filter: /^pdfjs-dist(?:\/legacy\/build\/pdf.mjs)?$/ }, () => ({ path: 'pdf', namespace: 'pdf-render-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'pdf-render-test' }, () => ({ contents: `
        export const calls=[]; export const GlobalWorkerOptions={};
        export function getDocument(options){ calls.push(options); return {destroy:async()=>{}, promise:Promise.resolve({
          numPages:3, getPage:async(number)=>({
            getViewport:({scale})=>({width:600*scale,height:800*scale}),
            render:({canvas})=>{ canvas.dataset.page=String(number); return {promise:Promise.resolve(),cancel(){}} },
            getTextContent:async()=>({items:[{str:'PDF text page '+number}]})
          })
        })} }
      `, loader: 'js' }));
      if (mockDocx) builder.onLoad({ filter: /[\\/]docxPreview\.ts$/ }, () => ({ contents: 'export const renderDocxPreview = async () => "<html><body>Word preview</body></html>";', loader: 'ts' }));
    } }],
  });
  const module = { exports: {} as any };
  new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
  return module.exports;
}

function environment() {
  const dom = new JSDOM('<!doctype html><body><button id="origin">Open</button><div id="root"></div></body>', { url: 'https://terenphys.web.app', pretendToBeVisual: true });
  // JSDOM cannot measure SVG; actual layout is separately checked in the browser.
  dom.window.SVGElement.prototype.getBBox = () => ({ x:0,y:0,width:0,height:0 });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window','document','Node','Element','HTMLElement','DOMParser','XMLSerializer','FileReader','Blob','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{ configurable:true,writable:true,value:dom.window[key] });
  }
  previous.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis,'IS_REACT_ACT_ENVIRONMENT'));
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  previous.set('ResizeObserver', Object.getOwnPropertyDescriptor(globalThis,'ResizeObserver'));
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} };
  return { dom, restore() { dom.window.close(); for (const [key,value] of previous) { if (value) Object.defineProperty(globalThis,key,value); else delete (globalThis as any)[key]; } } };
}

test('all eight actual DOCX resources render their text, tables and diagrams with the same safe viewer used by the website', async () => {
  const env = environment();
  try {
    const { renderDocxPreview } = await compiled("export {renderDocxPreview} from './src/telegram/docxPreview.ts';");
    for (const language of ['ru','kk'] as const) {
      const a = sectionMaterials(8,'8.1A',language), b = sectionMaterials(8,'8.1B',language);
      for (const resource of [a.trial!, b.trial!, quarterMaterial(8,1,language)!]) for (const file of resource.files.filter(file => file.url.startsWith('/study/'))) {
        const html = await renderDocxPreview(bytes(file.url),new AbortController().signal);
        assert.match(html, /Content-Security-Policy/);
        assert.doesNotMatch(html, /<script\b/);
        assert.doesNotMatch(html, /img\{[^}]*object-fit:contain/);
        assert.doesNotMatch(html, /min-width:600px/);
        assert.match(html, /width:100%!important;min-width:0/);
        if (resource.title === 'Пробный СОЧ') {
          assert.match(html, /<math\b/); assert.match(html, /<table\b/);
          assert.ok((html.match(/<img\b/g) || []).length >= 24);
          const prose = new env.dom.window.DOMParser().parseFromString(html,'text/html').body.textContent!.replace(/\s+/g,' ');
          assert.equal((language === 'ru' ? /Общий балл/ : /Жалпы балл/).test(prose),true,file.url);
        } else {
          const prose = new env.dom.window.DOMParser().parseFromString(html,'text/html').body.textContent!;
          assert.equal((language === 'ru' ? /Задание/ : /тапсырма/).test(prose),true,file.url);
        }
      }
    }
  } finally { env.restore(); }
});

test('Study opens the complete inline lesson automatically, keeps the trial below it, and preserves originals, language and modal answers', async () => {
  const env = environment(), originalFetch = globalThis.fetch;
  let root: any;
  try {
    const fetched: string[] = [];
    globalThis.fetch = (async (url: any) => { fetched.push(String(url)); return new Response(new Uint8Array([1,2,3])); }) as typeof fetch;
    const { StudyPage, LanguageProvider, Switch } = await compiled(`
      import React from 'react'; import {useLanguage} from './src/i18n/LanguageContext.tsx';
      export {StudyPage} from './src/components/StudyPage.tsx';
      export {LanguageProvider} from './src/i18n/LanguageContext.tsx';
      export function Switch(){ const {setLanguage,language}=useLanguage(); return <button onClick={()=>setLanguage(language==='ru'?'kk':'ru')}>switch</button> }
    `, true);
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(LanguageProvider,{initialLanguage:'ru'},React.createElement(StudyPage),React.createElement(Switch))));
    const button = (text: string) => [...document.querySelectorAll('button')].find(button=>button.textContent?.trim()===text)!;
    const click = async (node: HTMLElement) => act(async()=> { node.focus(); node.click(); await new Promise(resolve=>setTimeout(resolve,10)); });
    await click(document.querySelector('button[aria-label="8 класс"]')!);
    await click(document.querySelector('button[aria-label="1 четверть"]')!);
    assert.equal(button('Пробный СОЧ').disabled,false);
    await click(button('Пробный СОЧ'));
    assert.equal(document.querySelector('#study-resource-title')!.textContent,'8.1 — Пробный СОЧ');
    assert.equal(document.querySelector('a[download]')!.getAttribute('href'),'/study/8/1/quarter/soch-ru.docx');
    await click(document.querySelector('button[aria-label="Закрыть просмотр"]')!);
    await click(document.querySelector('button[aria-label="8.1A — Тепловая физика"]')!);
    const notes = document.querySelector<HTMLElement>('article#study-notes')!;
    assert.ok(notes);
    assert.equal(notes.lang, 'ru');
    assert.equal(notes.querySelectorAll('.study-lesson-prose h3').length, 6);
    assert.match(notes.textContent!, /Броуновское движение/);
    assert.equal(notes.querySelectorAll('table').length, 2);
    assert.equal(notes.querySelector('iframe,canvas,img'), null, 'a scan is not used as the reading edition');
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(button('Читать конспект'), undefined);
    assert.equal(button('Ответы'), undefined);
    assert.deepEqual([...notes.querySelectorAll('a[download]')].map(link => link.getAttribute('href')),
      [1,2,3].map(page => `/study/8/1/a/notes-ru-${page}.jpg`));
    const trialButton = button('Перейти к пробному СОРу');
    assert.ok(notes.compareDocumentPosition(trialButton) & env.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    const hash = window.location.hash;
    const outlineLink = notes.querySelector<HTMLAnchorElement>('.study-lesson-outline a')!;
    await click(outlineLink);
    assert.equal(document.activeElement?.id, outlineLink.hash.slice(1));
    assert.equal(window.location.hash, hash, 'outline links do not create a route or history entry');
    await click(document.querySelector('.study-lesson-trial-jump')!);
    assert.equal(document.activeElement?.id, 'study-trial-heading');
    assert.equal(window.location.hash, hash);
    await click(button('switch'));
    assert.equal(document.querySelector<HTMLElement>('#study-notes')!.lang, 'kk');
    assert.match(document.querySelector('.study-lesson-prose')!.textContent!, /Броундық қозғалыс/);
    assert.doesNotMatch(document.querySelector('.study-lesson-prose')!.textContent!, /Броуновское движение/);
    assert.equal(document.querySelector('#study-notes a[download]')!.getAttribute('href'), '/study/8/1/a/notes-kk-1.jpg');
    await click(button('switch'));
    await click(button('Перейти к пробному СОРу'));
    assert.equal(document.querySelector('a.attachment-download')!.getAttribute('href'), '/study/8/1/a/sau-ru.docx');
    await click(document.querySelector('button[aria-label="Закрыть просмотр"]')!);
    assert.equal(document.activeElement, button('Перейти к пробному СОРу'));
    assert.equal(document.body.style.overflow, '');
    assert.ok(fetched.every(url => !url.includes('notes-')), 'reading a lesson never downloads its original scans');
    await click(button('Все разделы'));
    await click(document.querySelector('button[aria-label="8.1B — Количество теплоты"]')!);
    assert.match(document.querySelector('.study-lesson-empty')!.textContent!,/Конспект пока не добавлен/);
    assert.equal(document.querySelector('#study-notes'),null);
    await click(button('Ответы'));
    assert.equal(document.querySelector('a.attachment-download')!.getAttribute('href'),'/study/8/1/b/answers-ru.docx');
    assert.equal(document.querySelector('iframe')!.getAttribute('sandbox'),'allow-same-origin');
    await click(button('switch'));
    assert.equal(document.querySelector('a.attachment-download')!.getAttribute('href'),'/study/8/1/b/answers-kk.docx');
    assert.match(document.querySelector('#study-resource-title')!.textContent!,/Сынама БЖБ/);
    assert.ok(fetched.includes('/study/8/1/quarter/soch-ru.docx'));
    assert.ok(fetched.includes('/study/8/1/b/answers-kk.docx'));
  } finally { if(root) await act(async()=>root.unmount()); globalThis.fetch = originalFetch; env.restore(); }
});

test('Word preview survives equivalent resource objects and fetches again only for a different file', async () => {
  const env = environment(), originalFetch = globalThis.fetch;
  let root: any;
  try {
    const fetched: string[] = [];
    globalThis.fetch = (async (url: any) => { fetched.push(String(url)); return new Response(new Uint8Array([1,2,3])); }) as typeof fetch;
    const { Viewer } = await compiled("export {default as Viewer} from './src/components/StudyResourceViewer.tsx';", true);
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    const onClose = () => {};
    const render = (language: 'ru' | 'kk') => act(async () => {
      root.render(React.createElement(Viewer, { resource: sectionMaterials(8,'8.1B',language).trial, onClose }));
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    await render('ru');
    const frame = document.querySelector('iframe');
    assert.ok(frame);
    await render('ru');
    assert.deepEqual(fetched, ['/study/8/1/b/sau-ru.docx']);
    assert.equal(document.querySelector('iframe'), frame);
    await render('kk');
    assert.deepEqual(fetched, ['/study/8/1/b/sau-ru.docx', '/study/8/1/b/sau-kk.docx']);
    assert.notEqual(document.querySelector('iframe'), frame);
  } finally { if (root) await act(async () => root.unmount()); globalThis.fetch = originalFetch; env.restore(); }
});

test('study PDF keeps English explicit, bounds loading and supports pages/zoom; unavailable sources have an honest Telegram fallback', async () => {
  const env = environment(), originalFetch = globalThis.fetch;
  let root: any;
  try {
    const fetched: string[] = [];
    globalThis.fetch = (async (url: any) => { fetched.push(String(url)); return new Response(new Uint8Array([1,2,3])); }) as typeof fetch;
    const { Viewer, calls } = await compiled("export {default as Viewer} from './src/components/StudyResourceViewer.tsx'; export {calls} from 'pdfjs-dist';");
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    const onClose = () => {};
    const render = (resource: any) => act(async()=>{ root.render(React.createElement(Viewer,{key:resource.id,resource,onClose})); await new Promise(resolve=>setTimeout(resolve,30)); });
    const notes = sectionMaterials(11,'11.1B','ru').notes!;
    await render(notes);
    assert.match(document.querySelector('#study-resource-title')!.textContent!, /English/);
    await act(async()=>{ await new Promise(resolve=>setTimeout(resolve,30)); });
    assert.equal(document.querySelector('canvas')!.getAttribute('data-page'), '1');
    assert.equal(document.querySelector('canvas')!.hidden, false);
    assert.equal(calls[0].enableXfa, false);
    assert.equal(calls[0].useWorkerFetch, false);
    await act(async()=>{ (document.querySelector('button[aria-label="Следующая страница"]') as HTMLButtonElement).click(); });
    assert.equal(document.querySelector('canvas')!.getAttribute('data-page'), '2');
    await act(async()=>{ (document.querySelector('button[aria-label="Увеличить"]') as HTMLButtonElement).click(); });
    assert.match(document.querySelector('.study-pdf-toolbar')!.textContent!,/125%/);
    assert.match(document.querySelector('a[download]')!.getAttribute('href')!, /\?download=11\.1B-EN-notes-tg-401.pdf$/);
    // Keep coverage for future source-only entries, independently of the restored catalogue.
    await render({ id:'unavailable',code:'9.2',title:'Пробный СОР',files:[{
      url:'https://t.me/nisphysicshub/154',format:'telegram',language:'und',
      downloadName:'9.2-UND-SOR-tg-154.docx',label:'Задания',sourceFormat:'docx',
    }] });
    assert.equal(document.querySelector('iframe'), null);
    assert.equal(document.querySelector('a[download]'), null);
    assert.match(document.querySelector('#study-resource-title')!.textContent!, /Язык не указан/);
    const link = document.querySelector('.attachment-state a')!;
    assert.equal(link.getAttribute('href'), 'https://t.me/nisphysicshub/154');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(link.getAttribute('target'), '_blank');
    assert.deepEqual(fetched, [notes.files[0].url]);
  } finally { if (root) await act(async()=>root.unmount()); globalThis.fetch = originalFetch; env.restore(); }
});

test('a long quarter collection has an accessible file selector and previews the chosen restored document without navigating away', async () => {
  const env = environment(), originalFetch = globalThis.fetch; let root: any;
  try {
    const fetched: string[] = [];
    globalThis.fetch = (async (url: any) => { fetched.push(String(url)); return new Response(new Uint8Array([1,2,3])); }) as typeof fetch;
    const { Viewer } = await compiled("export {default as Viewer} from './src/components/StudyResourceViewer.tsx';");
    const resource = quarterMaterial(8,1,'kk')!;
    const onClose = () => {};
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(Viewer,{resource,onClose})));
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Выбрать файл"]')!;
    assert.equal(select.options.length, resource.files.length);
    await act(async()=> { select.value = String(resource.files.length - 1); select.dispatchEvent(new env.dom.window.Event('change',{bubbles:true})); await new Promise(resolve=>setTimeout(resolve,30)); });
    assert.ok(document.querySelector('canvas'));
    assert.ok(document.querySelector('a[download]')!.getAttribute('href')!.startsWith(resource.files.at(-1)!.url));
    assert.ok(fetched.includes(resource.files.at(-1)!.url));
    assert.equal((document.querySelector('button[aria-label="Следующий файл"]')! as HTMLButtonElement).disabled, true);
    assert.equal(document.activeElement?.getAttribute('aria-label'), 'Закрыть просмотр');
  } finally { if (root) await act(async()=>root.unmount()); globalThis.fetch = originalFetch; env.restore(); }
});
