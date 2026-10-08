// DOM helpers shared by tab controllers.
import { t, formatDuration } from './i18n.js';
import { buildCurl } from './curl.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function toast(message, type = 'success', timeout = 5000) {
  const region = $('#toast-region');
  const node = el('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  region.append(node);
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(() => node.remove(), type === 'error' ? timeout * 2 : timeout);
}

export function describeError(error) {
  if (!error) return '';
  if (error.network) return t(error.timeout ? 'errors.timeout' : 'errors.network');
  if (error.code === 401 || error.code === 404) return t('errors.unauthorized');
  if (error.code === 429) {
    return t('errors.flood', { time: formatDuration(error.retryAfter ?? 0) });
  }
  return t('errors.telegram', { description: error.description || error.message });
}

export function showError(error) {
  toast(describeError(error), 'error');
}

export async function withBusy(button, fn) {
  if (!button) return fn();
  button.disabled = true;
  button.classList.add('is-busy');
  button.setAttribute('aria-busy', 'true');
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('common.copied'), 'success', 2000);
  } catch {
    toast(t('common.copyFailed'), 'error');
  }
}

// Marks a field invalid and shows a message under it. Pass null to clear.
export function setFieldError(input, message) {
  const field = input.closest('.field') ?? input.parentElement;
  let node = field.querySelector('.field-error');
  if (!message) {
    input.removeAttribute('aria-invalid');
    node?.remove();
    return;
  }
  input.setAttribute('aria-invalid', 'true');
  if (!node) {
    node = el('p', { class: 'field-error', role: 'alert' });
    field.append(node);
  }
  node.textContent = message;
}

// Runs validators ([input, errorCode|null, vars]) and focuses the first invalid input.
export function applyValidation(checks) {
  let first = null;
  for (const [input, code, vars] of checks) {
    setFieldError(input, code ? t(`validation.${code}`, vars) : null);
    if (code && !first) first = input;
  }
  first?.focus();
  return !first;
}

export function jsonBlock(value) {
  const text = JSON.stringify(value, null, 2);
  return el('div', { class: 'code-wrap' },
    el('pre', { class: 'code' }, el('code', { text })),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm code-copy', onclick: () => copyText(text) }, t('common.copy')));
}

// Accepts one request or a list of them ({ method, params, files }).
export function showCurl(form, requests, baseUrl) {
  const box = form.querySelector('.curl-box');
  const list = [requests].flat().filter(Boolean);
  if (list.length === 0) {
    box.hidden = true;
    return;
  }
  const command = list
    .map((r) => buildCurl(r.method, r.params, { baseUrl, files: r.files }))
    .join('\n\n');
  box.replaceChildren(
    el('p', { class: 'hint' }, t('common.curlHint')),
    el('div', { class: 'code-wrap' },
      el('pre', { class: 'code' }, el('code', { text: command })),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm code-copy', onclick: () => copyText(command) }, t('common.copy'))),
  );
  box.hidden = false;
}

export function bindCounters(root = document) {
  for (const counter of $$('[data-counter]', root)) {
    const input = document.getElementById(counter.dataset.counter);
    const max = Number(counter.dataset.max);
    const update = () => {
      const length = [...input.value].length;
      counter.textContent = `${length}/${max}`;
      counter.classList.toggle('over', length > max);
    };
    input.addEventListener('input', update);
    input.updateCounter = update;
    update();
  }
}

export function setValue(input, value) {
  input.value = value ?? '';
  input.updateCounter?.();
}

export function badge(text, type = 'neutral') {
  return el('span', { class: `badge badge-${type}` }, text);
}

export function confirmAction(message) {
  return window.confirm(message);
}

export function radioValue(name) {
  return $(`input[name="${name}"]:checked`)?.value;
}

export function setRadio(name, value) {
  const input = $(`input[name="${name}"][value="${value}"]`);
  if (input) {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
