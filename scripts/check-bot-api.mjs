// Compares the project's Bot API reference data (src/assets/js/data.js) with the latest
// machine-readable Bot API spec and reports what is missing or outdated.
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

const diff = (spec, ours) => ({
  added: spec.filter((x) => !ours.includes(x)),
  removed: ours.filter((x) => !spec.includes(x)),
});

async function usedMethods() {
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

export async function checkBotApi(spec) {
  const fields = (type) => spec.types[type].fields.map((f) => f.name);
  const version = spec.version.replace(/^Bot API\s*/, '');
  const used = await usedMethods();

  const report = {
    specVersion: version,
    specReleaseDate: spec.release_date,
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
    setWebhookParams: diff(spec.methods.setWebhook.fields.map((f) => f.name),
      ['url', 'certificate', 'ip_address', 'max_connections', 'allowed_updates', 'drop_pending_updates', 'secret_token']),
    botSettingsMethods: {
      added: Object.keys(spec.methods).filter((m) => BOT_SETTINGS_METHOD.test(m) && !used.includes(m) && !IGNORED_METHODS.has(m)),
      removed: used.filter((m) => !spec.methods[m]),
    },
  };
  const sections = Object.values(report).filter((v) => v && typeof v === 'object');
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
    setWebhookParams: 'setWebhook parameters',
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
  if (r.upToDate) lines.push('✅ Up to date.');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specIndex = process.argv.indexOf('--spec');
  try {
    const spec = specIndex > -1
      ? JSON.parse(await readFile(process.argv[specIndex + 1], 'utf8'))
      : await (await fetch(SPEC_URL)).json();
    const report = await checkBotApi(spec);
    console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : toMarkdown(report));
    process.exitCode = report.upToDate ? 0 : 1;
  } catch (error) {
    console.error(`check-bot-api failed: ${error.message}`);
    process.exitCode = 2;
  }
}
