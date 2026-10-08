import { t } from '../i18n.js';
import { $, el, jsonBlock } from '../ui.js';

const MASKED_PARAMS = ['secret_token'];

let app;

function maskParams(params) {
  const copy = { ...params };
  for (const key of MASKED_PARAMS) if (copy[key]) copy[key] = '•••';
  return copy;
}

function renderRaw() {
  const entries = [...app.raw.entries()];
  if (entries.length === 0) {
    $('#raw-data').replaceChildren(el('p', { class: 'muted' }, t('dev.empty')));
    return;
  }
  $('#raw-data').replaceChildren(...entries.map(([method, result], index) => el('details', { class: 'disclosure', open: index === 0 },
    el('summary', {}, el('code', {}, method)),
    jsonBlock(result))));
}

function renderLog() {
  if (app.log.length === 0) {
    $('#request-log').replaceChildren(el('p', { class: 'muted' }, t('dev.empty')));
    return;
  }
  $('#request-log').replaceChildren(...app.log.map((entry) => {
    const status = entry.ok ? '✓' : `✗ ${entry.error?.code || ''}`.trim();
    const params = maskParams(entry.params);
    return el('details', { class: `disclosure log-entry ${entry.ok ? 'ok' : 'failed'}` },
      el('summary', {},
        el('span', { class: 'log-time' }, entry.time.toLocaleTimeString()),
        el('code', {}, entry.method),
        el('span', { class: 'log-status' }, status),
        el('span', { class: 'log-duration' }, `${entry.duration} ms`)),
      Object.keys(params).length || entry.files.length
        ? [el('p', { class: 'small muted' }, t('dev.request')), jsonBlock(entry.files.length ? { ...params, files: entry.files } : params)]
        : null,
      el('p', { class: 'small muted' }, t('dev.response')),
      jsonBlock(entry.response ?? { error: entry.error?.description }));
  }));
}

function render() {
  if ($('#panel-dev').hidden) return;
  renderRaw();
  renderLog();
}

export default {
  id: 'dev',
  alwaysReload: true,
  init(appState) {
    app = appState;
    app.on('log', render);
    $('#log-clear').addEventListener('click', () => {
      app.log.length = 0;
      renderLog();
    });
  },
  async load() {
    renderRaw();
    renderLog();
  },
};
