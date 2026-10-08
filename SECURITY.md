# Security policy

## How the token is handled

- Telegram Bot Manager is a static site. It has no backend and no analytics.
- The bot token is used only in the browser to call the Bot API server (`https://api.telegram.org` by default, or the server set in “Advanced: API server”).
- The token is kept in `sessionStorage` (current tab) or, if “Remember on this device” is checked, in `localStorage`. “Disconnect” removes it.
- A strict Content Security Policy allows scripts only from the site itself.

## Reporting a vulnerability

Please report vulnerabilities privately via [GitHub Security Advisories](https://github.com/f1devbin/telegram-bot-manager/security/advisories/new) instead of opening a public issue. You will get a response within a few days.

If you believe a bot token was exposed, revoke it immediately with [@BotFather](https://t.me/BotFather) → `/revoke`.
