import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { groupTelegramPosts, completeTelegramPage, mergeTelegramPosts, telegramGrades, telegramMatchesGrade, type TelegramPost } from '../src/telegram/model.ts';
import { attachmentPreviewKind, assertDocxBudget, readPreviewBytes, MAX_PREVIEW_BYTES } from '../src/telegram/preview.ts';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const post = (id: number, extra: Partial<TelegramPost> = {}): TelegramPost => ({ message_id:id, channel_username:'nisphysicshub',
  text:'', entities:[], attachments:[{kind:'document',name:'file'+id+'.docx',path:'nisphysicshub/assets/'+id+'.docx'}],
  published_at:'2026-10-07T13:44:21.000Z',source_revision_at:'2026-10-07T13:44:21.000Z',source_kind:'export',media_group_id:null,...extra });

test('class hashtags support grades 7–12, Russian/Kazakh, case and multiple classes without matching plain text', () => {
  assert.deepEqual(telegramGrades('Для 9 класса. #пробник #1четверть'), []);
  assert.deepEqual(telegramGrades('#6класс #13класс #8классный #18класс #сор9 #9'), []);
  assert.deepEqual(telegramGrades('🪐 #9класс #8КЛАСС #9класс #10_сынып #сынып11 #12grade #class7'), [7,8,9,10,11,12]);
  assert.deepEqual(telegramGrades('слово#7класс'), []);
  for (const grade of [7,8,9,10,11,12] as const) {
    assert.equal(telegramMatchesGrade(post(1),grade), true);
    assert.equal(telegramMatchesGrade(post(1,{text:'#физика #сор'}),grade), true);
    assert.equal(telegramMatchesGrade(post(1,{text:'#8класс #9класс'}),grade), grade === 8 || grade === 9);
  }
});

test('all four screenshot files inherit the caption’s class, never leak into other classes and stay in the general feed', () => {
  const raw = [post(431,{text:'Пробные СОР #8класс #1четверть'}),post(430),post(429),post(428)];
  const before = JSON.stringify(raw), groups = groupTelegramPosts(raw);
  assert.equal(groups.length,1); assert.equal(groups[0].attachments.length,4);
  for (const grade of [7,8,9,10,11,12] as const) assert.equal(groups.filter(item => telegramMatchesGrade(item,grade)).length,grade === 8 ? 1 : 0);
  assert.equal(JSON.stringify(raw),before);
  const [album] = groupTelegramPosts([post(2,{text:'#8класс',media_group_id:'album',source_kind:'bot'}),
    post(1,{text:'#9класс',media_group_id:'album',source_kind:'bot'})]);
  assert.deepEqual(album.grades,[8,9]);
});

test('new bot posts and later hashtag edits automatically move between classes without duplicate rows', () => {
  let rows = mergeTelegramPosts([], [post(1,{text:'Общее сообщение',source_kind:'bot'})]);
  assert.equal(telegramMatchesGrade(groupTelegramPosts(rows)[0],7),true);
  rows = mergeTelegramPosts(rows,[post(1,{text:'#9класс',source_kind:'bot',source_revision_at:'2026-10-08T00:00:00Z'})]);
  assert.equal(rows.length,1); assert.equal(telegramMatchesGrade(groupTelegramPosts(rows)[0],7),false);
  assert.equal(telegramMatchesGrade(groupTelegramPosts(rows)[0],9),true);
  rows = mergeTelegramPosts(rows,[post(1,{text:'Снова для всех',source_kind:'bot',source_revision_at:'2026-10-09T00:00:00Z'})]);
  assert.equal(rows.length,1); assert.equal(telegramMatchesGrade(groupTelegramPosts(rows)[0],12),true);
});

test('the four same-second export files in the screenshot render as one post with their original caption', () => {
  const rows = [post(431,{text:'Пробные СОР',entities:[{type:'bold',offset:0,length:7}]}),post(430),post(429),post(428)];
  const snapshot = JSON.stringify(rows), [group] = groupTelegramPosts(rows);
  assert.equal(groupTelegramPosts(rows).length,1); assert.equal(group.text,'Пробные СОР'); assert.equal(group.message_id,428);
  assert.deepEqual(group.attachments.map(file=>file.source_message_id),[431,430,429,428]);
  assert.deepEqual(group.entities,rows[0].entities); assert.equal(JSON.stringify(rows),snapshot);
});

test('archive grouping never guesses across distinct captions, timestamps, IDs, channels or media families', () => {
  for (const rows of [
    [post(1,{text:'first'}),post(2,{text:'second'})],
    [post(1),post(2,{published_at:'2026-10-07T13:44:22.000Z'})],
    [post(1),post(3)], [post(1),post(2,{channel_username:'other'})],
    [post(1),post(2,{attachments:[{kind:'photo'}]})],
    [post(1,{source_kind:'bot'}),post(2,{source_kind:'bot'})],
    [post(1,{attachments:[]}),post(2)],
  ]) assert.equal(groupTelegramPosts(rows).length,2);
  assert.equal(groupTelegramPosts(Array.from({length:11},(_,i)=>post(i+1))).length,11);
});

test('known Telegram album IDs survive edits and retain each unavailable attachment’s own source ID', () => {
  const a = post(2,{source_kind:'bot',media_group_id:'real-album',attachments:[{kind:'document',external:true,name:'missing.docx'}]});
  const b = post(1,{media_group_id:'real-album',text:'caption'});
  const [group] = groupTelegramPosts([a,b]); assert.equal(group.text,'caption'); assert.equal(group.attachments.length,2);
  assert.equal(group.attachments[0].source_message_id,2);
});

test('a later bot edit supplies a real album ID without splitting the remaining archive attachments', () => {
  const rows = [post(431,{text:'caption',source_kind:'bot',media_group_id:'real-album'}),post(430),post(429),post(428)];
  assert.equal(groupTelegramPosts(rows).length,1);assert.equal(groupTelegramPosts(rows)[0].attachments.length,4);
  assert.equal(groupTelegramPosts([post(1,{media_group_id:'a'}),post(2,{media_group_id:'b'})]).length,2);
});

test('pagination includes a whole boundary album and places the cursor after its last member', () => {
  const rows = [post(8,{published_at:'2026-10-08T00:00:00Z'}),post(7),post(6),post(5),post(4),post(3,{published_at:'2026-10-06T00:00:00Z'})];
  const page = completeTelegramPage(rows,2);
  assert.deepEqual(page.posts.map(p=>p.message_id),[8,7,6,5,4]); assert.equal(page.hasMore,true);
  assert.equal(completeTelegramPage(rows.slice(0,5),2).hasMore,false);
});

test('file preview allows PDF and DOCX but never guesses an active format for ZIP or external attachments', () => {
  const item = {kind:'document' as const,path:'nisphysicshub/assets/file.docx',name:'work.docx'};
  assert.equal(attachmentPreviewKind(item),'docx'); assert.equal(attachmentPreviewKind({...item,name:'work.pdf',path:'nisphysicshub/assets/file.pdf'}),'pdf');
  assert.equal(attachmentPreviewKind({...item,mime:'application/zip'}),undefined);
  assert.equal(attachmentPreviewKind({...item,external:true}),undefined); assert.equal(attachmentPreviewKind({...item,path:undefined}),undefined);
});

test('file loading is bounded even without Content-Length; oversized responses are not buffered', async () => {
  assert.deepEqual(new Uint8Array(await readPreviewBytes(new Response(new Uint8Array([1,2,3])))),new Uint8Array([1,2,3]));
  await assert.rejects(readPreviewBytes(new Response('x',{headers:{'content-length':String(MAX_PREVIEW_BYTES+1)}})),/too large/);
  await assert.rejects(readPreviewBytes(new Response(new Uint8Array(MAX_PREVIEW_BYTES+1))),/too large/);
});

async function compiled(source: string, mockDocx = false, supabaseSource = 'export const supabase={}; export const supabaseUrl="https://example.supabase.co";') {
  const result = await build({stdin:{contents:source,resolveDir:fileURLToPath(new URL('..',import.meta.url)),sourcefile:'preview-test.tsx'},
    bundle:true,write:false,platform:'node',format:'cjs',external:['react','react-dom','react-dom/*','docx-preview','dompurify'],loader:{'.css':'empty'},
    plugins:[{name:'isolated-preview',setup(builder) {
      builder.onLoad({filter:/[\\/]src[\\/]supabase\.ts$/},()=>({contents:supabaseSource,loader:'ts'}));
      if(mockDocx) builder.onLoad({filter:/[\\/]src[\\/]telegram[\\/]docxPreview\.ts$/},()=>({contents:'export const renderDocxPreview = async () => "<html><body>Word preview</body></html>";',loader:'ts'}));
    }}],
  });
  const module = {exports:{} as any}; new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports); return module.exports;
}

const gradeApiMock = `
export const fixture = {rows: [], calls: 0};
export const supabaseUrl = "https://example.supabase.co";
export const supabase = {from: () => {
  let cursor = Infinity, limit = 0;
  const query = {select: () => query, eq: () => query, order: () => query,
    limit: n => {limit=n; return query},
    or: filter => {cursor=Number(filter.match(/message_id.lt.(\\d+)/)[1]); return query},
    abortSignal: async signal => {signal.throwIfAborted(); fixture.calls++;
      return {data:fixture.rows.filter(row=>row.message_id<cursor).slice(0,limit),error:null}}};
  return query;
}};
`;

test('the actual grade feed combines site posts and Telegram chronologically, updates hashtag edits and resets when switching class', async () => {
  const environment = browserEnvironment();
  let root: any;
  try {
    const source = gradeApiMock + `
      fixture.handlers = new Set();
      fixture.emit = row => {fixture.rows = fixture.rows.map(old => old.message_id === row.message_id ? row : old);
        for (const handler of fixture.handlers) handler({eventType:'UPDATE',new:row})};
      supabase.channel = () => {let handler;
        const channel = {on: (_event,_filter,callback) => {handler=callback;fixture.handlers.add(handler);return channel},
          subscribe: () => channel,close: () => fixture.handlers.delete(handler)}; return channel};
      supabase.removeChannel = async channel => channel.close();
    `;
    const {TelegramFeed,fixture} = await compiled("export {TelegramFeed} from './src/components/TelegramFeed.tsx'; export {fixture} from './src/supabase.ts';",false,source);
    fixture.rows = [post(3,{text:'Задача #8класс',published_at:'2026-10-08T03:00:00Z'}),
      post(2,{text:'Для всех',published_at:'2026-10-08T02:00:00Z'}),post(1,{text:'Задача #9класс',published_at:'2026-10-08T01:00:00Z'})];
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    await act(async()=>root.render(React.createElement(TelegramFeed,{key:8,active:true,grade:8,additionalEntries:[{
      key:'site-author',publishedAt:'2026-10-08T04:00:00Z',content:React.createElement('article',null,'От автора сайта')}]})));
    const texts = () => [...document.querySelectorAll('article')].map((entry:any)=>entry.textContent);
    assert.equal(document.querySelector('h1')?.textContent,'8 класс');
    assert.equal(texts().length,3); assert.equal(texts()[0],'От автора сайта');
    assert.ok(texts()[1].includes('#8класс'));assert.ok(texts()[2].includes('Для всех'));
    assert.ok(!texts().some(text=>text.includes('#9класс')));
    await act(async()=>fixture.emit({...fixture.rows[0],text:'Перенесено #9класс',source_revision_at:'2026-10-09T00:00:00Z'}));
    assert.equal(texts().length,2);
    await act(async()=>root.render(React.createElement(TelegramFeed,{key:9,active:true,grade:9})));
    assert.equal(document.querySelector('h1')?.textContent,'9 класс');assert.equal(texts().length,3);
    assert.ok(texts()[0].includes('Перенесено #9класс'));assert.ok(!texts().some(text=>text.includes('От автора сайта')));
    assert.equal(fixture.handlers.size,1);
  } finally {if(root)await act(async()=>root.unmount());environment.restore();}
});

test('grade pagination scans past nonmatching posts, advances the raw cursor and does not split an album', async () => {
  const {loadTelegramPage,fixture} = await compiled("export {loadTelegramPage} from './src/telegram/api.ts'; export {fixture} from './src/supabase.ts';",false,gradeApiMock);
  fixture.rows = Array.from({length:100},(_,i)=>post(100-i,{text:i<50?'#9класс':'#8класс',
    published_at:new Date(Date.UTC(2026,9,8)+(100-i)*1000).toISOString()}));
  const signal = new AbortController().signal, page = await loadTelegramPage(signal,undefined,8);
  assert.equal(fixture.calls,3); assert.equal(page.hasMore,true); assert.equal(page.posts.at(-1).message_id,11);
  assert.equal(groupTelegramPosts(page.posts).filter(item=>telegramMatchesGrade(item,8)).length,40);
  const older = await loadTelegramPage(signal,page.posts.at(-1),8);
  assert.equal(older.hasMore,false); assert.equal(older.posts.length,10);
  assert.equal(new Set([...page.posts,...older.posts].map(item=>item.message_id)).size,100);
  fixture.rows = [post(431,{text:'#8класс'}),post(430),post(429),post(428)];
  const [album] = groupTelegramPosts((await loadTelegramPage(signal,undefined,8)).posts);
  assert.equal(album.attachments.length,4); assert.equal(telegramMatchesGrade(album,9),false);
});

test('sparse grade requests stay bounded, respect cancellation and general chat keeps its unfiltered pagination', async () => {
  const {loadTelegramPage,fixture} = await compiled("export {loadTelegramPage} from './src/telegram/api.ts'; export {fixture} from './src/supabase.ts';",false,gradeApiMock);
  fixture.rows = Array.from({length:400},(_,i)=>post(400-i,{text:'#9класс',published_at:new Date(Date.UTC(2026,9,8)+(400-i)*1000).toISOString()}));
  const signal = new AbortController().signal;
  const general = await loadTelegramPage(signal); assert.equal(general.posts.length,30);assert.equal(fixture.calls,1);
  fixture.calls=0;
  const page = await loadTelegramPage(signal,undefined,8);assert.equal(fixture.calls,10);assert.equal(page.hasMore,true);
  const remaining = await loadTelegramPage(signal,page.posts.at(-1),8);assert.equal(remaining.hasMore,false);
  const controller=new AbortController();controller.abort();await assert.rejects(loadTelegramPage(controller.signal,undefined,8));
  await assert.rejects(loadTelegramPage(signal,undefined,6),/Invalid grade/);
});

function browserEnvironment() {
  const dom = new JSDOM('<!doctype html><body><button id="origin">Open</button><div id="root"></div></body>',{url:'https://example.test'});
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window','document','Node','Element','HTMLElement','DOMParser','XMLSerializer','FileReader','Blob','getComputedStyle']) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:(dom.window as any)[key]});
  }
  previous.set('IS_REACT_ACT_ENVIRONMENT',Object.getOwnPropertyDescriptor(globalThis,'IS_REACT_ACT_ENVIRONMENT'));
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  return {dom,restore() {dom.window.close();for(const [key,value]of previous) {if(value)Object.defineProperty(globalThis,key,value);else delete(globalThis as any)[key];}}};
}

test('one article exposes four open buttons, four separate downloads and a single caption/date/source', async () => {
  const {TelegramEntry} = await compiled("export {TelegramEntry} from './src/components/TelegramFeed.tsx';");
  const [group] = groupTelegramPosts([post(431,{text:'Пробные СОР'}),post(430),post(429),post(428)]);
  const markup = renderToStaticMarkup(React.createElement(TelegramEntry,{post:group}));
  const {window} = new JSDOM(markup), document = window.document;
  assert.equal(document.querySelectorAll('article').length,1); assert.equal(document.querySelectorAll('time').length,1);
  assert.equal(document.querySelectorAll('.telegram-file-open').length,4); assert.equal(document.querySelectorAll('.telegram-file-download').length,4);
  assert.equal(document.querySelectorAll('.telegram-source').length,1); assert.equal(document.querySelector('.dispatch-text')?.textContent,'Пробные СОР');
  window.close();
});

test('Word output preserves tables and MathML while stripping script, active HTML, unsafe URLs and external CSS', async () => {
  const environment = browserEnvironment();
  try {
    const {cleanDocumentHtml} = await compiled("export {cleanDocumentHtml} from './src/telegram/docxPreview.ts';");
    const result = cleanDocumentHtml('<p onclick="evil()">Тест <b>формулы</b></p><table><tr><td>1</td></tr></table>'
      +'<math><mfrac><mi>F</mi><mi>m</mi></mfrac></math><script>evil()</script><iframe src="https://evil.test"></iframe>'
      +'<a href="javascript:evil()">link</a><img src="https://evil.test/tracker"><p style="background:url(https://evil.test)">text</p>',
      'body{background:url(https://evil.test)}');
    assert.match(result,/<table>/); assert.match(result,/<math>/); assert.match(result,/<mfrac>/);
    assert.doesNotMatch(result,/onclick|<script|<iframe|javascript:|https:\/\/evil/);
    assert.match(result,/Content-Security-Policy/); assert.match(result,/default-src &#?|'none'/);
    assert.match(cleanDocumentHtml('<p>text</p>','.docx-wrapper>section.docx{background:white}'),/docx-wrapper>section.docx\{background:white\}/);
  } finally {environment.restore();}
});

test('DOCX ZIP budget checks reject expanded bombs, encryption and corrupt directory data before rendering', async () => {
  const JSZip = createRequire(require.resolve('docx-preview'))('jszip');
  const zip = new JSZip();zip.file('word/document.xml','<document/>');
  const bytes: ArrayBuffer = await zip.generateAsync({type:'arraybuffer'});assert.doesNotThrow(()=>assertDocxBudget(bytes));
  const data = new DataView(bytes), central = data.getUint32(bytes.byteLength-6,true);
  const bomb = bytes.slice(0);new DataView(bomb).setUint32(central+24,0xffffffff,true);assert.throws(()=>assertDocxBudget(bomb),/budget/);
  const encrypted = bytes.slice(0);new DataView(encrypted).setUint16(central+8,1,true);assert.throws(()=>assertDocxBudget(encrypted),/budget/);
  assert.throws(()=>assertDocxBudget(new ArrayBuffer(24)),/Invalid/);
});

test('a real generated Word document renders text, a table and an equation in the sandbox preview', async () => {
  const environment = browserEnvironment();
  try {
    const JSZip = createRequire(require.resolve('docx-preview'))('jszip'), zip = new JSZip();
    zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>'
      +'<w:p><w:r><w:t>Физика — 8 класс</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Ответ</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
      +'<w:p><m:oMath><m:f><m:num><m:r><m:t>F</m:t></m:r></m:num><m:den><m:r><m:t>m</m:t></m:r></m:den></m:f></m:oMath></w:p></w:body></w:document>');
    const {renderDocxPreview} = await compiled("export {renderDocxPreview} from './src/telegram/docxPreview.ts';");
    const html = await renderDocxPreview(await zip.generateAsync({type:'arraybuffer'}),new AbortController().signal);
    assert.match(html,/Физика — 8 класс/);assert.match(html,/<table/);assert.match(html,/<mfrac/);
  } finally {environment.restore();}
});

test('the file dialog switches PDF/Word, closes with Escape, restores focus and releases the scroll lock', async () => {
  const environment = browserEnvironment(), previousFetch = globalThis.fetch;
  let root: any;
  try {
    globalThis.fetch = (async()=>new Response(new Uint8Array([1,2,3]))) as typeof fetch;
    const {default:Viewer} = await compiled("export {default} from './src/components/AttachmentViewer.tsx';",true);
    const {createRoot} = require('react-dom/client');root=createRoot(document.getElementById('root'));
    const origin = document.getElementById('origin') as HTMLButtonElement;origin.focus();
    document.body.style.overflow='auto';
    const items = [{kind:'document',name:'one.pdf',path:'nisphysicshub/assets/one.pdf',mime:'application/pdf'},
      {kind:'document',name:'two.docx',path:'nisphysicshub/assets/two.docx'}];
    const close = ()=>root.render(null);
    await act(async()=>root.render(React.createElement(Viewer,{items,initialIndex:0,onClose:close})));
    assert.equal(document.body.style.overflow,'hidden');assert.ok(document.querySelector('iframe')?.src.includes('one.pdf'));
    await act(async()=>{(document.querySelector('[aria-label="Следующий файл"]')as HTMLButtonElement).click();await new Promise(resolve=>setTimeout(resolve,30));});
    assert.equal(document.querySelector('#attachment-title')?.textContent,'two.docx');
    const frame = document.querySelector('iframe');assert.equal(frame?.getAttribute('sandbox'),'allow-same-origin');assert.match(frame?.srcdoc||'',/Word preview/);
    await act(async()=>document.dispatchEvent(new environment.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(document.body.style.overflow,'auto');assert.equal(document.activeElement,origin);
  } finally {if(root)await act(async()=>root.unmount());globalThis.fetch=previousFetch;environment.restore();}
});
