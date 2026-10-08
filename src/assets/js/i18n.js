// Runtime translations. The build embeds the "app" section of the locale file into each page.
let dict = {};
let locale = 'en';

export function setDictionary(data, lang) {
  dict = data;
  locale = lang;
}

export function initI18n() {
  const el = document.getElementById('i18n-data');
  setDictionary(el ? JSON.parse(el.textContent) : {}, document.documentElement.lang || 'en');
}

export function hasKey(key) {
  return typeof lookup(key) === 'string';
}

function lookup(key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

export function t(key, vars) {
  const value = lookup(key);
  if (typeof value !== 'string') return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function getLocale() {
  return locale;
}

export function formatDateTime(unixSeconds) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(unixSeconds * 1000));
}

export function formatRelative(unixSeconds, now = Date.now()) {
  const diff = Math.round(unixSeconds - now / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function formatDuration(seconds) {
  if (seconds < 60) return t('time.seconds', { n: seconds });
  if (seconds < 3600) return t('time.minutes', { n: Math.ceil(seconds / 60) });
  return t('time.hours', { n: Math.round((seconds / 3600) * 10) / 10 });
}
