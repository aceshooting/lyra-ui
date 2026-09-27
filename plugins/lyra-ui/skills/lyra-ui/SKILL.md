---
name: lyra-ui
description: >
  Use when writing or reviewing code that imports @aceshooting/lyra-ui, uses any lr-* custom
  element, or migrates a project off Web Awesome (wa-*) or Shoelace (sl-*) components. Covers
  component APIs (attributes, slots, events, parts, CSS custom properties), design-token theming,
  localization, framework/TypeScript integration, and migration paths from wa-*/sl-* to lr-*.
---

# lyra-ui

`@aceshooting/lyra-ui` is a free, MIT-licensed, framework-agnostic Lit 3 web-component library — an
independent alternative to Shoelace and Web Awesome, with no runtime dependency on either. Its
custom elements use the `lr-` prefix and ship with design tokens, localization, RTL support and
(for form controls) native form association. The current element count and complete tag list live
in `references/index.md`; do not repeat a remembered count.

## Look up the exact API before writing any `lr-*` markup

Never infer attributes, slots, events, parts or CSS custom properties from memory, or from a
similarly-named component in another library. The reference is split so a lookup costs a few
hundred tokens:

| Need | Read |
|---|---|
| Which component to use / its import path | `references/index.md` |
| One component's full API | `references/components/<tag>.md` — path derived from the tag, no search needed |
| Library-wide behavior | `references/shared.md` |
| Design tokens | `references/tokens.md` |
| What to `npm install` | `references/peers.md` |
| `wa-*`/`sl-*` renames | `references/migration.md` |

Example: `<lr-table>` → `references/components/lr-table.md`. Each component file carries
its import path, optional peers, properties with types and defaults, events with payloads, slots,
CSS parts, themeable properties, a usage snippet and gotchas; a tag documented together with a
sibling points to that sibling's file for the shared prose.

**If the project already has lyra-ui installed, prefer its own copies** — the same files ship at
`node_modules/@aceshooting/lyra-ui/llms/`, matching the exact installed version, which may differ
from whatever this skill last shipped with.

If local package references are unavailable, use the public machine surfaces rather than guessing:

| Need | Public fallback |
|---|---|
| Search by intent, synonym, typo, or localized name | `GET https://www.lyra-ui.com/api/v1/components/search?q=<query>` |
| Exact component API | `GET https://www.lyra-ui.com/api/v1/components/<lr-tag>` |
| Search shared/component documentation | `GET https://www.lyra-ui.com/api/v1/documentation/search?q=<query>` |
| Resolve a Web Awesome/Shoelace tag | `GET https://www.lyra-ui.com/api/v1/migrations/<wa-or-sl-tag>` |
| Complete structured index | `https://www.lyra-ui.com/component-api-index.json` |

MCP clients can connect to `https://www.lyra-ui.com/mcp` (streamable HTTP, no authentication).
Use `search_components` to discover a tag, `get_component` to retrieve its exact API,
`search_documentation` for library-wide behavior, and `resolve_migration` for `wa-*`/`sl-*`
lookups. Equivalent resources are `lyra://catalog`, `lyra://component/{tag}`, and
`lyra://guide/{topic}`.

## Non-negotiable conventions

- **Prefer stable tag registration aliases.**
  `@aceshooting/lyra-ui/components/<lr-tag>.js` stays valid if the component's internal family
  folder moves; `references/index.md` has the exact path for every tag. Class-only `.class.js`
  entries keep their owning family path.

  ```js
  import '@aceshooting/lyra-ui/components/lr-combobox.js';
  ```
  ```html
  <lr-combobox label="Fruit"></lr-combobox>
  ```

  `import '@aceshooting/lyra-ui';` is registration-free in v8. `all.js` gives the explicit
  compatibility registration set — prefer per-component entries in application code — and omits
  the 16 peer-gated tags (the chart family, `lr-map`, `lr-graph`, `lr-knowledge-graph-explorer`,
  `lr-geojson-view`, `lr-geojson-viewer`).

- **Theme only through `--lr-theme-*` custom properties.** Never hardcode a color, spacing or font
  value that fights the token system; override the relevant `--lr-theme-*` property on any ancestor
  instead. `references/tokens.md` is the full catalog — look the name up, don't invent it.
  `@aceshooting/lyra-ui/theme.css` is an optional ready-made light/dark base.

- **Lyra-specific events are `lr-*`-prefixed `CustomEvent`s** (`lr-change`, `lr-input`, …),
  bubbling and composed, with payload on `event.detail`; they are non-cancelable unless the
  component's own section says otherwise. Native wrappers may also relay the native `Event`,
  `InputEvent`, and `FocusEvent` contracts explicitly listed for that component. Don't assume an
  unlisted native DOM event name works.

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

`references/migration.md` holds `wa-*`/`sl-*` mappings, import rewrites, classifications and
warnings. Determine each occurrence's actual source ecosystem and installed version — coinstalling
both doesn't change either one's provenance. Apply only verified automatic mappings and their
documented rewrites; manual/warning-required cases (`*-include` sanitization/same-origin
differences in both ecosystems, Shoelace alert lifecycle timing and cancellation) need their
stated follow-up. Coverage of a tag is not a blanket automatic-rewrite guarantee.

Read `references/components/<tag>.md` for the target's actual contract. Lyra combobox accepts both
`clearable` and `with-clear`. A tag absent from the tables has no documented counterpart — check
`references/index.md` for one covering the same need.

`/lyra-ui:migrate` performs verified rewrites and reports manual/unresolved occurrences (both
ecosystems are best-effort). `/lyra-ui:review` audits a whole consumer project: fixes local misuse
and every workaround the installed version already covers, files genuine gaps upstream with the
user's consent, and keeps a request ledger so a later run can close each item out. `/lyra-ui:update`
bumps the dependency and reports the changelog.

## Report gaps, bugs, and improvement ideas on a user's behalf

Found something lyra-ui doesn't cover, does wrong, or could do better? Read
[reporting.md](reporting.md) for the naming-mismatch check, the feature-request API and payload,
and the response format. **Always get the user's explicit agreement before filing** — never as a
side effect of noticing something — and never include source, file paths, or product/client names.
