// Pure validation helpers. Each validator returns an error code (an i18n key suffix) or null.
import { LIMITS, WEBHOOK_PORTS } from './data.js';

const TOKEN_RE = /^\d{3,20}:[A-Za-z0-9_-]{30,}$/;
const SECRET_RE = /^[A-Za-z0-9_-]+$/;
const SECRET_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function validateToken(token) {
  return TOKEN_RE.test(token.trim()) ? null : 'token_format';
}

export function normalizeApiBase(value) {
  return value.trim().replace(/\/+$/, '');
}

export function validateApiBase(value) {
  const url = parseUrl(normalizeApiBase(value));
  if (!url) return 'url_invalid';
  if (url.protocol === 'https:') return null;
  // Plain HTTP only for a local Bot API server: browsers block other mixed content anyway.
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) return null;
  return 'url_https';
}

export function validateWebhookUrl(value) {
  const url = parseUrl(value.trim());
  if (!url) return 'url_invalid';
  if (url.protocol !== 'https:') return 'url_https';
  const port = url.port === '' ? 443 : Number(url.port);
  if (!WEBHOOK_PORTS.includes(port)) return 'url_port';
  return null;
}

export function validateHttpsUrl(value) {
  const url = parseUrl(value.trim());
  if (!url) return 'url_invalid';
  return url.protocol === 'https:' ? null : 'url_https';
}

export function validateSecretToken(value) {
  if (value === '') return null;
  if (value.length > LIMITS.secretToken || !SECRET_RE.test(value)) return 'secret_format';
  return null;
}

export function generateSecretToken(length = 48, cryptoImpl = globalThis.crypto) {
  const bytes = new Uint8Array(length);
  cryptoImpl.getRandomValues(bytes);
  // 64-char alphabet: masking with 63 keeps the distribution uniform.
  return Array.from(bytes, (b) => SECRET_CHARS[b & 63]).join('');
}

export function validateIpAddress(value) {
  const ip = value.trim();
  if (ip === '') return null;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return v4.slice(1).every((part) => Number(part) <= 255 && String(Number(part)) === part) ? null : 'ip_format';
  if (ip.includes(':') && parseUrl(`http://[${ip}]/`)) return null;
  return 'ip_format';
}

export function validateMaxConnections(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < LIMITS.maxConnectionsMin || n > LIMITS.maxConnectionsMax) return 'max_connections';
  return null;
}

export function validateLanguageCode(value) {
  return value === '' || /^[a-z]{2}$/.test(value) ? null : 'language_code';
}

export function validateChatId(value) {
  const v = value.trim();
  return /^-?\d{1,20}$/.test(v) || /^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(v) ? null : 'chat_id';
}

export function validateUserId(value) {
  return /^\d{1,20}$/.test(value.trim()) ? null : 'user_id';
}

export function validateLength(value, max) {
  return [...value].length > max ? 'too_long' : null;
}

// Telegram IDs have at most 52 significant bits, so Number is safe.
export function parseChatId(value) {
  const v = value.trim();
  return /^-?\d+$/.test(v) ? Number(v) : v;
}
