import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'dotenv';
import { localExportPath } from './telegram-export.mjs';
const directory = process.argv[2];
if (!directory) throw new Error('Pass private export manifest directory');
const manifest = JSON.parse(await readFile(resolve(directory, 'export-manifest.json'), 'utf8'));
const environment = { ...parse(await readFile(new URL('../.env.local', import.meta.url))), ...parse(await readFile(new URL('../.env.production', import.meta.url))) };
const base = environment.VITE_SUPABASE_URL, key = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key.startsWith('sb_publishable_'));
const response = await fetch(base + '/rest/v1/telegram_posts?channel_username=eq.nisphysicshub&select=*&limit=1000', { headers: { apikey: key } });
assert.equal(response.status, 200);
const rows = await response.json(), byId = new Map(rows.map(row => [row.message_id, row]));
const media = [], skippedNewer = [];
for (const post of manifest.posts) {
  const stored = byId.get(post.message_id); assert.ok(stored, 'Missing export post ' + post.message_id);
  if (stored.source_kind === 'bot' && Date.parse(stored.source_revision_at) >= Date.parse(post.source_revision_at)) { skippedNewer.push(post.message_id); continue; }
  assert.equal(stored.source_kind, 'export'); assert.equal(stored.text, post.text);
  for (const item of post.attachments) {
    if (!item.local_path) continue;
    const file = localExportPath(manifest.export_root, item.local_path), bytes = await readFile(file);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const found = stored.attachments.find(a => a.path?.includes('/' + digest + '.'));
    assert.ok(found, 'Missing exported attachment for ' + post.message_id);
    assert.equal(found.name, item.name); assert.equal(found.mime, item.mime);
    media.push({ file, path: found.path, size: (await stat(file)).size, mime: item.mime });
  }
}
const unique = [...new Map(media.map(item => [item.path, item])).values()];
let nextMedia = 0, checked = 0;
async function worker() {
  while (nextMedia < unique.length) {
    const item = unique[nextMedia++], url = base + '/storage/v1/object/public/telegram-media/' + item.path;
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-type')?.split(';')[0], item.mime);
    if (head.headers.has('content-length')) assert.equal(Number(head.headers.get('content-length')), item.size);
    checked++;
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
// Verify byte equality of a photo, PDF and Word file using the real public download URLs.
for (const mime of ['image/jpeg', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) {
  const item = unique.find(file => file.mime === mime); assert.ok(item);
  const download = await fetch(base + '/storage/v1/object/public/telegram-media/' + item.path + '?download=' + encodeURIComponent('test' + item.path.slice(item.path.lastIndexOf('.'))), { signal: AbortSignal.timeout(30000) });
  assert.equal(download.status, 200);
  const bytes = Buffer.from(await download.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex'); assert.ok(item.path.includes('/' + digest + '.'));
}
const closed = await fetch(base + '/functions/v1/telegram-import', { method: 'POST' }); assert.equal(closed.status, 410);
console.log(JSON.stringify({ total_posts: rows.length, export_posts_present: manifest.posts.length, exported_media_verified: media.length,
  unique_media_accessible: checked, download_byte_checks: ['JPG', 'PDF', 'DOCX'], newer_bot_posts_preserved: skippedNewer, import_closed: true }));
