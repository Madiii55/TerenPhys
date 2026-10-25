import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEinsteinHandler, geminiBody, GEMINI_MODELS } from '../supabase/functions/_shared/einstein.ts';
import type { EinsteinRequest } from '../src/einstein/protocol.ts';

const origin = 'https://terenphys.vercel.app';
const userId = '10000000-0000-4000-8000-000000000001';
const token = 'verified-test-token-123456789';
const input: EinsteinRequest = {
  messages: [{ role: 'user', content: 'Почему меняется скорость?' }],
  context: { page: 'home', language: 'ru', availableActions: ['navigate-study'] },
};
const verifiedUser = { id: userId, email_confirmed_at: '2026-10-01T00:00:00Z', is_anonymous: false };
const environment: Record<string, string> = {
  SUPABASE_URL: 'https://project.example.test', SUPABASE_ANON_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-test-key', GEMINI_API_KEY: 'gemini-test-key',
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
const modelReply = (value: unknown = { answer: 'Ускорение изменяет скорость: a = Δv / Δt.', actions: [] }, finishReason = 'STOP') => json({
  candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }],
});
function request(body: unknown = input, headers: Record<string, string> = {}, method = 'POST') {
  return new Request('https://project.example.test/functions/v1/einstein-assistant', {
    method, headers: { origin, authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}
type Step = Response | Error;
function fixture(steps: Step[] = [json(verifiedUser), json({ allowed: true }), modelReply()], overrides: Record<string, string | undefined> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const settings = { ...environment, ...overrides };
  const handler = createEinsteinHandler({
    env: name => settings[name],
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      const step = steps.shift();
      assert.ok(step, 'unexpected upstream request');
      if (step instanceof Error) throw step;
      return step;
    },
  });
  return { handler, calls };
}
async function expectError(response: Response, status: number, code: string, retryAfterSeconds?: number) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: { code, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } });
  assert.equal(response.headers.get('cache-control'), 'no-store');
}

test('backend rejects missing authentication and disallowed origins before any API call', async () => {
  const f = fixture([]);
  await expectError(await f.handler(request(input, { authorization: '' })), 401, 'auth_required');
  const forbidden = await f.handler(request(input, { origin: 'https://attacker.example.test' }));
  await expectError(forbidden, 403, 'forbidden_origin');
  assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
  assert.equal(f.calls.length, 0);
});

test('backend supports allowed CORS preflight and rejects non-POST requests without upstream calls', async () => {
  const f = fixture([]);
  const preflight = await f.handler(request(undefined, { origin: 'http://localhost:4174' }, 'OPTIONS'));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:4174');
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  await expectError(await f.handler(request(undefined, {}, 'GET')), 405, 'method_not_allowed');
  assert.equal(f.calls.length, 0);
});

test('backend bounds JSON bytes, message lengths and accepted page metadata before API calls', async () => {
  const f = fixture([]);
  const invalid = [
    request(input, { 'content-type': 'text/plain' }),
    request('{bad-json'),
    request(input, { 'content-length': '40001' }),
    request(' '.repeat(40001)),
    request({ ...input, messages: [{ role: 'user', content: 'x'.repeat(1801) }] }),
    request({ ...input, messages: Array.from({ length: 5 }, () => ({ role: 'user', content: 'x'.repeat(1800) })) }),
    request({ ...input, context: { ...input.context, availableActions: ['run-script'] } }),
    request({ ...input, profile: { email: 'private@example.test' } }),
  ];
  for (const malformed of invalid) await expectError(await f.handler(malformed), 400, 'invalid_request');
  assert.equal(f.calls.length, 0);
});

test('backend verifies the remote account instead of accepting bearer claims', async () => {
  for (const response of [json({ error: 'deleted' }, 401), json({ id: 'not-a-uuid' })]) {
    const f = fixture([response]);
    await expectError(await f.handler(request()), 401, 'auth_required');
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, environment.SUPABASE_URL + '/auth/v1/user');
    assert.equal(new Headers(f.calls[0].init?.headers).get('authorization'), 'Bearer ' + token);
    assert.equal(new Headers(f.calls[0].init?.headers).get('apikey'), environment.SUPABASE_ANON_KEY);
  }
});

test('unconfirmed or anonymous accounts cannot reserve quota or call Gemini', async () => {
  for (const user of [
    { ...verifiedUser, email_confirmed_at: null },
    { ...verifiedUser, email_confirmed_at: 'invalid-date' },
    { ...verifiedUser, is_anonymous: true },
  ]) {
    const f = fixture([json(user)]);
    await expectError(await f.handler(request()), 403, 'email_unverified');
    assert.equal(f.calls.length, 1);
  }
});

test('missing Gemini configuration and unsupported models never use an existing OpenAI key', async () => {
  for (const overrides of [
    { GEMINI_API_KEY: undefined, OPENAI_API_KEY: 'openai-test-key' },
    { EINSTEIN_GEMINI_MODEL: 'paid-or-unapproved-model', OPENAI_API_KEY: 'openai-test-key' },
  ]) {
    const f = fixture([json(verifiedUser)], overrides);
    await expectError(await f.handler(request()), 503, 'not_configured');
    assert.equal(f.calls.length, 1);
  }
});

test('database rate refusal stops Gemini and bounds Retry-After', async () => {
  for (const [upstreamRetry, expectedRetry] of [[12.1, 13], [999999, 86400], [-9, 1]]) {
    const f = fixture([json(verifiedUser), json({ allowed: false, retry_after_seconds: upstreamRetry })]);
    const response = await f.handler(request());
    await expectError(response, 429, 'rate_limited', expectedRetry);
    assert.equal(response.headers.get('retry-after'), String(expectedRetry));
    assert.equal(response.headers.get('access-control-expose-headers'), 'Retry-After');
    assert.equal(f.calls.length, 2);
  }
});

test('quota failure and malformed reservation fail closed before inference', async () => {
  for (const quota of [json({ error: 'server-test-key must remain private' }, 500), json({ allowed: 'true' }), new Response('{bad-json')]) {
    const f = fixture([json(verifiedUser), quota]);
    await expectError(await f.handler(request()), 503, 'upstream_unavailable');
    assert.equal(f.calls.length, 2);
  }
});

test('Gemini free quota exhaustion produces one bounded error, without fallback or secret leakage', async () => {
  const f = fixture([json(verifiedUser), json({ allowed: true }), json({ error: 'gemini-test-key upstream diagnostic' }, 429, { 'Retry-After': '91' })], {
    OPENAI_API_KEY: 'openai-test-key',
  });
  const response = await f.handler(request());
  await expectError(response, 429, 'rate_limited', 91);
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[2].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(new Headers(f.calls[2].init?.headers).get('x-goog-api-key'), environment.GEMINI_API_KEY);
  assert.ok(f.calls.every(call => !call.url.includes('openai')));
});

test('valid inference uses only verified account quota and filters unavailable model actions', async () => {
  const f = fixture([json({ ...verifiedUser, email: 'private@example.test' }), json({ allowed: true }), modelReply({
    answer: '  Сила изменяет скорость. F = ma.  ',
    actions: [
      { id: 'navigate-study', label: '  Открыть Учёбу  ', url: 'https://attacker.example.test', command: 'run' },
      { id: 'navigate-profile', label: 'Unavailable' },
      { id: 'run-script', label: 'Unknown' },
    ],
  })]);
  const response = await f.handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(await response.json(), { answer: 'Сила изменяет скорость. F = ma.', actions: [{ id: 'navigate-study', label: 'Открыть Учёбу' }], source: 'gemini' });
  const quota = JSON.parse(String(f.calls[1].init?.body));
  assert.deepEqual(quota, { p_user_id: userId, p_user_daily_limit: 20, p_user_minute_limit: 5, p_global_daily_limit: 200 });
  const outgoing = String(f.calls[2].init?.body);
  assert.doesNotMatch(outgoing, /private@example|server-test-key|verified-test-token|gemini-test-key/);
  assert.equal(new Headers(f.calls[1].init?.headers).get('apikey'), environment.SUPABASE_SERVICE_ROLE_KEY);
});

test('new secret key format stays in the API key header rather than a JWT authorization header', async () => {
  const f = fixture(undefined, { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_testserver' });
  assert.equal((await f.handler(request())).status, 200);
  const headers = new Headers(f.calls[1].init?.headers);
  assert.equal(headers.get('apikey'), 'sb_secret_testserver');
  assert.equal(headers.get('authorization'), null);
});

test('upstream malformed JSON, oversized JSON, truncated output and unsafe response shape are never returned as answers', async () => {
  const invalid = [
    new Response('{invalid upstream json'),
    new Response(' '.repeat(64001)),
    modelReply({ answer: 'truncated', actions: [] }, 'MAX_TOKENS'),
    modelReply({ answer: '', actions: [] }),
    modelReply({ answer: 'valid text', actions: Array.from({ length: 4 }, () => ({ id: 'navigate-study', label: 'Open' })) }),
    json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{bad output' }] } }] }),
  ];
  for (const generated of invalid) {
    const f = fixture([json(verifiedUser), json({ allowed: true }), generated]);
    await expectError(await f.handler(request()), 503, 'invalid_response');
    assert.equal(f.calls.length, 3);
  }
});

test('Gemini thought parts are excluded while public response text parts are joined', async () => {
  const answer = JSON.stringify({ answer: 'Ответ.', actions: [] });
  const generated = json({ candidates: [{ finishReason: 'STOP', content: { parts: [
    { thought: true, text: 'private model reasoning' }, { text: answer.slice(0, 10) }, { text: answer.slice(10) },
  ] } }] });
  const f = fixture([json(verifiedUser), json({ allowed: true }), generated]);
  const response = await f.handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: 'Ответ.', actions: [], source: 'gemini' });
});

test('Gemini network and timeout errors are bounded public errors and do not retry', async () => {
  for (const [cause, status, code] of [
    [new Error('secret diagnostic'), 503, 'upstream_unavailable'],
    [new DOMException('timeout diagnostic', 'TimeoutError'), 504, 'upstream_timeout'],
  ] as const) {
    const f = fixture([json(verifiedUser), json({ allowed: true }), cause]);
    await expectError(await f.handler(request()), status, code);
    assert.equal(f.calls.length, 3);
  }
});

test('Gemini payload requests bounded structured output with selected language and only proposed navigation', () => {
  const body = geminiBody({ ...input, messages: [{ role: 'user', content: 'Есеп' }, { role: 'assistant', content: 'Көмек' }, { role: 'user', content: 'Шешімі?' }],
    context: { ...input.context, language: 'kk', availableActions: [] } });
  assert.deepEqual(body.contents.map(message => message.role), ['user', 'model', 'user']);
  assert.match(body.systemInstruction.parts[0].text, /natural Kazakh/);
  assert.match(body.systemInstruction.parts[0].text, /plain text.*Unicode formulas/);
  assert.match(body.systemInstruction.parts[0].text, /never run automatically/);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.responseSchema.properties.actions.maxItems, 0);
  assert.equal(body.generationConfig.maxOutputTokens, 1100);
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.deepEqual(GEMINI_MODELS, ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
});
