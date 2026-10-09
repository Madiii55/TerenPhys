import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';

// Reads only the project's public browser key, never an admin credential.
const environment = { ...parse(await readFile(new URL('../.env.local', import.meta.url))), ...parse(await readFile(new URL('../.env.production', import.meta.url))) };
const base = environment.VITE_SUPABASE_URL;
const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key?.startsWith('sb_publishable_'));
const headers = { apikey: key };
let cursor, total = 0, pages = 0, firstMedia;
const ids = new Set();
for (;;) {
  const query = new URLSearchParams({ select: '*', channel_username: 'eq.nisphysicshub', order: 'published_at.desc,message_id.desc', limit: '30' });
  if (cursor) query.set('or', `(published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},message_id.lt.${cursor.message_id}))`);
  const response = await fetch(base + '/rest/v1/telegram_posts?' + query, { headers, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  const rows = await response.json(); if (!rows.length) break;
  for (const row of rows) {
    assert.ok(!ids.has(row.message_id), 'Duplicate pagination row'); ids.add(row.message_id);
    assert.ok(!JSON.stringify(row).includes('api.telegram.org/file/bot'), 'Unsafe bot URL');
    firstMedia ||= row.attachments.find(item => item.path)?.path;
  }
  pages++; total += rows.length; cursor = rows.at(-1);
  if (rows.length < 30) break;
}
const expected = process.argv[2] ? Number(process.argv[2]) : 339;
assert.equal(total, expected);
assert.ok(firstMedia);
const media = await fetch(base + '/storage/v1/object/public/telegram-media/' + firstMedia, { signal: AbortSignal.timeout(20000) });
assert.equal(media.status, 200); assert.match(media.headers.get('content-type'), /^image\//);
await media.body.cancel();
const rpc = await fetch(base + '/rest/v1/rpc/telegram_store_post', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_post: {} }) });
assert.ok([401, 403, 404].includes(rpc.status), 'Visitor can invoke privileged RPC');
const closed = await fetch(base + '/functions/v1/telegram-import', { method: 'POST' });
assert.equal(closed.status, 410);
const bot = await fetch(base + '/functions/v1/telegram-sync', { method: 'POST', body: '{}' });
assert.ok([401, 503].includes(bot.status), 'Unauthenticated webhook accepted');
console.log(JSON.stringify({ anonymous_read: true, total, pages, media_read: true, privileged_rpc_denied: true, import_closed: true, unauthenticated_webhook_denied: true }));
try {
  const preview = await fetch('http://localhost:4173/'); assert.equal(preview.status, 200);
  const html = await preview.text(); const asset = html.match(/src="([^" ]+\.js)"/)?.[1];
  assert.ok(asset); assert.equal((await fetch('http://localhost:4173' + asset)).status, 200);
  console.log(JSON.stringify({ preview: 'http://localhost:4173/', status: 200, assets: 'current build' }));
} catch (error) { console.log(JSON.stringify({ preview_warning: error.message })); }
