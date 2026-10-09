export const CHANNEL = 'nisphysicshub';
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export type RecordValue = Record<string, any>;
export interface MediaItem { kind: 'photo' | 'video' | 'audio' | 'document' | 'unsupported'; name?: string; mime?: string; path?: string; external?: boolean; file_id?: string; file_size?: number; source_url?: string }
export function object(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }

export function validChannelPost(message: unknown, chatId: number): boolean {
  const m = object(message), chat = object(m.chat);
  return chat.type === 'channel' && chat.username?.toLowerCase() === CHANNEL && chat.id === chatId
    && Number.isSafeInteger(m.message_id) && m.message_id > 0 && Number.isSafeInteger(m.date) && m.date > 0;
}
export function cleanEntities(input: unknown, text: string) {
  if (!Array.isArray(input)) return [];
  return input.map(object).filter(e => typeof e.type === 'string' && Number.isInteger(e.offset) && e.offset >= 0
    && Number.isInteger(e.length) && e.length > 0 && e.offset + e.length <= text.length).slice(0, 500)
    .map(e => ({ type: e.type.slice(0, 40), offset: e.offset, length: e.length, ...(typeof e.url === 'string' ? { url: e.url.slice(0, 4096) } : {}) }));
}
export function botPost(message: RecordValue) {
  let text = typeof message.text === 'string' ? message.text : typeof message.caption === 'string' ? message.caption : '';
  const attachments: MediaItem[] = [];
  const add = (file: RecordValue, kind: MediaItem['kind']) => {
    if (typeof file.file_id === 'string') attachments.push({ kind, file_id: file.file_id, file_size: file.file_size,
      ...(typeof file.file_name === 'string' ? { name: file.file_name.slice(0, 240) } : {}),
      ...(typeof file.mime_type === 'string' ? { mime: file.mime_type } : {}) });
  };
  if (Array.isArray(message.photo) && message.photo.length) add(object(message.photo.at(-1)), 'photo');
  if (message.animation) add(object(message.animation), 'video');
  else if (message.video) add(object(message.video), 'video');
  if (message.audio || message.voice) add(object(message.audio || message.voice), 'audio');
  if (message.document) add(object(message.document), 'document');
  if (message.poll) {
    const poll = object(message.poll);
    text += (text ? '\n\n' : '') + String(poll.question || '') + '\n' + (Array.isArray(poll.options) ? poll.options.map((o: unknown) => '• ' + String(object(o).text || '')).join('\n') : '');
    attachments.push({ kind: 'unsupported', external: true });
  }
  if (!text && !attachments.length) attachments.push({ kind: 'unsupported', external: true });
  return { channel_username: CHANNEL, message_id: message.message_id, text: text.slice(0, 100000),
    entities: cleanEntities(message.entities || message.caption_entities, text), attachments,
    published_at: new Date(message.date * 1000).toISOString(),
    source_revision_at: new Date((message.edit_date || message.date) * 1000).toISOString(),
    source_kind: 'bot', media_group_id: typeof message.media_group_id === 'string' ? message.media_group_id.slice(0, 100) : null };
}
export function publicMediaUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && /^cdn\d+\.telesco\.pe$/.test(url.hostname) && url.pathname.startsWith('/file/') ? url.href : null;
  } catch { return null; }
}
export function safeBotPath(input: unknown): input is string {
  return typeof input === 'string' && /^[a-zA-Z0-9_./-]+$/.test(input) && !input.startsWith('/')
    && input.split('/').every(part => part && part !== '.' && part !== '..');
}
export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), b => b.toString(16).padStart(2, '0')).join('');
}
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export async function webhookSecret(token: string): Promise<string> { return sha256('terenphys-telegram-webhook-v1:' + token); }
export async function readLimited(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength; if (total > max) throw new Error('Payload too large'); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const result = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export function normalizePublicPost(input: unknown) {
  const p = object(input);
  if (p.channel_username !== CHANNEL || !Number.isSafeInteger(p.message_id) || p.message_id <= 0
    || typeof p.text !== 'string' || p.text.length > 100000 || !Array.isArray(p.attachments) || p.attachments.length > 20
    || !Number.isFinite(Date.parse(p.published_at)) || !Number.isFinite(Date.parse(p.source_revision_at))) throw new Error('Invalid post');
  return { channel_username: CHANNEL, message_id: p.message_id, text: p.text, entities: cleanEntities(p.entities, p.text),
    attachments: p.attachments.map((value: unknown): MediaItem => {
      const a = object(value);
      if (!['photo', 'video', 'audio', 'document', 'unsupported'].includes(a.kind)) throw new Error('Invalid media');
      const source = publicMediaUrl(a.source_url);
      if (a.source_url && !source) throw new Error('Invalid media origin');
      return { kind: a.kind, ...(typeof a.name === 'string' ? { name: a.name.slice(0, 240) } : {}),
        ...(source ? { source_url: source } : { external: true }) };
    }), published_at: new Date(p.published_at).toISOString(), source_revision_at: new Date(p.source_revision_at).toISOString(),
    source_kind: 'public', media_group_id: null };
}

export function normalizeExportPost(input: unknown) {
  const p = object(input);
  if (p.channel_username !== CHANNEL || !Number.isSafeInteger(p.message_id) || p.message_id <= 0
    || typeof p.text !== 'string' || p.text.length > 100000 || !Array.isArray(p.attachments) || p.attachments.length > 20
    || !Number.isFinite(Date.parse(p.published_at)) || !Number.isFinite(Date.parse(p.source_revision_at))) throw new Error('Invalid export post');
  const attachments: MediaItem[] = p.attachments.map((value: unknown) => {
    const a = object(value);
    if (!['photo', 'video', 'audio', 'document', 'unsupported'].includes(a.kind)) throw new Error('Invalid media kind');
    const name = typeof a.name === 'string' ? a.name.slice(0, 240) : undefined;
    if (a.external === true || a.kind === 'unsupported') return { kind: a.kind, ...(name ? { name } : {}), external: true };
    if (typeof a.path !== 'string' || !/^nisphysicshub\/assets\/[a-f0-9]{64}\.[a-z0-9]{2,8}$/.test(a.path)
      || typeof a.mime !== 'string') throw new Error('Invalid persistent media');
    return { kind: a.kind, path: a.path, mime: a.mime, ...(name ? { name } : {}) };
  });
  return { channel_username: CHANNEL, message_id: p.message_id, text: p.text, entities: cleanEntities(p.entities, p.text), attachments,
    published_at: new Date(p.published_at).toISOString(), source_revision_at: new Date(p.source_revision_at).toISOString(), source_kind: 'export', media_group_id: null };
}
