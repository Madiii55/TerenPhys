import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LANGUAGE_KEY, classLabel, intlLocale, isLanguage, savedLanguage, translate } from '../src/i18n/locale.ts';
import { KAZAKH_MESSAGES } from '../src/i18n/messages.ts';
import { SCHOOL_GRADES, STUDY_SECTIONS, STUDY_QUARTERS, STUDY_PROGRAMME, CLASS_NOTES, type QuarteredGrade } from '../src/learning/catalogue.ts';
import { FORUM_CATEGORIES, formatForumDate, formatForumNumber, forumCount } from '../src/forum/model.ts';
import { verificationError } from '../src/auth/verification.ts';

test('language preference only accepts Russian and Kazakh', () => {
  assert.equal(isLanguage('ru'), true);
  assert.equal(isLanguage('kk'), true);
  for (const value of ['kaz', 'kz', 'en', '', null, undefined, {}, 7]) assert.equal(isLanguage(value), false);
  for (const value of ['ru', 'kk', 'kz', '', null]) {
    const storage = { getItem: (key: string) => { assert.equal(key, LANGUAGE_KEY); return value; } };
    assert.equal(savedLanguage(storage), value === 'kk' ? 'kk' : 'ru');
  }
});

test('disabled or missing browser storage still allows Russian as the default', () => {
  assert.equal(savedLanguage(), 'ru');
  assert.equal(savedLanguage({ getItem: () => { throw new Error('blocked storage'); } }), 'ru');
});

test('translation keeps the Russian original and uses explicit Kazakh copy', () => {
  assert.equal(translate('ru', 'Учёба'), 'Учёба');
  assert.equal(translate('kk', 'Учёба'), 'Оқу');
  assert.equal(translate('kk', 'Посты'), 'Жазбалар');
  assert.equal(translate('kk', 'Никнейм'), 'Лақап ат');
  assert.equal(translate('kk', 'An unknown server message'), 'An unknown server message');
  for (const key of ['constructor', 'toString', '__proto__']) assert.equal(translate('kk', key), key);
  for (const grade of SCHOOL_GRADES) {
    assert.equal(classLabel('ru', grade), grade + ' класс');
    assert.equal(classLabel('kk', grade), grade + '-сынып');
  }
});

test('template substitution preserves supplied personal values and zero', () => {
  assert.equal(translate('kk', 'Аватар {name}', { name: 'О себе' }), 'О себе аватары');
  assert.equal(translate('kk', 'Отправить снова через {seconds} с', { seconds: 0 }), '0 с кейін қайта жіберу');
  assert.equal(translate('ru', 'Ответ для {name}', { name: 'Қайрат' }), 'Ответ для Қайрат');
  assert.equal(translate('kk', 'Ответ для {name}'), '{name} үшін жауап');
  // Values are not recursively expanded or interpreted as markup by the translator.
  assert.equal(translate('kk', 'Аватар {name}', { name: '<script>{other}</script>' }), '<script>{other}</script> аватары');
});

test('every Kazakh translation preserves the original template parameters', () => {
  const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [source, translated] of Object.entries(KAZAKH_MESSAGES)) {
    assert.ok(translated.trim(), source);
    assert.deepEqual(tokens(translated), tokens(source), source);
  }
});

test('all study sections, class notes and forum categories have translations without changing their IDs', () => {
  for (const grade of SCHOOL_GRADES) {
    for (const section of STUDY_SECTIONS[grade]) assert.ok(Object.hasOwn(KAZAKH_MESSAGES, section.title), section.title);
    assert.ok(Object.hasOwn(KAZAKH_MESSAGES, CLASS_NOTES[grade]), CLASS_NOTES[grade]);
  }
  for (const category of FORUM_CATEGORIES) {
    assert.ok(Object.hasOwn(KAZAKH_MESSAGES, category.label), category.id);
    assert.match(category.id, /^[a-z]+$/);
  }
});

test('all interface literals and sanitized errors are covered by the dictionary', () => {
  const componentFiles = readdirSync(new URL('../src/components/', import.meta.url)).filter(name => name.endsWith('.tsx') && name !== 'LanguageSwitch.tsx');
  const files = ['App.tsx', 'auth/verification.ts', 'context/AuthContext.tsx', 'forum/model.ts', 'utils/imageCompressor.ts', ...componentFiles.map(name => 'components/' + name)];
  for (const file of files) {
    const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/(['"])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const text = match[2];
      if (/[А-Яа-яЁё]/.test(text) && text !== 'Пользователь') {
        assert.ok(Object.hasOwn(KAZAKH_MESSAGES, text), file + ': ' + text);
      }
    }
  }
  for (const code of ['otp_expired', 'flow_state_not_found', 'bad_code_verifier', 'email_not_confirmed', 'invalid_credentials', 'email_address_invalid', 'weak_password', 'email_exists', 'over_request_rate_limit', 'email_address_not_authorized', 'provider_disabled', 'unknown']) {
    assert.ok(Object.hasOwn(KAZAKH_MESSAGES, verificationError({ code })), code);
  }
});

test('forum dates and counts use the selected locale and correct Kazakh numeral grammar', () => {
  assert.equal(intlLocale('ru'), 'ru-RU');
  assert.equal(intlLocale('kk'), 'kk-KZ');
  assert.notEqual(formatForumDate('2026-05-17T12:00:00Z', 'ru-RU'), formatForumDate('2026-05-17T12:00:00Z', 'kk-KZ'));
  for (const value of [0, 1, 2, 5, 11, 21, 12000]) {
    assert.equal(forumCount(value, ['қаралым', 'unused', 'unused'], 'kk-KZ'), formatForumNumber(value, 'kk-KZ') + ' қаралым');
  }
  assert.equal(forumCount(1, ['просмотр', 'просмотра', 'просмотров']), '1 просмотр');
  assert.equal(forumCount(2, ['просмотр', 'просмотра', 'просмотров']), '2 просмотра');
  assert.equal(forumCount(11, ['просмотр', 'просмотра', 'просмотров']), '11 просмотров');
});

let compiledPromise: Promise<Record<string, any>> | undefined;
function isolatedComponents(): Promise<Record<string, any>> {
  return compiledPromise ??= (async () => {
    const result = await build({
      stdin: { contents: `
        export { LanguageProvider } from './src/i18n/LanguageContext.tsx';
        export { LanguageSwitch } from './src/components/LanguageSwitch.tsx';
        export { Navbar } from './src/components/Navbar.tsx';
        export { HomePage } from './src/components/HomePage.tsx';
        export { StudyPage, StudyQuarterList, StudySectionList } from './src/components/StudyPage.tsx';
        export { PostsPage, PostEntry } from './src/components/PostsPage.tsx';
        export { ForumPage } from './src/components/ForumPage.tsx';
        export { ProfilePage } from './src/components/ProfilePage.tsx';
        export { AuthModal } from './src/components/AuthModal.tsx';
        export { EmailVerification } from './src/components/EmailVerification.tsx';
        export { EmailActionPage } from './src/components/EmailActionPage.tsx';
        export { PrivacyPolicyModal } from './src/components/PrivacyPolicyModal.tsx';
        export { setFixtureAuth } from './src/context/AuthContext.tsx';
      `, resolveDir: fileURLToPath(new URL('..', import.meta.url)), sourcefile: 'language-fixture.ts' },
      bundle: true, write: false, platform: 'node', format: 'cjs',
      external: ['react', 'react-dom/*', 'pdfjs-dist', 'pdfjs-dist/*'], loader: { '.css': 'empty' },
      plugins: [{ name: 'isolated-language-render', setup(builder) {
        builder.onResolve({ filter: /^react-dom$/ }, () => ({ path: 'portals', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createPortal = children => children;', loader: 'js' }));
        builder.onLoad({ filter: /[\\/]context[\\/]AuthContext\.tsx$/ }, () => ({
          contents: "let state = { user: null, isLoading: false, pendingEmail: null, sessionError: '' }; export function useAuth() { return state; } export function setFixtureAuth(next) { state = { ...state, ...next }; }", loader: 'js',
        }));
        builder.onLoad({ filter: /[\\/]src[\\/]supabase\.ts$/ }, () => ({
          contents: 'export const supabase = {}; export const supabaseUrl = "https://example.supabase.co"; export function avatarUrl() { return undefined; }', loader: 'ts',
        }));
      } }],
    });
    const compiled: { exports: Record<string, any> } = { exports: {} };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
    return compiled.exports;
  })();
}

test('actual navigation and pages render in Russian and Kazakh, including grades 7–12', async () => {
  const components = await isolatedComponents();
  components.setFixtureAuth({ user: null, pendingEmail: null, sessionError: '' });
  const props = { onOpenAuth: () => {}, onNavigate: () => {}, onTabChange: () => {}, activeTab: 'study', active: false };
  for (const language of ['ru', 'kk'] as const) {
    const render = (name: string) => renderToStaticMarkup(React.createElement(components.LanguageProvider, { initialLanguage: language }, React.createElement(components[name], props)));
    const navbar = render('Navbar');
    for (const label of ['Учёба', 'Посты', 'Форум', 'Профиль', 'Войти', 'Регистрация']) assert.ok(navbar.includes(translate(language, label)), label);
    const switchMarkup = render('LanguageSwitch');
    assert.ok(switchMarkup.includes('aria-label="' + translate(language, 'Язык сайта') + '"'));
    assert.ok(switchMarkup.includes('lang="' + language + '" aria-label="' + (language === 'kk' ? 'Қазақша' : 'Русский') + '" aria-pressed="true"'));
    for (const page of ['StudyPage', 'PostsPage', 'ForumPage']) {
      const markup = render(page);
      for (const grade of SCHOOL_GRADES) assert.ok(markup.includes('aria-label="' + classLabel(language, grade) + '"'), page + ': ' + grade);
    }
    const home = render('HomePage');
    const { JSDOM } = createRequire(import.meta.url)('jsdom');
    const homeDom = new JSDOM(home);
    try {
      assert.ok(homeDom.window.document.querySelector('.home-copy')!.textContent!.includes(translate(language, 'Физика — это не просто формулы.')));
      assert.equal(homeDom.window.document.querySelector('h1')!.hasAttribute('data-cursor-avoid'), false);
      const words = homeDom.window.document.querySelectorAll('.home-word[data-cursor-avoid]');
      assert.ok(words.length > 10);
      for (const word of words) assert.equal(word.textContent!.trim().split(/\s+/).length, 1);
    } finally { homeDom.window.close(); }
    assert.ok(render('ForumPage').includes(translate(language, 'Поиск обсуждений')));
    assert.ok(render('ProfilePage').includes(translate(language, 'Войти по почте')));
  }
});

test('quarter and section badges expose translated availability before opening their materials', async () => {
  const components = await isolatedComponents();
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  for (const language of ['ru', 'kk'] as const) {
    const render = (name: string, props: object) => new JSDOM(renderToStaticMarkup(React.createElement(components.LanguageProvider,
      { initialLanguage: language }, React.createElement(components[name], props))));
    const quarters = render('StudyQuarterList', { grade: 8, onSelect: () => {} });
    const sections = render('StudySectionList', { sections: STUDY_PROGRAMME[8][1], onSelect: () => {} });
    try {
      const check = (document: Document, descriptionId: string, types: string[]) => {
        const button = document.querySelector(`[aria-describedby="${descriptionId}"]`)!;
        const description = document.getElementById(descriptionId)!;
        assert.ok(button.contains(description));
        assert.deepEqual([...description.querySelectorAll('[data-material]')].map(element => element.getAttribute('data-material')), types);
        for (const type of types) {
          const expected = translate(language, type === 'notes' ? 'Есть конспекты' : 'Есть пробники');
          const icon = description.querySelector(`[data-material="${type}"]`)!;
          assert.equal(icon.getAttribute('title'), expected);
          assert.equal(icon.textContent, expected);
        }
        if (!types.length) assert.equal(description.textContent, translate(language, 'Материалы пока не добавлены'));
      };
      check(quarters.window.document, 'study-quarter-materials-8-1', ['notes', 'trials']);
      for (const quarter of [2,3,4]) check(quarters.window.document, `study-quarter-materials-8-${quarter}`, []);
      check(sections.window.document, 'study-section-materials-8.1A', ['notes', 'trials']);
      check(sections.window.document, 'study-section-materials-8.1B', ['trials']);
      assert.equal(sections.window.document.querySelector('.learning-material-legend'), null);
      assert.equal(quarters.window.document.querySelector('.learning-material-legend'), null);
    } finally { quarters.window.close(); sections.window.close(); }
  }
});

test('authentication forms, email pages and policy render Kazakh interface copy', async () => {
  const components = await isolatedComponents();
  components.setFixtureAuth({ user: null, pendingEmail: 'reader@example.com', sessionError: '' });
  // The isolated portal renders its children directly; no real browser or auth request is involved.
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } });
  try {
    const render = (name: string, props: object) => renderToStaticMarkup(React.createElement(components.LanguageProvider, { initialLanguage: 'kk' }, React.createElement(components[name], props)));
    const verify = render('EmailVerification', {});
    assert.ok(verify.includes('reader@example.com'));
    assert.ok(verify.includes('Поштаңызды растаңыз'));
    const callback = render('EmailActionPage', { link: 'https://example.com/auth/confirm', onContinue: () => {} });
    assert.ok(callback.includes('Сілтемені тексеріп жатырмыз…'));
    assert.ok(callback.includes('Қаз'));
    components.setFixtureAuth({ pendingEmail: null });
    const register = render('AuthModal', { isOpen: true, initialMode: 'register', onClose: () => {} });
    for (const label of ['Лақап ат', 'Электрондық пошта', 'Құпиясөз', 'Аккаунт ашу', 'Қаз']) assert.ok(register.includes(label), label);
    const policy = render('PrivacyPolicyModal', { isOpen: true, onClose: () => {} });
    assert.ok(policy.includes('Құпиялық саясаты'));
    assert.ok(policy.includes('Жалпы ережелер'));
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    components.setFixtureAuth({ pendingEmail: null });
  }
});

test('the actual quarter and section pickers render the chosen curriculum in both languages', async () => {
  const components = await isolatedComponents();
  const render = (language: 'ru' | 'kk', name: string, props: object) => renderToStaticMarkup(React.createElement(components.LanguageProvider, { initialLanguage: language }, React.createElement(components[name], props)));
  for (const language of ['ru', 'kk'] as const) {
    for (const grade of [7, 8, 9, 10, 11] as QuarteredGrade[]) {
      const quarters = render(language, 'StudyQuarterList', { grade, onSelect: () => {} });
      assert.equal((quarters.match(/<button/g) || []).length, 4);
      for (const quarter of STUDY_QUARTERS) {
        assert.ok(quarters.includes('aria-label="' + translate(language, '{quarter} четверть', { quarter }) + '"'));
        const sections = STUDY_PROGRAMME[grade][quarter];
        const markup = render(language, 'StudySectionList', { sections, onSelect: () => {} });
        assert.equal((markup.match(/<button/g) || []).length, sections.length);
        for (const section of sections) {
          assert.ok(markup.includes('aria-label="' + section.id + ' — ' + translate(language, section.title) + '"'), section.id);
        }
        for (const otherQuarter of STUDY_QUARTERS.filter(other => other !== quarter)) {
          for (const section of STUDY_PROGRAMME[grade][otherQuarter]) assert.ok(!markup.includes(section.id), section.id + ': must not leak into another quarter');
        }
      }
    }
  }
});

test('Russian post text and personal values remain unchanged in the Kazakh interface', async () => {
  const components = await isolatedComponents();
  const post = { id: 'fixture', grade: 7, text: 'Физика — это не просто формулы.', authorName: 'Никнейм', authorId: 'author', createdAt: '2026-05-17T12:00:00Z' };
  const render = (name: string, props: object) => renderToStaticMarkup(React.createElement(components.LanguageProvider, { initialLanguage: 'kk' }, React.createElement(components[name], props)));
  const markup = render('PostEntry', { post });
  assert.ok(markup.includes('class="dispatch-author">Никнейм</span>'));
  assert.ok(markup.includes('class="dispatch-text">Физика — это не просто формулы.</p>'));
  components.setFixtureAuth({ user: { id: 'fixture', name: 'Никнейм', email: 'reader@example.com', bio: 'Здесь пока нет описания.', emailVerified: true } });
  try {
    const profile = render('ProfilePage', { onOpenAuth: () => {} });
    assert.ok(profile.includes('<h1>Никнейм</h1>'));
    assert.ok(profile.includes('<p>Здесь пока нет описания.</p>'));
    assert.ok(profile.includes('Өзім туралы'));
  } finally { components.setFixtureAuth({ user: null }); }
});
