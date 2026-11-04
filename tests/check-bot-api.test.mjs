import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkBotApi, toMarkdown } from '../scripts/check-bot-api.mjs';
import { loadLocales, LANGS } from '../scripts/build.mjs';
import * as data from '../src/assets/js/data.js';

const field = (name, description = '') => ({ name, description });

// Minimal spec that mirrors the project's data.js exactly.
function specFromProject() {
  const scopeTypes = data.COMMAND_SCOPES.map((s) => `Scope_${s.type}`);
  const types = {
    Update: { fields: [field('update_id'), ...data.UPDATE_TYPES.map((t) => field(t))] },
    ChatAdministratorRights: { fields: data.ADMIN_RIGHTS.map((r) => field(r.key)) },
    User: { fields: [field('id'), ...data.ME_FLAGS.map((f) => field(f, 'Optional. Returned only in getMe.'))] },
    BotCommandScope: { subtypes: scopeTypes },
  };
  data.COMMAND_SCOPES.forEach((s, i) => {
    types[scopeTypes[i]] = { fields: [field('type', `Scope type, must be ${s.type}`)] };
  });
  const methods = {
    setWebhook: { fields: ['url', 'certificate', 'ip_address', 'max_connections', 'allowed_updates', 'drop_pending_updates', 'secret_token'].map((n) => field(n)) },
  };
  for (const m of ['getMe', 'getWebhookInfo', 'deleteWebhook', 'getUserProfilePhotos', 'getFile', 'getMyName', 'setMyName',
    'getMyDescription', 'setMyDescription', 'getMyShortDescription', 'setMyShortDescription', 'getMyCommands', 'setMyCommands',
    'deleteMyCommands', 'getChatMenuButton', 'setChatMenuButton', 'getMyDefaultAdministratorRights',
    'setMyDefaultAdministratorRights', 'setMyProfilePhoto', 'removeMyProfilePhoto', 'getMyStarBalance']) {
    methods[m] ??= { fields: [] };
  }
  return { version: `Bot API ${data.BOT_API_VERSION}`, release_date: 'today', changelog: 'url', types, methods };
}

test('reports up to date when spec matches data.js', async () => {
  const report = await checkBotApi(specFromProject());
  assert.equal(report.upToDate, true, toMarkdown(report));
});

test('detects a new version, update type, admin right and bot method', async () => {
  const spec = specFromProject();
  spec.version = 'Bot API 99.0';
  spec.types.Update.fields.push(field('brand_new_update'));
  spec.types.ChatAdministratorRights.fields.push(field('can_do_magic'));
  spec.methods.setMyEmojiStatus = { fields: [] };
  const report = await checkBotApi(spec);
  assert.equal(report.upToDate, false);
  assert.deepEqual(report.updateTypes.added, ['brand_new_update']);
  assert.deepEqual(report.adminRights.added, ['can_do_magic']);
  assert.deepEqual(report.botSettingsMethods.added, ['setMyEmojiStatus']);
  const md = toMarkdown(report);
  assert.ok(md.includes('99.0') && md.includes('`brand_new_update`'));
});

test('Bot API version is defined only in data.js', async () => {
  for (const lang of LANGS) {
    const raw = await readFile(new URL(`../src/i18n/${lang.code}.json`, import.meta.url), 'utf8');
    assert.ok(!raw.includes(`Bot API ${data.BOT_API_VERSION}`), `${lang.code}.json hardcodes the version; use {botApiVersion}`);
  }
  const locales = await loadLocales();
  for (const lang of LANGS) {
    assert.ok(locales[lang.code].home.eyebrow.includes(data.BOT_API_VERSION), `${lang.code} eyebrow gets the version`);
    assert.ok(!JSON.stringify(locales[lang.code]).includes('{botApiVersion}'), `${lang.code} has unfilled token`);
  }
});
