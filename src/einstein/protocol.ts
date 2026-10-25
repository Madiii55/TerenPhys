export const GUIDE_ACTION_IDS = [
  'navigate-home', 'navigate-study', 'navigate-posts', 'navigate-forum', 'navigate-profile',
  'select-grade-7', 'select-grade-8', 'select-grade-9', 'select-grade-10', 'select-grade-11', 'select-grade-12',
  'select-quarter-1', 'select-quarter-2', 'select-quarter-3', 'select-quarter-4',
  'show-notes', 'show-trial', 'show-quarter-exam', 'show-practice', 'show-post-files',
] as const;
export const guideActionIds = GUIDE_ACTION_IDS;
export type GuideActionId = typeof GUIDE_ACTION_IDS[number];
export type EinsteinPage = 'home' | 'study' | 'posts' | 'forum' | 'profile';
export type EinsteinLanguage = 'ru' | 'kk';
export type EinsteinStudyLevel = 'classes' | 'quarters' | 'sections' | 'material';
export interface EinsteinLessonContext {
  id: string;
  title: string;
  language: EinsteinLanguage | 'en';
  sectionTitle?: string;
  excerpt?: string;
}
export interface EinsteinContext {
  page: EinsteinPage;
  language: EinsteinLanguage;
  grade?: number;
  quarter?: number;
  sectionId?: string;
  topic?: string;
  studyLevel?: EinsteinStudyLevel;
  lesson?: EinsteinLessonContext;
  view?: 'notes' | 'trial' | 'quarter-exam';
  availableActions: string[];
}
export type StudyGuideContext = Pick<EinsteinContext, 'grade' | 'quarter' | 'sectionId' | 'topic' | 'studyLevel' | 'lesson' | 'view' | 'availableActions'>;
export interface EinsteinMessage { role: 'user' | 'assistant'; content: string }
export interface EinsteinRequest { messages: EinsteinMessage[]; context: EinsteinContext }
export interface EinsteinAction { id: GuideActionId; label: string }
export interface EinsteinReply { answer: string; actions: EinsteinAction[]; source: 'gemini' }
export type GuideAction = EinsteinAction;
export type EinsteinResponse = EinsteinReply;
export type EinsteinErrorCode = 'auth_required' | 'email_unverified' | 'invalid_request' | 'rate_limited'
  | 'not_configured' | 'upstream_unavailable' | 'upstream_timeout' | 'invalid_response'
  | 'forbidden_origin' | 'method_not_allowed';
export interface EinsteinFailure { error: { code: EinsteinErrorCode; retryAfterSeconds?: number } }

export const EINSTEIN_LIMITS = { messages: 12, messageCharacters: 1800, totalCharacters: 8000, topicCharacters: 140, lessonTitleCharacters: 180, excerptCharacters: 3500, answerCharacters: 6000, actions: 3 } as const;
export function isGuideActionId(value: unknown): value is GuideActionId {
  return typeof value === 'string' && (GUIDE_ACTION_IDS as readonly string[]).includes(value);
}
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}

/** Accept only bounded visible page metadata and plain chat text. */
export function parseEinsteinRequest(value: unknown): EinsteinRequest | null {
  const input = record(value), context = record(input?.context);
  if (!input || !context || Object.keys(input).some(key => !['messages', 'context'].includes(key))) return null;
  if (!['home', 'study', 'posts', 'forum', 'profile'].includes(String(context.page)) || !['ru', 'kk'].includes(String(context.language))) return null;
  if (context.grade !== undefined && (![7, 8, 9, 10, 11, 12].includes(context.grade as number))) return null;
  if (context.quarter !== undefined && (![1, 2, 3, 4].includes(context.quarter as number))) return null;
  if (context.studyLevel !== undefined && !['classes', 'quarters', 'sections', 'material'].includes(String(context.studyLevel))) return null;
  if (context.sectionId !== undefined && (typeof context.sectionId !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(context.sectionId))) return null;
  if (context.topic !== undefined && !text(context.topic, EINSTEIN_LIMITS.topicCharacters)) return null;
  if (context.view !== undefined && (context.page !== 'study' || !['notes', 'trial', 'quarter-exam'].includes(String(context.view)))) return null;
  let lesson: EinsteinLessonContext | undefined;
  if (context.lesson !== undefined) {
    const source = record(context.lesson);
    if (context.page !== 'study' || context.studyLevel !== 'material' || !source
      || Object.keys(source).some(key => !['id', 'title', 'language', 'sectionTitle', 'excerpt'].includes(key))
      || typeof source.id !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(source.id)
      || !text(source.title, EINSTEIN_LIMITS.lessonTitleCharacters) || !['ru', 'kk', 'en'].includes(String(source.language))
      || (source.sectionTitle !== undefined && !text(source.sectionTitle, EINSTEIN_LIMITS.lessonTitleCharacters))
      || (source.excerpt !== undefined && (!source.sectionTitle || context.view !== 'notes' || !text(source.excerpt, EINSTEIN_LIMITS.excerptCharacters)))) return null;
    lesson = { id: source.id, title: source.title.trim(), language: source.language as EinsteinLessonContext['language'],
      ...(source.sectionTitle ? { sectionTitle: (source.sectionTitle as string).trim() } : {}),
      ...(source.excerpt ? { excerpt: (source.excerpt as string).trim() } : {}) };
  }
  if (!Array.isArray(context.availableActions) || context.availableActions.length > GUIDE_ACTION_IDS.length || !context.availableActions.every(isGuideActionId)) return null;
  if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > EINSTEIN_LIMITS.messages) return null;
  let total = 0;
  const messages: EinsteinMessage[] = [];
  for (const raw of input.messages) {
    const message = record(raw);
    if (!message || !['user', 'assistant'].includes(String(message.role)) || !text(message.content, EINSTEIN_LIMITS.messageCharacters)) return null;
    total += message.content.length;
    if (total > EINSTEIN_LIMITS.totalCharacters) return null;
    messages.push({ role: message.role as EinsteinMessage['role'], content: message.content.trim() });
  }
  if (messages.at(-1)?.role !== 'user') return null;
  return { messages, context: {
    page: context.page as EinsteinPage, language: context.language as EinsteinLanguage,
    ...(context.grade !== undefined ? { grade: context.grade as EinsteinContext['grade'] } : {}),
    ...(context.quarter !== undefined ? { quarter: context.quarter as EinsteinContext['quarter'] } : {}),
    ...(context.sectionId !== undefined ? { sectionId: context.sectionId as string } : {}),
    ...(context.topic !== undefined ? { topic: (context.topic as string).trim() } : {}),
    ...(context.studyLevel !== undefined ? { studyLevel: context.studyLevel as EinsteinStudyLevel } : {}),
    ...(lesson ? { lesson } : {}),
    ...(context.view !== undefined ? { view: context.view as EinsteinContext['view'] } : {}),
    availableActions: [...new Set(context.availableActions as GuideActionId[])],
  } };
}

/** Unknown links, selectors and actions from model output never become controls. */
export function parseEinsteinResponse(value: unknown, availableActions: readonly string[], source: EinsteinResponse['source']): EinsteinResponse | null {
  const result = record(value);
  if (!result || !text(result.answer, EINSTEIN_LIMITS.answerCharacters) || !Array.isArray(result.actions) || result.actions.length > EINSTEIN_LIMITS.actions) return null;
  const seen = new Set<string>();
  const actions: GuideAction[] = [];
  for (const raw of result.actions) {
    const action = record(raw);
    if (!action || !isGuideActionId(action.id) || !availableActions.includes(action.id) || !text(action.label, 70) || seen.has(action.id)) continue;
    seen.add(action.id); actions.push({ id: action.id, label: action.label.trim() });
  }
  return { answer: result.answer.trim(), actions, source };
}
