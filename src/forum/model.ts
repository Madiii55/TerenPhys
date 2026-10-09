import { isSchoolGrade } from '../learning/catalogue.ts';

export const FORUM_CATEGORIES = [
  { id: 'mechanics', label: 'Механика', symbol: '01' },
  { id: 'thermal', label: 'Тепловые явления', symbol: '02' },
  { id: 'electricity', label: 'Электричество', symbol: '03' },
  { id: 'magnetism', label: 'Магнетизм', symbol: '04' },
  { id: 'optics', label: 'Оптика', symbol: '05' },
  { id: 'atomic', label: 'Атомная физика', symbol: '06' },
  { id: 'astronomy', label: 'Астрономия', symbol: '07' },
  { id: 'general', label: 'Общие вопросы', symbol: '08' },
] as const;
export type ForumCategory = typeof FORUM_CATEGORIES[number]['id'];
export type ForumSort = 'latest' | 'popular' | 'best';
export interface ForumFilters { search: string; grade: number | null; category: ForumCategory | null; sort: ForumSort }
export interface ForumTopic {
  id: string; author_id: string; author_name: string; author_avatar_path: string | null;
  title: string; body: string; grade: number | null; category: string; created_at: string;
  view_count: number; like_count: number; comment_count: number;
}
export interface ForumComment {
  id: string; topic_id: string; author_id: string; author_name: string; author_avatar_path: string | null;
  body: string; parent_id: string | null; created_at: string;
}
export interface TopicDraft { title: string; body: string; grade: number | null; category: ForumCategory }
export const categoryLabel = (id: string) => FORUM_CATEGORIES.find(c => c.id === id)?.label || 'Общие вопросы';
export const FORUM_PAGE_SIZE = 15;
export function validateTopic(draft: TopicDraft): string | null {
  const title = draft.title.trim(), body = draft.body.trim();
  if (title.length < 6 || title.length > 160) return 'Заголовок — от 6 до 160 символов.';
  if (body.length < 20 || body.length > 12000) return 'Добавьте описание: от 20 до 12 000 символов.';
  if (draft.grade !== null && !isSchoolGrade(draft.grade)) return 'Выберите класс из списка.';
  if (!FORUM_CATEGORIES.some(c => c.id === draft.category)) return 'Выберите раздел.';
  return null;
}
export const formatForumDate = (value: string, locale = 'ru-RU') => new Intl.DateTimeFormat(locale, {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(value));
export const formatForumNumber = (value: number, locale = 'ru-RU') => new Intl.NumberFormat(locale, {
  notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1,
}).format(value);
export function forumCount(value: number, forms: readonly [string,string,string], locale = 'ru-RU'): string {
  const tens = value % 100, units = value % 10;
  const word = locale === 'kk-KZ' ? forms[0] : value >= 10000 || (tens >= 11 && tens <= 14) ? forms[2]
    : units === 1 ? forms[0] : units >= 2 && units <= 4 ? forms[1] : forms[2];
  return formatForumNumber(value, locale) + ' ' + word;
}
