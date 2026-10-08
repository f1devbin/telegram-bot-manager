// Renders PNG icons and Open Graph / GitHub social preview images with Playwright.
// Requires Playwright with Chromium: `npx playwright install chromium` (not a project dependency).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from './playwright.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const svg = await readFile(root('src/assets/img/favicon.svg'), 'utf8');
const svgUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const ICONS = [
  ['src/assets/img/favicon-32.png', 32],
  ['src/assets/img/apple-touch-icon.png', 180],
  ['src/assets/img/icon-192.png', 192],
  ['src/assets/img/icon-512.png', 512],
];

const card = (width, height) => `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; font-family: "Segoe UI", Roboto, "Noto Sans", sans-serif; color: #f2f5f8;
    background: radial-gradient(900px 500px at 85% 10%, #1f4f7d 0%, transparent 60%), #0e1621; padding: 72px 80px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 24px; }
  .brand img { width: 96px; height: 96px; }
  h1 { font-size: 68px; letter-spacing: -1.5px; line-height: 1.05; }
  p { font-size: 32px; color: #a9bacb; margin-top: 28px; line-height: 1.35; max-width: 980px; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: auto; }
  .chip { font: 600 24px ui-monospace, Menlo, Consolas, monospace; padding: 10px 18px; border-radius: 12px; background: #17212b; border: 1px solid #2b3947; color: #7bb9f4; }
  .url { position: absolute; right: 80px; top: 36px; font-size: 22px; color: #8fa1b3; }
</style></head><body>
  <div class="brand"><img src="${svgUri}" alt=""><h1>Telegram Bot<br>Manager</h1></div>
  <p>Set, check &amp; delete webhooks, edit commands, profile, menu button and admin rights — online, in your browser.</p>
  <div class="chips"><span class="chip">setWebhook</span><span class="chip">getWebhookInfo</span><span class="chip">deleteWebhook</span><span class="chip">setMyCommands</span><span class="chip">Bot API 10.3</span></div>
  <span class="url">github.com/f1devbin/telegram-bot-manager</span>
</body></html>`;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage();

for (const [file, size] of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${svgUri}" style="width:${size}px;height:${size}px;display:block"></body></html>`);
  await writeFile(root(file), await page.screenshot({ omitBackground: true }));
}

for (const [file, width, height] of [['src/assets/img/og-image.png', 1200, 630], ['docs/social-preview.png', 1280, 640]]) {
  await page.setViewportSize({ width, height });
  await page.setContent(card(width, height));
  await writeFile(root(file), await page.screenshot());
}

await browser.close();
console.log('Images generated.');
