import type { Language } from '../i18n/locale.ts';
import type { StudyFile, StudyResource } from './materials.ts';

export type NativeLessonContent = 'thermal' | 'motion7' | 'motion9-vectors' | 'motion9-kinematics' | 'motion11' | 'kinematics-summary';
export type StudyLesson = Readonly<{
  id: string;
  title: string;
  language: Language | 'en';
  content: NativeLessonContent | null;
  originals: readonly StudyFile[];
}>;

/** Reading editions are explicitly matched to audited originals, never guessed
 * from a grade or a similarly named file. The original catalogue stays intact.
 */
export function studyLessonsFor(grade: number, sectionId: string | null, language: Language, notes?: StudyResource): readonly StudyLesson[] {
  if (!sectionId || !sectionId.startsWith(grade + '.1')) return [];
  const lessons: StudyLesson[] = [];
  if (notes && sectionId === '8.1A' && notes.files.every(file => file.url.startsWith(`/study/8/1/a/notes-${language}-`))) {
    lessons.push({ id: `${sectionId}-${language}-reading`, title: 'Тепловая физика', language, content: 'thermal', originals: notes.files });
  } else if (notes) {
    for (const file of notes.files) {
      const source = file.sourceUrl?.split('/').at(-1);
      const content: NativeLessonContent | null = sectionId === '7.1B' && source === (language === 'ru' ? '412' : '413') ? 'motion7'
        : (sectionId === '9.1A' || sectionId === '9.1B') && source === (language === 'ru' ? '405' : '407')
          ? sectionId === '9.1A' ? 'motion9-vectors' : 'motion9-kinematics'
          : sectionId === '11.1B' && source === '401' && file.language === 'en' ? 'motion11' : null;
      lessons.push({ id: `${sectionId}-${source || lessons.length}-${language}`, language: file.language === 'en' ? 'en' : language,
        title: content === 'motion7' ? 'Механическое движение'
          : content === 'motion9-vectors' ? 'Действия над векторами'
          : content === 'motion9-kinematics' ? 'Кинематика'
          : content === 'motion11' ? 'Kinematics' : file.originalName || 'Конспект', content, originals: [file] });
    }
  }
  if (grade === 9 && sectionId === '9.1B') lessons.push({ id: `${sectionId}-${language}-summary`, title: 'Краткая теория',
    language, content: 'kinematics-summary', originals: [] });
  return lessons;
}
