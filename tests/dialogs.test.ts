import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act, useState } from 'react';

let compiled: Promise<Record<string, React.ComponentType<any>>> | undefined;
function components() {
  return compiled ??= (async () => {
    const result = await build({
      stdin: { contents: `export { AuthModal } from './src/components/AuthModal.tsx'; export { PrivacyPolicyModal } from './src/components/PrivacyPolicyModal.tsx'; export { LanguageProvider } from './src/i18n/LanguageContext.tsx';`, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
      bundle: true, write: false, platform: 'node', format: 'cjs',
      external: ['react', 'react/*', 'react-dom', 'react-dom/*'], loader: { '.css': 'empty' },
      plugins: [{ name: 'dialog-ui-only', setup(builder) {
        builder.onLoad({ filter: /[\\/]context[\\/]AuthContext\.tsx$/ }, () => ({
          contents: `export const useAuth = () => ({ pendingEmail: null, googleEnabled: true, user: null, registerWithEmail() { throw Error('Unexpected request'); }, loginWithEmail() { throw Error('Unexpected request'); }, loginWithGoogle() { throw Error('Unexpected request'); }, sendPasswordReset() { throw Error('Unexpected request'); } });`, loader: 'js',
        }));
      } }],
    });
    const module = { exports: {} as Record<string, React.ComponentType<any>> };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    return module.exports;
  })();
}

async function harness(name: 'AuthModal' | 'PrivacyPolicyModal', language: 'ru' | 'kk' = 'ru', strict = false) {
  const ui = await components();
  const dom = new JSDOM('<button id="origin">Open</button><div id="root"></div><div id="already-inert" inert="persist"></div>', { url: 'https://example.test/' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return [{ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 }] as unknown as DOMRectList;
  };
  // React detects native input events when its browser renderer loads.
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  const origin = document.getElementById('origin') as HTMLButtonElement;
  document.body.style.overflow = 'auto'; origin.focus();
  let closed = 0;
  function Host() {
    const [open, setOpen] = useState(true);
    return React.createElement(ui.LanguageProvider, { initialLanguage: language }, React.createElement(ui[name], {
      isOpen: open, initialMode: 'login', onClose: () => { closed++; setOpen(false); },
    }));
  }
  await act(() => root.render(strict ? React.createElement(React.StrictMode, null, React.createElement(Host)) : React.createElement(Host)));
  const press = (key: string, shiftKey = false) => {
    const event = new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
  };
  return { dom, origin, press, closed: () => closed,
    async close() {
      await act(() => root.unmount());
      assert.equal(document.body.style.overflow, 'auto');
      assert.equal(document.getElementById('root')!.hasAttribute('inert'), false);
      assert.equal(document.getElementById('already-inert')!.getAttribute('inert'), 'persist');
      dom.window.close();
      for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test('privacy dialog portals above the application, traps focus, closes with Escape and restores its trigger', async () => {
  const app = await harness('PrivacyPolicyModal', 'ru', true);
  try {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.ok(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent?.includes('Политика конфиденциальности'));
    assert.equal(dialog.parentElement?.parentElement, document.body);
    assert.equal(document.getElementById('root')!.contains(dialog), false);
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(document.getElementById('root')!.hasAttribute('inert'), true);
    const first = dialog.querySelector<HTMLButtonElement>('button')!;
    const last = [...dialog.querySelectorAll<HTMLButtonElement>('button')].at(-1)!;
    assert.equal(document.activeElement, first);
    await act(() => app.press('Tab', true)); assert.equal(document.activeElement, last);
    await act(() => app.press('Tab')); assert.equal(document.activeElement, first);
    app.origin.focus(); assert.equal(document.activeElement, first);
    await act(() => app.press('Escape'));
    assert.equal(app.closed(), 1); assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, app.origin);
  } finally { await app.close(); }
});

test('auth mode changes keep focus in the new form; a removed or external focus cannot escape on Tab', async () => {
  const app = await harness('AuthModal');
  try {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    assert.equal(document.activeElement, dialog.querySelector('input[type="email"]'));
    const forgot = dialog.querySelector<HTMLButtonElement>('.account-forgot')!;
    await act(() => { forgot.focus(); forgot.click(); });
    assert.equal(dialog.getAttribute('aria-label'), 'Сброс пароля');
    assert.equal(document.activeElement, dialog.querySelector('input[type="email"]'));
    const login = dialog.querySelector<HTMLButtonElement>('.account-switch button')!;
    await act(() => { login.focus(); login.click(); });
    assert.equal(dialog.getAttribute('aria-label'), 'Вход');
    const register = dialog.querySelector<HTMLButtonElement>('.account-switch button')!;
    await act(() => { register.focus(); register.click(); });
    assert.equal(dialog.getAttribute('aria-label'), 'Регистрация');
    assert.equal((document.activeElement as HTMLInputElement).autocomplete, 'nickname');
    const items = [...dialog.querySelectorAll<HTMLElement>('button, input')];
    items.at(-1)!.focus();
    await act(() => app.press('Tab')); assert.equal(document.activeElement, items[0]);
    // Disabled/removed controls can make activeElement fall back to the body.
    (document.activeElement as HTMLElement).blur();
    assert.equal(document.activeElement, document.body);
    const tab = app.press('Tab');
    assert.equal(tab.defaultPrevented, true); assert.equal(document.activeElement, items[0]);
    await act(() => app.press('Escape')); assert.equal(document.activeElement, app.origin);
  } finally { await app.close(); }
});

test('password visibility has its own labelled control, and privacy policy retains Kazakh copy', async () => {
  let app = await harness('AuthModal');
  try {
    const button = document.querySelector<HTMLButtonElement>('[aria-controls]')!;
    const field = document.getElementById(button.getAttribute('aria-controls')!) as HTMLInputElement;
    assert.equal(field.type, 'password'); assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.ok(document.querySelector(`label[for="${field.id}"]`));
    assert.equal(button.closest('label'), null);
    await act(() => button.click());
    assert.equal(field.type, 'text'); assert.equal(button.getAttribute('aria-pressed'), 'true');
  } finally { await app.close(); }
  app = await harness('PrivacyPolicyModal', 'kk');
  try {
    assert.match(document.querySelector('h2')!.textContent || '', /Құпиялық саясаты/);
    assert.match(document.querySelector('.privacy-dialog-content')!.textContent || '', /Жалпы ережелер/);
    const close = document.querySelector<HTMLButtonElement>('.privacy-dialog-close')!;
    assert.equal(close.getAttribute('aria-label'), 'Жабу');
    await act(() => close.click()); assert.equal(document.activeElement, app.origin);
  } finally { await app.close(); }
});
