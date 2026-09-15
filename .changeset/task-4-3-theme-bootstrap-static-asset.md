---
"@aceshooting/lyra-ui": minor
---

Adds `@aceshooting/lyra-ui/theme-bootstrap.js`, a static, non-module script asset carrying the same
bytes as `lyraThemeBootstrap` (`@aceshooting/lyra-ui/theme.js`) so a Content-Security-Policy that
forbids `unsafe-inline` — and cannot mint a per-response nonce, such as a static HTML entry — can
reference the no-flash theme bootstrap with a plain `<script src>` instead of hand-rolling a build
step that writes it to a fixed-name file. The two are generated from the same build step and are
guaranteed byte-identical, so hashing (or same-origin-serving) one covers the other. It only ever
carries the default storage key (`'lyra-theme'`); an application-owned key still needs
`createLyraThemeBootstrap({ storageKey })` inlined, since a static file can't take a call-time
argument.
