import { constantTimeEqual, normalizePublicPost, normalizeExportPost, readLimited, sha256, type MediaItem } from '../_shared/telegram.ts';
import { copyMedia, json, requestJson, storePost, storeMedia, MIME_EXTENSION } from '../_shared/server.ts';
declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };

// A short-lived SHA-256 digest is substituted ONLY during an explicitly authorized history import.
// The committed/deployed resting version is closed. No import credential is a frontend setting.
const IMPORT_DIGEST: string = '';
const IMPORT_EXPIRES: number = 0;
export async function handleImport(request: Request): Promise<Response> {
  if (!IMPORT_DIGEST || Date.now() > IMPORT_EXPIRES) return json({ error: 'Import closed' }, 410);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  if (!constantTimeEqual(await sha256(bearer), IMPORT_DIGEST)) return json({ error: 'Unauthorized' }, 401);
  if (new URL(request.url).searchParams.get('action') === 'upload') {
    const mime = request.headers.get('Content-Type') || '', kind = request.headers.get('X-Media-Kind') || '';
    if (!Object.hasOwn(MIME_EXTENSION, mime) || !['photo','video','audio','document'].includes(kind)
      || (kind === 'photo' && !mime.startsWith('image/'))) return json({ error: 'Unsupported media' }, 400);
    let bytes;
    try {
      bytes = await readLimited(request.body, 50 * 1024 * 1024);
      if (!constantTimeEqual(await sha256(bytes), request.headers.get('X-Content-Sha256') || '')) return json({ error: 'Content hash mismatch' }, 400);
    } catch { return json({ error: 'Invalid media' }, 400); }
    try { return json(await storeMedia(bytes, mime, kind as MediaItem['kind'])); }
    catch { return json({ error: 'Upload temporarily unavailable' }, 503); }
  }
  let posts;
  let exported = false;
  try {
    const input = await requestJson(request);
    exported = input?.source_kind === 'export';
    const batch = exported ? input.posts : input;
    if (!Array.isArray(batch) || batch.length > 10) throw new Error('Invalid batch');
    posts = batch.map(exported ? normalizeExportPost : normalizePublicPost);
  } catch { return json({ error: 'Invalid batch' }, 400); }
  const results = [];
  for (const post of posts) {
    try {
      if (!exported) post.attachments = await Promise.all(post.attachments.map(item => copyMedia(item)));
      const changed = await storePost(post);
      results.push({ message_id: post.message_id, ok: true, changed, copied: post.attachments.filter(a => a.path).length });
    } catch { results.push({ message_id: post.message_id, ok: false }); }
  }
  return json({ results });
}
Deno.serve(handleImport);
