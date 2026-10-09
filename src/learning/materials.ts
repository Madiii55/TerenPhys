import type { Language } from '../i18n/locale.ts';
import type { StudyQuarter } from './catalogue.ts';

export type StudyFile = Readonly<{
  url: string;
  format: 'image' | 'docx';
  downloadName: string;
  label: 'Задания' | 'Ответы' | 'Страница {page}';
  page?: number;
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

// Each language points to its own supplied file. No cross-section or language fallback.
export function sectionMaterials(grade: number, sectionId: string | null, language: Language): SectionMaterials {
  if (grade !== 8 || (sectionId !== '8.1A' && sectionId !== '8.1B')) return {};
  const section = sectionId === '8.1A' ? 'a' : 'b';
  const trial: StudyResource = {
    id: sectionId + '-trial-' + language, title: 'Пробный СОР', code: sectionId,
    files: [word(`${base}/${section}/sau-${language}.docx`, `${sectionId}-SAU-${language}.docx`),
      ...(section === 'b' ? [word(`${base}/b/answers-${language}.docx`, `${sectionId}-answers-${language}.docx`, 'Ответы')] : [])],
  };
  if (section === 'b') return { trial }; // Notes for 8.1B have not been supplied.
  return { trial, notes: {
    id: sectionId + '-notes-' + language, title: 'Конспект', code: sectionId,
    files: [1, 2, 3].map(page => ({ url: `${base}/a/notes-${language}-${page}.jpg`, format: 'image',
      downloadName: `${sectionId}-notes-${language}-${page}.jpg`, label: 'Страница {page}', page })),
  } };
}

export function quarterMaterial(grade: number, quarter: StudyQuarter | null, language: Language): StudyResource | undefined {
  if (grade !== 8 || quarter !== 1) return undefined;
  return { id: `8-1-quarter-${language}`, title: 'Пробный СОЧ', code: '8.1',
    files: [word(`${base}/quarter/soch-${language}.docx`, `8-quarter-1-SOCh-${language}.docx`)] };
}
