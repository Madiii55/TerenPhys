export const SCHOOL_GRADES = [7, 8, 9, 10, 11, 12] as const;
export type SchoolGrade = typeof SCHOOL_GRADES[number];

export function isSchoolGrade(value: unknown): value is SchoolGrade {
  return SCHOOL_GRADES.some(grade => grade === value);
}

export const STUDY_QUARTERS = [1, 2, 3, 4] as const;
export type StudyQuarter = typeof STUDY_QUARTERS[number];
export type QuarteredGrade = Exclude<SchoolGrade, 12>;
export interface StudySection { readonly id: string; readonly title: string }

// The supplied programme uses Latin A/B/C identifiers regardless of the UI language.
// There is no intermediate topic index and no invented quarter assignment for grade 12.
export const STUDY_PROGRAMME: Record<QuarteredGrade, Record<StudyQuarter, readonly StudySection[]>> = {
  7: {
    1: [{ id: '7.1A', title: 'Физические величины и измерения' }, { id: '7.1B', title: 'Движение' }],
    2: [{ id: '7.2A', title: 'Плотность' }, { id: '7.2B', title: 'Силы, масса и вес' }],
    3: [{ id: '7.3A', title: 'Трение' }, { id: '7.3B', title: 'Давление в твердых телах, жидкостях и газах' }, { id: '7.3C', title: 'Работа и мощность' }],
    4: [{ id: '7.4A', title: 'Энергия' }, { id: '7.4B', title: 'Моменты сил' }],
  },
  8: {
    1: [{ id: '8.1A', title: 'Тепловая физика' }, { id: '8.1B', title: 'Количество теплоты' }],
    2: [{ id: '8.2A', title: 'Электрическое поле' }, { id: '8.2B', title: 'Магнитное поле' }],
    3: [{ id: '8.3A', title: 'Постоянный ток' }, { id: '8.3B', title: 'Соединение проводников' }, { id: '8.3C', title: 'Потребление электроэнергии' }],
    4: [{ id: '8.4A', title: 'Световые явления' }, { id: '8.4B', title: 'Оптические приборы' }, { id: '8.4C', title: 'Спектр электромагнитных волн' }],
  },
  9: {
    1: [{ id: '9.1A', title: 'Действия над векторами' }, { id: '9.1B', title: 'Кинематика' }, { id: '9.1C', title: 'Криволинейное движение' }],
    2: [{ id: '9.2A', title: 'Динамика: деформация, силы и законы Ньютона' }, { id: '9.2B', title: 'Гравитационное поле' }],
    3: [{ id: '9.3A', title: 'Статика-моменты' }, { id: '9.3B', title: 'Законы сохранения' }, { id: '9.3C', title: 'Колебания' }],
    4: [{ id: '9.4A', title: 'Волновое движение' }, { id: '9.4B', title: 'Звук' }, { id: '9.4C', title: 'Астрофизика' }],
  },
  10: {
    1: [{ id: '10.1A', title: 'Физические величины и измерения' }, { id: '10.1B', title: 'Гравитационное поле' }],
    2: [{ id: '10.2A', title: 'Электрическое поле' }, { id: '10.2B', title: 'Постоянный ток' }],
    3: [{ id: '10.3A', title: 'Электрические цепи' }, { id: '10.3B', title: 'Электрический ток в различных средах' }, { id: '10.3C', title: 'Радиоактивность' }],
    4: [{ id: '10.4A', title: 'Физика атома и ядра' }, { id: '10.4B', title: 'Космология' }],
  },
  11: {
    1: [{ id: '11.1A', title: 'Физические величины и измерения' }, { id: '11.1B', title: 'Кинематика' }, { id: '11.1C', title: 'Кинематика жидкостей' }],
    2: [{ id: '11.2A', title: 'Динамика' }, { id: '11.2B', title: 'Законы сохранения' }],
    3: [{ id: '11.3A', title: 'Колебания и волны' }, { id: '11.3B', title: 'Тепловая физика' }],
    4: [{ id: '11.4A', title: 'Геометрическая оптика' }],
  },
};

export function hasStudyQuarters(grade: SchoolGrade): grade is QuarteredGrade {
  return grade !== 12;
}

// Flat yearly index is derived from the quarter catalogue, not maintained separately.
export const STUDY_SECTIONS: Record<SchoolGrade, readonly StudySection[]> = {
  7: STUDY_QUARTERS.flatMap(quarter => STUDY_PROGRAMME[7][quarter]),
  8: STUDY_QUARTERS.flatMap(quarter => STUDY_PROGRAMME[8][quarter]),
  9: STUDY_QUARTERS.flatMap(quarter => STUDY_PROGRAMME[9][quarter]),
  10: STUDY_QUARTERS.flatMap(quarter => STUDY_PROGRAMME[10][quarter]),
  11: STUDY_QUARTERS.flatMap(quarter => STUDY_PROGRAMME[11][quarter]),
  12: [
    { id: '12-mechanics', title: 'Механика' },
    { id: '12-molecular', title: 'Молекулярная физика и термодинамика' },
    { id: '12-electrodynamics', title: 'Электродинамика' },
    { id: '12-optics', title: 'Оптика' },
    { id: '12-quantum', title: 'Квантовая физика' },
    { id: '12-atomic', title: 'Атомная и ядерная физика' },
    { id: '12-astronomy', title: 'Астрономия' },
  ],
};

export function studySectionsFor(grade: SchoolGrade, quarter: StudyQuarter | null): readonly StudySection[] {
  if (!hasStudyQuarters(grade)) return STUDY_SECTIONS[grade];
  return quarter === null ? [] : STUDY_PROGRAMME[grade][quarter];
}

export const CLASS_NOTES: Record<SchoolGrade, string> = {
  7: 'Вещество, движение и первые законы',
  8: 'Тепло, электричество и свет',
  9: 'Движение, силы, колебания и астрофизика',
  10: 'Поля, электричество и строение атома',
  11: 'Движение, тепло, волны и оптика',
  12: 'Основные разделы физики',
};

// The existing kinematics demo now belongs to grade 9, quarter 1, section B.
// Other sections must not inherit unrelated kinematics tasks.
export function hasStudyMaterial(grade: SchoolGrade, sectionId: string | null): boolean {
  return grade === 9 && sectionId === '9.1B';
}
