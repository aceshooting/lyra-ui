---
name: lyra-ui
description: >
  Use when writing or reviewing code that imports @aceshooting/lyra-ui (or its lyra-docs,
  lyra-flags, lyra-map, lyra-translations, lyra-ide and lyra-gen companions), uses any lr-* custom element, or
  migrates a project off Web Awesome (wa-*) or Shoelace (sl-*). Covers exact component APIs
  (attributes, slots, events, parts, CSS custom properties), design-token theming, localization,
  framework/TypeScript integration, and wa-*/sl-* to lr-* migration.
---

# lyra-ui

`@aceshooting/lyra-ui` is a free, MIT-licensed, framework-agnostic Lit 3 web-component library, an
independent alternative to Shoelace and Web Awesome with no runtime dependency on either. Elements
use the `lr-` prefix and ship design tokens, localization, RTL support and native form association.
The tag count and full tag list live in `node_modules/@aceshooting/lyra-ui/llms/index.md`; never repeat a remembered count.

## Look up the exact API before writing any `lr-*` markup

Never infer attributes, slots, events, parts or CSS custom properties from memory or from a
similarly named component in another library.

| Need | Read |
|---|---|
| Find a component by need | Search `node_modules/@aceshooting/lyra-ui/llms/index.md` |
| A known tag's full API and import | `node_modules/@aceshooting/lyra-ui/llms/components/<tag>.md` (path derived from the tag, e.g. `lr-table`) |
| Imports, registration, events, forms, styling, localization, frameworks, AI, utilities, testing | The matching `node_modules/@aceshooting/lyra-ui/llms/shared/<topic>.md` (`imports-and-registration.md`, `events-and-types.md`, `forms-and-accessibility.md`, `styles-and-tokens.md`, `native-styles-and-utilities.md`, `localization-and-rtl.md`, `frameworks-and-ssr.md`, `ai-and-peers.md`, `testing-and-utilities.md`) |
| Design tokens | `node_modules/@aceshooting/lyra-ui/llms/tokens.md` |
| What to install (optional peers) | `node_modules/@aceshooting/lyra-ui/llms/peers.md` |
| One `wa-*`/`sl-*` tag | That tag's section in `node_modules/@aceshooting/lyra-ui/llms/migration.md` |
| Lyra v23 to v24 upgrade | `node_modules/@aceshooting/lyra-ui/llms/shared/v23-to-v24-migration.md` |
| Lyra v29 to v30 upgrade | `node_modules/@aceshooting/lyra-ui/llms/shared/v29-to-v30-migration.md` |
| Any other version upgrade | `CHANGELOG.md` of the package (current major; it links older history) |

Each component file carries its import path, optional peers, properties with types and defaults,
events with payloads, slots, CSS parts, themeable properties, a usage snippet and gotchas.

Without local references, use the public HTTP and MCP surfaces in [online-api.md](online-api.md)
instead of guessing.

## Non-negotiable conventions

- **Register through stable tag-shaped paths**, one per rendered tag:
  `import '@aceshooting/lyra-ui/components/lr-combobox.js';`. `import '@aceshooting/lyra-ui'` is
  registration-free. `all.js` is a compatibility set (prefer per-component entries in applications)
  and omits the optional-peer tags (charts, `lr-map`, `lr-graph`, `lr-knowledge-graph-explorer`,
  `lr-geojson-viewer`; full list in `node_modules/@aceshooting/lyra-ui/llms/shared/imports-and-registration.md`), which always
  need their own import. Class-only `.class.js` entries keep
  their family path; `node_modules/@aceshooting/lyra-ui/llms/index.md` lists every exact path.
- **Use the style API and `--lr-theme-*` inputs**, never ad-hoc values: look, surface, density, mode
  and accent compose through the style API or scope attributes
  (`node_modules/@aceshooting/lyra-ui/llms/shared/styles-and-tokens.md`, exact tokens in `node_modules/@aceshooting/lyra-ui/llms/tokens.md`).
  `@aceshooting/lyra-ui/theme.css` supplies the document-level default profile.
- **Events are `lr-*`-prefixed, bubbling, composed `CustomEvent`s** with payload on `event.detail`,
  non-cancelable unless the component says otherwise. Native wrappers also relay only the native
  events their section lists; do not assume an unlisted native event works.
- **Complex values need property bindings**, not attributes (an object attribute becomes
  `[object Object]`): Lit `.rows=${rows}`, Vue `:rows.prop`, Angular `[rows]`, React 19+ natively,
  older React via a ref.
- **Form controls are form-associated** (native submit and validation, no wiring). Read
  `effectiveDisabled`, not `disabled`, for the state merged with an ancestor `<fieldset disabled>`.
- **Localize component chrome separately from content.** Use documented keys through `.strings`
  or `registerLyraLocale()`; preserve caller/slotted data. Locale imports register catalogs but do
  not select them: use `setLyraLocale()` or inherited `lang`/`locale`, and apply `dir` explicitly.
  Read `node_modules/@aceshooting/lyra-ui/llms/shared/localization-and-rtl.md` for precedence and document bridging.

## Appearance defaults

The built-in profile is Shadcn look, Glass surface, Emerald accent, System mode, comfortable
density. Preserve saved style/locale choices and explicit project branding; restyle an existing app
only inside an authorized migration or redesign. To keep the pre-default look select
`look: 'lyra'`, `surface: 'solid'`, `accent: null` explicitly (`accent: null` clears;
`resetLyraStyle()` restores Emerald). Read the
[Lyra signature starter](node_modules/@aceshooting/lyra-ui/llms/shared/styles-and-tokens.md#lyra-signature-starter) before
changing startup or persistence.

## Companion packages

Install `@aceshooting/lyra-ide` and `@aceshooting/lyra-translations` at the same version as
`@aceshooting/lyra-ui`. `@aceshooting/lyra-flags`, `@aceshooting/lyra-docs`, and `@aceshooting/lyra-map` are versioned
independently; choose releases compatible with the installed packages and their declared peer ranges.

- **`@aceshooting/lyra-translations`** (optional peer): side-effect-only core locale catalogs at
  `@aceshooting/lyra-translations/<locale>.js` or `<locale>/<family>.js` (include shared keys when
  using slices). Lazy loading uses `loadLyraLocale()` from `@aceshooting/lyra-ui/locale-loader.js`.
  The conversation slice includes Gen's seven `genView*` renderer messages; generated prose stays
  caller content. English is built into Lyra UI; pseudo locales stay under its `translations/pseudo/` path. Read
  `@aceshooting/lyra-ui/locales.json` for exact imports and coverage; coverage is not linguistic
  review. Companion-specific and application text retain their own message ownership.
- **`@aceshooting/lyra-ide`** (dev dependency): editor data (`custom-elements.json`,
  `web-types.json`, `vscode-html-data.json`, `vscode-css-data.json`); setup in
  `node_modules/@aceshooting/lyra-ui/llms/shared/testing-and-utilities.md`.
- **`@aceshooting/lyra-flags`** (optional peer): assets for `<lr-flag>`. Read
  `node_modules/@aceshooting/lyra-ui/llms/components/lr-flag.md`; for direct asset loading read the installed package README.
- **`@aceshooting/lyra-docs`**: experimental `<lr-docx-editor>`; read its installed README for the
  bundled engine, registration, stylesheet imports, async editing commands, save receipts and limits. Core document viewers
  stay in `node_modules/@aceshooting/lyra-ui/llms/components/`.
- **`@aceshooting/lyra-gen`**: independently versioned experimental generated views and saved
  dashboards. Read [lyra-gen.md](lyra-gen.md) for boundary, validation, authority and locale ownership,
  then the installed companion guide for the task. Its view format differs from widget-v2;
  a roadmap or adapter does not establish released support or protocol conformance.
- **`@aceshooting/lyra-map`** (optional peer): the default modular renderer for `<lr-map>`. Configure
  `lyraMapWorkerPlugin()` from `@aceshooting/lyra-map/vite`, or supply a compatible worker URL.
  Read `node_modules/@aceshooting/lyra-ui/llms/components/lr-map.md` and the companion README before imperative map mutations:
  new feature families require awaiting `map.prepareFeatures()`. Explicit `engine="maplibre"`
  retains the separate native `maplibre-gl` peer and its worker setup.

Tests under Happy DOM: call `installHappyDomShims()` from `@aceshooting/lyra-ui/testing` in the
setup file instead of local patches (details in `node_modules/@aceshooting/lyra-ui/llms/shared/testing-and-utilities.md`).

## Migrating from Web Awesome or Shoelace

Mappings, import rewrites and warnings: `node_modules/@aceshooting/lyra-ui/llms/migration.md`; procedure: `/lyra-ui:migrate`.
The combobox accepts both `clearable` and `with-clear`. The retired `lr-icon` `autoWidth` /
`auto-width` spelling uses `canvas="auto"` instead; preserve an explicit `canvas` value and review
dynamic boolean bindings. Follow the v29 to v30 guide for the other retired compatibility names.

## Workflows

Commands (`commands/*.md` beside this skill; `/lyra-ui:<name>` in the plugin): migrate, review,
frontend, new-component, update. Each file states its procedure.

For page and interface design use the sibling `compose-lyra-interfaces` skill.

## Report gaps and bugs on a user's behalf

For a missing component, capability, bug or improvement idea, read [reporting.md](reporting.md)
(naming-mismatch check, payload, classification). **Always get the user's explicit agreement before
filing**, never as a side effect of noticing something, and never include source, file paths or
product/client names.
