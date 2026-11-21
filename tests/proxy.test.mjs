import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../proxy/cloudflare-worker.js';

const ENV = { ALLOWED_ORIGIN: 'https://example.com' };

function request(path, { method = 'POST', origin = 'https://example.com', body = 'x=1' } = {}) {
  const headers = {};
  if (origin !== null) headers.Origin = origin;
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  return new Request(`https://worker.example${path}`, {
    method,
    headers,
    body: method === 'POST' ? body : undefined,
  });
}

function mockUpstream(t, calls) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

test('rejects requests without an Origin header', async (t) => {
  const calls = [];
  mockUpstream(t, calls);
  const response = await worker.fetch(request('/bot123:abc/getMe', { origin: null }), ENV);
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('rejects an origin that is not in ALLOWED_ORIGIN', async (t) => {
  const calls = [];
  mockUpstream(t, calls);
  const response = await worker.fetch(request('/bot123:abc/getMe', { origin: 'https://evil.example' }), ENV);
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('answers preflight for an allowed origin', async () => {
  const response = await worker.fetch(request('/bot123:abc/getMe', { method: 'OPTIONS' }), ENV);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
  assert.equal(response.headers.get('Vary'), 'Origin');
});

test('proxies an allowed POST and returns CORS headers', async (t) => {
  const calls = [];
  mockUpstream(t, calls);
  const response = await worker.fetch(request('/bot123:abc/getMe'), ENV);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
  assert.equal(calls[0].url, 'https://api.telegram.org/bot123:abc/getMe');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/x-www-form-urlencoded');
});

test('proxies allowed file downloads without a body', async (t) => {
  const calls = [];
  mockUpstream(t, calls);
  const response = await worker.fetch(
    request('/file/bot123:abc/photos/file.png', { method: 'GET' }),
    ENV,
  );
  assert.equal(response.status, 200);
  assert.equal(calls[0].url, 'https://api.telegram.org/file/bot123:abc/photos/file.png');
  assert.equal(calls[0].init.body, undefined);
});

test('rejects unknown paths and methods with 404', async (t) => {
  const calls = [];
  mockUpstream(t, calls);
  const badPath = await worker.fetch(request('/not-a-bot-path'), ENV);
  assert.equal(badPath.status, 404);
  const badMethod = await worker.fetch(request('/bot123:abc/getMe', { method: 'PUT' }), ENV);
  assert.equal(badMethod.status, 404);
  assert.equal(calls.length, 0);
});

test('ALLOWED_ORIGIN="*" is an explicit public-proxy opt-in', async () => {
  const env = { ALLOWED_ORIGIN: '*' };
  const response = await worker.fetch(request('/bot123:abc/getMe', { method: 'OPTIONS', origin: 'https://any.example' }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('accepts several origins and normalizes a trailing slash', async () => {
  const env = { ALLOWED_ORIGIN: 'https://example.com/, https://other.example' };
  const response = await worker.fetch(request('/bot123:abc/getMe', { method: 'OPTIONS', origin: 'https://other.example' }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://other.example');
});
