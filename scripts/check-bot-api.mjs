// Compares the project's Bot API reference data with the latest machine-readable Bot API spec
// and reports what is missing or outdated.
// Usage: node scripts/check-bot-api.mjs [--spec path/to/api.json] [--json]
// Exit code: 0 = up to date, 1 = drift found, 2 = error.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as data from '../src/assets/js/data.js';

export const SPEC_URL = 'https://raw.githubusercontent.com/PaulSonOfLars/telegram-bot-api-spec/main/api.json';
const JS_DIR = fileURLToPath(new URL('../src/assets/js/', import.meta.url));

// Methods the tool deliberately does not expose (dangerous or unrelated to bot settings).
const IGNORED_METHODS = new Set(['getMyStarBalance', 'logOut', 'close']);
const BOT_SETTINGS_METHOD = /^(set|get|delete|remove)(My[A-Z]|Webhook|WebhookInfo|ChatMenuButton)/;

// Bot API parameters the project knows about for every method it calls.
// A parameter added by Telegram is reported even when the UI does not need it yet;
// when the UI starts using it, add it here. Keep this map in sync with src/assets/js.
export const METHOD_PARAMS = {
  getMe: [],
  getWebhookInfo: [],
  setWebhook: ['url', 'certificate', 'ip_address', 'max_connections', 'allowed_updates', 'drop_pending_updates', 'secret_token'],
  deleteWebhook: ['drop_pending_updates'],
  getFile: ['file_id'],
  getUserProfilePhotos: ['user_id', 'offset', 'limit'],
  getMyStarBalance: [],
  removeMyProfilePhoto: [],
  setMyProfilePhoto: ['photo'],
  getMyName: ['language_code'],
  setMyName: ['name', 'language_code'],
  getMyShortDescription: ['language_code'],
  setMyShortDescription: ['short_description', 'language_code'],
  getMyDescription: ['language_code'],
  setMyDescription: ['description', 'language_code'],
  getMyCommands: ['scope', 'language_code'],
  setMyCommands: ['commands', 'scope', 'language_code'],
  deleteMyCommands: ['scope', 'language_code'],
  getChatMenuButton: ['chat_id'],
  setChatMenuButton: ['chat_id', 'menu_button'],
  getMyDefaultAdministratorRights: ['for_channels'],
  setMyDefaultAdministratorRights: ['rights', 'for_channels'],
};

// Object fields rendered (or deliberately ignored) by the UI.
export const WEBHOOK_INFO_FIELDS = [
  'url', 'has_custom_certificate', 'pending_update_count', 'ip_address', 'last_error_date',
  'last_error_message', 'last_synchronization_error_date', 'max_connections', 'allowed_updates',
];
export const BOT_COMMAND_FIELDS = ['command', 'description', 'is_ephemeral'];
export const MENU_BUTTON_TYPES = ['MenuButtonCommands', 'MenuButtonWebApp', 'MenuButtonDefault'];

// A stale spec source is a silent-drift risk: it can look "up to date" while Telegram has
// already shipped a newer API. The report warns when the spec release date is older than this.
export const MAX_SPEC_AGE_DAYS = 90;

const diff = (spec, ours) => ({
  added: spec.filter((x) => !ours.includes(x)),
  removed: ours.filter((x) => !spec.includes(x)),
});

export async function usedMethods() {
  const files = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  await walk(JS_DIR);
  const methods = new Set();
  for (const file of files) {
    // Methods are passed either directly (api.call('getMe')) or via request objects ({ method: 'setMyName' }).
    for (const m of (await readFile(file, 'utf8')).matchAll(/(?:\.call\(|method: )'([a-z]\w+)'/g)) methods.add(m[1]);
  }
  return [...methods];
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function checkBotApi(spec, { now = new Date(), maxSpecAgeDays = MAX_SPEC_AGE_DAYS } = {}) {
  const fields = (type) => (spec.types[type]?.fields ?? []).map((f) => f.name);
  const version = spec.version.replace(/^Bot API\s*/, '');
  const used = await usedMethods();

  // Parameters of every method the tool calls: a new optional parameter matters because
  // the UI may need a control for it (as happened with is_ephemeral and secret_token).
  const methodParams = { added: [], removed: [] };
  for (const [method, expected] of Object.entries(METHOD_PARAMS)) {
    if (!spec.methods[method]) continue; // Method removal is reported by botSettingsMethods.removed.
    const actual = (spec.methods[method].fields ?? []).map((f) => f.name);
    for (const name of actual) if (!expected.includes(name)) methodParams.added.push(`${method}.${name}`);
    for (const name of expected) if (!actual.includes(name)) methodParams.removed.push(`${method}.${name}`);
  }

  // A new method in the source must also get a METHOD_PARAMS entry, otherwise its
  // parameters are silently unchecked.
  const uncheckedMethods = used.filter((method) => spec.methods[method] && !(method in METHOD_PARAMS));
  const releaseDate = parseDate(spec.release_date);
  const specAgeDays = releaseDate ? Math.floor((now.getTime() - releaseDate.getTime()) / 86_400_000) : null;

  const report = {
    specVersion: version,
    specReleaseDate: spec.release_date,
    specAgeDays,
    staleSpec: specAgeDays !== null && specAgeDays > maxSpecAgeDays,
    ourVersion: data.BOT_API_VERSION,
    changelog: spec.changelog,
    updateTypes: diff(fields('Update').filter((f) => f !== 'update_id'), data.UPDATE_TYPES),
    adminRights: diff(fields('ChatAdministratorRights'), data.ADMIN_RIGHTS.map((r) => r.key)),
    meFlags: diff(
      spec.types.User.fields.filter((f) => f.description.includes('Returned only in getMe')).map((f) => f.name),
      data.ME_FLAGS,
    ),
    commandScopes: diff(
      spec.types.BotCommandScope.subtypes.map((t) => spec.types[t].fields.find((f) => f.name === 'type').description.match(/must be (\w+)/)[1]),
      data.COMMAND_SCOPES.map((s) => s.type),
    ),
    botCommandFields: diff(fields('BotCommand'), BOT_COMMAND_FIELDS),
    menuButtonTypes: diff(spec.types.MenuButton?.subtypes ?? [], MENU_BUTTON_TYPES),
    webhookInfoFields: diff(fields('WebhookInfo'), WEBHOOK_INFO_FIELDS),
    methodParams,
    uncheckedMethods: { added: uncheckedMethods, removed: [] },
    botSettingsMethods: {
      added: Object.keys(spec.methods).filter((m) => BOT_SETTINGS_METHOD.test(m) && !used.includes(m) && !IGNORED_METHODS.has(m)),
      removed: used.filter((m) => !spec.methods[m]),
    },
  };
  const sections = [
    report.updateTypes, report.adminRights, report.meFlags, report.commandScopes,
    report.botCommandFields, report.menuButtonTypes, report.webhookInfoFields,
    report.methodParams, report.uncheckedMethods, report.botSettingsMethods,
  ];
  report.upToDate = report.specVersion === report.ourVersion
    && sections.every((s) => s.added.length === 0 && s.removed.length === 0);
  return report;
}

export function toMarkdown(r) {
  const lines = [
    `Spec: **Bot API ${r.specVersion}** (${r.specReleaseDate}) · project: **${r.ourVersion}**`,
    `Changelog: ${r.changelog}`,
    '',
  ];
  const labels = {
    updateTypes: 'Update types (allowed_updates)',
    adminRights: 'ChatAdministratorRights',
    meFlags: 'getMe flags',
    commandScopes: 'BotCommandScope types',
    botCommandFields: 'BotCommand fields',
    menuButtonTypes: 'MenuButton types',
    webhookInfoFields: 'WebhookInfo fields',
    methodParams: 'Method parameters',
    uncheckedMethods: 'Used methods without a parameter check',
    botSettingsMethods: 'Bot settings methods not used by the tool',
  };
  for (const [key, label] of Object.entries(labels)) {
    const { added, removed } = r[key];
    if (!added.length && !removed.length) continue;
    lines.push(`### ${label}`);
    if (added.length) lines.push(`- New: ${added.map((x) => `\`${x}\``).join(', ')}`);
    if (removed.length) lines.push(`- Removed from spec: ${removed.map((x) => `\`${x}\``).join(', ')}`);
    lines.push('');
  }
  if (r.staleSpec) {
    lines.push(`⚠️ The spec was released ${r.specAgeDays} days ago; the source may be stale.`);
    lines.push('');
  }
  if (r.upToDate) lines.push('✅ Up to date.');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specIndex = process.argv.indexOf('--spec');
  try {
    const spec = specIndex > -1
      ? JSON.parse(await readFile(process.argv[specIndex + 1], 'utf8'))
      : await (await fetch(SPEC_URL)).json();
    const maxSpecAgeDays = Number(process.env.SPEC_MAX_AGE_DAYS) || MAX_SPEC_AGE_DAYS;
    const report = await checkBotApi(spec, { maxSpecAgeDays });
    console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : toMarkdown(report));
    process.exitCode = report.upToDate ? 0 : 1;
  } catch (error) {
    console.error(`check-bot-api failed: ${error.message}`);
    process.exitCode = 2;
  }
}
