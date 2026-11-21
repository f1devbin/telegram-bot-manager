import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  checkBotApi, toMarkdown, usedMethods, METHOD_PARAMS, WEBHOOK_INFO_FIELDS, BOT_COMMAND_FIELDS, MENU_BUTTON_TYPES,
  INPUT_PROFILE_PHOTO_TYPES,
} from '../scripts/check-bot-api.mjs';
import { loadLocales, LANGS } from '../scripts/build.mjs';
import * as data from '../src/assets/js/data.js';

const field = (name, description = '') => ({ name, description });
const NOW = new Date('2026-11-21T00:00:00Z');

// Minimal spec that mirrors the project's reference data exactly.
function specFromProject() {
  const scopeTypes = data.COMMAND_SCOPES.map((s) => `Scope_${s.type}`);
  const types = {
    Update: { fields: [field('update_id'), ...data.UPDATE_TYPES.map((t) => field(t))] },
    ChatAdministratorRights: { fields: data.ADMIN_RIGHTS.map((r) => field(r.key)) },
    User: { fields: [field('id'), ...data.ME_FLAGS.map((f) => field(f, 'Optional. Returned only in getMe.'))] },
    BotCommandScope: { subtypes: scopeTypes },
    BotCommand: { fields: BOT_COMMAND_FIELDS.map((n) => field(n)) },
    MenuButton: { subtypes: [...MENU_BUTTON_TYPES] },
    InputProfilePhoto: { subtypes: [...INPUT_PROFILE_PHOTO_TYPES] },
    WebhookInfo: { fields: WEBHOOK_INFO_FIELDS.map((n) => field(n)) },
  };
  data.COMMAND_SCOPES.forEach((s, i) => {
    types[scopeTypes[i]] = { fields: [field('type', `Scope type, must be ${s.type}`)] };
  });
  const methods = {};
  for (const [method, params] of Object.entries(METHOD_PARAMS)) {
    methods[method] = { fields: params.map((n) => field(n)) };
  }
  return { version: `Bot API ${data.BOT_API_VERSION}`, release_date: 'November 9, 2026', changelog: 'url', types, methods };
}

test('reports up to date when spec matches the project', async () => {
  const report = await checkBotApi(specFromProject(), { now: NOW });
  assert.equal(report.upToDate, true, toMarkdown(report));
  assert.equal(report.staleSpec, false);
});

test('detects a new version, update type, admin right and bot method', async () => {
  const spec = specFromProject();
  spec.version = 'Bot API 99.0';
  spec.types.Update.fields.push(field('brand_new_update'));
  spec.types.ChatAdministratorRights.fields.push(field('can_do_magic'));
  spec.methods.setMyEmojiStatus = { fields: [] };
  const report = await checkBotApi(spec, { now: NOW });
  assert.equal(report.upToDate, false);
  assert.deepEqual(report.updateTypes.added, ['brand_new_update']);
  assert.deepEqual(report.adminRights.added, ['can_do_magic']);
  assert.deepEqual(report.botSettingsMethods.added, ['setMyEmojiStatus']);
  const md = toMarkdown(report);
  assert.ok(md.includes('99.0') && md.includes('`brand_new_update`'));
});

test('detects new method parameters and object fields', async () => {
  const spec = specFromProject();
  spec.methods.setMyCommands.fields.push(field('new_parameter'));
  spec.methods.setWebhook.fields = spec.methods.setWebhook.fields.filter((f) => f.name !== 'secret_token');
  spec.types.WebhookInfo.fields.push(field('new_info_field'));
  spec.types.BotCommand.fields.push(field('new_command_field'));
  spec.types.MenuButton.subtypes.push('MenuButtonNew');
  spec.types.InputProfilePhoto.subtypes.push('InputProfilePhotoNew');
  const report = await checkBotApi(spec, { now: NOW });
  assert.equal(report.upToDate, false);
  assert.deepEqual(report.methodParams.added, ['setMyCommands.new_parameter']);
  assert.deepEqual(report.methodParams.removed, ['setWebhook.secret_token']);
  assert.deepEqual(report.webhookInfoFields.added, ['new_info_field']);
  assert.deepEqual(report.botCommandFields.added, ['new_command_field']);
  assert.deepEqual(report.menuButtonTypes.added, ['MenuButtonNew']);
  assert.deepEqual(report.profilePhotoTypes.added, ['InputProfilePhotoNew']);
  const md = toMarkdown(report);
  assert.ok(md.includes('`setMyCommands.new_parameter`') && md.includes('### WebhookInfo fields'));
});

test('every method used by the source has a parameter expectation', async () => {
  const used = await usedMethods();
  assert.ok(used.length > 15);
  assert.deepEqual(used.filter((method) => !(method in METHOD_PARAMS)), []);
});

test('warns when the spec source is stale without treating it as drift', async () => {
  const report = await checkBotApi(specFromProject(), { now: new Date('2027-03-01T00:00:00Z') });
  assert.equal(report.staleSpec, true);
  assert.ok(report.specAgeDays > 90);
  assert.equal(report.upToDate, true);
  assert.match(toMarkdown(report), /source may be stale/);
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
