// End-to-end smoke test + README screenshots against a mocked Bot API.
// Usage: npm run build && node scripts/screenshots.mjs [--no-shots]
// Requires Playwright with Chromium (not a project dependency).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from './playwright.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const SHOTS = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const TAKE_SHOTS = !process.argv.includes('--no-shots');
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const AVATAR = await readFile(fileURLToPath(new URL('../src/assets/img/icon-192.png', import.meta.url)));

function createMock() {
  const now = Math.floor(Date.now() / 1000);
  const state = {
    webhook: {
      url: 'https://bot.example.com/telegram/webhook',
      has_custom_certificate: false,
      pending_update_count: 17,
      ip_address: '203.0.113.10',
      last_error_date: now - 340,
      last_error_message: 'Wrong response from the webhook: 502 Bad Gateway',
      max_connections: 40,
      allowed_updates: ['message', 'callback_query', 'chat_member'],
    },
    commands: { '': [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help' },
      { command: 'settings', description: 'Open settings' },
    ] },
    name: 'Demo Helper Bot',
    short: 'Answers questions and sends daily reports.',
    description: 'Hi! I can answer questions, remind you about tasks and send daily reports.\n\nPress Start to begin.',
    rights: { groups: { can_delete_messages: true, can_pin_messages: true, can_invite_users: true }, channels: { can_post_messages: true } },
    menu: { type: 'commands' },
    calls: [],
  };
  const ok = (result) => ({ ok: true, result });
  const handlers = {
    getMe: () => ok({
      id: 7012345678, is_bot: true, first_name: state.name, username: 'demo_helper_bot',
      can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: true,
      can_connect_to_business: false, has_main_web_app: true, has_topics_enabled: false,
      allows_users_to_create_topics: false, supports_guest_queries: true, supports_join_request_queries: false, can_manage_bots: false,
    }),
    getWebhookInfo: () => ok(state.webhook),
    setWebhook: (p) => {
      state.webhook = { ...state.webhook, url: p.url, max_connections: Number(p.max_connections ?? state.webhook.max_connections) };
      if (p.allowed_updates) {
        const list = JSON.parse(p.allowed_updates);
        if (list.length) state.webhook.allowed_updates = list;
        else delete state.webhook.allowed_updates;
      }
      if (p.drop_pending_updates === 'true') state.webhook.pending_update_count = 0;
      delete state.webhook.last_error_date;
      delete state.webhook.last_error_message;
      return ok(true);
    },
    deleteWebhook: (p) => {
      state.webhook = { url: '', has_custom_certificate: false, pending_update_count: p.drop_pending_updates === 'true' ? 0 : state.webhook.pending_update_count };
      return ok(true);
    },
    getMyStarBalance: () => ok({ amount: 1250 }),
    getUserProfilePhotos: () => ok({ total_count: 1, photos: [[{ file_id: 'small', width: 160, height: 160 }, { file_id: 'big', width: 640, height: 640 }]] }),
    getFile: (p) => ok({ file_id: p.file_id, file_path: 'photos/file_1.png' }),
    getMyName: () => ok({ name: state.name }),
    getMyShortDescription: () => ok({ short_description: state.short }),
    getMyDescription: () => ok({ description: state.description }),
    setMyName: (p) => { state.name = p.name; return ok(true); },
    setMyShortDescription: (p) => { state.short = p.short_description; return ok(true); },
    setMyDescription: () => ({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 1832', parameters: { retry_after: 1832 } }),
    getMyCommands: (p) => ok(state.commands[p.scope ?? ''] ?? []),
    setMyCommands: (p) => { state.commands[p.scope ?? ''] = JSON.parse(p.commands); return ok(true); },
    deleteMyCommands: (p) => { delete state.commands[p.scope ?? '']; return ok(true); },
    getChatMenuButton: () => ok(state.menu),
    setChatMenuButton: (p) => { state.menu = JSON.parse(p.menu_button); return ok(true); },
    getMyDefaultAdministratorRights: (p) => ok(state.rights[p.for_channels === 'true' ? 'channels' : 'groups']),
    setMyDefaultAdministratorRights: (p) => { state.rights[p.for_channels === 'true' ? 'channels' : 'groups'] = p.rights ? JSON.parse(p.rights) : {}; return ok(true); },
    setMyProfilePhoto: () => ok(true),
    removeMyProfilePhoto: () => ok(true),
  };
  return { state, handlers };
}

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let file = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    }).listen(0, () => resolve(server));
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const server = await serve();
const base = `http://localhost:${server.address().port}/`;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];

async function openApp({ theme = 'dark', lang = '', width = 1280, height = 900 } = {}) {
  const mock = createMock();
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Failed mocked requests (e.g. the deliberate 429) are logged by the browser; they are expected.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`);
  });
  page.on('dialog', (d) => d.accept());
  await page.route('https://api.telegram.org/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/file/')) return route.fulfill({ status: 200, contentType: 'image/png', body: AVATAR, headers: { 'access-control-allow-origin': '*' } });
    const method = url.pathname.split('/').pop();
    const body = route.request().postData() ?? '';
    const params = Object.fromEntries(new URLSearchParams(body));
    mock.state.calls.push({ method, params });
    const handler = mock.handlers[method];
    const json = handler ? handler(params) : { ok: false, error_code: 404, description: 'Not Found: method not found' };
    return route.fulfill({ status: json.ok ? 200 : json.error_code, contentType: 'application/json', body: JSON.stringify(json), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(`${base}${lang}`);
  return { page, mock, context };
}

async function shot(page, name, options = {}) {
  if (!TAKE_SHOTS) return;
  // Toasts would cover the content.
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((n) => n.remove()));
  await page.screenshot({ path: join(SHOTS, name), ...options });
}

async function connect(page) {
  await page.fill('#token', TOKEN);
  await page.click('#connect-form button[type="submit"]');
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForSelector('#webhook-status .stats');
  await page.waitForSelector('#bot-avatar img');
}

try {
  // Landing page
  {
    const { page, context } = await openApp({ theme: 'light' });
    assert(await page.title() !== '', 'title');
    assert((await page.locator('link[rel="alternate"][hreflang]').count()) === 6, 'hreflang links');
    await page.fill('#token', 'bad');
    await page.click('#connect-form button[type="submit"]');
    assert(await page.locator('.field-error').isVisible(), 'token validation');
    await shot(page, 'landing.png');
    await context.close();
  }

  // Webhook tab
  {
    const { page, mock, context } = await openApp();
    await connect(page);
    assert((await page.textContent('#bot-name')) === 'Demo Helper Bot', 'bot name');
    assert((await page.textContent('#webhook-status')).includes('502 Bad Gateway'), 'last error shown');
    assert(await page.isChecked('input[name="wh-updates-mode"][value="custom"]'), 'custom updates mode');
    assert(await page.isChecked('input[value="chat_member"]'), 'chat_member checked');
    await shot(page, 'webhook.png', { fullPage: true });

    await page.click('#wh-secret-generate');
    await page.click('[data-curl="webhook-form"]');
    const curl = await page.textContent('#webhook-form .curl-box');
    assert(curl.includes('$BOT_TOKEN') && curl.includes('$WEBHOOK_SECRET') && !curl.includes(TOKEN), 'curl hides secrets');
    await page.fill('#wh-url', 'http://insecure.example.com');
    await page.click('#webhook-form button[type="submit"]');
    assert(await page.locator('#wh-url[aria-invalid="true"]').count() === 1, 'https validation');
    await page.fill('#wh-url', 'https://bot.example.com/new');
    await page.click('#webhook-form button[type="submit"]');
    await page.waitForSelector('.toast');
    const set = mock.state.calls.find((c) => c.method === 'setWebhook');
    assert(set && set.params.url === 'https://bot.example.com/new' && set.params.secret_token?.length === 48, 'setWebhook params');
    assert(!('ip_address' in set.params), 'ip not pinned implicitly');
    await page.waitForFunction(() => !document.querySelector('#webhook-status').textContent.includes('502'));

    await page.click('#delete-webhook-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('#bot-webhook-status').textContent.length > 0
      && document.querySelector('#webhook-status .alert-info'));
    assert(mock.state.calls.some((c) => c.method === 'deleteWebhook'), 'deleteWebhook called');

    // Profile
    await page.click('#tab-profile');
    await page.waitForFunction(() => document.querySelector('#profile-name').value === 'Demo Helper Bot');
    await shot(page, 'profile.png', { fullPage: true });
    await page.fill('#profile-short', 'Updated short description');
    await page.fill('#profile-description', 'New description');
    await page.click('#profile-form button[type="submit"]');
    await page.waitForSelector('.toast-error');
    assert((await page.textContent('.toast-error')).includes('31'), '429 retry_after shown');
    assert(!mock.state.calls.some((c) => c.method === 'setMyName'), 'unchanged name not sent');

    // Commands
    await page.click('#tab-commands');
    await page.waitForFunction(() => document.querySelector('#cmd-text').value.includes('start - Start the bot'));
    await page.fill('#cmd-text', 'start - Start\nBad Name - x\nhelp');
    assert((await page.locator('#cmd-errors li').count()) === 2, 'command errors listed');
    await page.fill('#cmd-text', 'start - Start the bot\nhelp - Show help\nreport - Daily report\ntip - Visible only to you [ephemeral]');
    await page.selectOption('#cmd-scope', 'all_private_chats');
    await page.waitForFunction(() => document.querySelector('#cmd-text').value === '');
    await page.fill('#cmd-text', 'start - Start the bot\nhelp - Show help\nreport - Daily report\ntip - Visible only to you [ephemeral]');
    await page.click('#commands-form button[type="submit"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('4')));
    const setCmd = mock.state.calls.find((c) => c.method === 'setMyCommands');
    assert(JSON.parse(setCmd.params.scope).type === 'all_private_chats', 'commands scope');
    assert(JSON.parse(setCmd.params.commands)[3].is_ephemeral === true, 'ephemeral flag');
    await shot(page, 'commands.png', { fullPage: true });

    // Menu button
    await page.click('#tab-menu');
    await page.waitForFunction(() => document.querySelector('input[name="menu-type"][value="commands"]').checked);
    await page.check('input[name="menu-type"][value="web_app"]');
    await page.fill('#menu-text', 'Open app');
    await page.fill('#menu-url', 'https://app.example.com');
    await page.click('#menu-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelectorAll('.toast').length > 0);
    assert(JSON.parse(mock.state.calls.find((c) => c.method === 'setChatMenuButton').params.menu_button).web_app.url === 'https://app.example.com', 'menu web app');

    // Rights
    await page.click('#tab-rights');
    await page.waitForFunction(() => document.querySelector('#rights-grid input[value="can_pin_messages"]')?.checked);
    await page.check('#rights-grid input[value="can_manage_topics"]');
    await page.click('#rights-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelectorAll('.toast').length > 0);
    const rights = JSON.parse(mock.state.calls.find((c) => c.method === 'setMyDefaultAdministratorRights').params.rights);
    assert(rights.can_manage_topics === true && rights.can_pin_messages === true && !('can_post_messages' in rights), 'group rights');
    await page.check('input[name="rights-target"][value="channels"]');
    await page.waitForFunction(() => document.querySelector('#rights-grid input[value="can_post_messages"]')?.checked);
    await shot(page, 'rights.png', { fullPage: true });

    // Developer
    await page.click('#tab-dev');
    await page.waitForSelector('#request-log .log-entry');
    const logText = await page.textContent('#request-log');
    assert(!logText.includes(TOKEN), 'token not in log');
    await context.close();
  }

  // Russian page, mobile, light theme
  {
    const { page, context } = await openApp({ theme: 'light', lang: 'ru/', width: 390, height: 844 });
    assert((await page.getAttribute('html', 'lang')) === 'ru', 'ru lang attr');
    await connect(page);
    await shot(page, 'mobile-ru.png', { fullPage: false });
    const overflow = await page.evaluate(() => {
      const width = window.innerWidth;
      if (document.documentElement.scrollWidth <= width) return null;
      return [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > width + 1 && !e.closest('pre, .tabs'))
        .slice(0, 5).map((e) => `${e.tagName}.${e.className}#${e.id}`).join(', ');
    });
    assert(!overflow, `no horizontal scroll on mobile (${overflow})`);
    await context.close();
  }

  // Guide page
  {
    const { page, context } = await openApp({ lang: 'set-webhook/' });
    assert((await page.locator('h1').textContent()).length > 10, 'guide h1');
    assert(await page.locator('script[type="application/ld+json"]').count() === 1, 'guide json-ld');
    await context.close();
  }

  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
  console.log('E2E smoke test passed.');
} catch (error) {
  console.error(error.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
