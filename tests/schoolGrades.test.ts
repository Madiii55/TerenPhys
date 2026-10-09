import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SCHOOL_GRADES, STUDY_SECTIONS, CLASS_NOTES, isSchoolGrade, hasStudyMaterial } from '../src/learning/catalogue.ts';
import { validateTopic, type TopicDraft } from '../src/forum/model.ts';

test('one catalogue supports exactly grades 7 through 12', () => {
  assert.deepEqual(SCHOOL_GRADES, [7, 8, 9, 10, 11, 12]);
  for (const grade of SCHOOL_GRADES) {
    assert.equal(isSchoolGrade(grade), true);
    assert.ok(STUDY_SECTIONS[grade].length > 0);
    assert.equal(new Set(STUDY_SECTIONS[grade].map(section => section.id)).size, STUDY_SECTIONS[grade].length);
    assert.ok(CLASS_NOTES[grade]);
  }
  for (const invalid of [6, 13, 10.5, '10', null, undefined, NaN]) assert.equal(isSchoolGrade(invalid), false);
});

test('forum creation accepts all supported grades and the all-grades option', () => {
  const draft: TopicDraft = { title: 'Вопрос о физике', body: 'Достаточно подробное условие задачи для обсуждения.', grade: null, category: 'general' };
  for (const grade of [null, ...SCHOOL_GRADES]) assert.equal(validateTopic({ ...draft, grade }), null);
  for (const grade of [6, 13, 10.5, NaN]) assert.equal(validateTopic({ ...draft, grade }), 'Выберите класс из списка.');
});

test('empty sections never inherit the demo mechanics material', () => {
  for (const grade of SCHOOL_GRADES) {
    for (const section of STUDY_SECTIONS[grade]) {
      assert.equal(hasStudyMaterial(grade, section.id), grade === 9 && section.id === '9.1B');
    }
  }
});

test('study navigation has no intermediate topic selection', () => {
  const study = readFileSync(new URL('../src/components/StudyPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(study, /selectedTopic|topicsBySection|topicList|setLevel\('topics'\)|Все темы/);
  assert.match(study, /dispatch\(\{ type: 'select-section', sectionId: id \}\)/);
  assert.match(study, /Все разделы/);
});

test('all three pages render classes from the shared catalogue', () => {
  for (const page of ['StudyPage', 'PostsPage', 'ForumPage']) {
    const source = readFileSync(new URL('../src/components/' + page + '.tsx', import.meta.url), 'utf8');
    assert.match(source, /SCHOOL_GRADES\.map/);
  }
});

test('both schema snapshots permit grades 10, 11 and 12 without weakening access policies', () => {
  const posts = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const forum = readFileSync(new URL('../supabase/forum-schema.sql', import.meta.url), 'utf8');
  assert.equal((posts.match(/grade in \(7,8,9,10,11,12\)/g) || []).length, 2);
  assert.equal((forum.match(/grade in \(7,8,9,10,11,12\)/g) || []).length, 1);
  assert.match(posts, /a\.grade = posts\.grade and a\.is_active/);
  assert.match(forum, /with check \(\(select private\.verified_account\(\)\) and author_id = \(select auth\.uid\(\)\)\)/);
});

test('rendered study, post and forum pages expose all six classes to guests', async () => {
  // Compile the actual TSX pages, but isolate this render test from real accounts/network.
  const result = await build({
    stdin: {
      contents: "export { StudyPage } from './src/components/StudyPage.tsx'; export { PostsPage } from './src/components/PostsPage.tsx'; export { ForumPage } from './src/components/ForumPage.tsx';",
      resolveDir: fileURLToPath(new URL('..', import.meta.url)),
      sourcefile: 'school-pages.ts',
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['react', 'react-dom', 'react-dom/*'], loader: { '.css': 'empty' },
    plugins: [{ name: 'isolated-school-pages', setup(builder) {
      builder.onLoad({ filter: /[\\/]context[\\/]AuthContext\.tsx$/ }, () => ({
        contents: 'export function useAuth() { return { user: null, isLoading: false }; }', loader: 'ts',
      }));
      builder.onLoad({ filter: /[\\/]src[\\/]supabase\.ts$/ }, () => ({
        contents: 'export const supabase = {}; export const supabaseUrl = "https://example.supabase.co"; export function avatarUrl() { return undefined; }', loader: 'ts',
      }));
    } }],
  });
  const compiled: { exports: Record<string, React.ComponentType<any>> } = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  for (const page of ['StudyPage', 'PostsPage', 'ForumPage']) {
    const markup = renderToStaticMarkup(React.createElement(compiled.exports[page], { onOpenAuth: () => {}, active: false }));
    for (const grade of SCHOOL_GRADES) assert.ok(markup.includes('aria-label="' + grade + ' класс"'), page + ': missing ' + grade);
    if (page === 'StudyPage') {
      assert.match(markup, /data-study-level="classes"/);
      assert.match(markup, /<header class="learning-masthead">.*<\/header><div class="learning-body">.*class="learning-class-list"/);
    }
  }
});

test('study layout reserves the left galaxy area and stacks on smaller screens', () => {
  const css = readFileSync(new URL('../src/styles/learning.css', import.meta.url), 'utf8');
  assert.match(css, /\.learning-layout \{[^}]*grid-template-columns: minmax\(240px, \.72fr\) minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.learning-layout \{[^}]*grid-template-columns: minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /height:\s*100vh|overflow:\s*hidden/);
});
