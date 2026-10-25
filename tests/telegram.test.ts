import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parsePublicPage } from '../scripts/telegram-public.mjs';
import { parseHtmlExport, exportDate, localExportPath } from '../scripts/telegram-export.mjs';
import { CHANNEL, MAX_MEDIA_BYTES, botPost, cleanEntities, constantTimeEqual, normalizePublicPost, normalizeExportPost, publicMediaUrl, readLimited, safeBotPath, validChannelPost, webhookSecret } from '../supabase/functions/_shared/telegram.ts';
import { TELEGRAM_CHANNEL, groupTelegramPosts, mergeTelegramPosts, safeTelegramLink, telegramMediaUrl, telegramEntities, type TelegramPost } from '../src/telegram/model.ts';

const post = (id: number, extra: Partial<TelegramPost> = {}): TelegramPost => ({ channel_username: CHANNEL, message_id: id,
  text: 'Сила 🪐', entities: [], attachments: [], published_at: '2026-10-07T00:00:00.000Z', source_revision_at: '2026-10-07T00:00:00.000Z',
  source_kind: 'public', media_group_id: null, ...extra });

test('public parser keeps emoji, line breaks, formatting, source IDs and named document fallbacks', () => {
  const html = `<a data-before="25"></a><div class="tgme_widget_message" data-post="nisphysicshub/29">
    <div class="tgme_widget_message_text">🪐<b>Физика</b><br><a href="https://example.org">Задача</a><script>alert(1)</script></div>
    <a class="tgme_widget_message_document_wrap"><div class="tgme_widget_message_document_title">СОР.docx</div></a>
    <a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn1.telesco.pe/file/photo.jpg')"></a>
    <a class="tgme_widget_message_date"><time datetime="2026-10-07T00:00:00Z"></time></a></div>`;
  const parsed = parsePublicPage(html);
  assert.equal(parsed.before, 25); assert.equal(parsed.posts.length, 1);
  assert.equal(parsed.posts[0].text, '🪐Физика\nЗадача');
  assert.equal(parsed.posts[0].entities.find((e: { type: string; offset: number }) => e.type === 'bold')?.offset, 2);
  assert.deepEqual(parsed.posts[0].attachments, [{ kind: 'photo', source_url: 'https://cdn1.telesco.pe/file/photo.jpg' }, { kind: 'document', name: 'СОР.docx', external: true }]);
  assert.equal(parsePublicPage(html.replace('nisphysicshub/29', 'other/29')).posts.length, 0);
});

test('HTML exports preserve channel IDs, UTF-16 formatting and original files without executing scripts', () => {
  const html = `<div class="page_header"><div class="text">Physics Hub | TerenSci</div></div>
    <div class="message service" id="message199"><div class="body">pinned</div></div>
    <div class="message default" id="message200"><div class="body">
      <div class="date" title="08.01.2026 18:14:57 UTC+05:00"></div>
      <div class="text">\n  🪐<strong>Физика</strong><br><a href="#go_to_message78" onclick="evil()">Задача</a><script>evil()</script>\n </div>
      <div class="media_wrap"><a class="photo_wrap" href="photos/full.jpg"><img src="photos/thumb.jpg"></a>
        <a class="media_file" href="files/СОР.docx"><div class="title">СОР.docx</div></a></div>
    </div></div>`;
  const result = parseHtmlExport(html);
  assert.equal(result.posts.length, 1);
  const row = result.posts[0];
  assert.equal(row.message_id, 200); assert.equal(row.source_kind, 'export');
  assert.equal(row.published_at, '2026-01-08T13:14:57.000Z');
  assert.equal(row.text, '🪐Физика\nЗадача');
  assert.deepEqual(row.entities.find((e: { type: string }) => e.type === 'bold'), { type: 'bold', offset: 2, length: 6 });
  assert.equal(row.entities.find((e: { type: string }) => e.type === 'text_link')?.url, 'https://t.me/nisphysicshub/78');
  assert.deepEqual(row.attachments.map((a: { local_path: string }) => a.local_path), ['photos/full.jpg', 'files/СОР.docx']);
  assert.throws(() => parseHtmlExport(html.replace('Physics Hub | TerenSci', 'Private chat')));
  assert.throws(() => parseHtmlExport(html.replace('UTC+05:00', 'missing zone')));
});

test('export dates use their explicit timezone and media paths cannot leave the extracted folder', () => {
  assert.equal(exportDate('07.10.2026 18:44:21 UTC+05:00'), '2026-10-07T13:44:21.000Z');
  assert.equal(exportDate('07.10.2026 08:44:21 UTC-05:00'), '2026-10-07T13:44:21.000Z');
  assert.ok(localExportPath('C:/safe/export', 'files/СОР.docx').endsWith('СОР.docx'));
  for (const value of ['files/../../secret', 'files/../secret', 'files/a\\..\\secret', 'C:/secret', '\\\\host\\secret', 'https://example.test', 'js/script.js', 'files/a:stream']) assert.throws(() => localExportPath('C:/safe/export', value));
});

test('export post validation accepts only persistent bucket paths and never publishes local paths', () => {
  const path = 'nisphysicshub/assets/' + 'a'.repeat(64) + '.pdf';
  const data = { ...post(1), attachments: [{ kind: 'document', path, mime: 'application/pdf', name: 'СОР.pdf', local_path: 'files/private.pdf' }] };
  const result = normalizeExportPost(data);
  assert.equal(result.source_kind, 'export'); assert.equal(result.attachments[0].path, path);
  assert.doesNotMatch(JSON.stringify(result), /local_path|private.pdf/);
  for (const bad of ['other/assets/' + 'a'.repeat(64) + '.pdf', 'nisphysicshub/assets/../../secret', 'https://api.telegram.org/file/botTOKEN/x', 'nisphysicshub/assets/short.pdf']) assert.throws(() => normalizeExportPost({ ...data, attachments: [{ ...data.attachments[0], path: bad }] }));
});

test('export polls retain their question/options, not executable handlers or vote counters', () => {
  const html = `<div class="page_header"><div class="text">Physics Hub | TerenSci</div></div>
    <div class="message default" id="message221"><div class="body"><div class="date" title="08.01.2026 18:14:57 UTC+05:00"></div>
      <div class="media_wrap"><div class="question">Какой класс?</div><div class="answer">- 7 <span class="details">10 votes</span></div><div class="answer">- 8</div></div></div></div>`;
  const result = parseHtmlExport(html).posts[0];
  assert.equal(result.text, 'Какой класс?\n• 7\n• 8'); assert.equal(result.attachments[0].external, true);
});

test('one-time bot setup remains closed; retry diagnostics cannot expose the stored token', async () => {
  const before = (globalThis as any).Deno;
  (globalThis as any).Deno = { env: { get: () => { throw new Error('Closed setup must not read secrets'); } }, serve: () => {} };
  try {
    const { handleSetup } = await import('../supabase/functions/telegram-setup/index.ts');
    assert.equal((await handleSetup(new Request('https://example.test', { method: 'POST' }))).status, 410);
    const source = readFileSync(new URL('../supabase/functions/telegram-setup/index.ts', import.meta.url), 'utf8');
    assert.match(source, /before.url && before.url !== target/);
    assert.match(source, /drop_pending_updates: false/);
    assert.match(source, /return_bots: true/);
    assert.doesNotMatch(source, /json\([^\n]*token[, }]/);
  } finally { (globalThis as any).Deno = before; }
});

test('media import cannot fetch internal URLs, foreign hosts, credentials or bot-token URLs', () => {
  assert.equal(publicMediaUrl('https://cdn4.telesco.pe/file/image.jpg'), 'https://cdn4.telesco.pe/file/image.jpg');
  for (const url of ['http://cdn4.telesco.pe/file/x', 'https://127.0.0.1/file/x', 'https://cdn4.telesco.pe.evil.test/file/x',
    'https://cdn4.telesco.pe:1234/file/x', 'https://secret@cdn4.telesco.pe/file/x', 'https://api.telegram.org/file/botTOKEN/file.jpg']) assert.equal(publicMediaUrl(url), null);
  assert.equal(safeBotPath('photos/file_123.jpg'), true);
  for (const path of ['../secrets', '/etc/passwd', 'https://evil.test', 'a/../b', 'a//b', 'a/./b', 'x?token=secret']) assert.equal(safeBotPath(path), false);
});

test('webhook restricts both the channel username and actual numeric ID', () => {
  const message = { chat: { type: 'channel', username: 'NisPhysicsHub', id: -100123456 }, message_id: 42, date: 1791331200 };
  assert.equal(validChannelPost(message, -100123456), true);
  assert.equal(validChannelPost(message, -100999), false);
  assert.equal(validChannelPost({ ...message, chat: { ...message.chat, username: 'other' } }, -100123456), false);
  assert.equal(validChannelPost({ ...message, chat: { ...message.chat, type: 'private' } }, -100123456), false);
  assert.equal(validChannelPost({ ...message, message_id: -1 }, -100123456), false);
});

test('bot normalization preserves captions, album IDs, edited timestamps and the largest photo', () => {
  const result = botPost({ message_id: 42, date: 1791331200, edit_date: 1791331300, caption: '🪐Сила',
    caption_entities: [{ type: 'bold', offset: 2, length: 4 }], media_group_id: '123',
    photo: [{ file_id: 'small', file_size: 10 }, { file_id: 'large', file_size: 100 }] });
  assert.equal(result.source_kind, 'bot'); assert.equal(result.media_group_id, '123');
  assert.equal(result.attachments[0].file_id, 'large'); assert.equal(result.entities[0].offset, 2);
  assert.ok(Date.parse(result.source_revision_at) > Date.parse(result.published_at));
  const poll = botPost({ message_id: 43, date: 1791331200, poll: { question: 'Ответ?', options: [{ text: 'А' }, { text: 'Б' }] } });
  assert.equal(poll.text, 'Ответ?\n• А\n• Б'); assert.equal(poll.attachments[0].external, true);
});

test('only bounded UTF-16 entities and approved public post origins can be imported', () => {
  const text = '🪐Сила';
  const entries = [{ type: 'bold', offset: 2, length: 4 }, { type: 'bold', offset: -1, length: 4 }, { type: 'bold', offset: 2, length: 99 }];
  assert.equal(cleanEntities(entries, text).length, 1); assert.equal(telegramEntities(entries, text).length, 1);
  assert.equal(normalizePublicPost(post(1)).message_id, 1);
  assert.throws(() => normalizePublicPost(post(1, { channel_username: 'other' })));
  assert.throws(() => normalizePublicPost({ ...post(1), attachments: [{ kind: 'photo', source_url: 'https://evil.test' }] }));
  assert.throws(() => normalizePublicPost(post(1, { published_at: 'broken' })));
});

test('persistent attachment URLs cannot escape the dedicated bucket or expose bot tokens', () => {
  assert.equal(telegramMediaUrl('https://example.supabase.co/', CHANNEL + '/assets/photo.jpg'), 'https://example.supabase.co/storage/v1/object/public/telegram-media/nisphysicshub/assets/photo.jpg');
  for (const path of ['other/photo.jpg', 'nisphysicshub/../secret', 'nisphysicshub/./secret', 'https://api.telegram.org/botSECRET', 'nisphysicshub/x?token=secret']) assert.equal(telegramMediaUrl('https://example.supabase.co', path), undefined);
  for (const link of ['javascript:alert(1)', 'data:text/html,evil', 'https://user:password@example.org', 'file:///etc/passwd']) assert.equal(safeTelegramLink(link), undefined);
  assert.equal(safeTelegramLink('https://t.me/nisphysicshub'), 'https://t.me/nisphysicshub');
});

test('pagination merges without duplicates and albums combine across pages without mutating source rows', () => {
  const a = post(2, { text: '', media_group_id: 'album', attachments: [{ kind: 'photo', path: CHANNEL + '/assets/a.jpg' }] });
  const b = post(1, { media_group_id: 'album', attachments: [{ kind: 'photo', path: CHANNEL + '/assets/b.jpg' }] });
  const rows = mergeTelegramPosts([a], [b, { ...a, text: 'Обновлено' }]);
  assert.deepEqual(rows.map(row => row.message_id), [2, 1]);
  const group = groupTelegramPosts([a, b])[0];
  assert.equal(group.message_id, 1); assert.equal(group.text, b.text); assert.equal(group.attachments.length, 2);
  assert.equal(a.text, ''); assert.equal(a.attachments.length, 1);
});

test('request and media readers stop before accepting unbounded payloads', async () => {
  const stream = () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3, 4])); controller.close(); } });
  assert.deepEqual(await readLimited(stream(), 4), new Uint8Array([1, 2, 3, 4]));
  await assert.rejects(readLimited(stream(), 3), /too large/);
  assert.equal(MAX_MEDIA_BYTES, 20 * 1024 * 1024);
  const secret = await webhookSecret('test-token');
  assert.match(secret, /^[0-9a-f]{64}$/); assert.notEqual(secret, 'test-token');
  assert.equal(constantTimeEqual(secret, secret), true); assert.equal(constantTimeEqual(secret, 'bad'), false);
});

test('webhook authenticates before payload parsing or any privileged request; resting import is closed', async () => {
  const environment: Record<string, string> = { TELEGRAM_BOT_TOKEN: 'dummy-bot-token' };
  const previousDeno = (globalThis as any).Deno;
  (globalThis as any).Deno = { env: { get: (key: string) => environment[key] }, serve: () => {} };
  try {
    const { handleWebhook } = await import('../supabase/functions/telegram-sync/index.ts');
    const { handleImport } = await import('../supabase/functions/telegram-import/index.ts');
    const wrong = await handleWebhook(new Request('https://example.test', { method: 'POST', body: 'broken JSON' }));
    assert.equal(wrong.status, 401);
    const secret = await webhookSecret(environment.TELEGRAM_BOT_TOKEN);
    const invalid = await handleWebhook(new Request('https://example.test', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret }, body: 'broken JSON' }));
    assert.equal(invalid.status, 400);
    const ignored = await handleWebhook(new Request('https://example.test', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify({ message: { text: 'private' } }) }));
    assert.equal(ignored.status, 200); assert.deepEqual(await ignored.json(), { ignored: true });
    delete environment.TELEGRAM_BOT_TOKEN;
    assert.equal((await handleWebhook(new Request('https://example.test', { method: 'POST' }))).status, 503);
    assert.equal((await handleImport(new Request('https://example.test', { method: 'POST' }))).status, 410);
  } finally { (globalThis as any).Deno = previousDeno; }
});

test('Telegram rendering escapes markup, rejects unsafe links and preserves source text', async () => {
  const result = await build({ stdin: { contents: "export { TelegramText, TelegramEntry } from './src/components/TelegramFeed.tsx'; export { telegramCursorFilter } from './src/telegram/api.ts';",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)), sourcefile: 'telegram-render.ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react-dom', 'react-dom/*'], loader: { '.css': 'empty' },
    plugins: [{ name: 'isolated-telegram', setup(builder) {
      builder.onLoad({ filter: /[\\/]src[\\/]supabase\.ts$/ }, () => ({ contents: 'export const supabase = {}; export const supabaseUrl = "https://example.supabase.co";', loader: 'ts' }));
      builder.onResolve({ filter: /pdf\.worker\.mjs\?url$/ }, () => ({ path:'worker',namespace:'worker-url-test' }));
      builder.onLoad({ filter:/.*/,namespace:'worker-url-test' }, () => ({ contents:'export default "/test-pdf-worker.mjs";',loader:'js' }));
    } }],
  });
  const compiled: { exports: any } = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  const { TelegramText, TelegramEntry, telegramCursorFilter } = compiled.exports;
  const text = '<img onerror=evil>🪐';
  const markup = renderToStaticMarkup(React.createElement(TelegramText, { text, entities: [{ type: 'text_link', offset: 0, length: text.length, url: 'javascript:evil' }] }));
  assert.ok(markup.includes('&lt;img')); assert.doesNotMatch(markup, /<img|href=/);
  const entry = renderToStaticMarkup(React.createElement(TelegramEntry, { post: post(5, { attachments: [{ kind: 'document', name: 'СОР.docx', external: true }] }) }));
  assert.match(entry, /СОР.docx/); assert.match(entry, /https:\/\/t.me\/nisphysicshub\/5/);
  assert.match(entry, /Сила 🪐/);
  assert.equal(telegramCursorFilter(post(7)), 'published_at.lt.2026-10-07T00:00:00.000Z,and(published_at.eq.2026-10-07T00:00:00.000Z,message_id.lt.7)');
  assert.throws(() => telegramCursorFilter(post(7, { published_at: 'x,foreign.filter' })));
});

test('an authenticated channel update copies media server-side and stores no bot credentials', async () => {
  const environment: Record<string, string> = { TELEGRAM_BOT_TOKEN: 'dummy-bot-token', SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_dummy' }) };
  const previousDeno = (globalThis as any).Deno, previousFetch = globalThis.fetch;
  const captured: any[] = [];
  (globalThis as any).Deno = { env: { get: (key: string) => environment[key] }, serve: () => {} };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/rest/v1/telegram_sources')) return Response.json([{ chat_id: -100123456 }]);
    if (url.endsWith('/getFile')) return Response.json({ ok: true, result: { file_path: 'photos/file.jpg', file_size: 4 } });
    if (url.includes('/file/bot')) return new Response(new Uint8Array([255, 216, 255, 217]), { headers: { 'Content-Type': 'image/jpeg' } });
    if (url.includes('/storage/v1/object/telegram-media/')) {
      assert.match(url, /nisphysicshub\/assets\/[a-f0-9]{64}\.jpg$/);
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers.apikey, 'sb_secret_dummy'); assert.equal(headers.Authorization, undefined);
      return Response.json({ Key: 'stored' });
    }
    if (url.endsWith('/rpc/telegram_store_post')) { captured.push(JSON.parse(String(init?.body)).p_post); return Response.json(true); }
    throw new Error('Unexpected mock request');
  }) as typeof fetch;
  try {
    const { handleWebhook } = await import('../supabase/functions/telegram-sync/index.ts');
    const secret = await webhookSecret(environment.TELEGRAM_BOT_TOKEN);
    const message = { chat: { type: 'channel', username: CHANNEL, id: -100123456 }, message_id: 48, date: 1791331200,
      caption: 'Тест', photo: [{ file_id: 'file', file_size: 4 }] };
    const response = await handleWebhook(new Request('https://example.test', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify({ channel_post: message }) }));
    assert.equal(response.status, 200); assert.equal(captured.length, 1);
    assert.match(captured[0].attachments[0].path, /^nisphysicshub\/assets\//);
    assert.doesNotMatch(JSON.stringify(captured), /dummy-bot-token|sb_secret_|file_id|source_url|api.telegram/);
    const ignored = await handleWebhook(new Request('https://example.test', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify({ channel_post: { ...message, chat: { ...message.chat, id: -100999 } } }) }));
    assert.equal(ignored.status, 200); assert.equal(captured.length, 1);
  } finally { globalThis.fetch = previousFetch; (globalThis as any).Deno = previousDeno; }
});

test('oversized and permanently inaccessible bot attachments keep text/source fallback; transient errors retry', async () => {
  const previousFetch = globalThis.fetch;
  const { copyMedia } = await import('../supabase/functions/_shared/server.ts');
  try {
    globalThis.fetch = (() => { throw new Error('Oversized attachment should not be fetched'); }) as typeof fetch;
    assert.deepEqual(await copyMedia({ kind: 'document', name: 'large.pdf', file_id: 'file', file_size: MAX_MEDIA_BYTES + 1 }, 'dummy'), { kind: 'document', name: 'large.pdf', external: true });
    globalThis.fetch = (async () => Response.json({ ok: false }, { status: 400 })) as typeof fetch;
    assert.deepEqual(await copyMedia({ kind: 'document', name: 'missing.pdf', file_id: 'file' }, 'dummy'), { kind: 'document', name: 'missing.pdf', external: true });
    globalThis.fetch = (async () => Response.json({ ok: false }, { status: 503 })) as typeof fetch;
    await assert.rejects(copyMedia({ kind: 'document', file_id: 'file' }, 'dummy'), /Telegram request failed/);
  } finally { globalThis.fetch = previousFetch; }
});

test('Telegram tables and RPC never grant website visitors write access', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261007133713_add_telegram_feed.sql', import.meta.url), 'utf8');
  assert.match(sql, /alter table public.telegram_posts enable row level security/);
  assert.match(sql, /revoke all on public.telegram_sources, public.telegram_posts from anon, authenticated/);
  assert.match(sql, /grant select on public.telegram_sources, public.telegram_posts to anon, authenticated/);
  assert.match(sql, /revoke all on function public.telegram_store_post\(jsonb\) from public, anon, authenticated/);
  assert.match(sql, /excluded.source_revision_at > current.source_revision_at/);
  assert.equal(TELEGRAM_CHANNEL, CHANNEL);
});
