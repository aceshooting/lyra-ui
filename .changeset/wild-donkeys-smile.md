---
"@aceshooting/lyra-ui": minor
---

Restructure the AI-agent-facing reference so a component lookup costs a few hundred tokens instead
of the whole catalog, and close the gaps that made it unreliable.

**New published layout.** `llms/index.md` maps every tag to its import path and one-line purpose;
`llms/components/<tag>.md` is a self-contained per-component reference addressed directly from the
tag name; `llms/shared.md`, `llms/tokens.md`, `llms/peers.md` and `llms/migration.md` carry the
library-wide contracts. `llms.txt` is now the entry index over all of it, and `llms-full.txt` keeps
its role as the single-file concatenation. Everything is generated from per-family authored sources
by `pnpm run llms` and diffed in CI, so the docs cannot drift from `custom-elements.json`.

**Corrected documentation that was wrong, not merely missing:**

- Import paths in the docs had not been updated for the family directory layout —
  `components/combobox/combobox.js` does not resolve; it is
  `components/forms/combobox/combobox.js`. CI now fails on any documented path that has no source
  module.
- 26 components were documented twice with divergent content; the freshness check validated the
  weaker copy.
- `lr-include` was documented with the wrong purpose, property semantics, event name and CSS parts.
- Wrong or non-existent CSS parts on `lr-timeline`/`lr-timeline-item`, `lr-tour`, `lr-known-date`,
  `lr-random-content`, `lr-avatar-group`, `lr-breadcrumb`, `lr-swatch-picker`.
- `lr-button` was missing the `quiet` appearance and the `2xs` size; `lr-attachment-trigger` was
  missing the `audio` capability; `lr-avatar` was documented as having no slots.
- `lr-widget` event details are objects, not scalars; three overlay-color tokens do resolve to
  `var(--lr-color-overlay)`; `lr-histogram`'s `label` default is localized, not `'Frequency'`.
- The root barrel skips 15 peer-gated tags, not 13 — `lr-knowledge-graph-explorer` and
  `lr-geojson-view` were undocumented omissions.

**Newly documented:** the `@aceshooting/lyra-ui/ai` provider-neutral data types, the `locale` and
`strings` properties present on every element, the localization API surface
(`setLyraLocale`/`getLyraLocale`/`resolveLyraString`/`LYRA_DEFAULT_STRINGS` and its 996 message
keys), the full design-token catalog, framework integration (React/Vue/Angular/Svelte property and
event binding), TypeScript usage (the 127 `Lyra*EventMap` types, the typed `addEventListener`,
`HTMLElementTagNameMap`), SSR/declarative-shadow-DOM status, the component-to-peer-dependency table,
editor tooling metadata, and `<lr-map>`'s OpenStreetMap demo-tile-server production hazard.

The freshness check now covers events, slots, CSS parts and themeable custom properties in addition
to properties — it previously only checked properties, which is how 87 public names came to be
documented nowhere.
