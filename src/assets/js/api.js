// Minimal Telegram Bot API client for the browser.
// Requests are "simple" CORS requests (POST + urlencoded/multipart body) so no preflight is needed.
import { DEFAULT_API_BASE } from './data.js';
import { normalizeApiBase } from './validators.js';

export class TelegramApiError extends Error {
  constructor(method, { code = 0, description = '', retryAfter = null, network = false, timeout = false } = {}) {
    super(description || 'Request failed');
    this.name = 'TelegramApiError';
    this.method = method;
    this.code = code;
    this.description = description;
    this.retryAfter = retryAfter;
    this.network = network;
    this.timeout = timeout;
  }
}

export function serializeValue(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function encodeParams(params = {}, files = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  const fileEntries = Object.entries(files).filter(([, f]) => f);

  if (fileEntries.length === 0) {
    const body = new URLSearchParams();
    for (const [key, value] of entries) body.append(key, serializeValue(value));
    return body;
  }

  const body = new FormData();
  for (const [key, value] of entries) body.append(key, serializeValue(value));
  for (const [key, file] of fileEntries) body.append(key, file, file.name);
  return body;
}

export function createApi({ token, baseUrl = DEFAULT_API_BASE, timeout = 20000, onLog = () => {} }) {
  const base = normalizeApiBase(baseUrl);

  async function call(method, params = {}, files = {}) {
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response = null;
    let error = null;

    try {
      const res = await fetch(`${base}/bot${token}/${method}`, {
        method: 'POST',
        body: encodeParams(params, files),
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
      response = await res.json().catch(() => null);
      if (!response) {
        throw new TelegramApiError(method, { code: res.status, description: `HTTP ${res.status}` });
      }
      if (!response.ok) {
        throw new TelegramApiError(method, {
          code: response.error_code,
          description: response.description,
          retryAfter: response.parameters?.retry_after ?? null,
        });
      }
      return response.result;
    } catch (e) {
      error = e instanceof TelegramApiError
        ? e
        : new TelegramApiError(method, {
          network: true,
          timeout: e.name === 'AbortError',
          description: e.name === 'AbortError' ? 'Timeout' : e.message,
        });
      throw error;
    } finally {
      clearTimeout(timer);
      onLog({
        time: new Date(),
        method,
        params,
        files: Object.entries(files).filter(([, f]) => f).map(([key, f]) => `${key}: ${f.name}`),
        ok: !error,
        error,
        response,
        duration: Math.round(performance.now() - started),
      });
    }
  }

  const fileUrl = (filePath) => `${base}/file/bot${token}/${filePath}`;
  const defaultServer = base === DEFAULT_API_BASE;

  // Downloads a file as a Blob. The official server sends no CORS headers for files,
  // so this only works through a proxy; skip the doomed request to keep the console clean.
  async function fetchFile(filePath) {
    if (defaultServer) throw new TelegramApiError('getFile', { network: true, description: 'Files are not CORS-enabled' });
    const res = await fetch(fileUrl(filePath), {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new TelegramApiError('getFile', { code: res.status, description: `HTTP ${res.status}` });
    return res.blob();
  }

  return { call, fetchFile, fileUrl, baseUrl: base };
}
