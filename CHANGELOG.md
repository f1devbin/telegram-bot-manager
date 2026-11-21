# Changelog

## 3.3.1 — 2026-11-21

### Fixed
- The optional Cloudflare Worker CORS proxy now rejects requests from origins not listed in `ALLOWED_ORIGIN` and requests without an `Origin` header (403) instead of proxying them, so a deployed worker cannot be used as an open Telegram proxy. `ALLOWED_ORIGIN="*"` remains an explicit opt-in.
- Added unit tests for origin checks, preflight, path validation and proxying.

## 3.3.0 — 2026-11-21

### Added
- Bot API drift check now compares the parameters of every method the tool calls, plus `WebhookInfo`, `BotCommand` and `MenuButton` fields; it also warns when the spec source is stale.
- The English root page suggests a localized version based on the browser language (a dismissible banner, not a redirect).
- Plural forms for pending-update and saved-command messages via `Intl.PluralRules`.

### Changed
- Accessibility: focus moves to the active tab after connecting; validation errors are linked to their field with `aria-describedby`; the theme toggle exposes `aria-pressed`; radio groups have accessible names; the toast live region is no longer nested.
- CI: Playwright 1.65.1 with a browser cache; the Lighthouse SEO threshold is now an error (≥ 95), while performance stays a warning (≥ 85) because GitHub runners vary.

## 3.2.0 — 2026-11-11

### Changed
- Updated to Telegram Bot API 10.4: new `widget_query` and `shared_widget_query` update types in the `allowed_updates` picker.

### Added
- Menu button tab explains where the main Mini App is configured (@BotFather) and how to check that it is enabled.

## 3.1.0 — 2026-11-04

### Added
- `scripts/check-bot-api.mjs`: compares the latest Bot API spec with the project's reference data.
- Weekly “Bot API watch” workflow that opens an issue when the API changes.
- CI runs the end-to-end test and a Lighthouse audit on every pull request; duplicate push runs removed.
- `CLAUDE.md` with the Bot API update procedure.

### Changed
- The Bot API version is defined once in `data.js`; translations and the OG image use it automatically.

## 3.0.1 — 2026-10-08

### Fixed
- Accessibility: text/background contrast meets WCAG AA in both themes; links inside text are underlined.
- Theme script is inlined (CSP hash) to remove a render-blocking request.
- Command scope and language selects are no longer truncated.
- Bot avatar was not shown: api.telegram.org serves files without CORS headers, so the avatar is now loaded as a regular image (via a proxy it is still downloaded as a blob).

## 3.0.0 — 2026-10-08

Complete rewrite as a static site for GitHub Pages. The project is renamed from **getWebhookInfo** to **Telegram Bot Manager**.

### Changed
- PHP backend removed: all Bot API requests are sent directly from the browser. The token never passes through a third-party server.
- Interface translated into English, Russian, Spanish, Portuguese and Simplified Chinese; light and dark themes; responsive layout.
- Updated to Telegram Bot API 10.3: new update types (`guest_message`, `managed_bot`, `subscription`, `stopped_message_generation`, business and paid media updates), admin rights (`can_manage_direct_messages`, `can_manage_tags`, `can_send_welcome_messages`) and `getMe` flags.

### Added
- Default admin rights for channels (`for_channels`).
- Per-language bot name and descriptions; command scopes, languages and `is_ephemeral`.
- Profile photo upload and removal (`setMyProfilePhoto`, `removeMyProfilePhoto`).
- Menu button editor (`setChatMenuButton`).
- Telegram Stars balance.
- Self-signed certificate upload and secret token generator for `setWebhook`.
- Webhook error hints, curl generator, raw JSON viewer and request log.
- SEO: localized guide pages, hreflang, sitemap, structured data, Open Graph images.
- Optional Cloudflare Worker CORS proxy, unit and end-to-end tests, CI and Pages deployment.

### Fixed
- “Drop pending updates” no longer resets the webhook secret token and settings silently.
- “Delete webhook” could never drop pending updates (the checkbox was missing).
- XSS through unescaped API responses and error messages.
- Public `stats_counter.json` file and lack of CSRF protection (no server anymore).
- Profile save sent all fields every time and hit the `setMyName` rate limit.
- `ip_address` of an active webhook is no longer pinned implicitly when saving.
- Dates shown in the server time zone; fixed footer overlapping content.
