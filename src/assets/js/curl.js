// Builds an equivalent curl command. The bot token and webhook secret are replaced
// with shell variables so the snippet is safe to paste into issues and chats.
import { DEFAULT_API_BASE } from './data.js';
import { serializeValue } from './api.js';
import { normalizeApiBase } from './validators.js';

const SECRET_PARAMS = { secret_token: 'WEBHOOK_SECRET' };

const singleQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const doubleQuoteBody = (s) => String(s).replace(/["$`\\]/g, '\\$&');

export function buildCurl(method, params = {}, { baseUrl = DEFAULT_API_BASE, files = {} } = {}) {
  const base = doubleQuoteBody(normalizeApiBase(baseUrl));
  const lines = [`curl -X POST "${base}/bot$BOT_TOKEN/${method}"`];

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (key in SECRET_PARAMS) {
      lines.push(`--form-string "${key}=$${SECRET_PARAMS[key]}"`);
      continue;
    }
    // --form-string: values starting with @ or < are sent literally, not read from files.
    lines.push(`--form-string ${singleQuote(`${key}=${serializeValue(value)}`)}`);
  }
  for (const [key, file] of Object.entries(files)) {
    if (!file) continue;
    lines.push(`-F ${singleQuote(`${key}=@${file.name ?? file}`)}`);
  }
  return lines.join(' \\\n  ');
}
