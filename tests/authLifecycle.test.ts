import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import type { AuthContextType } from '../src/context/AuthContext.tsx';
import { clearRecovery, emailCooldown, matchesRecovery, rememberEmailSend, rememberRecovery, restoredRecovery, sessionIdentifier } from '../src/auth/browserState.ts';
import { oauthReturnUrl } from '../src/auth/localOrigin.ts';
import { capturedAuthLink, authCallbackKind, verificationError } from '../src/auth/verification.ts';

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const token = (id: string) => 'header.' + Buffer.from(JSON.stringify({ session_id: 'session-' + id })).toString('base64url') + '.signature';
const account = (id: string, confirmed = true) => ({ id, email: id + '@example.test', email_confirmed_at: confirmed ? '2026-10-08T00:00:00Z' : undefined, app_metadata: { provider: 'email' }, user_metadata: {} });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const row = (id: string) => ({ id, name: id, bio: '', avatar_path: null, created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' });

test('recovery UI survives reload, but expires and is bound to the same verified user and session', () => {
  const store = storage();
  rememberRecovery('A', 'session-A', store, 1000);
  const state = restoredRecovery(store, 2000);
  assert.equal(matchesRecovery(state, 'A', 'session-A', 2000), true);
  assert.equal(matchesRecovery(state, 'B', 'session-A', 2000), false);
  assert.equal(matchesRecovery(state, 'A', 'session-B', 2000), false);
  assert.equal(restoredRecovery(store, 1000 + 30 * 60 * 1000), null);
  clearRecovery(store); assert.equal(restoredRecovery(store, 2000), null);
  store.setItem('terenphys.recovery-state', '{invalid'); assert.equal(restoredRecovery(store, 2000), null);
  assert.equal(sessionIdentifier(token('A')), 'session-A');
  assert.equal(sessionIdentifier('not-a-token'), null);
});

test('resend timers survive reopening and normalize email without mixing signup and recovery', () => {
  const store = storage();
  rememberEmailSend(' A@EXAMPLE.TEST ', 'signup', 60, store, 1000);
  assert.equal(emailCooldown('a@example.test', 'signup', store, 1000), 60);
  assert.equal(emailCooldown('a@example.test', 'signup', store, 2500), 59);
  assert.equal(emailCooldown('a@example.test', 'recovery', store, 2500), 0);
  assert.equal(emailCooldown('b@example.test', 'signup', store, 2500), 0);
  assert.equal(emailCooldown('a@example.test', 'signup', store, 61000), 0);
});

test('OAuth returns to the initiating origin and recovery errors do not tell users to enter a forgotten password', () => {
  assert.equal(oauthReturnUrl('http://127.0.0.1:4173/?next=https://bad.test'), 'http://localhost:4173/auth/callback');
  assert.equal(oauthReturnUrl('https://terenphys.web.app/?code=old'), 'https://terenphys.web.app/auth/callback');
  assert.match(verificationError({ code: 'bad_code_verifier' }, 'recovery'), /новую ссылку/);
  assert.doesNotMatch(verificationError({ code: 'bad_code_verifier' }, 'recovery'), /войдите по почте и паролю/);
});

test('OAuth failures returned to the site root are captured and classified before rendering', async () => {
  const failed = 'https://terenphys.web.app/?error=invalid_request&error_code=bad_oauth_state&error_description=private-diagnostics';
  assert.equal(capturedAuthLink(failed), failed);
  assert.equal(authCallbackKind(new URL(failed)), 'oauth');
  assert.equal(capturedAuthLink('https://terenphys.web.app/?ordinary=page#section'), null);
  assert.equal(capturedAuthLink('https://terenphys.web.app/#error=access_denied'), 'https://terenphys.web.app/#error=access_denied');
  const app = await harness(null);
  try {
    await app.render();
    const result = await app.context().completeAuthCallback(failed);
    assert.equal(result.success, false); assert.equal(result.action, 'oauth');
    assert.match(result.error || '', /Google/); assert.doesNotMatch(result.error || '', /private-diagnostics/);
    assert.equal(app.exchanges(), 0); assert.equal(app.context().authenticatedAccount, null);
  } finally { await app.close(); }
});

let compiledPromise: Promise<Record<string, any>> | undefined;
function components() {
  return compiledPromise ??= (async () => {
    const result = await build({
      stdin: { contents: `export { AuthProvider, useAuth } from './src/context/AuthContext.tsx'; export { installMock } from './src/supabase.ts'; export { AuthModal } from './src/components/AuthModal.tsx'; export { EmailActionPage } from './src/components/EmailActionPage.tsx'; export { Navbar } from './src/components/Navbar.tsx';`, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
      bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', 'react/*', 'react-dom', 'react-dom/*'], loader: { '.css': 'empty' },
      define: { 'import.meta.env.VITE_PUBLIC_SITE_URL': 'undefined' },
      plugins: [{ name: 'isolated-auth-sdk', setup(builder) {
        builder.onLoad({ filter: /[\\/]src[\\/]supabase\.ts$/ }, () => ({ loader: 'js', contents: `export let supabase; export function installMock(value) { supabase = value; } export function avatarUrl() { return undefined; } export async function googleProviderEnabled() { return supabase.googleEnabled; }` }));
      } }],
    });
    const compiled = { exports: {} as Record<string, any> };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
    return compiled.exports;
  })();
}

async function harness(initialId: string | null, initialStorage?: ReturnType<typeof storage>, strict = false) {
  const ui = await components();
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://terenphys.web.app/' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: initialStorage || dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  if (initialStorage) Object.defineProperty(dom.window, 'sessionStorage', { configurable: true, value: initialStorage });
  let current = initialId ? account(initialId) : null;
  let callback: (event: string, session: any) => void = () => {};
  let profileReads = 0, updates = 0, signIns = 0, exchanges = 0;
  let profileResult: (id: string) => Promise<any> = async id => ({ data: row(id), error: null });
  let logoutError: unknown = null;
  const session = () => current ? { user: current, access_token: token(current.id) } : null;
  const sdk = {
    googleEnabled: true,
    auth: {
      getSession: async () => ({ data: { session: session() }, error: null }),
      getUser: async () => ({ data: { user: current }, error: null }),
      onAuthStateChange: (listener: typeof callback) => { callback = listener; return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async ({ email }: { email: string }) => { signIns++; current = account(email.split('@')[0]); callback('SIGNED_IN', session()); return { data: { user: current, session: session() }, error: null }; },
      exchangeCodeForSession: async () => { exchanges++; current = account('A'); callback('SIGNED_IN', session()); return { data: { session: session() }, error: null }; },
      updateUser: async () => { updates++; return { data: { user: current }, error: null }; },
      signOut: async () => { if (logoutError) return { error: logoutError }; current = null; callback('SIGNED_OUT', null); return { error: null }; },
    },
    from: () => { let id = ''; const query = { select: () => query, eq: (_key: string, value: string) => { id = value; return query; }, maybeSingle: async () => { profileReads++; return profileResult(id); } }; return query; },
  };
  ui.installMock(sdk);
  let context!: AuthContextType;
  const Probe = () => { context = ui.useAuth(); return null; };
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = async (child?: React.ReactNode) => { await act(async () => {
    const provider = React.createElement(ui.AuthProvider, null, React.createElement(Probe), child);
    root.render(strict ? React.createElement(React.StrictMode, null, provider) : provider);
    await new Promise(done => setTimeout(done, 5));
  }); };
  const settle = async () => { await act(async () => { await new Promise(done => setTimeout(done, 10)); }); };
  return {
    ui, dom, sdk, render, settle, context: () => context,
    setProfileResult: (next: typeof profileResult) => { profileResult = next; },
    setLogoutError: (next: unknown) => { logoutError = next; },
    setAccount: (next: typeof current) => { current = next; callback(next ? 'SIGNED_IN' : 'SIGNED_OUT', session()); },
    reads: () => profileReads, updates: () => updates, signIns: () => signIns, exchanges: () => exchanges,
    async close() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test('a delayed profile from A never overwrites B, including after B reports successful login', async () => {
  const app = await harness('A');
  const wait = deferred<any>();
  app.setProfileResult(async id => id === 'A' ? wait.promise : { data: row(id), error: null });
  try {
    await app.render(); assert.equal(app.reads(), 1);
    let result: any;
    await act(async () => { result = await app.context().loginWithEmail('B@example.test', 'example-password'); });
    assert.equal(result.success, true); assert.equal(app.context().user?.id, 'B');
    await act(async () => wait.resolve({ data: row('A'), error: null }));
    await app.settle(); assert.equal(app.context().user?.id, 'B');
    assert.equal(app.context().authenticatedAccount?.id, 'B');
  } finally { await app.close(); }
});

test('a private-profile outage does not undo successful authentication and can be retried', async () => {
  const app = await harness(null);
  try {
    app.setProfileResult(async () => ({ data: null, error: new Error('profile offline') }));
    await app.render();
    let result: any;
    await act(async () => { result = await app.context().loginWithEmail('B@example.test', 'example-password'); });
    assert.equal(result.success, true); assert.equal(app.context().user, null);
    assert.equal(app.context().authenticatedAccount?.id, 'B'); assert.match(app.context().profileError, /профиль/);
    app.setProfileResult(async id => ({ data: row(id), error: null }));
    await act(async () => { await app.context().retryProfile(); });
    assert.equal(app.context().user?.id, 'B'); assert.equal(app.context().profileError, '');
  } finally { await app.close(); }
});

test('password recovery resumes after remount without a token URL and cannot resume another session', async () => {
  const store = storage();
  let app = await harness(null, store);
  try {
    await app.render();
    let result: any;
    await act(async () => { result = await app.context().completeAuthCallback('https://terenphys.web.app/auth/reset-password?code=one-time'); });
    assert.equal(result.success, true); assert.equal(result.action, 'recovery');
  } finally { await app.close(); }
  app = await harness('A', store);
  try {
    await app.render();
    let result: any;
    await act(async () => { result = await app.context().completeAuthCallback('https://terenphys.web.app/auth/reset-password'); });
    assert.equal(result.success, true);
    await act(async () => { result = await app.context().changeRecoveredPassword('new-example-password'); });
    assert.equal(result.success, true); assert.equal(app.updates(), 1); assert.equal(restoredRecovery(store), null);
  } finally { await app.close(); }
  rememberRecovery('A', 'session-A', store);
  app = await harness('B', store);
  try {
    await app.render();
    let result: any;
    await act(async () => { result = await app.context().completeAuthCallback('https://terenphys.web.app/auth/reset-password'); });
    assert.equal(result.success, false); assert.equal(app.updates(), 0);
  } finally { await app.close(); }
});

test('navbar reports a failed logout instead of silently leaving the user signed in', async () => {
  const app = await harness('A');
  try {
    await app.render(React.createElement(app.ui.Navbar, { activeTab: 'profile', onTabChange() {}, onOpenAuth() {} }));
    app.setLogoutError(new Error('offline'));
    const button = [...app.dom.window.document.querySelectorAll('button')].find(item => item.textContent === 'Выйти')!;
    assert.ok(button);
    await act(async () => button.click());
    assert.match(app.dom.window.document.querySelector('[role="alert"]')?.textContent || '', /Не удалось выйти/);
    assert.equal(app.context().user?.id, 'A');
  } finally { await app.close(); }
});

test('Google buttons are hidden when the real provider is disabled', async () => {
  const app = await harness(null);
  app.sdk.googleEnabled = false;
  try {
    await app.render(React.createElement(app.ui.AuthModal, { isOpen: true, initialMode: 'login', onClose() {} }));
    assert.equal(app.dom.window.document.querySelector('.account-google'), null);
  } finally { await app.close(); }
});

test('an unconfirmed server account never loads a profile or becomes authenticated', async () => {
  const app = await harness(null);
  try {
    await app.render();
    await act(async () => { app.setAccount(account('A', false)); });
    await app.settle();
    assert.equal(app.reads(), 0); assert.equal(app.context().user, null);
    assert.equal(app.context().authenticatedAccount, null); assert.equal(app.context().pendingEmail, 'A@example.test');
  } finally { await app.close(); }
});

test('a signed-in account cannot open password recovery without a processed recovery link', async () => {
  const app = await harness('A');
  try {
    await app.render();
    const result = await app.context().completeAuthCallback('https://terenphys.web.app/auth/reset-password');
    assert.equal(result.success, false); assert.equal(app.updates(), 0);
    await act(async () => { await app.context().logout(); });
    assert.equal(app.context().authenticatedAccount, null); assert.equal(app.context().user, null);
  } finally { await app.close(); }
});

test('auth forms reject duplicate submission and disable mode switching while a request is pending', async () => {
  const app = await harness(null);
  const wait = deferred<any>();
  let calls = 0, closed = 0;
  app.sdk.auth.signInWithPassword = async () => { calls++; return wait.promise; };
  try {
    await app.render(React.createElement(app.ui.AuthModal, { isOpen: true, initialMode: 'login', onClose() { closed++; } }));
    const form = app.dom.window.document.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new app.dom.window.Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new app.dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(calls, 1);
    const register = [...app.dom.window.document.querySelectorAll('button')].find(item => item.textContent === 'Регистрация')!;
    assert.equal(register.disabled, true);
    assert.equal(app.dom.window.document.querySelector('input')?.disabled, true);
    await app.render(React.createElement(app.ui.AuthModal, { isOpen: false, initialMode: 'login', onClose() { closed++; } }));
    await act(async () => wait.resolve({ data: { user: null }, error: { code: 'invalid_credentials' } }));
    assert.equal(closed, 0);
  } finally { await app.close(); }
});

test('a completed OAuth callback keeps verified sign-in even when loading its profile fails', async () => {
  const app = await harness(null);
  try {
    app.setProfileResult(async () => ({ data: null, error: new Error('offline') }));
    await app.render();
    let result: any;
    await act(async () => { result = await app.context().completeAuthCallback('https://terenphys.web.app/auth/callback?code=example'); });
    assert.equal(result.success, true); assert.equal(result.action, 'oauth');
    assert.equal(app.context().authenticatedAccount?.id, 'A'); assert.match(app.context().profileError, /профиль/);
  } finally { await app.close(); }
});

test('the actual OAuth callback page completes once under application StrictMode', async () => {
  const app = await harness(null, undefined, true);
  try {
    await app.render(React.createElement(app.ui.EmailActionPage, { link: 'https://terenphys.web.app/auth/callback?code=example', onContinue() {} }));
    await app.settle();
    assert.equal(app.exchanges(), 1);
    assert.equal(app.context().authenticatedAccount?.id, 'A');
    assert.equal(app.dom.window.document.querySelector('[role="alert"]'), null);
    assert.match(app.dom.window.document.querySelector('h1')?.textContent || '', /Вход выполнен/);
  } finally { await app.close(); }
});

test('reloading completed email and OAuth pages verifies the session instead of consuming a code again', async () => {
  const app = await harness('A');
  try {
    await app.render();
    for (const path of ['callback', 'confirm']) {
      let result: any;
      await act(async () => { result = await app.context().completeAuthCallback('https://terenphys.web.app/auth/' + path); });
      assert.equal(result.success, true);
      assert.equal(result.action, path === 'callback' ? 'oauth' : 'email');
    }
    assert.equal(app.exchanges(), 0);
    await act(async () => app.setAccount(null));
    let rejected: any;
    await act(async () => { rejected = await app.context().completeAuthCallback('https://terenphys.web.app/auth/callback'); });
    assert.equal(rejected.success, false);
    assert.equal(app.context().authenticatedAccount, null);
  } finally { await app.close(); }
});

test('successful email requests persist their UI cooldown and do not send again after reopening', async () => {
  const app = await harness(null);
  let registrations = 0, recoveries = 0;
  Object.assign(app.sdk.auth, {
    signUp: async () => { registrations++; return { data: { user: account('A', false), session: null }, error: null }; },
    resetPasswordForEmail: async () => { recoveries++; return { error: null }; },
  });
  try {
    await app.render();
    await act(async () => {
      const result = await app.context().registerWithEmail('Reader', 'A@example.test', 'example-password');
      assert.equal(result.success, true); assert.equal(result.needsVerification, true);
    });
    assert.equal(registrations, 1);
    assert.equal(emailCooldown('a@example.test', 'signup'), 60);
    await app.render(React.createElement(app.ui.AuthModal, { isOpen: true, initialMode: 'login', onClose() {} }));
    const resend = [...app.dom.window.document.querySelectorAll('button')].find(item => item.textContent?.startsWith('Отправить снова через'))!;
    assert.ok(resend); assert.equal(resend.disabled, true);
    await act(async () => {
      const again = await app.context().registerWithEmail('Reader', 'A@example.test', 'example-password');
      assert.equal(again.success, false);
      const reset = await app.context().sendPasswordReset('A@example.test');
      assert.equal(reset.success, true);
      const repeat = await app.context().sendPasswordReset('A@example.test');
      assert.equal(repeat.success, false);
    });
    assert.equal(registrations, 1); assert.equal(recoveries, 1);
    assert.ok(emailCooldown('A@example.test', 'recovery') > 0);
  } finally { await app.close(); }
});
