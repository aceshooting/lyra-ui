---
name: lyra-ui
description: >
  Use when writing or reviewing code that imports @aceshooting/lyra-ui, uses any lr-* custom
  element, or migrates a project off Web Awesome (wa-*) or Shoelace (sl-*) components. Covers
  component APIs (attributes, slots, events, parts, CSS custom properties), design-token theming,
  localization, framework/TypeScript integration, and the wa-*/sl-* -> lr-* migration paths.
---

# lyra-ui

`@aceshooting/lyra-ui` is a free, MIT-licensed, framework-agnostic Lit 3 web-component library — an
independent alternative to Shoelace and Web Awesome. 249 custom elements under the `lr-` prefix,
each shipping its own design tokens, localization, RTL support and (for form controls) native form
association. No runtime dependency on Shoelace or Web Awesome.

## Look up the exact API before writing any `lr-*` markup

Never infer a component's attributes, slots, events, parts or CSS custom properties from memory, or
from a similarly-named component in another library. The reference is split so a lookup costs a few
hundred tokens:

| Need | Read |
|---|---|
| Which component to use / its import path | `references/index.md` |
| One component's full API | `references/components/<tag>.md` — path derived from the tag, no search needed |
| Library-wide behavior | `references/shared.md` |
| Design tokens | `references/tokens.md` |
| What to `npm install` | `references/peers.md` |
| `wa-*`/`sl-*` renames | `references/migration.md` |

So for `<lr-table>`: read `references/components/lr-table.md`. Each component file is
self-contained — import path, optional peers, properties with types and defaults, events with
payloads, slots, CSS parts, themeable properties, a usage snippet and known gotchas.

**If the project already has lyra-ui installed, prefer its own copies**: the same files ship inside
the package at `node_modules/@aceshooting/lyra-ui/llms/`. They match the exact installed version,
which may differ from whatever this skill last shipped with.

## Non-negotiable conventions

- **Import paths carry the family segment.** `@aceshooting/lyra-ui/components/<family>/<dir>/<file>.js`
  — for example `components/forms/combobox/combobox.js`, **never** `components/combobox/combobox.js`.
  A missing family segment is a hard module-resolution error. `references/index.md` has the exact
  path for every tag; the sibling `.class.js` gives the class without registering the tag.

  ```js
  import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js';
  ```
  ```html
  <lr-combobox label="Fruit"></lr-combobox>
  ```

  `import '@aceshooting/lyra-ui';` pulls everything except the 15 peer-gated tags (the chart family,
  `lr-map`, `lr-graph`, `lr-knowledge-graph-explorer`, `lr-geojson-view`) and defeats tree-shaking —
  use per-component entries in application code.

- **Theme only through `--lr-theme-*` custom properties.** Never hardcode a color, spacing or font
  value that fights the token system; override the relevant `--lr-theme-*` property on any ancestor
  instead. `references/tokens.md` is the full catalog — look the name up, don't invent it.
  `@aceshooting/lyra-ui/theme.css` is an optional ready-made light/dark base.

- **Events are `lr-*`-prefixed `CustomEvent`s** (`lr-change`, `lr-input`, …), bubbling and composed,
  payload on `event.detail`, non-cancelable unless the component's own section says otherwise. Don't
  assume a native DOM event name works.

- **Complex values need property bindings, not attributes.** An object set as an attribute
  stringifies to `[object Object]`. Lit `.rows=${rows}`, Vue `:rows.prop`, Angular `[rows]`,
  React 19+ natively, earlier React via a ref.

- **Form controls are form-associated** — they participate in native `<form>` submission and
  validation with no extra wiring. Read `effectiveDisabled`, not `disabled`, for the state merged
  with an ancestor `<fieldset disabled>`.

- **Every built-in string is localizable.** Components accept a per-instance `.strings` override or
  an app-wide catalog via `registerLyraLocale()`; don't assume built-in text is hardcoded English,
  and don't hand-translate by overwriting slotted content.

## Migrating from Web Awesome or Shoelace

`references/migration.md` holds the generated `wa-*` → `lr-*` and `sl-*` → `lr-*` tables plus the
import-specifier rewrites. For a mirrored component the migration is a mechanical tag/import rename;
intentional differences are called out in that component's own `references/components/<tag>.md`
section (for example, Lyra's combobox uses `with-clear` where Web Awesome uses `clearable`). A tag
absent from the tables has no documented counterpart — check `references/index.md` for a Lyra
component covering the same job under a different name.

Run `/lyra-ui:migrate-from-wa` or `/lyra-ui:migrate-from-shoelace` to apply the rename across a
project automatically, or `/lyra-ui:update-lyra` for the broader periodic audit (bump to latest,
sweep for remaining `wa-*`/hand-rolled UI, migrate what's adoptable, file genuine gaps upstream).
