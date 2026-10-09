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
        assert.equal(existsSync(asset(file.url)), true, file.url);
        if (file.format === 'docx') assert.doesNotThrow(() => assertDocxBudget(bytes(file.url)));
      }
    }
  }
});

test('files never leak into other grades, quarters or sections', () => {
  for (const grade of [7,8,9,10,11] as const) for (const quarter of [1,2,3,4] as const) {
    for (const section of STUDY_PROGRAMME[grade][quarter]) {
      const materials = sectionMaterials(grade, section.id, 'ru');
      assert.equal(Boolean(materials.trial), grade === 8 && quarter === 1);
    }
    assert.equal(Boolean(quarterMaterial(grade, quarter, 'kk')), grade === 8 && quarter === 1);
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
  return { dom, restore() { dom.window.close(); for (const [key,value] of previous) { if (value) Object.defineProperty(globalThis,key,value); else delete (globalThis as any)[key]; } } };
}

test('all eight actual DOCX resources render their text, tables and diagrams with the same safe viewer used by the website', async () => {
  const env = environment();
  try {
    const { renderDocxPreview } = await compiled("export {renderDocxPreview} from './src/telegram/docxPreview.ts';");
    for (const language of ['ru','kk'] as const) {
      const a = sectionMaterials(8,'8.1A',language), b = sectionMaterials(8,'8.1B',language);
      for (const resource of [a.trial!, b.trial!, quarterMaterial(8,1,language)!]) for (const file of resource.files) {
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

test('actual Study navigation exposes the quarter trial and exactly two panels, previews notes and separate answers, restores focus and changes files with language', async () => {
  const env = environment(), originalFetch = globalThis.fetch;
  let root: any;
  try {
    const fetched: string[] = [];
    globalThis.fetch = (async (url: any) => { fetched.push(String(url)); return new Response(new Uint8Array([1,2,3])); }) as typeof fetch;
    const { StudyPage, LanguageProvider, Switch } = await compiled(`
      import React from 'react'; import {useLanguage} from './src/i18n/LanguageContext.tsx';
      export {StudyPage} from './src/components/StudyPage.tsx';
      export {LanguageProvider} from './src/i18n/LanguageContext.tsx';
      export function Switch(){ const {setLanguage}=useLanguage(); return <button onClick={()=>setLanguage('kk')}>switch</button> }
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
    assert.deepEqual([...document.querySelectorAll('.learning-resource h2')].map(node=>node.textContent), ['Конспект','Пробный СОР']);
    assert.equal(button('Ответы'),undefined);
    await click(button('Читать конспект'));
    assert.equal(document.querySelector('img')!.getAttribute('src'),'/study/8/1/a/notes-ru-1.jpg');
    await click(document.querySelector('button[aria-label="Следующий файл"]')!);
    assert.equal(document.querySelector('img')!.getAttribute('src'),'/study/8/1/a/notes-ru-2.jpg');
    await click(document.querySelector('button[aria-label="Следующий файл"]')!);
    assert.equal(document.querySelector('img')!.getAttribute('src'),'/study/8/1/a/notes-ru-3.jpg');
    await act(async()=>document.dispatchEvent(new env.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(document.querySelector('[role="dialog"]'),null); assert.equal(document.body.style.overflow,'');
    assert.equal(document.activeElement,button('Читать конспект'));
    await click(button('Все разделы'));
    await click(document.querySelector('button[aria-label="8.1B — Количество теплоты"]')!);
    assert.match(document.querySelector('.learning-resources')!.textContent!,/Конспект пока не добавлен/);
    await click(button('Ответы'));
    assert.equal(document.querySelector('a[download]')!.getAttribute('href'),'/study/8/1/b/answers-ru.docx');
    assert.equal(document.querySelector('iframe')!.getAttribute('sandbox'),'allow-same-origin');
    await click(button('switch'));
    assert.equal(document.querySelector('a[download]')!.getAttribute('href'),'/study/8/1/b/answers-kk.docx');
    assert.match(document.querySelector('#study-resource-title')!.textContent!,/Сынама БЖБ/);
    assert.ok(fetched.includes('/study/8/1/quarter/soch-ru.docx'));
    assert.ok(fetched.includes('/study/8/1/b/answers-kk.docx'));
  } finally { if(root) await act(async()=>root.unmount()); globalThis.fetch = originalFetch; env.restore(); }
});
