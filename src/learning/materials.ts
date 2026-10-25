import type { Language } from '../i18n/locale.ts';
import { SCHOOL_GRADES, hasStudyMaterial, hasStudyQuarters, studySectionsFor, type StudyQuarter } from './catalogue.ts';
import { TELEGRAM_STUDY_CATALOGUE, type TelegramStudyEntry } from './telegramCatalogue.ts';

export type StudyFile = Readonly<{
  url: string;
  format: 'image' | 'docx' | 'pdf' | 'telegram';
  downloadName: string;
  label: string;
  page?: number;
  number?: number;
  language?: TelegramStudyEntry['language'];
  originalName?: string;
  sourceUrl?: string;
  sourceFormat?: 'pdf' | 'docx';
}>;
export type StudyResource = Readonly<{
  id: string;
  title: 'Конспект' | 'Пробный СОР' | 'Пробный СОЧ';
  code: string;
  files: readonly StudyFile[];
}>;
export type SectionMaterials = Readonly<{ notes?: StudyResource; trial?: StudyResource }>;

const base = '/study/8/1';
const word = (url: string, downloadName: string, label: StudyFile['label'] = 'Задания'): StudyFile => ({ url, downloadName, label, format: 'docx' });
const mediaRoot = 'https://gotlcaqzrwfitgiwmsnj.supabase.co/storage/v1/object/public/telegram-media/';
const languageCode = { ru: 'RU', kk: 'KZ', en: 'EN', und: 'UND' } as const;
const matchesLanguage = (entry: TelegramStudyEntry, language: Language) => entry.language === language || entry.language === 'en' || entry.language === 'und';

function channelResource(code: string, kind: 'notes' | 'trial' | 'quarter', language: Language,
  entries: readonly TelegramStudyEntry[], existing?: StudyResource): StudyResource | undefined {
  const selected = entries.filter(entry => matchesLanguage(entry, language) && !existing?.files.some(file => file.url === entry.localUrl))
    .sort((a, b) => Number(a.kind === 'preparation') - Number(b.kind === 'preparation') || Math.min(...a.sources) - Math.min(...b.sources));
  if (!selected.length) return existing;
  const title = kind === 'quarter' ? 'Пробный СОЧ' : kind === 'trial' ? 'Пробный СОР' : 'Конспект';
  const groupNumbers = new Map<string, number>();
  const groupId = (entry: TelegramStudyEntry) => entry.sources.includes(300) ? 'tg-301' : entry.sources.includes(312) ? 'tg-314' : entry.id;
  // Answers retain the number of their actual task sheet, even when posted separately.
  for (const entry of selected) if (entry.role !== 'answers') groupNumbers.set(entry.id, groupNumbers.size + 1);
  selected.sort((a, b) => Number(a.kind === 'preparation') - Number(b.kind === 'preparation')
    || (groupNumbers.get(groupId(a)) ?? 0) - (groupNumbers.get(groupId(b)) ?? 0) || Number(a.role === 'answers') - Number(b.role === 'answers'));
  const files: StudyFile[] = selected.map(entry => {
    const sourceUrl = 'https://t.me/nisphysicshub/' + Math.max(...entry.sources);
    const fileKind = entry.kind === 'preparation' ? 'PREP' : kind === 'trial' ? 'SOR' : kind === 'quarter' ? 'SOCH' : 'notes';
    const label = entry.role === 'answers' ? 'Ответы — {number}' : entry.kind === 'preparation' ? 'Подготовка — {number}'
      : kind === 'notes' ? 'Конспект' : 'Задания — {number}';
    return { url: entry.localUrl || (entry.path ? mediaRoot + entry.path : sourceUrl),
      format: entry.external ? 'telegram' : entry.format, sourceFormat: entry.format,
      downloadName: `${code === 'Механика' ? 'Mechanics' : code}-${languageCode[entry.language]}-${fileKind}-${entry.id}.${entry.format}`,
      label, number: groupNumbers.get(groupId(entry)), language: entry.language,
      originalName: entry.names[0], sourceUrl };
  });
  return { id: `${code}-${kind}-${language}`, code, title, files: [...(existing?.files || []), ...files] };
}

/** Display metadata describes the supplied files, independently of the interface language. */
export function studyResourceFormats(resource: StudyResource): string {
  return [...new Set(resource.files.map(file => file.format === 'telegram' ? 'Telegram' : file.format === 'image' ? 'JPG' : file.format.toUpperCase()))].join(' · ');
}

export function studyDownloadUrl(file: StudyFile): string {
  return file.url.startsWith(mediaRoot) ? file.url + '?download=' + encodeURIComponent(file.downloadName) : file.url;
}

// Each language points to its own supplied file. No cross-section or language fallback.
export function sectionMaterials(grade: number, sectionId: string | null, language: Language): SectionMaterials {
  if (!sectionId || !sectionId.startsWith(grade + '.1')) return {};
  const entries = TELEGRAM_STUDY_CATALOGUE.filter(entry => entry.grade === grade && entry.sections.includes(sectionId));
  const supplied = suppliedSectionMaterials(grade, sectionId, language);
  const notes = channelResource(sectionId, 'notes', language, entries.filter(entry => entry.kind === 'notes'), supplied.notes);
  const trial = channelResource(sectionId, 'trial', language, entries.filter(entry => entry.kind === 'trial'), supplied.trial);
  return { ...(notes ? { notes } : {}), ...(trial ? { trial } : {}) };
}

function suppliedSectionMaterials(grade: number, sectionId: string, language: Language): SectionMaterials {
  if (grade !== 8 || (sectionId !== '8.1A' && sectionId !== '8.1B')) return {};
  const section = sectionId === '8.1A' ? 'a' : 'b';
  const trial: StudyResource = {
    id: sectionId + '-trial-' + language, title: 'Пробный СОР', code: sectionId,
    files: [word(`${base}/${section}/sau-${language}.docx`, `${sectionId}-${languageCode[language]}-SOR.docx`),
      ...(section === 'b' ? [word(`${base}/b/answers-${language}.docx`, `${sectionId}-${languageCode[language]}-answers.docx`, 'Ответы')] : [])],
  };
  if (section === 'b') return { trial }; // Notes for 8.1B have not been supplied.
  return { trial, notes: {
    id: sectionId + '-notes-' + language, title: 'Конспект', code: sectionId,
    files: [1, 2, 3].map(page => ({ url: `${base}/a/notes-${language}-${page}.jpg`, format: 'image',
      downloadName: `${sectionId}-${languageCode[language]}-notes-${page}.jpg`, label: 'Страница {page}', page })),
  } };
}

export function quarterMaterial(grade: number, quarter: StudyQuarter | null, language: Language): StudyResource | undefined {
  if (quarter !== 1) return undefined;
  const existing: StudyResource | undefined = grade === 8 && quarter === 1 ? { id: `8-1-quarter-${language}`, title: 'Пробный СОЧ', code: '8.1',
    files: [word(`${base}/quarter/soch-${language}.docx`, `8.1-${languageCode[language]}-SOCH.docx`)] } : undefined;
  return channelResource(`${grade}.${quarter}`, 'quarter', language,
    TELEGRAM_STUDY_CATALOGUE.filter(entry => entry.grade === grade && entry.quarter === quarter && (entry.kind === 'quarter' || entry.kind === 'preparation')), existing);
}

/** The source establishes a quarter, but not a section. Do not silently guess A/B. */
export function quarterSectionTrial(grade: number, quarter: StudyQuarter | null, language: Language): StudyResource | undefined {
  if (quarter !== 1) return undefined;
  return channelResource(`${grade}.${quarter}`, 'trial', language,
    TELEGRAM_STUDY_CATALOGUE.filter(entry => entry.grade === grade && entry.quarter === quarter && entry.kind === 'trial' && !entry.sections.length));
}

export type MaterialAvailability = Readonly<{ notes: boolean; trials: boolean }>;

export function sectionMaterialAvailability(grade: number, sectionId: string, language: Language): MaterialAvailability {
  const materials = sectionMaterials(grade, sectionId, language);
  const schoolGrade = SCHOOL_GRADES.find(value => value === grade);
  return { notes: Boolean(materials.notes) || Boolean(schoolGrade && hasStudyMaterial(schoolGrade, sectionId)), trials: Boolean(materials.trial) };
}

/** Include both section resources and whole-quarter trial collections. */
export function quarterMaterialAvailability(grade: number, quarter: StudyQuarter, language: Language): MaterialAvailability {
  const schoolGrade = SCHOOL_GRADES.find(value => value === grade);
  if (!schoolGrade || !hasStudyQuarters(schoolGrade) || quarter !== 1) return { notes: false, trials: false };
  const sections = studySectionsFor(schoolGrade, quarter).map(section => sectionMaterialAvailability(grade, section.id, language));
  return { notes: sections.some(section => section.notes),
    trials: Boolean(quarterMaterial(grade, quarter, language) || quarterSectionTrial(grade, quarter, language)) || sections.some(section => section.trials) };
}
