import { initI18n, t } from './i18n.js';
import { createApi } from './api.js';
import { DEFAULT_API_BASE, LANGUAGE_CODES, ME_FLAGS } from './data.js';
import { validateToken, validateApiBase, normalizeApiBase } from './validators.js';
import * as storage from './storage.js';
import { $, $$, el, describeError, withBusy, copyText, bindCounters, badge, showError, applyValidation } from './ui.js';
import webhookTab from './tabs/webhook.js';
import profileTab from './tabs/profile.js';
import commandsTab from './tabs/commands.js';
import menuTab from './tabs/menu.js';
import rightsTab from './tabs/rights.js';
import devTab from './tabs/dev.js';

const TABS = [webhookTab, profileTab, commandsTab, menuTab, rightsTab, devTab];
const LOG_LIMIT = 100;

const bus = new EventTarget();

// Shared state passed to every tab controller.
const app = {
  api: null,
  me: null,
  webhook: null,
  raw: new Map(),
  log: [],
  on: (type, fn) => bus.addEventListener(type, fn),
  emit: (type) => bus.dispatchEvent(new Event(type)),
  setWebhook(info) {
    app.webhook = info;
    renderWebhookBadge();
    app.emit('webhook');
  },
  loadAvatar: () => loadAvatar(),
};

const loadedTabs = new Set();
let avatarUrl = null;
let activeTab = null;

function onLog(entry) {
  app.log.unshift(entry);
  if (app.log.length > LOG_LIMIT) app.log.length = LOG_LIMIT;
  if (entry.ok && entry.method.startsWith('get')) app.raw.set(entry.method, entry.response.result);
  app.emit('log');
}

// ---------- Connect / disconnect ----------

async function connect({ token, remember, apiBase }) {
  const api = createApi({ token, baseUrl: apiBase || DEFAULT_API_BASE, onLog });
  const me = await api.call('getMe');
  app.api = api;
  app.me = me;
  storage.saveToken(token, remember);
  if (apiBase) storage.set('apiBase', apiBase);
  else storage.remove('apiBase');

  document.body.classList.add('is-connected');
  $('#connect-section').hidden = true;
  $('#landing').hidden = true;
  $('#app').hidden = false;
  $('#bot-caps').open = matchMedia('(min-width: 961px)').matches;
  renderBot();
  loadAvatar();
  loadStars();
  activateTab(tabFromHash() ?? 'webhook');
  window.scrollTo(0, 0);
}

function disconnect() {
  storage.clearToken();
  if (avatarUrl) URL.revokeObjectURL(avatarUrl);
  history.replaceState(null, '', location.pathname + location.search);
  location.reload();
}

function initConnectForm() {
  const form = $('#connect-form');
  const tokenInput = $('#token');
  const apiInput = $('#api-base');
  const errorBox = $('#connect-error');
  const savedBase = storage.get('apiBase');
  if (savedBase) {
    apiInput.value = savedBase;
    $('.advanced', form).open = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    const token = tokenInput.value.trim();
    const apiBase = apiInput.value.trim() ? normalizeApiBase(apiInput.value) : '';
    const valid = applyValidation([
      [tokenInput, validateToken(token)],
      [apiInput, apiBase ? validateApiBase(apiBase) : null],
    ]);
    if (!valid) return;

    await withBusy(form.querySelector('[type="submit"]'), async () => {
      try {
        await connect({ token, remember: $('#remember').checked, apiBase });
      } catch (error) {
        errorBox.textContent = describeError(error);
        errorBox.hidden = false;
        if (error.network) $('.advanced', form).open = true;
      }
    });
  });

  const saved = storage.loadToken();
  if (saved) {
    tokenInput.value = saved.token;
    $('#remember').checked = saved.remember;
    form.requestSubmit();
  }
}

// ---------- Sidebar ----------

function renderBot() {
  const { me } = app;
  $('#bot-name').textContent = [me.first_name, me.last_name].filter(Boolean).join(' ');
  $('#bot-avatar-fallback').textContent = (me.first_name || '?').trim().charAt(0).toUpperCase();
  const username = $('#bot-username');
  username.textContent = me.username ? `@${me.username}` : '';
  username.href = me.username ? `https://t.me/${encodeURIComponent(me.username)}` : '#';
  $('#bot-id').textContent = String(me.id);

  $('#bot-flags').replaceChildren(...ME_FLAGS.map((flag) => {
    const on = Boolean(me[flag]);
    return el('li', { class: on ? 'on' : 'off', title: flag },
      el('span', { class: 'flag-icon', 'aria-hidden': 'true' }, on ? '✓' : '–'),
      el('span', {}, t(`me.${flag}`)),
      el('span', { class: 'visually-hidden' }, on ? t('common.yes') : t('common.no')));
  }));
  renderWebhookBadge();
}

function renderWebhookBadge() {
  const node = $('#bot-webhook-status');
  const info = app.webhook;
  if (!info) {
    node.replaceChildren('…');
    return;
  }
  if (!info.url) node.replaceChildren(badge(t('webhook.statusPolling'), 'neutral'));
  else if (info.last_error_date) node.replaceChildren(badge(t('webhook.statusError'), 'danger'));
  else node.replaceChildren(badge(t('webhook.statusActive'), 'success'));
}

async function loadAvatar() {
  const container = $('#bot-avatar');
  container.querySelector('img')?.remove();
  try {
    const photos = await app.api.call('getUserProfilePhotos', { user_id: app.me.id, limit: 1 });
    const sizes = photos.photos?.[0];
    if (!sizes?.length) return;
    const size = sizes.find((s) => s.width >= 160) ?? sizes[sizes.length - 1];
    const file = await app.api.call('getFile', { file_id: size.file_id });
    const blob = await app.api.fetchFile(file.file_path);
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    avatarUrl = URL.createObjectURL(blob);
    container.append(el('img', { src: avatarUrl, alt: '', width: 112, height: 112 }));
  } catch {
    // The letter fallback stays visible.
  }
}

async function loadStars() {
  try {
    const balance = await app.api.call('getMyStarBalance');
    $('#bot-stars').textContent = `⭐ ${balance.amount}`;
  } catch {
    $('#bot-stars').textContent = '—';
  }
}

// ---------- Tabs ----------

function tabFromHash() {
  const id = location.hash.slice(1);
  return TABS.some((tab) => tab.id === id) ? id : null;
}

function activateTab(id, { focus = false } = {}) {
  activeTab = id;
  for (const button of $$('[role="tab"]')) {
    const selected = button.dataset.tab === id;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  }
  for (const tab of TABS) $(`#panel-${tab.id}`).hidden = tab.id !== id;
  if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
  loadTab(id);
}

async function loadTab(id, force = false) {
  const tab = TABS.find((x) => x.id === id);
  if (!app.api || (loadedTabs.has(id) && !force && !tab.alwaysReload)) return;
  loadedTabs.add(id);
  const panel = $(`#panel-${id}`);
  panel.classList.add('is-loading');
  try {
    await tab.load(app);
  } catch (error) {
    loadedTabs.delete(id);
    showError(error);
  } finally {
    panel.classList.remove('is-loading');
  }
}

function initTabs() {
  const buttons = $$('[role="tab"]');
  for (const button of buttons) {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
    button.addEventListener('keydown', (event) => {
      const index = buttons.indexOf(button);
      const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      activateTab(buttons[(next + buttons.length) % buttons.length].dataset.tab, { focus: true });
    });
  }
  window.addEventListener('hashchange', () => {
    const id = tabFromHash();
    if (id && app.api && id !== activeTab) activateTab(id);
  });
  for (const tab of TABS) tab.init(app);
}

// ---------- Misc UI ----------

function initLanguageSelects() {
  for (const select of $$('[data-language-select]')) {
    select.replaceChildren(
      el('option', { value: '' }, t('common.allLanguages')),
      ...LANGUAGE_CODES.map(([code, name]) => el('option', { value: code }, `${code} — ${name}`)),
    );
  }
}

function initHeader() {
  // Close header dropdowns when clicking elsewhere.
  document.addEventListener('click', (event) => {
    for (const details of $$('.dropdown[open]')) {
      if (!details.contains(event.target)) details.open = false;
    }
  });
  initThemeToggle();
}

function initThemeToggle() {
  $('#theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    storage.set('theme', next);
  });
}

function initGlobalButtons() {
  for (const button of $$('[data-reveal]')) {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.reveal);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(reveal));
      button.textContent = t(reveal ? 'common.hide' : 'common.show');
    });
  }
  for (const button of $$('[data-copy-from]')) {
    button.addEventListener('click', () => copyText(document.getElementById(button.dataset.copyFrom).textContent));
  }
  $('#disconnect').addEventListener('click', disconnect);
  $('#refresh-all').addEventListener('click', (event) => withBusy(event.currentTarget, async () => {
    try {
      app.me = await app.api.call('getMe');
      renderBot();
      loadAvatar();
      loadStars();
      loadedTabs.clear();
      await loadTab(activeTab);
    } catch (error) {
      showError(error);
    }
  }));
}

function init() {
  initI18n();
  initHeader();
  if (!$('#app')) return; // Guide pages have no app.
  initGlobalButtons();
  initLanguageSelects();
  bindCounters();
  initTabs();
  initConnectForm();
}

init();
