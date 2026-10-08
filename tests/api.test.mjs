import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeParams, serializeValue, createApi, TelegramApiError } from '../src/assets/js/api.js';
import { buildCurl } from '../src/assets/js/curl.js';

test('serializeValue', () => {
  assert.equal(serializeValue('x'), 'x');
  assert.equal(serializeValue(40), '40');
  assert.equal(serializeValue(true), 'true');
  assert.equal(serializeValue(['message']), '["message"]');
  assert.equal(serializeValue({ type: 'default' }), '{"type":"default"}');
});

test('encodeParams uses urlencoded body without files', () => {
  const body = encodeParams({ url: 'https://x.dev', drop_pending_updates: true, skip: undefined, none: null, allowed_updates: [] });
  assert.ok(body instanceof URLSearchParams);
  assert.equal(body.toString(), 'url=https%3A%2F%2Fx.dev&drop_pending_updates=true&allowed_updates=%5B%5D');
});

test('encodeParams uses multipart body with files', () => {
  const file = new File(['cert'], 'cert.pem');
  const body = encodeParams({ url: 'https://x.dev' }, { certificate: file, empty: null });
  assert.ok(body instanceof FormData);
  assert.equal(body.get('url'), 'https://x.dev');
  assert.equal(body.get('certificate').name, 'cert.pem');
  assert.equal(body.has('empty'), false);
});

test('createApi returns result and logs calls', async (t) => {
  const logs = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.telegram.org/bot1:T/getMe');
    assert.equal(init.method, 'POST');
    return new Response(JSON.stringify({ ok: true, result: { id: 1 } }));
  });
  const api = createApi({ token: '1:T', onLog: (e) => logs.push(e) });
  assert.deepEqual(await api.call('getMe'), { id: 1 });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].ok, true);
});

test('createApi maps API errors and retry_after', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    ok: false, error_code: 429, description: 'Too Many Requests: retry after 120', parameters: { retry_after: 120 },
  }), { status: 429 }));
  const api = createApi({ token: '1:T', baseUrl: 'https://proxy.dev/' });
  await assert.rejects(api.call('setMyName', { name: 'x' }), (e) => {
    assert.ok(e instanceof TelegramApiError);
    assert.equal(e.code, 429);
    assert.equal(e.retryAfter, 120);
    return true;
  });
});

test('createApi marks network failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  const api = createApi({ token: '1:T' });
  await assert.rejects(api.call('getMe'), (e) => e.network === true && e.timeout === false);
});

test('buildCurl hides secrets and escapes values', () => {
  const cmd = buildCurl('setWebhook', {
    url: "https://x.dev/it's",
    secret_token: 'super-secret',
    allowed_updates: ['message'],
    skip: undefined,
  }, { files: { certificate: { name: 'cert.pem' } } });
  assert.equal(cmd, [
    'curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook"',
    `--form-string 'url=https://x.dev/it'\\''s'`,
    '--form-string "secret_token=$WEBHOOK_SECRET"',
    `--form-string 'allowed_updates=["message"]'`,
    `-F 'certificate=@cert.pem'`,
  ].join(' \\\n  '));
  assert.ok(!cmd.includes('super-secret'));
});
