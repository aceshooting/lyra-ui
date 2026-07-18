---
name: lyra-ui
description: >
  Use when writing or reviewing code that imports @aceshooting/lyra-ui, uses any lr-* custom
  element, or migrates a project off Web Awesome (wa-*) or Shoelace (sl-*) components. Covers
  component APIs (attributes, slots, events, parts, CSS custom properties), design-token theming,
  and the wa-*/sl-* -> lr-* migration paths.
---

# lyra-ui

`@aceshooting/lyra-ui` is a free, MIT-licensed, framework-agnostic Lit 3 web-component library — an
independent alternative to Shoelace and Web Awesome. Every component is a plain custom element
under the `lr-` prefix, ships its own design tokens, localization, RTL support, and (for form
controls) native form association. It has no runtime dependency on Shoelace or Web Awesome.

## Install

```bash
npm install @aceshooting/lyra-ui
```

```js
import '@aceshooting/lyra-ui/components/combobox/combobox.js';
```

```html
<lr-combobox label="Fruit"></lr-combobox>
```

Each component is a separate side-effect import at
`@aceshooting/lyra-ui/components/<name>/<name>.js` — import only what's used, the library is fully
tree-shakeable.

## Where to look up a component's exact API

Never guess a `lr-*` component's attributes, slots, events, parts, or CSS custom properties from
memory or from a similarly-named Web Awesome/Shoelace/other-library component — verify against:

- **`references/llms.txt`** — short index: what the library is, the component catalog grouped by
  category, and pointers to deeper docs.
- **`references/llms-full.txt`** — the full reference: every component's properties, events,
  slots, CSS parts, themeable custom properties, optional peer dependencies, a usage snippet, and
  known gotchas. This is the primary source of truth for API details — read the specific
  component's section rather than skimming the whole file.

Both are generated, verbatim copies of the same files published inside the npm package itself
(`node_modules/@aceshooting/lyra-ui/llms.txt`/`llms-full.txt`) — if working inside a project that
already has lyra-ui installed, those installed copies are equally authoritative and reflect the
exact version in use, which may differ from whatever this skill last shipped with.

## Non-negotiable conventions

- **Theming only through `--lr-theme-*` custom properties.** Never hardcode a color, spacing, or
  font value in a way that fights the token system — override the relevant `--lr-theme-*`
  property at any ancestor instead. Every component works with zero configuration and rethemes
  fully from that one mechanism.
- **Events are `lr-*`-prefixed custom events** (e.g. `lr-change`, `lr-input`), except where a
  component deliberately mirrors a native event contract (documented per-component in
  `llms-full.txt`) — don't assume a native DOM event name works.
- **Form controls are form-associated** — they participate in native `<form>` submission/validation
  without extra wiring.
- **Every string is localizable** — components accept a per-instance `.strings` override or a
  registered locale; don't assume built-in UI text (labels, announcements) is hardcoded English.

## Migrating from Web Awesome or Shoelace

Selected components document a Web Awesome-compatible surface 1:1 under the `lr-` prefix — for
those, migration is a mechanical `wa-*` → `lr-*` tag/import rename (see the "Web Awesome mirror"
note in each component's `llms-full.txt` section for exactly which ones, and any intentional
differences). Shoelace users get a similar but best-effort `sl-*` → `lr-*` map, since Web Awesome
(not lyra-ui) is Shoelace's direct successor and the two don't always agree on naming.

Use `/lyra-ui:migrate-from-wa` or `/lyra-ui:migrate-from-shoelace` to run this rename across a
project automatically, or `/lyra-ui:update-lyra` for the broader periodic audit (bump to latest,
sweep for every remaining `wa-*`/hand-rolled-UI usage, migrate what's adoptable, file genuine gaps
upstream).
