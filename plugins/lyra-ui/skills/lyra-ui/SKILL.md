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

## New application defaults

For a new application, apply the [Lyra signature starter](references/shared/styles-and-tokens.md#lyra-signature-starter)
unless explicit project branding or the user's choices override it: Shadcn look, glass surfaces,
Emerald accent, theme-aware spotlights, compact single-row gemstones, and separate 44px gemstone,
mode, design, and country-flag language controls. Language menus retain flags and readable localized
names. Read the recipe before implementing startup and persistence; prefer the installed package's
matching guide. Preserve valid saved style and locale choices. This recommendation changes no
library defaults and grants no permission to retheme an existing application.

## Look up the exact API before writing any `lr-*` markup

Never infer attributes, slots, events, parts or CSS custom properties from memory, or from a
similarly-named component in another library. Read the component and shared guides needed for the
task:

| Need | Read |
|---|---|
| Find a component by need | Search `references/index.md` for the relevant family or term |
| Known tag's full API and import | `references/components/<tag>.md` — derive the path from the tag, skipping the index |
| Imports, registration, events, forms, styling, localization, frameworks, AI, or utilities | The matching focused `references/shared/<topic>.md` guide below |
| Design tokens | `references/tokens.md` |
| Native light-DOM CSS, typography and utility classes | `references/shared/native-styles-and-utilities.md` |
| What to `npm install` | `references/peers.md` |
| One `wa-*`/`sl-*` tag | Search for that tag's section in `references/migration.md`; read the applicable mapping and warning |
| Lyra v23 → v24 project upgrade | `references/shared/v23-to-v24-migration.md` |

Focused `references/shared/` files: `imports-and-registration.md`, `v23-to-v24-migration.md`,
`events-and-types.md`, `forms-and-accessibility.md`, `styles-and-tokens.md`,
`native-styles-and-utilities.md`,
`localization-and-rtl.md`, `frameworks-and-ssr.md`, `ai-and-peers.md`, and
`testing-and-utilities.md`. `references/shared.md` remains an aggregate for tools that require a
single compatibility document.

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

  `import '@aceshooting/lyra-ui';` is registration-free. `all.js` gives the explicit
  compatibility registration set — prefer per-component entries in application code — and omits
  the 15 peer-gated tags (the chart family, `lr-map`, `lr-graph`, `lr-knowledge-graph-explorer`,
  `lr-geojson-viewer`).

- **Use documented style axes and tokens.** Compose look, surface, density, mode and accent through
  the style API or scope attributes; customize with the documented `--lr-theme-*` inputs.
  `references/shared/styles-and-tokens.md` explains the API and `references/tokens.md` lists exact
  tokens. `@aceshooting/lyra-ui/theme.css` is an optional light/dark base.

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

`references/migration.md` holds `wa-*`/`sl-*` mappings, import rewrites and warnings. Determine
each occurrence's source ecosystem and installed version. Apply verified automatic mappings;
review warnings and semantic differences in context. A mapped tag does not guarantee a safe
automatic rewrite.

Some deprecated Lyra spellings remain supported while the mirrored upstream still publishes them;
their `removalNotBefore` floor is not an automatic removal date. Prefer the current Lyra spelling
for new code and see `references/migration.md` for the exact protected list. In particular,
`lr-icon`'s `autoWidth` is only a CSS-level alias for `canvas="auto"`; explicit `canvas` wins, so
review selector reach before changing `[auto-width]` rules. Do not blanket-rewrite these aliases.

Read `references/components/<tag>.md` for the target contract. Lyra combobox accepts both
`clearable` and `with-clear`; a tag absent from the tables has no documented counterpart. For a
Lyra v23 → v24 upgrade, use `references/shared/v23-to-v24-migration.md` for the route, style, SSR
and event-detail changes.

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
