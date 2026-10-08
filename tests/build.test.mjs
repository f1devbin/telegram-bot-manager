import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, render, compareLocales, escapeHtml, LANGS, GUIDES, SITE_URL } from '../scripts/build.mjs';

test('render escapes {{ }} and keeps {{{ }}} raw', () => {
  assert.equal(render('{{a}}|{{{a}}}', { a: '<b>' }), '&lt;b&gt;|<b>');
  assert.throws(() => render('{{missing}}', {}), /missing value/);
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
});

test('compareLocales reports missing and extra keys', () => {
  assert.deepEqual(compareLocales({ a: 'x', b: ['1'] }, { a: 'y', b: ['2'] }), []);
  assert.deepEqual(compareLocales({ a: 'x' }, { c: 'y' }), ['.a: missing', '.c: unknown key']);
  assert.deepEqual(compareLocales({ a: 'x' }, { a: ' ' }), ['.a: empty']);
});

test('build produces all localized pages with SEO metadata', async (t) => {
  const out = await mkdtemp(join(tmpdir(), 'tbm-build-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  const { pages } = await build(out);
  assert.equal(pages, LANGS.length * (GUIDES.length + 1));

  for (const file of ['404.html', 'robots.txt', 'sitemap.xml', 'site.webmanifest', '.nojekyll', 'assets/js/main.js', 'assets/img/og-image.png']) {
    assert.ok(existsSync(join(out, file)), `${file} exists`);
  }

  for (const lang of LANGS) {
    const html = await readFile(join(out, lang.prefix, 'index.html'), 'utf8');
    assert.ok(html.includes(`<html lang="${lang.hreflang}">`), `${lang.code} lang attribute`);
    assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}${lang.prefix}">`), `${lang.code} canonical`);
    assert.equal((html.match(/rel="alternate" hreflang=/g) ?? []).length, LANGS.length + 1, `${lang.code} hreflang`);
    assert.ok(html.includes('"@type":"FAQPage"'), `${lang.code} FAQ JSON-LD`);
    assert.ok(!/\{\{|\[\[curl:/.test(html), `${lang.code} has no unrendered placeholders`);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${lang.code} has one h1`);
  }

  const guide = await readFile(join(out, 'ru', 'set-webhook', 'index.html'), 'utf8');
  assert.ok(guide.includes('"@type":"TechArticle"'));
  assert.ok(guide.includes('href="../../assets/css/app.css'), 'relative asset path');
  assert.ok(!/\{\{|\[\[curl:/.test(guide));

  const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, pages);
  assert.ok((await readFile(join(out, 'robots.txt'), 'utf8')).includes(`Sitemap: ${SITE_URL}sitemap.xml`));
});
