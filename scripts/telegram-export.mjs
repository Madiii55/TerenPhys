import { load } from 'cheerio';
import { readFile, writeFile, access } from 'node:fs/promises';
import { basename, resolve, relative, isAbsolute, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const CHANNEL = 'nisphysicshub', TITLE = 'Physics Hub | TerenSci';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.zip': 'application/zip' };

export function exportDate(value) {
  const match = value?.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) UTC([+-]\d{2}:\d{2})$/);
  if (!match) throw new Error('Invalid export timestamp');
  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6]}${match[7]}`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid export timestamp');
  return date.toISOString();
}
export function localExportPath(root, value) {
  if (typeof value !== 'string' || !/^(photos|files|video_files|voice_messages|audio_files|stickers)\//.test(value)
    || value.includes('\\') || value.includes(':') || value.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe export media path');
  const path = resolve(root, value), delta = relative(root, path);
  if (isAbsolute(delta) || delta.startsWith('..')) throw new Error('Export media escapes root');
  return path;
}
function readText($, element) {
  let raw = ''; const entities = [];
  function walk(node) {
    if (node.type === 'text') { raw += node.data; return; }
    if (node.name === 'br') { raw += '\n'; return; }
    if (['script', 'style', 'svg'].includes(node.name)) return;
    if (node.name === 'img') { raw += $(node).attr('alt') || ''; return; }
    const offset = raw.length;
    for (const child of node.children || []) walk(child);
    let type = ({ b: 'bold', strong: 'bold', i: 'italic', em: 'italic', u: 'underline', s: 'strikethrough', del: 'strikethrough', code: 'code', pre: 'pre', blockquote: 'blockquote', a: 'text_link' })[node.name];
    if ($(node).hasClass('spoiler')) type = 'spoiler';
    let url = $(node).attr('href');
    const internal = url?.match(/^#(?:go_to_message|message)(\d+)$/);
    if (internal) url = `https://t.me/${CHANNEL}/${internal[1]}`;
    if (type && raw.length > offset && (type !== 'text_link' || url)) entities.push({ type, offset, length: raw.length - offset, ...(type === 'text_link' ? { url } : {}) });
  }
  for (const child of element.contents()) walk(child);
  const leading = raw.length - raw.trimStart().length, text = raw.trim();
  return { text, entities: entities.map(e => {
    const start = Math.max(0, e.offset - leading), end = Math.min(text.length, e.offset + e.length - leading);
    return { ...e, offset: start, length: end - start };
  }).filter(e => e.length > 0) };
}
export function parseHtmlExport(html) {
  const $ = load(html), title = $('.page_header .text').first().text().trim();
  if (title !== TITLE) throw new Error('Unexpected channel export title');
  const posts = [];
  $('.message.default[id]').each((_, node) => {
    const item = $(node), id = item.attr('id')?.match(/^message(\d+)$/);
    if (!id) return;
    const published_at = exportDate(item.find('.date[title]').first().attr('title'));
    let { text, entities } = readText($, item.children('.body').children('.text').first());
    const attachments = [], seen = new Set();
    item.find('.media_wrap a[href]').each((_, media) => {
      const a = $(media), local_path = a.attr('href');
      if (!local_path || seen.has(local_path) || !/^(photos|files|video_files|voice_messages|audio_files|stickers)\//.test(local_path)) return;
      seen.add(local_path);
      const mime = MIME[extname(local_path).toLowerCase()];
      const kind = a.hasClass('photo_wrap') || mime?.startsWith('image/') ? 'photo' : mime?.startsWith('video/') ? 'video' : mime?.startsWith('audio/') ? 'audio' : 'document';
      attachments.push({ kind, local_path, mime, name: a.find('.title').first().text().trim() || basename(local_path) });
    });
    const question = item.find('.media_wrap .question').first();
    if (question.length) {
      const answers = item.find('.media_wrap .answer').map((_, answer) => { const clone = $(answer).clone(); clone.find('.details').remove(); return clone.text().trim().replace(/^-\s*/, ''); }).get();
      text += (text ? '\n\n' : '') + readText($, question).text + '\n' + answers.map(answer => '• ' + answer).join('\n');
      attachments.push({ kind: 'unsupported', external: true });
    }
    if (!text && !attachments.length) attachments.push({ kind: 'unsupported', external: true });
    posts.push({ channel_username: CHANNEL, message_id: Number(id[1]), text, entities, attachments,
      published_at, source_revision_at: published_at, source_kind: 'export', media_group_id: null });
  });
  if (!posts.length || new Set(posts.map(p => p.message_id)).size !== posts.length) throw new Error('Empty or duplicate export messages');
  return { channel: CHANNEL, title, posts };
}

async function prepare(root, outputDirectory) {
  const html = await readFile(resolve(root, 'messages.html'), 'utf8');
  const result = parseHtmlExport(html);
  // Bind the HTML archive to the known channel using overlapping source IDs AND publication times.
  const baseline = JSON.parse(await readFile(resolve(outputDirectory, '../telegram-import/public-history.json'), 'utf8'));
  const previous = new Map(baseline.posts.map(p => [p.message_id, p]));
  let matched = 0;
  for (const post of result.posts) {
    const old = previous.get(post.message_id);
    if (old) {
      const difference = Math.abs(Date.parse(old.published_at) - Date.parse(post.published_at));
      if (difference > 1000 || (difference && old.text.trim() !== post.text.trim())) throw new Error('Export does not match known channel dates');
      // The web view rounds two timestamps by one second; preserve the canonical stored cursor time.
      post.published_at = old.published_at;
      post.source_revision_at = old.source_revision_at;
      matched++;
    }
    for (const media of post.attachments) {
      if (!media.local_path) continue;
      try { await access(localExportPath(root, media.local_path)); }
      catch { media.external = true; delete media.local_path; }
    }
  }
  if (matched < 5) throw new Error('Insufficient channel identity evidence');
  result.export_root = root;
  result.matched_existing = matched;
  await writeFile(resolve(outputDirectory, 'export-manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ posts: result.posts.length, matched_existing: matched, first_id: result.posts[0].message_id,
    last_id: result.posts.at(-1).message_id, oldest: result.posts[0].published_at, newest: result.posts.at(-1).published_at,
    local_media: result.posts.reduce((n, p) => n + p.attachments.filter(a => a.local_path).length, 0),
    missing_media: result.posts.reduce((n, p) => n + p.attachments.filter(a => a.external).length, 0) }));
}

async function run(outputDirectory) {
  const credential = JSON.parse(await readFile(resolve(outputDirectory, 'private.json'), 'utf8'));
  if (Date.now() > credential.expires) throw new Error('Import credential expired');
  const manifest = JSON.parse(await readFile(resolve(outputDirectory, 'export-manifest.json'), 'utf8'));
  const endpoint = 'https://gotlcaqzrwfitgiwmsnj.supabase.co/functions/v1/telegram-import';
  const headers = { Authorization: 'Bearer ' + credential.token };
  const uploaded = new Map(), failed = [], missing = [];
  let completed = 0, mediaCompleted = 0;
  async function upload(item) {
    if (!item.local_path || !item.mime) { if (item.kind !== 'unsupported') missing.push(item.name); return { kind: item.kind, name: item.name, external: true }; }
    const bytes = await readFile(localExportPath(manifest.export_root, item.local_path));
    if (bytes.length > 50 * 1024 * 1024) { missing.push(item.name); return { kind: item.kind, name: item.name, external: true }; }
    const digest = createHash('sha256').update(bytes).digest('hex'), key = digest + ':' + item.mime;
    if (!uploaded.has(key)) uploaded.set(key, (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(endpoint + '?action=upload', { method: 'POST', headers: { ...headers, 'Content-Type': item.mime,
            'X-Media-Kind': item.kind, 'X-Content-Sha256': digest }, body: bytes, signal: AbortSignal.timeout(110000) });
          if (!response.ok) throw new Error('Upload failed (' + response.status + ')');
          const media = await response.json(); mediaCompleted++;
          console.log(JSON.stringify({ files_uploaded: mediaCompleted, posts_imported: completed }));
          return media;
        } catch (error) { if (attempt === 2) throw error; await new Promise(wait => setTimeout(wait, 1000 * (attempt + 1))); }
      }
    })());
    return { ...await uploaded.get(key), kind: item.kind, name: item.name };
  }
  let nextPost = 0;
  async function worker() {
    while (nextPost < manifest.posts.length) {
      const post = manifest.posts[nextPost++];
      try {
        const attachments = await Promise.all(post.attachments.map(upload));
        const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_kind: 'export', posts: [{ ...post, attachments }] }), signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error('Post import failed (' + response.status + ')');
        const result = await response.json(); if (!result.results?.[0]?.ok) throw new Error('Post store failed');
        completed++;
        if (completed % 20 === 0) console.log(JSON.stringify({ posts_imported: completed, total: manifest.posts.length, files_uploaded: mediaCompleted }));
      } catch (error) { failed.push(post.message_id); console.log(JSON.stringify({ failed_id: post.message_id, error: error.message })); }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const result = { completed, total: manifest.posts.length, unique_files_uploaded: mediaCompleted, failed, missing, finished_at: new Date().toISOString() };
  await writeFile(resolve(outputDirectory, 'export-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); if (failed.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, first, second] = process.argv.slice(2);
  if (mode === 'prepare' && first && second) await prepare(resolve(first), resolve(second));
  else if (mode === 'run' && first) await run(resolve(first));
  else throw new Error('Usage: telegram-export.mjs prepare <export-root> <private-output-dir> | run <private-output-dir>');
}
