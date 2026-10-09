import { SCHOOL_GRADES, type SchoolGrade } from '../learning/catalogue.ts';

export const TELEGRAM_CHANNEL = 'nisphysicshub';
export const TELEGRAM_TITLE = 'Physics Hub | TerenSci';
export const TELEGRAM_PAGE_SIZE = 30;
export const TELEGRAM_ALBUM_LIMIT = 10;
export interface TelegramEntity { type: string; offset: number; length: number; url?: string }
export interface TelegramAttachment {
  kind: 'photo' | 'video' | 'audio' | 'document' | 'unsupported';
  path?: string;
  name?: string;
  mime?: string;
  external?: boolean;
  source_message_id?: number;
}
export interface TelegramPost {
  message_id: number;
  channel_username: string;
  text: string;
  entities: TelegramEntity[];
  attachments: TelegramAttachment[];
  published_at: string;
  source_revision_at: string;
  source_kind: 'public' | 'export' | 'bot';
  media_group_id: string | null;
  // Derived on grouped messages, never written back to the source archive.
  grades?: readonly SchoolGrade[];
}

export function telegramGrades(text: string): SchoolGrade[] {
  const grades = new Set<SchoolGrade>();
  for (const match of text.matchAll(/(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu)) {
    const tag = match[1].toLowerCase().replaceAll('_', '');
    const grade = tag.match(/^(?:(7|8|9|10|11|12)(?:класс|сынып|class|grade)|(?:класс|сынып|class|grade)(7|8|9|10|11|12))$/);
    if (grade) grades.add(Number(grade[1] || grade[2]) as SchoolGrade);
  }
  return SCHOOL_GRADES.filter(grade => grades.has(grade));
}

export function telegramMatchesGrade(post: TelegramPost, grade: SchoolGrade): boolean {
  const grades = post.grades ?? telegramGrades(post.text);
  return grades.length === 0 || grades.includes(grade);
}
export function telegramPostUrl(messageId: number): string {
  return Number.isSafeInteger(messageId) && messageId > 0 ? `https://t.me/${TELEGRAM_CHANNEL}/${messageId}` : `https://t.me/${TELEGRAM_CHANNEL}`;
}
export function safeTelegramLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.username || url.password || !['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return undefined;
    return url.href;
  } catch { return undefined; }
}
export function telegramMediaUrl(baseUrl: string, path: string | undefined): string | undefined {
  if (!path || !/^nisphysicshub\/[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').some(part => part === '..' || part === '.')) return undefined;
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/telegram-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}
export function telegramEntities(value: unknown, text: string): TelegramEntity[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entity): entity is TelegramEntity => entity && typeof entity.type === 'string'
    && Number.isInteger(entity.offset) && entity.offset >= 0 && Number.isInteger(entity.length) && entity.length > 0
    && entity.offset + entity.length <= text.length && (entity.url === undefined || typeof entity.url === 'string')).slice(0, 500);
}
export function telegramAttachments(value: unknown): TelegramAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TelegramAttachment => item && ['photo','video','audio','document','unsupported'].includes(item.kind)
    && (item.path === undefined || typeof item.path === 'string') && (item.name === undefined || typeof item.name === 'string')
    && (item.mime === undefined || typeof item.mime === 'string') && (item.external === undefined || typeof item.external === 'boolean')).slice(0, 20);
}
export function mergeTelegramPosts(existing: readonly TelegramPost[], incoming: readonly TelegramPost[]): TelegramPost[] {
  const posts = new Map(existing.map(post => [post.message_id, post]));
  for (const post of incoming) {
    const current = posts.get(post.message_id);
    if (!current || Date.parse(post.source_revision_at) >= Date.parse(current.source_revision_at)) posts.set(post.message_id, post);
  }
  return [...posts.values()].sort((a,b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.message_id - a.message_id);
}
export function groupTelegramPosts(posts: readonly TelegramPost[]): TelegramPost[] {
  // HTML exports omit media_group_id. Only reconstruct an unambiguous batch:
  // consecutive IDs, the exact same second, one media family and at most one caption.
  // Never infer from "joined" HTML classes, minute labels or unrelated text messages.
  const inferred = new Map<number, string>();
  const chronological = [...posts].sort((a,b) => a.channel_username.localeCompare(b.channel_username) || a.message_id - b.message_id);
  let batch: TelegramPost[] = [];
  const family = (post: TelegramPost) => post.attachments.length === 1
    ? ['photo','video'].includes(post.attachments[0].kind) ? 'visual' : post.attachments[0].kind : undefined;
  const commit = () => {
    const knownAlbums = new Set(batch.map(post => post.media_group_id).filter(Boolean));
    if (batch.length >= 2 && batch.length <= TELEGRAM_ALBUM_LIMIT && batch.some(post => post.source_kind === 'export')
      && batch.filter(post => post.text.trim()).length <= 1 && knownAlbums.size <= 1) {
      const album = [...knownAlbums][0] || `archive:${batch[0].message_id}`;
      for (const post of batch) inferred.set(post.message_id, album);
    }
    batch = [];
  };
  for (const post of chronological) {
    const previous = batch.at(-1), mediaFamily = family(post);
    if (!mediaFamily || mediaFamily === 'unsupported') { commit(); continue; }
    if (previous && (post.channel_username !== previous.channel_username || post.message_id !== previous.message_id + 1
      || Date.parse(post.published_at) !== Date.parse(previous.published_at) || mediaFamily !== family(previous))) commit();
    batch.push(post);
  }
  commit();
  const groups = new Map<string, TelegramPost>();
  const result: TelegramPost[] = [];
  for (const post of posts) {
    const album = post.media_group_id || inferred.get(post.message_id);
    const attachments = post.attachments.map(item => ({ ...item, source_message_id: post.message_id }));
    const grades = post.grades ?? telegramGrades(post.text);
    if (!album) { result.push({ ...post, attachments, grades }); continue; }
    const key = post.channel_username + ':' + album;
    const group = groups.get(key);
    if (!group) { const copy = { ...post, attachments, grades }; groups.set(key,copy); result.push(copy); }
    else {
      group.grades = SCHOOL_GRADES.filter(grade => group.grades?.includes(grade) || grades.includes(grade));
      group.attachments = [...group.attachments,...attachments].filter((item,index,all) => !item.path || all.findIndex(other => other.path === item.path) === index);
      if (post.text && !group.text) { group.text = post.text; group.entities = post.entities; }
      group.message_id = Math.min(group.message_id, post.message_id);
    }
  }
  return result;
}

export function completeTelegramPage(rows: readonly TelegramPost[], pageSize = TELEGRAM_PAGE_SIZE) {
  let end = Math.min(pageSize, rows.length);
  // Read a whole boundary batch, so an album is not split by the “Earlier” button.
  while (end < rows.length && end < pageSize + TELEGRAM_ALBUM_LIMIT) {
    const previous = rows[end - 1], next = rows[end];
    if (!previous || previous.channel_username !== next.channel_username ||
      !(Date.parse(previous.published_at) === Date.parse(next.published_at)
        || (previous.media_group_id && previous.media_group_id === next.media_group_id))) break;
    end++;
  }
  return { posts: rows.slice(0, end), hasMore: rows.length > end };
}
