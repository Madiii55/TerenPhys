import { CHANNEL, MAX_MEDIA_BYTES, object, publicMediaUrl, readLimited, safeBotPath, sha256, type MediaItem } from './telegram.ts';

declare const Deno: { env: { get(name: string): string | undefined } };
export function serverConfig() {
  const url = Deno.env.get('SUPABASE_URL');
  let key: string | undefined;
  try { key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; } catch { /* Legacy key fallback. */ }
  key ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Server configuration unavailable');
  return { url, key };
}
export async function database(path: string, init: RequestInit = {}) {
  const { url, key } = serverConfig();
  const response = await fetch(url + '/rest/v1/' + path, { ...init, headers: {
    apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + key }),
    'Content-Type': 'application/json', ...init.headers,
  }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Database request failed');
  return response.status === 204 ? null : response.json();
}
export async function storePost(post: unknown): Promise<boolean> {
  return database('rpc/telegram_store_post', { method: 'POST', body: JSON.stringify({ p_post: post }) });
}
export class TelegramRequestError extends Error {
  status: number;
  constructor(status: number) { super('Telegram request failed'); this.status = status; }
}
export async function telegramApi(token: string, method: string, body: unknown = {}) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const result = object(await response.json());
  if (!response.ok || result.ok !== true) throw new TelegramRequestError(response.status);
  return result.result;
}
export const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
  'application/pdf': 'pdf', 'application/zip': 'zip', 'application/octet-stream': 'bin',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
export async function copyMedia(item: MediaItem, token?: string): Promise<MediaItem> {
  const fallback: MediaItem = { kind: item.kind, ...(item.name ? { name: item.name } : {}), external: true };
  if (item.external || item.kind === 'unsupported' || (item.file_size || 0) > MAX_MEDIA_BYTES) return fallback;
  let source: string;
  if (item.source_url) {
    const allowed = publicMediaUrl(item.source_url); if (!allowed) return fallback; source = allowed;
  } else if (item.file_id && token) {
    let info;
    try { info = object(await telegramApi(token, 'getFile', { file_id: item.file_id })); }
    catch (error) {
      // Cloud Bot API refuses inaccessible/oversized files permanently. Keep the text and source link.
      if (error instanceof TelegramRequestError && error.status === 400) return fallback;
      throw error;
    }
    if (!safeBotPath(info.file_path) || (info.file_size || 0) > MAX_MEDIA_BYTES) return fallback;
    source = 'https://api.telegram.org/file/bot' + token + '/' + info.file_path;
  } else return fallback;
  // No unrestricted redirects: signed public URLs may only redirect within Telegram's media CDN.
  let response = await fetch(source, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  for (let i = 0; i < 2 && response.status >= 300 && response.status < 400; i++) {
    const target = publicMediaUrl(new URL(response.headers.get('location') || '', source).href);
    if (!target) return fallback; source = target;
    response = await fetch(source, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  }
  if (!response.ok) throw new Error('Media download failed');
  if (Number(response.headers.get('content-length') || 0) > MAX_MEDIA_BYTES) { await response.body?.cancel(); return fallback; }
  const mime = (item.mime || response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  // Do not serve active content (HTML/SVG) from the public bucket.
  if (!Object.hasOwn(MIME_EXTENSION, mime)) { await response.body?.cancel(); return fallback; }
  if (item.kind === 'photo' && !mime.startsWith('image/')) { await response.body?.cancel(); return fallback; }
  let bytes: Uint8Array;
  try { bytes = await readLimited(response.body, MAX_MEDIA_BYTES); } catch { return fallback; }
  if (!bytes.length) return fallback;
  return storeMedia(bytes, mime, item.kind, item.name);
}
export async function storeMedia(bytes: Uint8Array, mime: string, kind: MediaItem['kind'], name?: string): Promise<MediaItem> {
  if (!bytes.length || bytes.length > 50 * 1024 * 1024 || !Object.hasOwn(MIME_EXTENSION, mime)) throw new Error('Unsupported media');
  const path = CHANNEL + '/assets/' + await sha256(bytes) + '.' + MIME_EXTENSION[mime];
  const { url, key } = serverConfig();
  const stored = await fetch(url + '/storage/v1/object/telegram-media/' + path, { method: 'POST', headers: {
    apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + key }),
    'Content-Type': mime, 'cache-control': '31536000', 'x-upsert': 'true',
  }, body: bytes as BodyInit, signal: AbortSignal.timeout(20000) });
  if (!stored.ok) throw new Error('Media storage failed');
  return { kind, path, mime, ...(name ? { name } : {}) };
}
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export async function requestJson(request: Request, limit = 1024 * 1024) {
  return JSON.parse(new TextDecoder().decode(await readLimited(request.body, limit)));
}
