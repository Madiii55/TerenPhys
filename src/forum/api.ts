import { supabase } from '../supabase.ts';
import { FORUM_PAGE_SIZE, type ForumFilters, type ForumTopic, type ForumComment, type TopicDraft } from './model.ts';

export interface ForumApi {
  list(filters: ForumFilters, page: number): Promise<{ topics: ForumTopic[]; total: number }>;
  topic(id: string): Promise<ForumTopic | null>;
  comments(id: string, limit: number): Promise<{ comments: ForumComment[]; total: number }>;
  liked(id: string, userId: string): Promise<boolean>;
  createTopic(draft: TopicDraft, userId: string): Promise<ForumTopic>;
  createComment(topicId: string, body: string, parentId: string | null, userId: string): Promise<ForumComment>;
  setLike(id: string, userId: string, liked: boolean): Promise<void>;
  recordView(id: string): Promise<number | null>;
  subscribe(topicId: string | null, changed: () => void): () => void;
}
const topicColumns = 'id,author_id,author_name,author_avatar_path,title,body,grade,category,created_at,view_count,like_count,comment_count' as const;
let visitor: string | null = null;
function visitorId() {
  if (visitor) return visitor;
  try { visitor = localStorage.getItem('terenphys.forum-reader'); } catch { /* Session-only fallback. */ }
  if (!visitor || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitor)) {
    visitor = crypto.randomUUID();
    try { localStorage.setItem('terenphys.forum-reader', visitor); } catch { /* Optional dedup persistence. */ }
  }
  return visitor;
}
export const forumApi: ForumApi = {
  async list(filters, page) {
    let query = supabase.from('forum_topics').select(topicColumns, { count: 'exact' });
    if (filters.grade !== null) query = query.eq('grade', filters.grade);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.search.trim()) query = query.textSearch('search_document', filters.search.trim().slice(0,200), { type: 'websearch', config: 'russian' });
    if (filters.sort !== 'latest') query = query.order(filters.sort === 'popular' ? 'view_count' : 'like_count', { ascending: false });
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id')
      .range(page * FORUM_PAGE_SIZE, (page + 1) * FORUM_PAGE_SIZE - 1);
    if (error) throw error;
    return { topics: data || [], total: count || 0 };
  },
  async topic(id) {
    const { data, error } = await supabase.from('forum_topics').select(topicColumns).eq('id',id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async comments(id, limit) {
    // Bound each request below the Data API row cap, even in long discussions.
    const rows: ForumComment[] = [];
    let total = 0;
    for (let offset = 0; offset < limit; offset += 500) {
      const size = Math.min(500, limit - offset);
      const { data, count, error } = await supabase.from('forum_comments').select('*', { count: 'exact' })
        .eq('topic_id',id).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + size - 1);
      if (error) throw error;
      total = count || 0;
      rows.push(...(data || []));
      if (!data || data.length < size) break;
    }
    return { comments: [...new Map(rows.map(row=>[row.id,row])).values()].reverse(), total };
  },
  async liked(id, userId) {
    const { data, error } = await supabase.from('forum_likes').select('topic_id').eq('topic_id',id).eq('user_id',userId).maybeSingle();
    if (error) throw error;
    return !!data;
  },
  async createTopic(draft, userId) {
    const { data, error } = await supabase.from('forum_topics').insert({
      title: draft.title.trim(), body: draft.body.trim(), grade: draft.grade, category: draft.category, author_id: userId,
    }).select(topicColumns).single();
    if (error) throw error;
    return data;
  },
  async createComment(topicId, body, parentId, userId) {
    const { data, error } = await supabase.from('forum_comments').insert({
      topic_id: topicId, body: body.trim(), parent_id: parentId, author_id: userId,
    }).select('*').single();
    if (error) throw error;
    return data;
  },
  async setLike(id, userId, liked) {
    const result = liked
      ? await supabase.from('forum_likes').insert({topic_id:id,user_id:userId})
      : await supabase.from('forum_likes').delete().eq('topic_id',id).eq('user_id',userId);
    // A second tab may already have added the same like; the unique constraint wins.
    if (result.error && !(liked && result.error.code === '23505')) throw result.error;
  },
  async recordView(id) {
    const { data, error } = await supabase.rpc('forum_record_view', { p_topic:id, p_visitor:visitorId() });
    if (error) throw error;
    return data;
  },
  subscribe(topicId, changed) {
    let timer: ReturnType<typeof setTimeout>;
    const notify = () => { clearTimeout(timer); timer = setTimeout(changed,250); };
    const channel = supabase.channel('forum-' + crypto.randomUUID())
      .on('postgres_changes', { event:'*', schema:'public', table:'forum_topics', ...(topicId ? {filter:'id=eq.'+topicId} : {}) }, notify);
    if (topicId) channel.on('postgres_changes', {event:'*',schema:'public',table:'forum_comments',filter:'topic_id=eq.'+topicId},notify);
    channel.subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  },
};
