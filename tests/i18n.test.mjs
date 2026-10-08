import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadLocales, LANGS } from '../scripts/build.mjs';
import { UPDATE_TYPES, ADMIN_RIGHTS, ME_FLAGS, COMMAND_SCOPES, UPDATE_GROUPS } from '../src/assets/js/data.js';
import { setDictionary, hasKey, t } from '../src/assets/js/i18n.js';

const JS_DIR = new URL('../src/assets/js/', import.meta.url).pathname;

async function jsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? jsFiles(join(dir, e.name)) : [join(dir, e.name)])));
  return files.flat().filter((f) => f.endsWith('.js'));
}

test('all locales have the same keys as English', async () => {
  const locales = await loadLocales(); // throws on mismatch
  assert.equal(Object.keys(locales).length, LANGS.length);
});

test('every static t() key used in JS exists in every locale', async () => {
  const locales = await loadLocales();
  const keys = new Set();
  for (const file of await jsFiles(JS_DIR)) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/\bt\('([\w.]+)'/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 30);
  for (const lang of LANGS) {
    setDictionary(locales[lang.code].app, lang.code);
    const missing = [...keys].filter((key) => !hasKey(key));
    assert.deepEqual(missing, [], `${lang.code} is missing keys`);
  }
});

test('dynamic keys (update types, rights, flags, scopes) are translated', async () => {
  const locales = await loadLocales();
  for (const lang of LANGS) {
    setDictionary(locales[lang.code].app, lang.code);
    const keys = [
      ...UPDATE_TYPES.map((x) => `updates.${x}`),
      ...UPDATE_GROUPS.map((g) => `updateGroups.${g.id}`),
      ...ADMIN_RIGHTS.map((r) => `rights.${r.key}`),
      ...ME_FLAGS.map((f) => `me.${f}`),
      ...COMMAND_SCOPES.flatMap((s) => [`scopes.${s.type}.label`, `scopes.${s.type}.hint`]),
      ...['cmd_format', 'cmd_name', 'cmd_description', 'cmd_duplicate', 'cmd_limit'].map((c) => `validation.${c}`),
      ...['ssl', 'dns', 'refused', 'timeout', 'http3xx', 'http4xx', 'http5xx'].map((h) => `webhook.hints.${h}`),
    ];
    assert.deepEqual(keys.filter((key) => !hasKey(key)), [], `${lang.code} is missing dynamic keys`);
  }
});

test('t() interpolates variables', () => {
  setDictionary({ a: { b: 'Hello {name}, {missing}' } }, 'en');
  assert.equal(t('a.b', { name: 'bot' }), 'Hello bot, {missing}');
  assert.equal(t('a.unknown'), 'a.unknown');
});

test('SEO titles and descriptions fit search snippets', async () => {
  const locales = await loadLocales();
  for (const lang of LANGS) {
    const l = locales[lang.code];
    const pages = [l.meta, ...Object.values(l.guides)];
    for (const page of pages) {
      assert.ok([...page.title].length <= 75, `${lang.code} title too long: ${page.title}`);
      assert.ok([...page.description].length <= 175, `${lang.code} description too long: ${page.description}`);
    }
  }
});
