import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { readVerifiedSession, isVerifiedAccount, authCallbackFromLink, verificationError } from '../src/auth/verification.ts';
import { canonicalLocalUrl, emailReturnUrl } from '../src/auth/localOrigin.ts';
const origin = 'https://example.test';
const account = (confirmed = false) => ({ id: 'account-one', email: 'student@example.test',
  email_confirmed_at: confirmed ? '2026-10-03T00:00:00Z' : undefined });
test('unverified accounts never load private profile data, even with a confirmed cache', async () => {
  for (const cached of [false, true]) {
    const calls: string[] = [];
    const result = await readVerifiedSession(account(cached), {
      reload: async () => { calls.push('server'); return account(false); },
      profile: async () => { assert.fail('Profile must not be read'); },
    });
    assert.deepEqual(result, { status: 'pending', email: 'student@example.test' });
    assert.deepEqual(calls, ['server']);
  }
});
test('server confirmation is checked before the private profile', async () => {
  const calls: string[] = [];
  const result = await readVerifiedSession(account(), {
    reload: async () => { calls.push('server'); return account(true); },
    profile: async fresh => { calls.push('profile'); assert.ok(fresh.email_confirmed_at); return 'private'; },
  });
  assert.deepEqual(calls, ['server', 'profile']);
  assert.equal(result.status, 'verified');
});
test('anonymous users, absent confirmation and editable metadata cannot authorize an account', () => {
  for (const user of [null, account(false), { ...account(true), is_anonymous: true },
    { ...account(false), user_metadata: { email_verified: true, role: 'admin' } },
    { ...account(true), email: '' }]) assert.equal(isVerifiedAccount(user), false);
});
test('network errors and account switches fail closed', async () => {
  await assert.rejects(readVerifiedSession(account(true), {
    reload: async () => { throw new Error('offline'); },
    profile: async () => { assert.fail('Profile must not be read'); },
  }));
  await assert.rejects(readVerifiedSession(account(true), {
    reload: async () => ({ ...account(true), id: 'another-account' }),
    profile: async () => { assert.fail('Profile must not be read'); },
  }));
});
test('email OTP hash and recovery hash are parsed without following redirects', () => {
  assert.deepEqual(authCallbackFromLink(origin + '/auth/confirm?type=email&token_hash=hash', origin),
    { kind: 'email', method: 'otp', tokenHash: 'hash', type: 'email' });
  assert.deepEqual(authCallbackFromLink(origin + '/auth/reset-password?type=recovery&token_hash=hash&next=https://bad.test', origin),
    { kind: 'recovery', method: 'otp', tokenHash: 'hash', type: 'recovery' });
});
test('PKCE distinguishes email, Google and password recovery routes', () => {
  for (const [path, kind] of [['confirm', 'email'], ['callback', 'oauth'], ['reset-password', 'recovery']]) {
    assert.deepEqual(authCallbackFromLink(origin + '/auth/' + path + '?code=test', origin), { kind, method: 'code', code: 'test' });
  }
});
test('legacy implicit callbacks accept only complete token pairs', () => {
  assert.deepEqual(authCallbackFromLink(origin + '/auth/callback#access_token=access&refresh_token=refresh&type=recovery', origin),
    { kind: 'recovery', method: 'tokens', accessToken: 'access', refreshToken: 'refresh' });
  assert.throws(() => authCallbackFromLink(origin + '/auth/callback#access_token=access', origin));
});
test('foreign origins, credentials, malformed links and mixed credentials are rejected', () => {
  for (const link of ['javascript:alert(1)', 'https://bad.test/auth/confirm?type=email&token_hash=test',
    'https://user:pass@example.test/auth/callback?code=test', origin + '/auth/callback?code=%20',
    origin + '/auth/confirm?type=email&token_hash=one&code=two',
    origin + '/auth/confirm?type=admin&token_hash=test', origin + '/auth/callback',
    origin + '/auth/callback?code=' + 'a'.repeat(2049)]) assert.throws(() => authCallbackFromLink(link, origin));
});
test('auth errors do not display provider diagnostics or token-bearing descriptions', () => {
  assert.match(verificationError({ code: 'otp_expired' }), /истекла/);
  assert.match(verificationError({ code: 'email_address_not_authorized' }), /SMTP/);
  assert.doesNotMatch(verificationError({ code: 'unknown', message: 'private-token' }), /private-token/);
  assert.throws(() => authCallbackFromLink(origin + '/auth/callback#error=access_denied&error_description=private-token', origin), error => !String(error).includes('private-token'));
});
test('numeric aliases normalize before session or PKCE startup', () => {
  assert.equal(canonicalLocalUrl('http://127.0.0.1:4173/auth/callback?code=test#keep'), 'http://localhost:4173/auth/callback?code=test#keep');
  assert.equal(canonicalLocalUrl('http://[::1]:4173/'), 'http://localhost:4173/');
  assert.equal(canonicalLocalUrl(origin), null);
});
test('controlled email destinations strip tokens and untrusted redirect values', () => {
  assert.equal(emailReturnUrl('http://127.0.0.1:4173/?code=secret&continueUrl=https://bad.test'), 'http://localhost:4173/auth/callback');
  assert.equal(emailReturnUrl('http://localhost:4173/', origin, 'reset-password'), origin + '/auth/reset-password');
  assert.throws(() => emailReturnUrl('http://example.test/'));
  assert.throws(() => emailReturnUrl('https://user:password@example.test/'));
});
test('schema grants no client role assignment, timestamp spoofing or cross-user profile access', () => {
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  for (const table of ['profiles', 'post_authors', 'posts']) assert.ok(sql.includes('alter table public.' + table + ' enable row level security'));
  assert.match(sql, /grant insert \(grade, text, author_id\)/);
  assert.match(sql, /grant update \(name, bio, avatar_path\)/);
  assert.doesNotMatch(sql, /grant (?:insert|update|all).*post_authors.*to authenticated/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /email_confirmed_at is not null/);
  assert.match(sql, /with check.*verified_account/s);
});
test('avatar upsert has owner-scoped insert, select and update policies', () => {
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  for (const action of ['read', 'insert', 'update']) assert.ok(sql.includes('create policy avatars_owner_' + action));
  assert.match(sql, /name = \(select auth.uid\(\)\)::text \|\| '\/profile.jpg'/);
});
test('Firebase is absent from app code and dependencies', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies.firebase, undefined);
  assert.equal(pkg.dependencies['@supabase/supabase-js'], '2.117.2');
  for (const path of ['../src/context/AuthContext.tsx', '../src/components/PostsPage.tsx', '../src/components/EmailActionPage.tsx']) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), 'utf8'), /from ['"][^'"]*firebase/);
  }
});
