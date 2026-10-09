import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse } from 'dotenv';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { groupTelegramPosts, completeTelegramPage, TELEGRAM_PAGE_SIZE, TELEGRAM_ALBUM_LIMIT } from '../src/telegram/model.ts';

const output = process.argv[2];
assert.ok(output, 'Pass a verification output directory');
const environment = {...parse(await readFile(new URL('../.env.local',import.meta.url))),...parse(await readFile(new URL('../.env.production',import.meta.url)))};
const base = environment.VITE_SUPABASE_URL, key = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key.startsWith('sb_publishable_'));
let cursor, hasMore = true, requests = 0;const posts = [], ids = new Set();
while(hasMore) {
  assert.ok(++requests < 50, 'Pagination loop');
  const query = new URLSearchParams({channel_username:'eq.nisphysicshub',select:'*',order:'published_at.desc,message_id.desc',limit:String(TELEGRAM_PAGE_SIZE+TELEGRAM_ALBUM_LIMIT+1)});
  if(cursor) query.set('or',`(published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},message_id.lt.${cursor.message_id}))`);
  const response = await fetch(base+'/rest/v1/telegram_posts?'+query,{headers:{apikey:key}});assert.equal(response.status,200);
  const page = completeTelegramPage(await response.json());
  for(const post of page.posts) {assert.ok(!ids.has(post.message_id),'Duplicate cursor row');ids.add(post.message_id);posts.push(post);}
  cursor = page.posts.at(-1);hasMore = page.hasMore;
}
const groups = groupTelegramPosts(posts), screenshot = groups.find(group=>group.attachments.some(item=>item.source_message_id===431));
assert.equal(screenshot.attachments.length,4);assert.match(screenshot.text,/Пробные СОР/);
assert.deepEqual(screenshot.attachments.map(item=>item.source_message_id),[431,430,429,428]);

const code = await build({stdin:{contents:"export {TelegramEntry} from './src/components/TelegramFeed.tsx'; export {renderDocxPreview} from './src/telegram/docxPreview.ts'; export {readPreviewBytes} from './src/telegram/preview.ts';",
  sourcefile:'verify.tsx',resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,write:false,platform:'node',format:'cjs',external:['react','react-dom','react-dom/*','docx-preview','dompurify'],loader:{'.css':'empty'},
  plugins:[{name:'public-verification',setup(builder){builder.onLoad({filter:/[\\/]src[\\/]supabase\.ts$/},()=>({contents:`export const supabase = {}; export const supabaseUrl = ${JSON.stringify(base)};`,loader:'ts'}));}}]});
const module={exports:{}};new Function('require','module','exports',code.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {TelegramEntry,renderDocxPreview,readPreviewBytes} = module.exports;
const entry = renderToStaticMarkup(React.createElement(TelegramEntry,{post:screenshot}));
const dom = new JSDOM('<!doctype html><body></body>',{url:'https://example.test'}), previous = new Map();
for(const name of ['window','document','Node','Element','HTMLElement','DOMParser','XMLSerializer','Blob','FileReader']) {
  previous.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name]});
}
const converted=[];
try {
  await mkdir(resolve(output),{recursive:true});
  const css = await readFile(new URL('../src/styles/dispatches.css',import.meta.url),'utf8');
  await writeFile(resolve(output,'grouped-entry.html'),'<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#060b14}button{background:none;border:0;color:inherit}a{color:inherit;text-decoration:none}'+css+'</style><main class="dispatch-page">'+entry+'</main>');
  for(const item of screenshot.attachments) {
    const response = await fetch(base+'/storage/v1/object/public/telegram-media/'+item.path,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200);
    const bytes = await readPreviewBytes(response), html = await renderDocxPreview(bytes,new AbortController().signal);
    const view = new dom.window.DOMParser().parseFromString(html,'text/html');
    assert.ok(view.querySelector('.docx'), 'Missing document page');assert.ok(view.body.textContent.trim().length > 40, 'Missing document text');
    assert.ok(view.querySelector('style').textContent.length > 1000, 'Missing Word page styles');
    assert.equal(view.querySelectorAll('script,object,embed,iframe').length,0);
    assert.equal(view.querySelectorAll('[href^="javascript"],[src^="http"]').length,0);
    await writeFile(resolve(output,'document-'+item.source_message_id+'.html'),html);
    converted.push({message_id:item.source_message_id,pages:view.querySelectorAll('section.docx').length,tables:view.querySelectorAll('table').length,
      formulas:view.querySelectorAll('math').length,images:view.querySelectorAll('img').length});
  }
} finally {dom.window.close();for(const[name,value]of previous){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}}
console.log(JSON.stringify({database_rows:posts.length,pagination_requests:requests,display_entries:groups.length,screenshot_files:screenshot.attachments.length,word_documents:converted}));
