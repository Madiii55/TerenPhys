import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { sha256 } from '../supabase/functions/_shared/telegram.ts';

const require = createRequire(import.meta.url);
const original = [{kind:'document',name:'original.docx',external:true}];
const bytes = readFileSync(new URL('../public/study/8/1/b/sau-ru.docx',import.meta.url));

async function restoreHandler(active: boolean) {
  const digest = await sha256('test-only-restore');
  const result = await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/telegram-restore-media/index.ts',import.meta.url))],
    bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'restore-test',setup(builder) {
      if(active) builder.onLoad({filter:/telegram-restore-media[\\/]index.ts$/}, args=>({loader:'ts',contents:readFileSync(args.path,'utf8')
        .replace("const CONTROL_DIGEST: string = '';",`const CONTROL_DIGEST: string = '${digest}';`)
        .replace('const CONTROL_EXPIRES: number = 0;',`const CONTROL_EXPIRES: number = ${Date.now()+60000};`)
        .replace('const OWNER_CHAT_ID: number = 0;','const OWNER_CHAT_ID: number = 123;')}));
    }}]});
  const module={exports:{} as any}; new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
  return module.exports.handleRestore;
}

async function fixture(run: (state: {calls:string[];patches:any[];foreign:boolean;forwarded:boolean})=>Promise<void>) {
  const previousFetch=globalThis.fetch, deno=Object.getOwnPropertyDescriptor(globalThis,'Deno');
  const state={calls:[] as string[],patches:[] as any[],foreign:false,forwarded:false};
  Object.defineProperty(globalThis,'Deno',{configurable:true,value:{serve(){},env:{get:(name:string)=>({
    TELEGRAM_BOT_TOKEN:'test-bot',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"sb_secret_test"}'
  }[name])}}});
  globalThis.fetch=(async(input,init)=> {
    const url=String(input); state.calls.push(url);
    const response=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
    if(url.includes('/getChat')) { const chat=JSON.parse(String(init?.body)).chat_id;
      return response({ok:true,result:chat===123?{id:123,type:'private'}:{id:-1001,type:'channel',username:'nisphysicshub'}}); }
    if(url.includes('/forwardMessage')) return response({ok:true,result:{chat:{id:123},forward_origin:state.forwarded?{type:'hidden_user'}:{type:'channel',chat:{id:-1001},message_id:state.foreign?43:42},
      document:{file_id:'test-file',file_name:'original.docx',file_size:bytes.length}}});
    if(url.includes('/getFile')) return response({ok:true,result:{file_path:'documents/test.docx',file_size:bytes.length}});
    if(url.includes('/file/bottest-bot/')) return new Response(bytes);
    if(url.includes('/storage/v1/object/')) return response({Key:'stored'});
    if(url.includes('/rest/v1/telegram_posts')) {
      if(init?.method==='PATCH') { assert.ok(url.endsWith('attachments=eq.'+encodeURIComponent(JSON.stringify(original))));
        state.patches.push(JSON.parse(String(init.body))); return response([{message_id:42}]); }
      return response([{attachments:original}]);
    }
    throw new Error('Unexpected request');
  }) as typeof fetch;
  try {await run(state);} finally {globalThis.fetch=previousFetch;if(deno)Object.defineProperty(globalThis,'Deno',deno);else delete (globalThis as any).Deno;}
}

const request=(message_id=42,credential='test-only-restore')=>new Request('https://example.test/restore',{
  method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify({message_id})});

test('maintenance restoration is closed by default and rejects wrong credentials or arbitrary sources before Telegram calls',async()=>fixture(async state=>{
  assert.equal((await (await restoreHandler(false))(request())).status,410);
  const handler=await restoreHandler(true);
  assert.equal((await handler(request(42,'wrong'))).status,401);
  assert.equal((await handler(request(900))).status,400);
  assert.deepEqual(state.calls,[]);
}));

test('restoration checks the exact forwarded source, stores original bytes by hash and only patches the unchanged attachment JSON',async()=>fixture(async state=>{
  const handler=await restoreHandler(true), response=await handler(request());
  assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.sha256,await sha256(bytes));assert.equal(result.bytes,bytes.length);
  assert.equal(result.attachment.name,'original.docx');assert.equal(result.attachment.external,undefined);
  assert.equal(state.patches.length,1);assert.deepEqual(Object.keys(state.patches[0]),['attachments']);
  assert.ok(state.calls.some(url=>url.endsWith('/'+result.attachment.path)));
  assert.equal(original[0].external,true);
}));

test('a mismatched forwarded message never reaches storage or changes the source record',async()=>fixture(async state=>{
  state.foreign=true;const handler=await restoreHandler(true),response=await handler(request());
  assert.equal(response.status,409);assert.deepEqual(state.patches,[]);
  assert.ok(state.calls.every(url=>!url.includes('/storage/')));
}));

test('a channel post forwarded from a private author retains Telegram’s original origin and still restores the exact requested file',async()=>fixture(async state=>{
  state.forwarded=true;const handler=await restoreHandler(true),response=await handler(request());
  assert.equal(response.status,200);assert.equal(state.patches.length,1);
}));
