# @aceshooting/lyra-ui — LLM API Reference

`@aceshooting/lyra-ui` is a free, independent, MIT-licensed [Lit](https://lit.dev) web-component
library and an open-source alternative to Shoelace and Web Awesome. It combines accessible form
controls, layout and overlay primitives, dashboards, charts, data visualization, and Conversation &
Agent UI. Selected components retain documented Web Awesome-compatible public names under a `lr-`
prefix to make migration easier, but Lyra has its own implementation, design tokens, localization
runtime, RTL behavior, and release surface. It has no runtime dependency on either project.

**This file is the whole catalog concatenated — several hundred thousand tokens.**
Read it end to end only if you genuinely need everything. Otherwise:

| To… | Read |
|---|---|
| use one component | `llms/components/<tag>.md` (path derived from the tag; a sibling-documented tag points to its primary file) |
| find the right component | `llms/index.md` (every tag, its import path, one-line purpose) |
| get library-wide behavior right | `llms/shared.md` (status, imports/autoloading, events, forms, theming/styles, i18n/RTL, TS/frameworks, SSR, utilities, AI types) |
| theme it | `llms/tokens.md` |
| opt into native CSS or utility classes | `llms/shared/native-styles-and-utilities.md` |
| know what to `npm install` | `llms/peers.md` |
| port `wa-*`/`sl-*` markup | `llms/migration.md` (per-tag classification, safe rewrites, and warnings) |
| upgrade Lyra v23 to v24 | `llms/shared/v23-to-v24-migration.md` (routes, styling, SSR and event details) |

Prefer stable tag-shaped registration imports such as
`@aceshooting/lyra-ui/components/lr-input.js`; each registers its tag as a side effect without
coupling application code to Lyra's source-family layout. The former duplicate nested registration
paths are removed in v24. Class-only and helper modules retain their owning family paths; a
`.class.js` module exports a class without registering it.
