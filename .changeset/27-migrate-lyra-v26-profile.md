---
'@aceshooting/lyra-ui': minor
---

`lyra-ui-migrate --origin=lyra-v26` moves a project from Lyra 26 to 27. It rewrites `@aceshooting/lyra-ui/translations/<locale>` specifiers (the pseudo-locales stay) to `@aceshooting/lyra-translations/<locale>` and `custom-elements.json`, `web-types.json`, `vscode-html-data.json` and `vscode-css-data.json` to `@aceshooting/lyra-ide/...`, re-binds root imports of `ToolCallStatus` and `ToolResultStatus` as `ToolStatus as <Old>`, runs the `theme-scopes` rule, and reports removed localization keys, deep imports of the removed types and computed specifiers (`GLOBAL_REVIEW`). Migration profiles gain the optional `globals` and `rules` lists described in RFC 0003.
