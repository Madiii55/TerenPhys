import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TELEGRAM_STUDY_CATALOGUE as catalogue, TELEGRAM_STUDY_EXCLUDED as excluded } from '../src/learning/telegramCatalogue.ts';
import { quarterMaterial, quarterSectionTrial, sectionMaterials, quarterMaterialAvailability, sectionMaterialAvailability, studyDownloadUrl, type StudyResource } from '../src/learning/materials.ts';
import { STUDY_PROGRAMME, type QuarteredGrade } from '../src/learning/catalogue.ts';

const entry = (messageId: number) => catalogue.find(item => item.sources.includes(messageId))!;
const resources = (language: 'ru' | 'kk') => {
  const result: StudyResource[] = [];
  for (const grade of [7, 8, 9, 10, 11] as const) for (const quarter of [1, 2, 3, 4] as const) {
    const soch = quarterMaterial(grade, quarter, language), trial = quarterSectionTrial(grade, quarter, language);
    if (soch) result.push(soch); if (trial) result.push(trial);
    for (const section of STUDY_PROGRAMME[grade][quarter]) result.push(...Object.values(sectionMaterials(grade, section.id, language)));
  }
  return result;
};

test('the active channel catalogue contains only first-quarter files, with unique source membership and original byte hashes', () => {
  assert.equal(catalogue.length, 41);
  assert.equal(catalogue.reduce<number>((sum, item) => sum + item.sources.length, 0), 45);
  assert.equal(excluded.length, 10); // Historical source audit remains available.
  const sourceIds = catalogue.flatMap(item => item.sources);
  assert.equal(new Set(sourceIds).size, sourceIds.length);
  assert.equal(catalogue.filter(item => item.external).length, 0);
  assert.equal(catalogue.filter(item => item.sha256).length, 41);
  assert.equal(new Set(catalogue.map(item => item.id)).size, catalogue.length);
  for (const item of catalogue) {
    assert.equal(item.quarter, 1, item.id);
    assert.ok(item.names.length && item.sources.length && item.evidence);
    if (item.path) {
      assert.match(item.sha256!, /^[a-f0-9]{64}$/);
      assert.equal(item.path, `nisphysicshub/assets/${item.sha256}.${item.format}`);
      assert.ok(item.bytes! > 0 && item.bytes! < 16 * 1024 * 1024);
    } else assert.equal(item.external, true);
  }
});

test('content takes precedence over misleading filenames and shared files are attached only to the sections they cover', () => {
  assert.deepEqual(entry(412).sections, ['7.1B']);
  assert.deepEqual(entry(410).sections, ['7.1B']);
  assert.deepEqual(entry(401).sections, ['11.1B']); assert.equal(entry(401).language, 'en');
  assert.deepEqual(entry(423).sections, ['10.1B']);
  assert.deepEqual(entry(405).sections, ['9.1A', '9.1B']);
  assert.deepEqual(entry(398).sections, ['9.1A', '9.1B']);
});

test('every classified file is reachable, respects curriculum and language, and downloads with normalized codes', () => {
  for (const language of ['ru', 'kk'] as const) {
    const all = resources(language), files = all.flatMap(resource => resource.files);
    for (const item of catalogue) {
      const matches = files.filter(file => file.url === item.localUrl || file.url.endsWith(item.path || '/'+Math.max(...item.sources)));
      const available = item.language === language || item.language === 'en' || item.language === 'und';
      assert.equal(Boolean(matches.length), available, item.id + ' ' + language);
      for (const file of matches) {
        assert.match(file.downloadName, /^(?:7|8|9|10|11)\.1[ABC]?-(?:RU|KZ|EN|UND)-/);
        assert.equal(file.format, item.external ? 'telegram' : item.format);
        if (item.path && !item.localUrl) assert.ok(studyDownloadUrl(file).endsWith('?download=' + encodeURIComponent(file.downloadName)));
      }
      for (const section of item.sections) {
        assert.ok(Object.values(STUDY_PROGRAMME[item.grade as QuarteredGrade]).flat().some(value => value.id === section));
        assert.equal(Number(section.split('.')[1][0]), item.quarter);
      }
    }
    for (const resource of all) assert.equal(new Set(resource.files.map(file => file.url)).size, resource.files.length, resource.id);
    assert.deepEqual(sectionMaterials(8, '9.1B', language), {});
    assert.deepEqual(sectionMaterials(12, '12-optics', language), {});
    assert.equal(quarterMaterial(12, 1, language), undefined);
  }
});

test('other quarters have no resources, while first-quarter files with uncertain sections or language remain explicit', () => {
  for (const language of ['ru', 'kk'] as const) {
    for (const grade of [7,8,9,10,11] as const) for (const quarter of [2,3,4] as const) {
      assert.equal(quarterMaterial(grade, quarter, language), undefined);
      assert.equal(quarterSectionTrial(grade, quarter, language), undefined);
      for (const section of STUDY_PROGRAMME[grade][quarter]) assert.deepEqual(sectionMaterials(grade, section.id, language), {});
    }
    assert.equal(quarterSectionTrial(9,1,language)!.files[0].language, 'und');
  }
  assert.deepEqual(entry(68).sections, []);
  assert.equal(entry(68).language, 'und');
  assert.equal(sectionMaterials(8,'8.1A','ru').trial!.files.length, 1);
  assert.deepEqual(sectionMaterials(8,'8.1B','kk').trial!.files.map(file => file.label), ['Задания','Ответы']);
});

test('availability describes actual notes and trials at the section and quarter, including whole-quarter files', () => {
  for (const language of ['ru', 'kk'] as const) {
    for (const grade of [7,8,9] as const) assert.deepEqual(quarterMaterialAvailability(grade,1,language), {notes:true,trials:true});
    assert.deepEqual(quarterMaterialAvailability(10,1,language), {notes:false,trials:true});
    assert.deepEqual(quarterMaterialAvailability(11,1,language), {notes:true,trials:false});
    for (const grade of [7,8,9,10,11] as const) for (const quarter of [2,3,4] as const) {
      assert.deepEqual(quarterMaterialAvailability(grade,quarter,language), {notes:false,trials:false});
    }
    assert.deepEqual(sectionMaterialAvailability(7,'7.1A',language), {notes:false,trials:false});
    assert.deepEqual(sectionMaterialAvailability(7,'7.1B',language), {notes:true,trials:true});
    assert.deepEqual(sectionMaterialAvailability(8,'8.1A',language), {notes:true,trials:true});
    assert.deepEqual(sectionMaterialAvailability(8,'8.1B',language), {notes:false,trials:true});
    assert.deepEqual(sectionMaterialAvailability(9,'9.1C',language), {notes:false,trials:true});
    assert.deepEqual(sectionMaterialAvailability(11,'11.1B',language), {notes:true,trials:false});
    assert.deepEqual(quarterMaterialAvailability(12,1,language), {notes:false,trials:false});
  }
});
