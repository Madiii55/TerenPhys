import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STUDY_QUARTERS, STUDY_PROGRAMME, STUDY_SECTIONS, studySectionsFor, hasStudyQuarters, hasStudyMaterial, type QuarteredGrade } from '../src/learning/catalogue.ts';
import { initialStudyNavigation, studyNavigationReducer as navigate } from '../src/learning/navigation.ts';
import { translate } from '../src/i18n/locale.ts';

const expected: Record<QuarteredGrade, string[][]> = {
  7: [
    ['Физические величины и измерения', 'Движение'],
    ['Плотность', 'Силы, масса и вес'],
    ['Трение', 'Давление в твердых телах, жидкостях и газах', 'Работа и мощность'],
    ['Энергия', 'Моменты сил'],
  ],
  8: [
    ['Тепловая физика', 'Количество теплоты'],
    ['Электрическое поле', 'Магнитное поле'],
    ['Постоянный ток', 'Соединение проводников', 'Потребление электроэнергии'],
    ['Световые явления', 'Оптические приборы', 'Спектр электромагнитных волн'],
  ],
  9: [
    ['Действия над векторами', 'Кинематика', 'Криволинейное движение'],
    ['Динамика: деформация, силы и законы Ньютона', 'Гравитационное поле'],
    ['Статика-моменты', 'Законы сохранения', 'Колебания'],
    ['Волновое движение', 'Звук', 'Астрофизика'],
  ],
  10: [
    ['Физические величины и измерения', 'Гравитационное поле'],
    ['Электрическое поле', 'Постоянный ток'],
    ['Электрические цепи', 'Электрический ток в различных средах', 'Радиоактивность'],
    ['Физика атома и ядра', 'Космология'],
  ],
  11: [
    ['Физические величины и измерения', 'Кинематика', 'Кинематика жидкостей'],
    ['Динамика', 'Законы сохранения'],
    ['Колебания и волны', 'Тепловая физика'],
    ['Геометрическая оптика'],
  ],
};

test('every supplied section of grades 7–11 belongs to the correct quarter and retains its order', () => {
  let count = 0;
  for (const grade of [7, 8, 9, 10, 11] as const) {
    assert.equal(hasStudyQuarters(grade), true);
    assert.deepEqual(STUDY_QUARTERS.map(quarter => STUDY_PROGRAMME[grade][quarter].map(section => section.title)), expected[grade]);
    for (const quarter of STUDY_QUARTERS) {
      for (const [index, section] of STUDY_PROGRAMME[grade][quarter].entries()) {
        assert.equal(section.id, grade + '.' + quarter + 'ABC'[index]);
        count++;
      }
    }
    assert.deepEqual(STUDY_SECTIONS[grade], STUDY_QUARTERS.flatMap(quarter => STUDY_PROGRAMME[grade][quarter]));
  }
  assert.equal(count, 47);
});

test('grades 7–11 require a quarter, while grade 12 keeps its existing unassigned sections', () => {
  for (const grade of [7, 8, 9, 10, 11] as const) {
    assert.deepEqual(studySectionsFor(grade, null), []);
    for (const quarter of STUDY_QUARTERS) assert.equal(studySectionsFor(grade, quarter), STUDY_PROGRAMME[grade][quarter]);
  }
  assert.equal(hasStudyQuarters(12), false);
  assert.equal(studySectionsFor(12, null), STUDY_SECTIONS[12]);
  assert.equal(STUDY_SECTIONS[12].length, 7);
  assert.equal(navigate(initialStudyNavigation, { type: 'select-grade', grade: 12 }).level, 'sections');
});

test('forward navigation follows class → quarter → section → material for every supplied section', () => {
  for (const grade of [7, 8, 9, 10, 11] as const) {
    const classSelection = navigate(initialStudyNavigation, { type: 'select-grade', grade });
    assert.equal(classSelection.level, 'quarters');
    assert.equal(classSelection.quarter, null);
    assert.equal(classSelection.sectionId, null);
    // Selecting a section before selecting a quarter is rejected.
    assert.equal(navigate(classSelection, { type: 'select-section', sectionId: STUDY_PROGRAMME[grade][1][0].id }), classSelection);
    for (const quarter of STUDY_QUARTERS) {
      const quarterSelection = navigate(classSelection, { type: 'select-quarter', quarter });
      assert.equal(quarterSelection.level, 'sections');
      for (const section of STUDY_PROGRAMME[grade][quarter]) {
        const material = navigate(quarterSelection, { type: 'select-section', sectionId: section.id });
        assert.deepEqual(material, { level: 'material', grade, quarter, sectionId: section.id });
        assert.deepEqual(navigate(material, { type: 'back' }), { ...material, level: 'sections' });
        assert.deepEqual(navigate(navigate(material, { type: 'back' }), { type: 'back' }), { ...material, level: 'quarters' });
      }
    }
  }
});

test('changing quarter or class clears the former section and prevents cross-quarter selection', () => {
  let state = navigate(initialStudyNavigation, { type: 'select-grade', grade: 7 });
  state = navigate(state, { type: 'select-quarter', quarter: 1 });
  state = navigate(state, { type: 'select-section', sectionId: '7.1B' });
  state = navigate(state, { type: 'grade' });
  state = navigate(state, { type: 'select-quarter', quarter: 3 });
  assert.equal(state.sectionId, null);
  assert.equal(navigate(state, { type: 'select-section', sectionId: '7.1B' }), state);
  assert.equal(navigate(state, { type: 'select-section', sectionId: '8.3A' }), state);
  state = navigate(state, { type: 'select-grade', grade: 11 });
  assert.deepEqual(state, { level: 'quarters', grade: 11, quarter: null, sectionId: null });
});

test('breadcrumb and back navigation keep the chosen quarter and support the grade 12 exception', () => {
  let state = navigate(initialStudyNavigation, { type: 'select-grade', grade: 9 });
  state = navigate(state, { type: 'select-quarter', quarter: 1 });
  state = navigate(state, { type: 'select-section', sectionId: '9.1B' });
  assert.deepEqual(navigate(state, { type: 'quarter' }), { ...state, level: 'sections' });
  assert.deepEqual(navigate(state, { type: 'grade' }), { ...state, level: 'quarters' });
  assert.deepEqual(navigate(state, { type: 'classes' }), { ...state, level: 'classes' });
  state = navigate(state, { type: 'select-grade', grade: 12 });
  assert.equal(navigate(state, { type: 'select-quarter', quarter: 1 }), state);
  state = navigate(state, { type: 'select-section', sectionId: '12-mechanics' });
  assert.equal(state.level, 'material');
  state = navigate(state, { type: 'back' });
  assert.equal(state.level, 'sections');
  assert.equal(navigate(state, { type: 'back' }).level, 'classes');
});

test('existing demo material is only in 9.1B, and localization never changes section identity', () => {
  for (const grade of [7, 8, 9, 10, 11, 12] as const) {
    for (const section of STUDY_SECTIONS[grade]) {
      assert.equal(hasStudyMaterial(grade, section.id), grade === 9 && section.id === '9.1B');
      const idBefore = section.id;
      for (const language of ['ru', 'kk'] as const) assert.ok(translate(language, section.title));
      assert.equal(section.id, idBefore);
    }
  }
  assert.equal(hasStudyMaterial(9, null), false);
  assert.equal(hasStudyMaterial(12, '9.1B'), false);
});
