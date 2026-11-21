// Optional CORS proxy for Telegram Bot API (Cloudflare Workers, free plan is enough).
// Use it when api.telegram.org is blocked in your network or does not answer from the browser.
//
// Deploy: Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file → Deploy.
// Set the ALLOWED_ORIGIN variable to your site origin (default: the official GitHub Pages site;
// comma-separated for several origins). Requests from other origins, and requests without an
// Origin header, are rejected with 403. Use ALLOWED_ORIGIN="*" only for a deliberately public proxy.
// Then put the worker URL (https://<name>.<account>.workers.dev) into
// "Advanced: API server" in Telegram Bot Manager.
//
// The worker does not log or store anything. Requests still contain the bot token in the path,
// so deploy your own instance instead of using someone else's.

const TELEGRAM = 'https://api.telegram.org';
const DEFAULT_ORIGIN = 'https://f1devbin.github.io';
const PATH_RE = /^\/(file\/)?bot\d+:[A-Za-z0-9_-]+\/[^?#]*$/;

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN)
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function forbidden() {
  return new Response('Forbidden origin', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', Vary: 'Origin' },
  });
}

export default {
  async fetch(request, env = {}) {
    const allowed = allowedOrigins(env);
    const wildcard = allowed.includes('*');
    const origin = request.headers.get('Origin') || '';
    if (!wildcard && !allowed.includes(origin)) return forbidden();
    const allowOrigin = wildcard ? '*' : origin;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
    }

    const url = new URL(request.url);
    if (!PATH_RE.test(url.pathname) || !['GET', 'POST'].includes(request.method)) {
      return new Response('Not found', { status: 404, headers: corsHeaders(allowOrigin) });
    }

    // Do not invent a Content-Type for GET requests; Telegram does not need one.
    const upstreamHeaders = {};
    if (request.method === 'POST') {
      upstreamHeaders['Content-Type'] = request.headers.get('Content-Type') || 'application/x-www-form-urlencoded';
    }

    const upstream = await fetch(TELEGRAM + url.pathname + url.search, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'POST' ? request.body : undefined,
    });

    const headers = new Headers(upstream.headers);
    const vary = headers.get('Vary');
    for (const [key, value] of Object.entries(corsHeaders(allowOrigin))) {
      if (key === 'Vary') headers.set(key, vary ? `${vary}, Origin` : 'Origin');
      else headers.set(key, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
