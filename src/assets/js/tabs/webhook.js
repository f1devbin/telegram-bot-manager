import { t, formatDateTime, formatRelative } from '../i18n.js';
import { UPDATE_GROUPS } from '../data.js';
import {
  validateWebhookUrl, validateSecretToken, validateMaxConnections, validateIpAddress, generateSecretToken,
} from '../validators.js';
import {
  $, $$, el, toast, showError, withBusy, copyText, applyValidation, showCurl, confirmAction, radioValue, setRadio, badge,
} from '../ui.js';

// Maps typical last_error_message texts to a troubleshooting hint.
const ERROR_HINTS = [
  [/ssl|certificate|tls/i, 'ssl'],
  [/resolve host|name or service not known|no address associated/i, 'dns'],
  [/connection refused/i, 'refused'],
  [/timed out|timeout/i, 'timeout'],
  [/wrong response from the webhook: 3\d\d/i, 'http3xx'],
  [/wrong response from the webhook: 4\d\d/i, 'http4xx'],
  [/wrong response from the webhook: 5\d\d/i, 'http5xx'],
];

export function webhookErrorHint(message = '') {
  const match = ERROR_HINTS.find(([re]) => re.test(message));
  return match ? match[1] : null;
}

let app;

function stat(label, value, modifier = '') {
  return el('div', { class: `stat ${modifier}` }, el('span', { class: 'stat-label' }, label), el('span', { class: 'stat-value' }, value));
}

function renderStatus(info) {
  const nodes = [];
  if (!info.url) {
    nodes.push(el('div', { class: 'alert alert-info' }, t('webhook.notSet')));
  }

  const urlValue = info.url
    ? el('span', { class: 'url-value' }, el('code', { text: info.url }),
      el('button', { type: 'button', class: 'link-btn', onclick: () => copyText(info.url) }, t('common.copy')))
    : t('webhook.none');

  const updates = info.allowed_updates?.length
    ? el('span', { class: 'chips' }, info.allowed_updates.map((type) => el('code', { class: 'chip' }, type)))
    : t('webhook.updatesDefaultShort');

  nodes.push(el('div', { class: 'stats' },
    stat(t('webhook.statUrl'), urlValue, 'stat-wide'),
    stat(t('webhook.statPending'), String(info.pending_update_count ?? 0), info.pending_update_count > 0 ? 'stat-warn' : ''),
    stat(t('webhook.statMax'), String(info.max_connections ?? (info.url ? 40 : '—'))),
    stat(t('webhook.statIp'), info.ip_address || '—'),
    stat(t('webhook.statCert'), info.has_custom_certificate ? t('common.yes') : t('common.no')),
    stat(t('webhook.statUpdates'), updates, 'stat-wide'),
  ));

  if (info.last_error_date) {
    const hint = webhookErrorHint(info.last_error_message);
    nodes.push(el('div', { class: 'alert alert-danger' },
      el('strong', {}, t('webhook.lastError')), ' ',
      el('span', { class: 'muted-inline' }, `${formatDateTime(info.last_error_date)} (${formatRelative(info.last_error_date)})`),
      el('p', {}, el('code', { text: info.last_error_message || '—' })),
      hint ? el('p', { class: 'small' }, `💡 ${t(`webhook.hints.${hint}`)}`) : null));
  }
  if (info.last_synchronization_error_date) {
    nodes.push(el('div', { class: 'alert alert-warn' },
      el('strong', {}, t('webhook.syncError')), ' ',
      `${formatDateTime(info.last_synchronization_error_date)} (${formatRelative(info.last_synchronization_error_date)})`,
      el('p', { class: 'small' }, t('webhook.syncErrorHint'))));
  }
  $('#webhook-status').replaceChildren(...nodes);
}

function renderUpdatePicker() {
  const container = $('#wh-updates');
  const groups = UPDATE_GROUPS.map((group) => el('div', { class: 'update-group' },
    el('p', { class: 'update-group-title' }, t(`updateGroups.${group.id}`)),
    el('div', { class: 'check-grid' }, group.types.map(({ type, optIn }) => el('label', { class: 'check-card', title: type },
      el('input', { type: 'checkbox', name: 'allowed_updates', value: type, 'data-opt-in': optIn ? 'true' : null }),
      el('span', {}, el('code', {}, type), optIn ? badge(t('webhook.optIn'), 'warn') : null,
        el('small', {}, t(`updates.${type}`))))))));
  const tools = el('div', { class: 'form-actions compact' },
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => toggleAll(true) }, t('common.selectAll')),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => toggleAll(false) }, t('common.selectNone')));
  container.replaceChildren(tools, ...groups);
}

function toggleAll(checked) {
  for (const box of $$('#wh-updates input[name="allowed_updates"]')) box.checked = checked;
}

function ensureUpdateCheckbox(type) {
  if ($(`#wh-updates input[value="${CSS.escape(type)}"]`)) return;
  // Unknown (newer) update type returned by the API: keep it selectable.
  const grid = $('#wh-updates .update-group:last-child .check-grid');
  grid.append(el('label', { class: 'check-card', title: type },
    el('input', { type: 'checkbox', name: 'allowed_updates', value: type }),
    el('span', {}, el('code', {}, type))));
}

function fillForm(info) {
  $('#wh-url').value = info.url || '';
  $('#wh-max').value = info.max_connections || 40;
  // ip_address in WebhookInfo is the IP currently in use, not necessarily a pinned one, so it is not prefilled.
  const current = info.allowed_updates ?? [];
  current.forEach(ensureUpdateCheckbox);
  for (const box of $$('#wh-updates input[name="allowed_updates"]')) {
    box.checked = current.length ? current.includes(box.value) : !box.dataset.optIn;
  }
  setRadio('wh-updates-mode', current.length ? 'custom' : 'default');
}

function collectSetWebhook() {
  const url = $('#wh-url');
  const secret = $('#wh-secret');
  const max = $('#wh-max');
  const ip = $('#wh-ip');
  const custom = radioValue('wh-updates-mode') === 'custom';
  const selected = $$('#wh-updates input[name="allowed_updates"]:checked').map((box) => box.value);

  const valid = applyValidation([
    [url, validateWebhookUrl(url.value)],
    [secret, validateSecretToken(secret.value.trim())],
    [max, validateMaxConnections(max.value)],
    [ip, validateIpAddress(ip.value)],
  ]);
  if (!valid) return null;
  if (custom && selected.length === 0) {
    toast(t('validation.updates_empty'), 'error');
    return null;
  }

  const certificate = $('#wh-cert').files[0] ?? null;
  return {
    method: 'setWebhook',
    params: {
      url: url.value.trim(),
      max_connections: Number(max.value),
      ip_address: ip.value.trim() || undefined,
      secret_token: secret.value.trim() || undefined,
      allowed_updates: custom ? selected : [],
      drop_pending_updates: $('#wh-drop').checked || undefined,
    },
    files: certificate ? { certificate } : {},
  };
}

async function refresh() {
  const info = await app.api.call('getWebhookInfo');
  app.setWebhook(info);
  renderStatus(info);
  return info;
}

function initForms() {
  const form = $('#webhook-form');
  $('#wh-secret-generate').addEventListener('click', () => {
    $('#wh-secret').value = generateSecretToken();
    toast(t('webhook.secretGenerated'), 'info');
  });
  for (const radio of $$('input[name="wh-updates-mode"]')) {
    radio.addEventListener('change', () => { $('#wh-updates').hidden = radioValue('wh-updates-mode') !== 'custom'; });
  }
  $('[data-curl]', form).addEventListener('click', () => showCurl(form, collectSetWebhook(), app.api.baseUrl));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const request = collectSetWebhook();
    if (!request) return;
    await withBusy(event.submitter, async () => {
      try {
        await app.api.call(request.method, request.params, request.files);
        toast(t('webhook.saved'));
        if (request.params.secret_token) $('#drop-secret').value = request.params.secret_token;
        $('#wh-drop').checked = false;
        const info = await refresh();
        fillForm(info);
      } catch (error) {
        showError(error);
      }
    });
  });

  $('#drop-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const info = app.webhook;
    if (!info?.url) {
      toast(t('webhook.noWebhook'), 'error');
      return;
    }
    const secret = $('#drop-secret');
    if (!applyValidation([[secret, validateSecretToken(secret.value.trim())]])) return;
    if (!confirmAction(t('webhook.dropConfirm', { count: info.pending_update_count ?? 0 }))) return;
    await withBusy(event.submitter, async () => {
      try {
        // allowed_updates is omitted on purpose: Telegram keeps the previous value.
        await app.api.call('setWebhook', {
          url: info.url,
          max_connections: info.max_connections,
          secret_token: secret.value.trim() || undefined,
          drop_pending_updates: true,
        });
        toast(t('webhook.dropped'));
        await refresh();
      } catch (error) {
        showError(error);
      }
    });
  });

  $('#delete-webhook-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!confirmAction(t('webhook.deleteConfirm'))) return;
    await withBusy(event.submitter, async () => {
      try {
        await app.api.call('deleteWebhook', { drop_pending_updates: $('#delete-drop').checked || undefined });
        toast(t('webhook.deleted'));
        const info = await refresh();
        fillForm(info);
      } catch (error) {
        showError(error);
      }
    });
  });

  $('#webhook-refresh').addEventListener('click', (event) => withBusy(event.currentTarget, async () => {
    try {
      await refresh();
    } catch (error) {
      showError(error);
    }
  }));
}

export default {
  id: 'webhook',
  init(appState) {
    app = appState;
    renderUpdatePicker();
    initForms();
  },
  async load() {
    const info = await refresh();
    fillForm(info);
  },
};

