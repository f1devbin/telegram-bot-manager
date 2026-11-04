# Telegram Bot Manager — notes for agents

Static site (GitHub Pages) that calls the Telegram Bot API from the browser. No backend, no npm dependencies.

- Build: `npm run build` → `dist/`. Unit tests: `npm test`. E2E with mocked API: `node scripts/screenshots.mjs --no-shots` (needs Playwright).
- Deploy: every push to `main` runs `.github/workflows/pages.yml`. Work on a branch and merge via PR; CI (`ci.yml`) runs unit tests, e2e and Lighthouse on PRs.
- UI strings live in `src/i18n/{en,ru,es,pt,zh}.json`; all locales must have the same keys (tests enforce it). Write natural translations, not machine-literal ones.
- The Bot API version is defined only in `BOT_API_VERSION` in `src/assets/js/data.js`; locale strings use the `{botApiVersion}` token.
- Never commit bot tokens. Never add analytics or third-party scripts: the page handles bot tokens and has a strict CSP.

## Updating to a new Bot API version

1. `node scripts/check-bot-api.mjs` — lists new update types, admin rights, getMe flags, command scopes, setWebhook params and bot-settings methods (spec: PaulSonOfLars/telegram-bot-api-spec; core.telegram.org may be unreachable).
2. Update `src/assets/js/data.js`: `UPDATE_GROUPS` (mark `optIn` if the spec says it must be requested explicitly), `ADMIN_RIGHTS` (with `target`), `ME_FLAGS`, `COMMAND_SCOPES`, `BOT_API_VERSION`.
3. Add labels for every new key to all five locale files (`app.updates.*`, `app.rights.*`, `app.me.*`, `app.scopes.*`). `npm test` lists anything missing.
4. A new bot-settings method that needs its own UI (a new tab or form) is a design change: describe it in the PR instead of building it silently.
5. Update `CHANGELOG.md` and the version badge in `README.md`; bump `package.json` patch/minor version.
6. Re-run the check (must print “Up to date”), `npm test`, `npm run build`, the e2e test, then `node scripts/images.mjs` to refresh the OG image.
