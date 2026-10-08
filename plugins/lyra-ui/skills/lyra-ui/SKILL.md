---
name: lyra-ui
description: >
  Use when writing or reviewing code that imports @aceshooting/lyra-ui (or its lyra-docs,
  lyra-flags, lyra-translations and lyra-ide companions), uses any lr-* custom element, or
  migrates a project off Web Awesome (wa-*) or Shoelace (sl-*). Covers exact component APIs
  (attributes, slots, events, parts, CSS custom properties), design-token theming, localization,
  framework/TypeScript integration, and wa-*/sl-* to lr-* migration.
---

# lyra-ui

`@aceshooting/lyra-ui` is a free, MIT-licensed, framework-agnostic Lit 3 web-component library, an
independent alternative to Shoelace and Web Awesome with no runtime dependency on either. Elements
use the `lr-` prefix and ship design tokens, localization, RTL support and native form association.
The tag count and full tag list live in `references/index.md`; never repeat a remembered count.

<!-- plugin-only:start -->
AI coding agents: run `npx lyra-ui init-agents` (add `--agent <name>` if not auto-detected) to install
this skill for yourself at the installed package's own version; it prints what to do so your agent
loads it. Humans: `npm i @aceshooting/lyra-ui && npx lyra-ui init-agents` (a terminal prompts for agents).
<!-- plugin-only:end -->

## Look up the exact API before writing any `lr-*` markup

Never infer attributes, slots, events, parts or CSS custom properties from memory or from a
similarly named component in another library.

| Need | Read |
|---|---|
| Find a component by need | Search `references/index.md` |
| A known tag's full API and import | `references/components/<tag>.md` (path derived from the tag, e.g. `lr-table`) |
| Imports, registration, events, forms, styling, localization, frameworks, AI, utilities, testing | The matching `references/shared/<topic>.md` (`imports-and-registration.md`, `events-and-types.md`, `forms-and-accessibility.md`, `styles-and-tokens.md`, `native-styles-and-utilities.md`, `localization-and-rtl.md`, `frameworks-and-ssr.md`, `ai-and-peers.md`, `testing-and-utilities.md`) |
| Design tokens | `references/tokens.md` |
| What to install (optional peers) | `references/peers.md` |
| One `wa-*`/`sl-*` tag | That tag's section in `references/migration.md` |
| Lyra v23 to v24 upgrade | `references/shared/v23-to-v24-migration.md` |
| Any other version upgrade | `CHANGELOG.md` of the package (current major; it links older history) |

Each component file carries its import path, optional peers, properties with types and defaults,
events with payloads, slots, CSS parts, themeable properties, a usage snippet and gotchas.

<!-- plugin-only:start -->
If the project has lyra-ui installed, prefer `node_modules/@aceshooting/lyra-ui/llms/`: the same
files at the exact installed version, which may differ from this plugin's copy.
<!-- plugin-only:end -->

Without local references, use the public surfaces instead of guessing:

| Need | Public fallback |
|---|---|
| Search by intent, synonym or typo | `GET https://www.lyra-ui.com/api/v1/components/search?q=<query>` |
| Exact component API | `GET https://www.lyra-ui.com/api/v1/components/<lr-tag>` |
| Shared documentation search | `GET https://www.lyra-ui.com/api/v1/documentation/search?q=<query>` |
| Resolve a `wa-*`/`sl-*` tag | `GET https://www.lyra-ui.com/api/v1/migrations/<tag>` |
| Structured index | `https://www.lyra-ui.com/component-api-index.json` |

MCP clients can connect to `https://www.lyra-ui.com/mcp` (streamable HTTP, no authentication):
`search_components`, `get_component`, `search_documentation`, `resolve_migration`; resources
`lyra://catalog`, `lyra://component/{tag}`, `lyra://guide/{topic}`.

## Non-negotiable conventions

- **Register through stable tag-shaped paths**, one per rendered tag:
  `import '@aceshooting/lyra-ui/components/lr-combobox.js';`. `import '@aceshooting/lyra-ui'` is
  registration-free. `all.js` is a compatibility set (prefer per-component entries in applications)
  and omits the 15 optional-peer tags (charts, `lr-map`, `lr-graph`, `lr-knowledge-graph-explorer`,
  `lr-geojson-viewer`), which always need their own import. Class-only `.class.js` entries keep
  their family path; `references/index.md` lists every exact path.
- **Use the style API and `--lr-theme-*` inputs**, never ad-hoc values: look, surface, density, mode
  and accent compose through the style API or scope attributes
  (`references/shared/styles-and-tokens.md`, exact tokens in `references/tokens.md`).
  `@aceshooting/lyra-ui/theme.css` supplies the document-level default profile.
- **Events are `lr-*`-prefixed, bubbling, composed `CustomEvent`s** with payload on `event.detail`,
  non-cancelable unless the component says otherwise. Native wrappers also relay only the native
  events their section lists; do not assume an unlisted native event works.
- **Complex values need property bindings**, not attributes (an object attribute becomes
  `[object Object]`): Lit `.rows=${rows}`, Vue `:rows.prop`, Angular `[rows]`, React 19+ natively,
  older React via a ref.
- **Form controls are form-associated** (native submit and validation, no wiring). Read
  `effectiveDisabled`, not `disabled`, for the state merged with an ancestor `<fieldset disabled>`.
- **Every built-in string is localizable** through a per-instance `.strings` override or an app-wide
  catalog via `registerLyraLocale()`; never overwrite slotted content to translate. Locale does not
  set writing direction: inherit an explicit `dir="rtl"`.

## Appearance defaults

The built-in profile is Shadcn look, Glass surface, Emerald accent, System mode, comfortable
density. Preserve saved style/locale choices and explicit project branding; restyle an existing app
only inside an authorized migration or redesign. To keep the pre-default look select
`look: 'lyra'`, `surface: 'solid'`, `accent: null` explicitly (`accent: null` clears;
`resetLyraStyle()` restores Emerald). For optional spotlights, gemstones and the 44px
gemstone/mode/design/flag-language controls follow the
[Lyra signature starter](references/shared/styles-and-tokens.md#lyra-signature-starter), which owns
the exact recipe, labels and persistence; read it before changing startup or persistence.

## Companion packages

Install each at the same version as `@aceshooting/lyra-ui`.

- **`@aceshooting/lyra-translations`** (optional peer): the 66 locale catalogs. Import
  `@aceshooting/lyra-translations/<locale>.js` (or `<locale>/<family>.js` slices); it is also what
  `loadLyraLocale()` from `@aceshooting/lyra-ui/locale-loader.js` imports. Only the pseudo-locales
  stay under `@aceshooting/lyra-ui/translations/pseudo/`. The old
  `@aceshooting/lyra-ui/translations/<locale>.js` path no longer exists.
- **`@aceshooting/lyra-ide`** (dev dependency): `custom-elements.json`, `web-types.json`,
  `vscode-html-data.json`, `vscode-css-data.json`. Point editor settings and manifest imports there;
  `@aceshooting/lyra-ui` no longer exports `custom-elements.json`.
- **`@aceshooting/lyra-flags`** (optional peer): assets for `<lr-flag>`. Read
  `references/components/lr-flag.md`; for direct asset loading read the installed package README.
- **`@aceshooting/lyra-docs`**: experimental `<lr-docx-editor>`; read its installed README for the
  optional peer, registration, stylesheet imports, save receipts and limits. Core document viewers
  stay in `references/components/`.

Tests under Happy DOM: call `installHappyDomShims()` from `@aceshooting/lyra-ui/testing` in the
setup file instead of local patches (details in `references/shared/testing-and-utilities.md`).

## Upgrading to 27

Check these first when a project moves to 27.0.0 (the `CHANGELOG.md` has the complete notes):

- `ToolCallStatus` and `ToolResultStatus` became the single `ToolStatus` union.
- `heading-level` defaults to `none` on `lr-task-list`, `lr-prompt-studio` and `lr-result-card`;
  set `heading-level` explicitly to keep a semantic heading.
- Locale catalogs and editor data moved to the two companion packages above.
- `lr-copy-button` `feedbackDuration` defaults to 1500 ms.

## Migrating from Web Awesome or Shoelace

`references/migration.md` holds the `wa-*`/`sl-*` mappings, import rewrites and warnings. Resolve
each occurrence against the source ecosystem and installed version that supplied it; apply verified
automatic mappings, review warnings and semantic differences in context. A mapped tag is not a
guaranteed lossless rename, and a tag absent from the tables has no documented counterpart. Some
deprecated Lyra spellings stay supported (`removalNotBefore` is a floor, not a removal date), such
as `clearable`/`with-clear` on the combobox and `lr-icon`'s `autoWidth` (a CSS-level alias of
`canvas="auto"`; an explicit `canvas` wins); do not blanket-rewrite them.

## Workflows

Slash commands in the plugin; in an `init-agents` install read the matching file in this skill's
`commands/` directory:

- `/lyra-ui:migrate` (`commands/migrate.md`): verified `wa-*`/`sl-*` rewrites plus a manual list.
- `/lyra-ui:review` (`commands/review.md`): whole-project audit, local fixes, upstream requests, ledger.
- `/lyra-ui:frontend` (`commands/frontend.md`): read-only review of how a project uses lyra-ui.
- `/lyra-ui:new-component` (`commands/new-component.md`): usage snippet from the real API.
- `/lyra-ui:update` (`commands/update.md`): bump the dependency and report the changelog.

For page and interface design use the sibling `compose-lyra-interfaces` skill.

## Report gaps and bugs on a user's behalf

For a missing component, capability, bug or improvement idea, read [reporting.md](reporting.md)
(naming-mismatch check, payload, classification). **Always get the user's explicit agreement before
filing**, never as a side effect of noticing something, and never include source, file paths or
product/client names.
