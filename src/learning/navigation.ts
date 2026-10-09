import { hasStudyQuarters, studySectionsFor, STUDY_QUARTERS, type SchoolGrade, type StudyQuarter } from './catalogue.ts';

export interface StudyNavigation {
  level: 'classes' | 'quarters' | 'sections' | 'material';
  grade: SchoolGrade;
  quarter: StudyQuarter | null;
  sectionId: string | null;
}
export const initialStudyNavigation: StudyNavigation = { level: 'classes', grade: 9, quarter: null, sectionId: null };
export type StudyAction =
  | { type: 'select-grade'; grade: SchoolGrade }
  | { type: 'select-quarter'; quarter: StudyQuarter }
  | { type: 'select-section'; sectionId: string }
  | { type: 'classes' | 'grade' | 'quarter' | 'back' };

export function studyNavigationReducer(state: StudyNavigation, action: StudyAction): StudyNavigation {
  switch (action.type) {
    case 'select-grade':
      return { level: hasStudyQuarters(action.grade) ? 'quarters' : 'sections', grade: action.grade, quarter: null, sectionId: null };
    case 'select-quarter':
      if (!hasStudyQuarters(state.grade) || !STUDY_QUARTERS.includes(action.quarter)) return state;
      return { ...state, level: 'sections', quarter: action.quarter, sectionId: null };
    case 'select-section':
      if (!studySectionsFor(state.grade, state.quarter).some(section => section.id === action.sectionId)) return state;
      return { ...state, level: 'material', sectionId: action.sectionId };
    case 'classes': return { ...state, level: 'classes' };
    case 'grade': return { ...state, level: hasStudyQuarters(state.grade) ? 'quarters' : 'sections' };
    case 'quarter': return state.quarter !== null ? { ...state, level: 'sections' } : state;
    case 'back':
      if (state.level === 'material') return { ...state, level: 'sections' };
      if (state.level === 'sections' && hasStudyQuarters(state.grade)) return { ...state, level: 'quarters' };
      return { ...state, level: 'classes' };
  }
}
