// Optional CORS proxy for Telegram Bot API (Cloudflare Workers, free plan is enough).
// Use it when api.telegram.org is blocked in your network or does not answer from the browser.
//
// Deploy: Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file → Deploy.
// Optionally set the ALLOWED_ORIGIN variable (default: the official GitHub Pages site).
// Then put the worker URL (https://<name>.<account>.workers.dev) into
// "Advanced: API server" in Telegram Bot Manager.
//
// The worker does not log or store anything. Requests still contain the bot token in the path,
// so deploy your own instance instead of using someone else's.

const TELEGRAM = 'https://api.telegram.org';
const DEFAULT_ORIGIN = 'https://f1devbin.github.io';
const PATH_RE = /^\/(file\/)?bot\d+:[A-Za-z0-9_-]+\/[^?#]*$/;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(',').map((s) => s.trim());
    const origin = request.headers.get('Origin') || '';
    const allowOrigin = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0];

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
    }

    const url = new URL(request.url);
    if (!PATH_RE.test(url.pathname) || !['GET', 'POST'].includes(request.method)) {
      return new Response('Not found', { status: 404, headers: corsHeaders(allowOrigin) });
    }

    const upstream = await fetch(TELEGRAM + url.pathname + url.search, {
      method: request.method,
      headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/x-www-form-urlencoded' },
      body: request.method === 'POST' ? request.body : undefined,
    });

    const headers = new Headers(upstream.headers);
    for (const [key, value] of Object.entries(corsHeaders(allowOrigin))) headers.set(key, value);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
