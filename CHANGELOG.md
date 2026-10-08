# Changelog

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
- Bot token was exposed in the avatar image URL.
- Public `stats_counter.json` file and lack of CSRF protection (no server anymore).
- Profile save sent all fields every time and hit the `setMyName` rate limit.
- `ip_address` of an active webhook is no longer pinned implicitly when saving.
- Dates shown in the server time zone; fixed footer overlapping content.
