# @aceshooting/lyra-ui — LLM API Reference

`@aceshooting/lyra-ui` is a free, independent, MIT-licensed [Lit](https://lit.dev) web-component
library and an open-source alternative to Shoelace and Web Awesome. It combines accessible form
controls, layout and overlay primitives, dashboards, charts, data visualization, and Conversation &
Agent UI. Selected components retain documented Web Awesome-compatible public names under a `lr-`
prefix to make migration easier, but Lyra has its own implementation, design tokens, localization
runtime, RTL behavior, and release surface. It has no runtime dependency on either project.

**This file is the whole catalog concatenated — 251 components, several hundred thousand tokens.**
Read it end to end only if you genuinely need everything. Otherwise:

| To… | Read |
|---|---|
| use one component | `llms/components/<tag>.md` (path derived from the tag; self-contained) |
| find the right component | `llms/index.md` (every tag, its import path, one-line purpose) |
| get library-wide behavior right | `llms/shared.md` (imports, events, forms, theming, i18n, TS, frameworks, SSR, AI types) |
| theme it | `llms/tokens.md` |
| know what to `npm install` | `llms/peers.md` |
| port `wa-*`/`sl-*` markup | `llms/migration.md` |

Import paths always carry the source family segment —
`@aceshooting/lyra-ui/components/<family>/<dir>/<file>.js`, never `components/<tag>/`. Each entry
registers its tag as a side effect; the sibling `.class.js` exports the class without registering.
