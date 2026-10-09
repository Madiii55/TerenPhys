import { supabase } from '../supabase.ts';
import { TELEGRAM_CHANNEL, TELEGRAM_PAGE_SIZE, TELEGRAM_ALBUM_LIMIT, completeTelegramPage, groupTelegramPosts, telegramMatchesGrade, telegramAttachments, telegramEntities, type TelegramPost } from './model.ts';
import type { Tables } from '../types/database.ts';
import { isSchoolGrade, type SchoolGrade } from '../learning/catalogue.ts';

export type TelegramCursor = Pick<TelegramPost, 'published_at' | 'message_id'>;
export function telegramCursorFilter(cursor: TelegramCursor): string {
  const date = new Date(cursor.published_at);
  if (Number.isNaN(date.getTime()) || !Number.isSafeInteger(cursor.message_id) || cursor.message_id <= 0) throw new Error('Invalid cursor');
  const iso = date.toISOString();
  return `published_at.lt.${iso},and(published_at.eq.${iso},message_id.lt.${cursor.message_id})`;
}
export function telegramRow(row: Tables<'telegram_posts'>): TelegramPost {
  return { ...row, entities: telegramEntities(row.entities, row.text), attachments: telegramAttachments(row.attachments),
    source_kind: row.source_kind as TelegramPost['source_kind'] };
}
async function readTelegramPage(signal: AbortSignal, cursor?: TelegramCursor) {
  let query = supabase.from('telegram_posts').select('*').eq('channel_username', TELEGRAM_CHANNEL)
    .order('published_at', { ascending: false }).order('message_id', { ascending: false }).limit(TELEGRAM_PAGE_SIZE + TELEGRAM_ALBUM_LIMIT + 1);
  if (cursor) query = query.or(telegramCursorFilter(cursor));
  const { data, error } = await query.abortSignal(signal);
  if (error) throw error;
  const rows = data || [];
  return completeTelegramPage(rows.map(telegramRow));
}

export async function loadTelegramPage(signal: AbortSignal, cursor?: TelegramCursor, grade?: SchoolGrade) {
  if (grade !== undefined && !isSchoolGrade(grade)) throw new Error('Invalid grade');
  const posts: TelegramPost[] = [];
  let next = cursor;
  let hasMore = true;
  let scans = 0;
  // Filter only after reconstructing whole albums. A caption-less file must
  // inherit its album's tags, not become a separate post shared with all grades.
  // Fill sparse grade feeds by advancing the source cursor, even on empty pages.
  // Keep raw rows for realtime edits, grouping and unchanged attachment previews.
  do {
    signal.throwIfAborted();
    const page = await readTelegramPage(signal, next);
    scans++;
    posts.push(...page.posts);
    next = page.posts.at(-1);
    hasMore = page.hasMore;
    if (!next || grade === undefined) break;
  } while (hasMore && scans < 10 && groupTelegramPosts(posts).filter(post => telegramMatchesGrade(post, grade)).length < TELEGRAM_PAGE_SIZE);
  return { posts, hasMore };
}
