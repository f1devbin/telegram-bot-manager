// Static site generator: renders src/templates with src/i18n/*.json into dist/.
// Usage: node scripts/build.mjs [--out dist]   (SITE_URL env overrides the canonical base URL)
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

export const SITE_URL = ensureSlash(process.env.SITE_URL || 'https://f1devbin.github.io/telegram-bot-manager/');
export const REPO_URL = 'https://github.com/f1devbin/telegram-bot-manager';

export const LANGS = [
  { code: 'en', prefix: '', hreflang: 'en', name: 'English', ogLocale: 'en_US' },
  { code: 'ru', prefix: 'ru/', hreflang: 'ru', name: 'Русский', ogLocale: 'ru_RU' },
  { code: 'es', prefix: 'es/', hreflang: 'es', name: 'Español', ogLocale: 'es_ES' },
  { code: 'pt', prefix: 'pt/', hreflang: 'pt', name: 'Português', ogLocale: 'pt_BR' },
  { code: 'zh', prefix: 'zh/', hreflang: 'zh-Hans', name: '简体中文', ogLocale: 'zh_CN' },
];

export const GUIDES = [
  { id: 'setWebhook', slug: 'set-webhook/', tab: 'webhook' },
  { id: 'webhookInfo', slug: 'webhook-info/', tab: 'webhook' },
  { id: 'deleteWebhook', slug: 'delete-webhook/', tab: 'webhook' },
  { id: 'botCommands', slug: 'bot-commands/', tab: 'commands' },
];

const PAGES = [{ id: 'home', slug: '' }, ...GUIDES];

// Language-neutral code samples referenced from guide bodies as [[curl:name]].
const SNIPPETS = {
  setWebhook: `curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \\
  --form-string "url=https://example.com/telegram/webhook" \\
  --form-string "secret_token=$WEBHOOK_SECRET" \\
  --form-string 'allowed_updates=["message","callback_query"]' \\
  --form-string "max_connections=40"`,
  setWebhookCert: `curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \\
  --form-string "url=https://203.0.113.10:8443/webhook" \\
  -F "certificate=@public.pem"`,
  verifySecret: `// Node.js (Express): reject requests without the right secret
app.post('/telegram/webhook', (req, res) => {
  if (req.get('X-Telegram-Bot-Api-Secret-Token') !== process.env.WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }
  // handle req.body (Update) ...
  res.sendStatus(200);
});`,
  getWebhookInfo: `curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"`,
  webhookInfoResponse: `{
  "ok": true,
  "result": {
    "url": "https://example.com/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 12,
    "ip_address": "203.0.113.10",
    "last_error_date": 1791446400,
    "last_error_message": "Wrong response from the webhook: 502 Bad Gateway",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query"]
  }
}`,
  deleteWebhook: `curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook" \\
  --form-string "drop_pending_updates=true"`,
  getUpdates: `curl "https://api.telegram.org/bot$BOT_TOKEN/getUpdates?timeout=30"`,
  setMyCommands: `curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setMyCommands" \\
  --form-string 'commands=[{"command":"start","description":"Start the bot"},{"command":"help","description":"Show help"}]' \\
  --form-string 'scope={"type":"all_private_chats"}' \\
  --form-string "language_code=en"`,
  deleteMyCommands: `curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/deleteMyCommands" \\
  --form-string 'scope={"type":"all_group_chats"}'`,
  commandsText: `start - Start the bot
help - Show help
settings - Open settings
tip - A hint only you can see [ephemeral]`,
};

function ensureSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function lookup(ctx, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), ctx);
}

// {{path}} — escaped, {{{path}}} — raw. Unknown paths fail the build.
export function render(template, ctx, name = 'template') {
  const resolve = (path) => {
    const value = lookup(ctx, path.trim());
    if (value === undefined || value === null || typeof value === 'object') {
      throw new Error(`${name}: missing value for "${path.trim()}"`);
    }
    return String(value);
  };
  return template
    .replace(/\{\{\{([^}]+)\}\}\}/g, (_, path) => resolve(path))
    .replace(/\{\{([^}]+)\}\}/g, (_, path) => escapeHtml(resolve(path)));
}

// Every locale must have exactly the same keys (and array lengths) as English.
export function compareLocales(base, other, path = '') {
  const problems = [];
  if (Array.isArray(base)) {
    if (!Array.isArray(other) || other.length !== base.length) return [`${path}: array length mismatch`];
    base.forEach((item, i) => problems.push(...compareLocales(item, other[i], `${path}[${i}]`)));
    return problems;
  }
  if (base && typeof base === 'object') {
    if (!other || typeof other !== 'object') return [`${path}: expected object`];
    for (const key of Object.keys(base)) {
      if (!(key in other)) problems.push(`${path}.${key}: missing`);
      else problems.push(...compareLocales(base[key], other[key], `${path}.${key}`));
    }
    for (const key of Object.keys(other)) if (!(key in base)) problems.push(`${path}.${key}: unknown key`);
    return problems;
  }
  if (typeof other !== typeof base) return [`${path}: type mismatch`];
  if (typeof base === 'string' && other.trim() === '' && base.trim() !== '') return [`${path}: empty`];
  return problems;
}

export async function loadLocales() {
  const locales = {};
  for (const lang of LANGS) {
    locales[lang.code] = JSON.parse(await readFile(join(SRC, 'i18n', `${lang.code}.json`), 'utf8'));
  }
  const problems = LANGS.slice(1).flatMap((lang) => compareLocales(locales.en, locales[lang.code], lang.code));
  if (problems.length) throw new Error(`Locale mismatch:\n  ${problems.join('\n  ')}`);
  return locales;
}

const pageUrl = (lang, page) => `${SITE_URL}${lang.prefix}${page.slug}`;
const pagePath = (lang, page) => `${lang.prefix}${page.slug}`;

function relativeRoot(lang, page) {
  const depth = pagePath(lang, page).split('/').filter(Boolean).length;
  return '../'.repeat(depth) || './';
}

function codeBlock(code) {
  return `<pre class="code"><code>${escapeHtml(code)}</code></pre>`;
}

function expandSnippets(html) {
  return html.replace(/\[\[curl:(\w+)\]\]/g, (_, name) => {
    if (!SNIPPETS[name]) throw new Error(`Unknown snippet: ${name}`);
    return codeBlock(SNIPPETS[name]);
  });
}

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function homeFragments(t, lang, root) {
  const guideHref = (g) => `${root}${lang.prefix}${g.slug}`;
  return {
    features: t.home.features.map((f) => `<article class="card feature"><h3><span class="feature-icon" aria-hidden="true">${escapeHtml(f.icon)}</span>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.text)}</p></article>`).join('\n'),
    steps: t.home.steps.map((s) => `<li><strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(s.text)}</span></li>`).join('\n'),
    security: t.home.security.map((item) => `<li>${item}</li>`).join('\n'),
    guideCards: GUIDES.map((g) => `<a class="card guide-card" href="${guideHref(g)}"><strong>${escapeHtml(t.guides[g.id].short)}</strong><span>${escapeHtml(t.guides[g.id].description)}</span></a>`).join('\n'),
    faq: t.home.faq.map((f) => `<details><summary>${escapeHtml(f.q)}</summary><div>${f.a.startsWith('<') ? f.a : `<p>${f.a}</p>`}</div></details>`).join('\n'),
  };
}

function homeJsonLd(t, lang) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Telegram Bot Manager',
        url: pageUrl(lang, PAGES[0]),
        description: t.meta.description,
        inLanguage: lang.hreflang,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        license: 'https://opensource.org/licenses/MIT',
        image: `${SITE_URL}assets/img/og-image.png`,
        author: { '@type': 'Person', name: 'f1devbin', url: 'https://github.com/f1devbin' },
        codeRepository: REPO_URL,
      },
      {
        '@type': 'FAQPage',
        mainEntity: t.home.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) },
        })),
      },
    ],
  });
}

function guideJsonLd(t, lang, guide, buildDate) {
  const g = t.guides[guide.id];
  return jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: g.h1,
        description: g.description,
        inLanguage: lang.hreflang,
        url: pageUrl(lang, guide),
        image: `${SITE_URL}assets/img/og-image.png`,
        datePublished: '2026-10-08',
        dateModified: buildDate,
        author: { '@type': 'Person', name: 'f1devbin', url: 'https://github.com/f1devbin' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Telegram Bot Manager', item: pageUrl(lang, PAGES[0]) },
          { '@type': 'ListItem', position: 2, name: g.short, item: pageUrl(lang, guide) },
        ],
      },
    ],
  });
}

async function hashDir(dir) {
  const hash = createHash('sha1');
  const walk = async (d) => {
    for (const entry of (await readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) await walk(full);
      else hash.update(relative(dir, full)).update(await readFile(full));
    }
  };
  await walk(dir);
  return hash.digest('hex').slice(0, 10);
}

export async function build(outDir = join(ROOT, 'dist')) {
  const [layout, indexTpl, guideTpl, pkg, locales] = await Promise.all([
    readFile(join(SRC, 'templates', 'layout.html'), 'utf8'),
    readFile(join(SRC, 'templates', 'index.html'), 'utf8'),
    readFile(join(SRC, 'templates', 'guide.html'), 'utf8'),
    readFile(join(ROOT, 'package.json'), 'utf8').then(JSON.parse),
    loadLocales(),
  ]);
  const { BOT_API_VERSION } = await import('../src/assets/js/data.js');
  const buildDate = new Date().toISOString().slice(0, 10);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(join(SRC, 'assets'), join(outDir, 'assets'), { recursive: true });
  if (existsSync(join(SRC, 'static'))) await cp(join(SRC, 'static'), outDir, { recursive: true });

  // Inlined to apply the saved theme before first paint without an extra blocking request.
  const themeScript = (await readFile(join(SRC, 'assets', 'js', 'theme.js'), 'utf8')).trim();
  const site = {
    themeScript,
    themeHash: `sha256-${createHash('sha256').update(themeScript).digest('base64')}`,
    url: SITE_URL,
    repo: REPO_URL,
    version: await hashDir(join(SRC, 'assets')),
    appVersion: pkg.version,
    botApiVersion: BOT_API_VERSION,
    year: new Date().getFullYear(),
  };
  const written = [];

  for (const lang of LANGS) {
    const t = locales[lang.code];
    for (const page of PAGES) {
      const root = relativeRoot(lang, page);
      const langRoot = page.slug ? '../' : './';
      const isHome = page.id === 'home';
      const guide = isHome ? null : t.guides[page.id];

      const alternates = [
        ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(l, page)}">`),
        `<link rel="alternate" hreflang="x-default" href="${pageUrl(LANGS[0], page)}">`,
      ].join('\n');
      const ogAlternates = LANGS.filter((l) => l !== lang)
        .map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">`).join('\n');
      const langLinks = LANGS.map((l) => `<li><a href="${root}${pagePath(l, page)}" hreflang="${l.hreflang}" lang="${l.hreflang}"${l === lang ? ' aria-current="page"' : ''}>${escapeHtml(l.name)}</a></li>`).join('');
      const guideLinks = GUIDES.map((g) => `<li><a href="${root}${lang.prefix}${g.slug}"${g === page ? ' aria-current="page"' : ''}>${escapeHtml(t.guides[g.id].short)}</a></li>`).join('');

      const ctx = {
        t,
        lang,
        site,
        root,
        langRoot,
        page: {
          id: page.id,
          url: pageUrl(lang, page),
          title: isHome ? t.meta.title : guide.title,
          description: isHome ? t.meta.description : guide.description,
          ogType: isHome ? 'website' : 'article',
          alternates,
          ogAlternates,
          langLinks,
          guideLinks,
          jsonLd: isHome ? homeJsonLd(t, lang) : guideJsonLd(t, lang, page, buildDate),
          i18nJson: JSON.stringify(t.app).replace(/</g, '\\u003c'),
          scripts: `<script type="module" src="${root}assets/js/main.js?v=${site.version}"></script>`,
        },
      };

      if (isHome) {
        ctx.home = homeFragments(t, lang, root);
      } else {
        const related = GUIDES.filter((g) => g !== page)
          .map((g) => `<a class="card guide-card" href="${root}${lang.prefix}${g.slug}"><strong>${escapeHtml(t.guides[g.id].short)}</strong><span>${escapeHtml(t.guides[g.id].description)}</span></a>`).join('\n');
        ctx.guide = { ...guide, tab: page.tab, body: expandSnippets(guide.body), related };
      }

      const content = render(isHome ? indexTpl : guideTpl, ctx, `${lang.code}/${page.id}`);
      const html = render(layout, { ...ctx, content }, `${lang.code}/${page.id} layout`);
      const file = join(outDir, pagePath(lang, page), 'index.html');
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, html);
      written.push({ lang, page });
    }
  }

  await writeFile(join(outDir, '404.html'), render404(layout, locales.en, site));
  await writeFile(join(outDir, 'sitemap.xml'), sitemap(buildDate));
  await writeFile(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);
  await writeFile(join(outDir, 'site.webmanifest'), JSON.stringify(manifest(locales.en), null, 2));
  await writeFile(join(outDir, '.nojekyll'), '');
  return { outDir, pages: written.length };
}

function render404(layout, t, site) {
  const root = new URL(SITE_URL).pathname;
  const page = { id: 'notfound', slug: '' };
  const links = LANGS.map((l) => `<li><a href="${root}${l.prefix}" hreflang="${l.hreflang}" lang="${l.hreflang}">${escapeHtml(l.name)}</a></li>`).join('');
  const content = `<section class="container article"><h1>404</h1><p class="lead">${escapeHtml(t.ui.notFound)}</p><p><a class="btn btn-primary" href="${root}">Telegram Bot Manager</a></p><ul class="footer-links">${links}</ul></section>`;
  return render(layout, {
    t,
    lang: LANGS[0],
    site,
    root,
    langRoot: root,
    content,
    page: {
      id: page.id,
      url: SITE_URL,
      title: `404 — Telegram Bot Manager`,
      description: t.meta.description,
      ogType: 'website',
      alternates: '<meta name="robots" content="noindex">',
      ogAlternates: '',
      langLinks: links,
      guideLinks: GUIDES.map((g) => `<li><a href="${root}${g.slug}">${escapeHtml(t.guides[g.id].short)}</a></li>`).join(''),
      jsonLd: '',
      scripts: `<script type="module" src="${root}assets/js/main.js?v=${site.version}"></script>`,
    },
  }, '404');
}

function sitemap(buildDate) {
  const urls = PAGES.flatMap((page) => LANGS.map((lang) => {
    const links = [
      ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(l, page)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(LANGS[0], page)}"/>`,
    ].join('\n');
    return `  <url>\n    <loc>${pageUrl(lang, page)}</loc>\n    <lastmod>${buildDate}</lastmod>\n${links}\n  </url>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

function manifest(t) {
  return {
    name: 'Telegram Bot Manager',
    short_name: 'Bot Manager',
    description: t.meta.description,
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#0e1621',
    theme_color: '#2481cc',
    icons: [
      { src: 'assets/img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'assets/img/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'assets/img/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf('--out');
  const out = outIndex > -1 ? process.argv[outIndex + 1] : undefined;
  build(out).then(
    ({ outDir, pages }) => console.log(`Built ${pages} pages into ${relative(process.cwd(), outDir) || '.'}`),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
