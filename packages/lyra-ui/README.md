# Lyra UI: UI, made light 🪶 ✨

[![CI](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/aceshooting/lyra-ui/branch/main/graph/badge.svg)](https://codecov.io/gh/aceshooting/lyra-ui)
[![CodeQL](https://github.com/aceshooting/lyra-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/aceshooting/lyra-ui/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/aceshooting/lyra-ui/badge)](https://scorecard.dev/viewer/?uri=github.com/aceshooting/lyra-ui)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/13648/badge)](https://www.bestpractices.dev/projects/13648)
[![docs](https://img.shields.io/badge/docs-storybook-ff4785)](https://aceshooting.github.io/lyra-ui/)
[![website](https://img.shields.io/badge/website-lyra--ui.com-6366f1)](https://www.lyra-ui.com/)
[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![npm downloads](https://img.shields.io/npm/dm/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![npm weekly downloads](https://img.shields.io/npm/dw/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![Node.js](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.npmjs.org%2F%40aceshooting%2Flyra-ui%2Flatest&query=%24.engines.node&label=node&color=339933&logo=nodedotjs&logoColor=white)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![Lit](https://img.shields.io/badge/Lit-3-324FFF?logo=lit)](https://lit.dev/)
[![Web Components](https://img.shields.io/badge/Web%20Components-native-29ABE2)](https://www.webcomponents.org/)
[![avg per component](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.avgComponentGzipKb&label=avg%20per%20component&suffix=%20KB%20gzip&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![total gzip](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.barrelGzipKb&label=total%20gzip&suffix=%20KB&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![types](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/github/license/aceshooting/lyra-ui)](./LICENSE)

<p align="center">
  <a href="https://www.lyra-ui.com/">
    <img src="https://raw.githubusercontent.com/aceshooting/lyra-ui/main/.github/readme/lyra-mark.svg" width="112" height="112" alt="Lyra UI constellation logo" />
  </a>
</p>

**Lyra UI — the free, independent web-component alternative.** An MIT-licensed, framework-agnostic
library for accessible forms, dashboards, charts, data visualization, and AI chat/agent interfaces.
Built with [Lit](https://lit.dev), it works with Lit, React, Vue, Angular, Svelte, and plain JavaScript.
It is a practical open-source alternative to [Shoelace](https://shoelace.style/) and
[Web Awesome](https://webawesome.com/), with 308 custom elements, native custom-element APIs,
tree-shakeable, granular per-component imports, its own `--lr-*` design tokens, built-in localization and RTL support,
and no runtime dependency on either project.

> **Independent implementation.** Lyra is not affiliated with, endorsed by, or a fork or rebrand of
> Shoelace or Web Awesome. Selected Web Awesome-compatible components retain documented public names
> under the `lr-` prefix to make migration easier; component notes identify differences. Shoelace
> users get a separate `sl-*` migration map because the APIs are not identical. No competitor runtime,
> theme, token namespace, or source code is required by Lyra.

<a id="v21-highlights"></a>

## Highlights

- **Composable looks.** Lyra, shadcn, Material, data, terminal and high contrast combine with independent
  surface, density, mode and accent choices; the built-in profile is Shadcn/Glass/Emerald/System with
  comfortable density ([styling setup](./llms/shared/styles-and-tokens.md#composing-looks-surfaces-and-density),
  [signature starter](./llms/shared/styles-and-tokens.md#lyra-signature-starter)).
- **Conversation and agent UI.** Progressive [Markdown](./llms/components/lr-markdown.md) and expandable
  [tool-call blocks](./llms/components/lr-tool-call-block.md).
- **Languages and typography.** 66 optional catalogs in `@aceshooting/lyra-translations` plus built-in English
  ([`locales.json`](./locales.json), [import guide](./llms/shared/localization-and-rtl.md#ready-made-catalogs-aceshootinglyra-translationslocalejs)) and
  [typography utilities](./llms/shared.md#typography).

The [roadmap](../../docs/roadmap.md#roadmap-index-and-release-status) tracks upcoming work; the
[changelog](CHANGELOG.md) and [archive](../../docs/changelog) hold per-version changes and older upgrade notes.

## Upgrading to v23

Compatibility APIs deprecated before v22 were removed; use the [migration guide](./llms/migration.md) and the `lyra-v21` profile ([notes](../../docs/changelog/v23.md)).

## Upgrading to v24

Theme/preset facade, nested registration routes and `ssr-loader.js` were removed; follow the [v23-to-v24 guide](./llms/shared/v23-to-v24-migration.md) and run the CLI with `--origin=lyra-v22` ([notes](../../docs/changelog/v24.md)).

## Upgrading to v27

V27 is a major release; each change below has a migration note in the [changelog](CHANGELOG.md).

- **Package split.** Locale catalogs moved to [`@aceshooting/lyra-translations`](../lyra-translations)
  (`@aceshooting/lyra-ui/translations/<locale>.js` becomes `@aceshooting/lyra-translations/<locale>.js`; the
  pseudo-locales stay here) and editor data to [`@aceshooting/lyra-ide`](../lyra-ide)
  (the `custom-elements.json` export is now `@aceshooting/lyra-ide/custom-elements.json`). Install
  them at the same version; `loadLyraLocale()` needs `lyra-translations`.
- **Agent tools.** `ToolCallStatus` and `ToolResultStatus` are replaced by one `ToolStatus` union.
  `lr-task-list` and `lr-prompt-studio` default `heading-level` to `none`; set `3` / `2` to keep headings.
- **Copy controls** show feedback for 1500 ms; set `feedback-duration="1000"` on `lr-copy-button` to keep the old timing.
- **Text fields.** `lr-phone-input`'s string `autoCorrect` is now the boolean `autocorrect`.
- **Charts** over the row budget keep every series and thin only rows.

## Quick Start

**Use with AI coding agents.** AI coding agents: run `npx lyra-ui init-agents` (add `--agent <name>` if not auto-detected) to install the
Lyra UI skill for yourself; it prints the installed paths and the step that makes your agent load it
(add `--json` for machine-readable output).

Humans: install the package, then run it.

```bash
npm i @aceshooting/lyra-ui && npx lyra-ui init-agents
```

In a terminal it asks which agents (Claude Code, Codex, OpenCode, Cursor, Gemini CLI, GitHub Copilot, Amp,
Windsurf) to set up; agents and CI get the detected defaults. It installs the bundled `lyra-ui` and
`compose-lyra-interfaces` skills into the shared `.agents/skills/` plus a link for agents with their own
directory (Claude Code: `.claude/skills/`), as symlinks into `node_modules` so upgrades refresh them
(`--copy`, `--dry-run`, `--agents claude,opencode|all`, `--force`), and adds a short marked block to
`AGENTS.md` (and `CLAUDE.md` if present). Re-running is safe. Prefer a marketplace? `/plugin marketplace add
aceshooting/lyra-ui` then `/plugin install lyra-ui@aceshooting` (Claude Code), or `codex plugin marketplace
add aceshooting/lyra-ui` then `codex plugin add lyra-ui@aceshooting` (Codex).

## Install

```bash
npm install @aceshooting/lyra-ui
```

Lit and Floating UI install transitively; everything else is an optional peer, installed only for the components that need it (full map: [`llms/peers.md`](./llms/peers.md)): `@aceshooting/lyra-flags`
(`<lr-flag>`), `@aceshooting/lyra-translations` (non-English locales, `loadLyraLocale()`), `libphonenumber-js`
(`<lr-phone-input>` adapter; E.164 input works without it), `d3-force`/`d3-drag`/`d3-zoom`/`d3-selection`
(`<lr-graph>`), `chart.js` plus optional `chartjs-plugin-zoom`, `chartjs-plugin-datalabels` and
`@sgratzl/chartjs-chart-boxplot` (chart family), `mammoth` and `dompurify` (`<lr-docx-viewer>`), and
`maplibre-gl` v5 or v6 (`<lr-map>`).

`<lr-map>` requires an explicit `mapStyle` and never requests a third-party tile service implicitly. MapLibre v6
is ESM-only, needs WebGL2, and needs its worker URL set before the first map is built (Vite shown; other
bundlers: [MapLibre's ESM guide](https://maplibre.org/maplibre-gl-js/docs/#esm)):
`import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"; setWorkerUrl(workerUrl);`.

## Usage

Register components from granular entry points; the tag-shaped path is the canonical, stable import:

```js
import "@aceshooting/lyra-ui/components/lr-combobox.js";
import "@aceshooting/lyra-ui/components/lr-option.js";
```

```html
<lr-combobox label="Fruit" clearable>
  <lr-option value="a">Apple</lr-option>
  <lr-option value="b">Banana</lr-option>
</lr-combobox>
```

- **Class-only:** the registration-free `.class.js` entry (for example `components/overlays/empty/empty.class.js`) for subclassing.
- **Family entries** (`@aceshooting/lyra-ui/components/forms`, likewise `overlays`, `agent-tools`, `charts`,
  `conversation`, `data`, `layout`, `media`, `retrieval`, `utility`, `viewers`) register every tag in the family;
  they are side-effectful and cannot be tree-shaken, so prefer granular paths.
- **Everything:** `import "@aceshooting/lyra-ui/all.js"` registers 293 tags — every component **except** the 15 optional-peer
  tags (`<lr-chart>` and typed subclasses, `<lr-box-plot>`, `<lr-histogram>`, `<lr-map>`, `<lr-graph>`,
  `<lr-knowledge-graph-explorer>`, `<lr-geojson-viewer>`), which need their own subpath import.
  `<lr-flag>` with `country`/`language` also needs `@aceshooting/lyra-ui/components/media/flag/flag-peer.js` once.

> **Registration is explicit.** The package root is side-effect-free and exports helpers and types, not
> component classes; an unregistered tag stays inert even when the import and build succeed.

Full rules: [`llms/shared/imports-and-registration.md`](./llms/shared/imports-and-registration.md#importing-and-registering-components).

### Optional autoloader and CDN entry

For arbitrary server/CMS markup, the side-effect-free autoloader registers only known tags already present under
a root; optional-peer tags are skipped unless named in `optionalPeers`. Traversal is bounded and inert in Node.

Use `discover(document)` for one scan, or `start(document, { optionalPeers: ["dompurify"], events: true })` to scan and
then watch replacements (`stop()` ends it), from `@aceshooting/lyra-ui/autoloader.js`.

`autoloader-cdn.js` auto-starts for direct-browser use. Limits, events, `allDefined()`:
[`imports-and-registration.md`](./llms/shared/imports-and-registration.md#optional-autoloader).

### External modal interop

When a third-party modal opens above a Lyra dialog or drawer, suspend Lyra's modal ownership for that external
root with `suspendLyraModalsFor(root)` from `@aceshooting/lyra-ui/utilities/overlay-manager.js`. It returns a
release function (safe to call twice); the handle is document-scoped, nestable and released on disconnect.

## For AI agents / LLMs

[`llms.txt`](./llms.txt) is the entry index: [`llms/index.md`](./llms/index.md) routes a tag to its import path,
`llms/components/<tag>.md` is one component's API, `llms/shared/<topic>.md` (combined as
[`llms/shared.md`](./llms/shared.md)) covers cross-cutting topics, and [`llms/tokens.md`](./llms/tokens.md),
[`llms/peers.md`](./llms/peers.md) and [`llms/migration.md`](./llms/migration.md) cover tokens, optional peers and
`wa-*`/`sl-*` rules; `llms-full.txt` concatenates everything. Family files and `llms/shared/*.md` are authored, the rest
is generated by `pnpm run llms`. `npx lyra-ui init-agents` installs the bundled skills; the `lyra-ui@aceshooting`
marketplace plugin ships the same content. Contributing to this repo? See
[`AGENTS.md`](https://github.com/aceshooting/lyra-ui/blob/main/AGENTS.md).

## Migrating from Web Awesome or Shoelace

The "Mirrors" column in [Components](#components) records a design/API relationship, not permission to rename a
tag blindly. Every pinned Web Awesome and Shoelace component has a machine-readable classification (`exact`,
`rewritten`, `warning-required`, `conceptual-only`, `unsupported`); only `exact` and fully specified `rewritten`
mappings change automatically, the rest are reported with their source location ([`llms/migration.md`](./llms/migration.md)).

- Where upstreams disagree on a name, Lyra accepts both and deprecates neither (`with-clear` and `clearable` both
  work on `<lr-input>`, `<lr-select>`, `<lr-combobox>`); `autocorrect` always reads as a boolean.
- Icon tags rename mechanically, icon names do not: the default library has only `add`, `check`, `close`,
  `search`, `menu`, `chevron-left`, `chevron-right`, `chevron-down`, `calendar`, `command` and `trash`; other
  names render nothing (`BEHAVIOR_REVIEW_REQUIRED`). Use `registerIconLibrary('default', { resolver })`.
- `lr-option`: the `selected` attribute initializes `defaultSelected` (the reset default); `selected` is
  property-only live state.

The version-matched `lyra-ui-migrate` CLI applies only contract-recorded rewrites and writes a JSON report;
replace `<version>` with the Lyra version you are migrating to:

```bash
npx --package @aceshooting/lyra-ui@<version> lyra-ui-migrate --check \
  --report=migration.json path/to/your/src
npx --package @aceshooting/lyra-ui@<version> lyra-ui-migrate path/to/your/src
```

It understands `@awesome.me/webawesome`, `@awesome.me/webawesome-pro` and `@shoelace-style/shoelace`, scans HTML, CSS,
JS/TS, JSX, Vue, Svelte, MDX and Markdown, and is byte-idempotent; `--check` never writes and exits nonzero while a
rewrite or warning remains. Ambiguous cases stay unchanged with an actionable warning (for example
`REGISTRATION_CLOSURE_REQUIRED`, `OPTIONAL_PEER_REQUIRED`). Behavior profiles are not manual assistive-technology
review ([accessibility evidence](https://github.com/aceshooting/lyra-ui/blob/main/docs/accessibility.md)).

The Shoelace table is a porting guide, not an automatic-rename allowlist:

| Shoelace | Lyra | Migration note |
| --- | --- | --- |
| `<sl-button>` | `<lr-button>` | Check `variant`, `appearance`, and loading behavior. |
| `<sl-input>` / `<sl-textarea>` | `<lr-input>` / `<lr-textarea>` | String `autocorrect` property writes remain accepted but read back as booleans; preserve the native editing/form contract and review label/error markup. |
| `<sl-select>` / `<sl-option>` | `<lr-select>` / `<lr-option>` | `defaultSelected`/the `selected` attribute is the reset default; live `selected` is property-only. Review option and value events. |
| `<sl-dialog>` / `<sl-drawer>` | `<lr-dialog>` / `<lr-drawer>` | Review close reasons, focus behavior, and slots. |
| `<sl-card>` / `<sl-badge>` | `<lr-card>` / `<lr-badge>` | Review appearance tokens and dismiss events. |
| `<sl-alert>` | `<lr-alert>` | Closed by default, with the same properties, slots, lifecycle, parts, and identity-preserving `toast()` contract under the `lr-` prefix. |
| `<sl-spinner>` / `<sl-progress-bar>` | `<lr-spinner>` / `<lr-progress-bar>` | Built-in status copy is localized through Lyra's runtime. |

Lyra reads only its own `--lr-theme-*` variables; map existing values in application CSS for a staged migration.

### Security boundaries

Some upstream behavior is deliberately not automatic; the report records it instead of emitting markup that weakens a boundary:

- `<lr-include>` sanitizes every fragment, has no script mode, defaults `mode` to `same-origin`, and strips every
  navigation or resource attribute except same-document `#fragment` anchors.
- Link-like controls always add `noopener noreferrer` to `rel` when `target` is set and strip `opener`; author
  `rel` tokens are merged. `<lr-app-rail-item>` still derives `rel` from `target` alone.
- `<lr-zoomable-frame>` rejects active/non-embeddable schemes, always sandboxes, and never combines
  `allow-scripts` with `allow-same-origin`; `<lr-video>` validates media and thumbnail URLs and byte-caps VTT input.

## Theming, internationalization & RTL

**Theming.** Components read independent `--lr-theme-*` inputs with standalone defaults. Import
`@aceshooting/lyra-ui/theme.css` once and toggle `.lr-light`/`.lr-dark` (or `data-lr-theme`) on an ancestor.
Shadcn, Glass, Emerald, System mode and comfortable density are built in; the style API persists look, surface,
density, mode and accent independently ([guide](./llms/shared/styles-and-tokens.md#composing-looks-surfaces-and-density)):

`setLyraStyle({})` from `@aceshooting/lyra-ui/theme.js` restores saved choices (missing fields use the built-in
profile); `setLyraStyle({ look: "lyra", surface: "solid", accent: null })` selects the earlier appearance and
`resetLyraStyle()` restores the built-in profile. The resolved `--lr-color-*`/`--lr-space-*`/... layer exists only
on each `lr-*` shadow `:host`, so retheme through the `--lr-theme-*` inputs, for example
`:root { --lr-theme-color-brand-fill-loud: #60a5fa; }` ([where an override reaches](./llms/shared.md#where-an-override-actually-reaches),
[tokens](./llms/tokens.md)). `theme.css` declares `@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides`,
so an unlayered rule wins (name all five if you declare the order). Canvas components repaint on observable theme
changes; otherwise call `invalidateLyraTheme(root?)` from `@aceshooting/lyra-ui/utilities/theme.js`. Optional
`native.css` and `utilities.css` bring the tokens to light DOM ([details](./llms/shared.md#optional-native-styles-and-css-utilities));
`design-tokens.json` is the DTCG export for tooling.

**Internationalization.** Every built-in string, including `aria-label`s, resolves through one runtime, app-wide or
per instance; `Intl` formatting uses the resolved locale and consumer data is never altered:

```ts
import { registerLyraLocale, setLyraLocale } from "@aceshooting/lyra-ui/localization.js";

registerLyraLocale("fr", { close: "Fermer", retry: "Réessayer" /* ... */ });
setLyraLocale("fr"); // or set <html lang="fr">; per instance: .strings=${{ close: 'Fermer' }}
```

`localization.js` is side-effect-free; English is the built-in fallback and `@aceshooting/lyra-translations` has
ready-made catalogs ([guide](./llms/shared/localization-and-rtl.md)).

**RTL.** `dir="rtl"` on `<html>` or an ancestor mirrors layout (logical CSS) and swaps directional keyboard
navigation. `lang`/`locale` never change direction: pair `lang="ar"`, `"he"` or `"fa"` with `dir="rtl"`.

## Component status, versioning, and deprecation

Every component carries `stable` or `experimental` status and its first published `since` version; both get
normal semver protection once published. A deprecation names its replacement, version, rationale and earliest
removal: deprecated in major M, available through the whole M+1 line, removable no earlier than M+2
([policy](./llms/shared.md#component-status-versioning-and-deprecation)).

## SSR & Declarative Shadow DOM

The root, `all.js`, family entries and granular registrations are server-safe on Node 22+. Register the tags a
page renders and use `@aceshooting/lyra-ui/ssr.js` (`ssr/all.js` registers everything). `render-and-hydrate`
components emit Declarative Shadow DOM and reuse it on hydration; `client-render` components keep the host,
attributes and light DOM and create their shadow DOM on upgrade (`LYRA_SSR_SUPPORT_MATRIX` is the per-tag list). Pass
`elementRenderers: lyraSsrElementRenderers(LitElementRenderer)` to `@lit-labs/ssr`'s `render()`.

In the browser, make `@aceshooting/lyra-ui/hydration.js` the first import that can reach Lit, then register tags;
`diagnoseLyraHydration(document)` checks the result. A fallback renderer cannot serialize property bindings, so
pass initial state as attributes or light DOM. Measurement, observers, canvas and media start after hydration; remote
content stays client-only ([details](./llms/shared/frameworks-and-ssr.md#ssr-and-declarative-shadow-dom)).

## Framework integration (React, Vue, Angular, Svelte)

Lyra ships plain custom elements with no wrapper package. Import the opt-in, types-only declaration entry once for
template types (it registers nothing): `import type {} from "@aceshooting/lyra-ui/custom-elements-jsx"` (React 19),
`.../vue` or `.../svelte`.

- Bind object, array and function values as JS properties (Vue `:prop`, Angular `[prop]`); a bare `attr="value"`
  sets only a string attribute. Angular needs `schemas: [CUSTOM_ELEMENTS_SCHEMA]` on any module using `<lr-*>`.
- Events are native kebab-case `CustomEvent`s: `onlr-change={fn}` (React 19, Svelte 5), `@lr-change="fn"` (Vue),
  `(lr-change)="fn()"` (Angular), or `addEventListener('lr-change', fn)`.

More: [`llms/shared/frameworks-and-ssr.md`](./llms/shared/frameworks-and-ssr.md#framework-integration).

## Editor autocomplete (VS Code, JetBrains)

TypeScript consumers get completion from `HTMLElementTagNameMap`. For HTML, in-DOM templates and CSS install
[`@aceshooting/lyra-ide`](../lyra-ide): `web-types.json` works in WebStorm/IntelliJ, and `vscode-html-data.json` /
`vscode-css-data.json` plug into VS Code's `html.customData` and `css.customData` (setup in its README). In its
`custom-elements.json`, `cssParts` is flattened but `attributes`/`members`/`events`/`slots`/`cssProperties` list only a
declaration's own and overridden entries; walk the `superclass` chain or use the resolved `web-types.json`.

A per-tag entry can register several elements (`components/lr-table.js` also defines `<lr-empty>`, `<lr-pagination>`,
`<lr-skeleton>` and `<lr-spinner>`); tooling reads `registrations.json` (`entries[].registers`; `pnpm run registration-graph`).

## Components

All 308 tags appear below: the table lists components mirroring a Web Awesome or Shoelace tag, the lists after it the
original ones. Purpose and import path: [`llms/index.md`](./llms/index.md); full APIs: `llms/components/<tag>.md`
and the [live docs](https://aceshooting.github.io/lyra-ui/).

| Component | Mirrors | Notes |
| --- | --- | --- |
| `<lr-combobox>` + `<lr-option>` | `wa-combobox` / `wa-option` / `sl-option` | Filterable single/multi select, form-associated; options separate live `selected` from attribute-backed/reset `defaultSelected`; `xs`–`xl` sizing; async rich rows and retained selection payloads via `source`/`selectedRows`; virtual scrolling with `max-render` |
| `<lr-select>` | `wa-select` / `sl-select` | Closed-list single-select, button trigger (not a text input, no filtering); form-associated, shares `<lr-option>` with `lr-combobox` |
| `<lr-date-picker>` | `wa-date-picker` | Inline calendar, single + range |
| `<lr-date-input>` | `wa-date-input` | Date field + calendar popover, form-associated |
| `<lr-toast>` + `<lr-toast-item>` + `toast()` | `wa-toast` / `wa-toast-item` | Stacking notifications |
| `<lr-sparkline>` | `wa-sparkline` | Zero-dependency inline SVG |
| `<lr-textarea>` | `wa-textarea` / `sl-textarea` | Form-associated multiline field with label/hint/error chrome, auto-resize, native editing passthrough, and caret APIs |
| `<lr-input>` | `wa-input` / `sl-input` | Form-associated single-line field (`text`/`password`/`email`/`number`/`time`/`search`/`date`/`datetime-local`/`tel`/`url`) with label/hint/error chrome and a built-in password-visibility toggle |
| `<lr-number-input>` + `<lr-time-input>` | `wa-number-input` / `wa-time-input` | Numeric input and locale-aware segmented time input |
| `<lr-color-picker>` | `wa-color-picker` / `sl-color-picker` | Form-associated native color picker with label/hint chrome |
| `<lr-checkbox-group>` | `wa-checkbox-group` | Form-associated group of checkboxes with array values and group validation |
| `<lr-icon>` + `<lr-icon-button>` | `wa-icon` / `sl-icon` / `sl-icon-button` | Dependency-free SVG icons and accessible icon-only actions; migrated icon names outside the eleven-name built-in set require a registered library |
| `<lr-button>` | `wa-button` / `sl-button` | Generic action-button primitive (`variant`/`appearance`/`size`/`loading`), owns `type="submit"`/`"reset"` via its browser-resolved form owner, including an external owner named by `form` |
| `<lr-radio>` + `<lr-radio-group>` | `wa-radio` / `wa-radio-group` / `sl-radio` / `sl-radio-group` | Form-associated single-choice controls with roving arrow-key navigation and group validation; Lyra's group `name` defaults empty while Shoelace defaults to `option`, so the codemod inserts `name="option"` (set it for a manual rename) |
| `<lr-radio-button>` | `sl-radio-button` | The same single-choice control rendered as a button; a `LyraRadio` subclass, so a `<lr-radio-group>` accepts either tag and consecutive siblings collapse into one segmented control |
| `<lr-otp-input>` | `wa-otp-input` | Form-associated one-time-code field — presentational segments over one real input, so paste, SMS autofill and mobile keyboards work natively and the control stays one tab stop |
| `<lr-spinner>` | `wa-spinner` / `sl-spinner` | Localized indeterminate busy indicator with reduced-motion support |
| `<lr-progress-bar>` + `<lr-progress-ring>` | `wa-progress-bar` / `wa-progress-ring` / `sl-progress-bar` / `sl-progress-ring` | Determinate or indeterminate progress indicators |
| `<lr-animated-image>` | `wa-animated-image` / `sl-animated-image` | Animated image playback with a captured still frame and reduced-motion support |
| `<lr-animation>` | `wa-animation` / `sl-animation` | Web Animations API wrapper for declarative preset or custom animations |
| `<lr-include>` | `wa-include` / `sl-include` | Loads sanitized HTML or text content from a URL |
| `<lr-known-date>` | `wa-known-date` | Form-associated date entry control with separate day, month, and year fields |
| `<lr-qr-code>` | `wa-qr-code` / `sl-qr-code` | Canvas QR renderer; needs the optional peer `qrcode` |
| `<lr-random-content>` | `wa-random-content` | Random, unique, or sequential slotted-content selection with autoplay |
| `<lr-skeleton>` | `wa-skeleton` / `sl-skeleton` | Loading placeholder (pulse/sheen) |
| `<lr-scroller>` | `wa-scroller` | Responsive overflow surface with optional navigation controls |
| `<lr-resize-observer>` | `wa-resize-observer` / `sl-resize-observer` | Lifecycle-managed ResizeObserver for slotted elements |
| `<lr-intersection-observer>` | `wa-intersection-observer` | Lifecycle-managed IntersectionObserver for slotted elements |
| `<lr-mutation-observer>` | `wa-mutation-observer` / `sl-mutation-observer` | Lifecycle-managed MutationObserver for slotted elements |
| `<lr-data-grid>` | `wa-data-grid` | Virtualized client/server data grid with sorting, filtering, grouping, selection, column controls, tree/detail rows, paging, CSV export, and the complete experimental 3.11 public surface |
| `<lr-pagination>` | `wa-pagination` | Controlled previous/next and validated page-jump navigation with a localized range summary, loading/empty states, RTL icons, and container-responsive stacking |
| `<lr-copy-button>` | `wa-copy-button` / `sl-copy-button` | Standalone icon-only copy-to-clipboard button for a plain text value, no positioning opinion |
| `<lr-split-panel>` | `wa-split-panel` / `sl-split-panel` | Exact two-pane split contract with named `start`/`end` content, percent/pixel positioning, primary-pane sizing, snapping, constraints, and an accessible divider |
| `<lr-badge>` + `<lr-tag>` | `wa-badge` / `wa-tag` / `sl-badge` / `sl-tag` | Compact semantic status labels |
| `<lr-alert>` | `sl-alert` | Closed-by-default inline alert with timed dismissal, countdown, and identity-preserving toast promotion |
| `<lr-callout>` | `wa-callout` | Dismissible inline status, warning, and error message surface |
| `<lr-divider>` | `wa-divider` / `sl-divider` | Horizontal or vertical semantic separator |
| `<lr-rating>` | `wa-rating` / `sl-rating` | Keyboard-accessible star rating slider |
| `<lr-tree>` + `<lr-tree-item>` | `wa-tree` / `wa-tree-item` / `sl-tree` / `sl-tree-item` | Expand/collapse hierarchy with structured icon/label/description/badge rows, optional richer accessible labels, and APG tree keyboard navigation |
| `<lr-popover>` + `<lr-tooltip>` + `<lr-dropdown>` | `wa-popover` / `wa-tooltip` / `wa-dropdown` / `sl-tooltip` / `sl-dropdown` | Floating UI-positioned, RTL-aware overlay primitives with light dismiss and trigger ARIA wiring; `focus` activation opens only on keyboard focus (a deliberate narrowing of the upstream behaviour); call `show()` for scripted reveals |
| `<lr-popup>` | `wa-popup` / `sl-popup` | The low-level anchored-positioning primitive the three above are built on — placement, flip/shift, arrow and virtual anchoring, with no dismiss, focus or ARIA policy of its own |
| `<lr-chart>` | `wa-chart` | Core Chart.js wrapper (`LyraChartSeries`-based, plus raw `config` passthrough) with bounded `appendData()` streaming and `exportData('csv' |
| `<lr-bar-chart>`, `<lr-line-chart>`, `<lr-pie-chart>`, `<lr-doughnut-chart>`, `<lr-scatter-chart>`, `<lr-bubble-chart>`, `<lr-radar-chart>`, `<lr-polar-area-chart>` | `wa-bar-chart` / `wa-line-chart` / `wa-pie-chart` / `wa-doughnut-chart` / `wa-scatter-chart` / `wa-bubble-chart` / `wa-radar-chart` / `wa-polar-area-chart` | Typed `<lr-chart>` subclasses with tag-specific defaults and the full writable `LyraChartType` vocabulary — same optional peer deps as `<lr-chart>` |
| `<lr-file-input>` | `wa-file-input` | Drag-drop + click-to-browse file dropzone, emits raw `File[]` (no CSV/XLSX parsing — that's host-specific) |
| `<lr-markdown>` | `wa-markdown` | Sanitized Markdown → HTML (GFM tables, fenced code, links); lazy-loads the optional peers `marked` + `dompurify` |
| `<lr-page>` | `wa-page` | Responsive application shell with header, navigation, aside, main, footer, and mobile navigation state under one page-level layout contract |
| `<lr-slider>` | `wa-slider` / `sl-range` | Numeric range control (e.g. an LLM "temperature" setting), form-associated, mirrors native `<input type="range">` semantics; Lyra's tooltip defaults off while `sl-range` defaults to `top`, so the codemod inserts `tooltip="top"` (set it for a manual rename) |
| `<lr-dialog>` + `confirm()` | `wa-dialog` / `sl-dialog` | General-purpose modal/overlay (focus-trapped, Escape/backdrop-dismissible, scroll-locking, dialog stacking); `confirm()` is a promise-based `window.confirm()` replacement built on it |
| `<lr-drawer>` | `wa-drawer` / `sl-drawer` | Modal panel anchored to the logical start/end edge or top/bottom, sharing dialog focus, dismissal, stacking, and scroll-lock behavior |
| `<lr-carousel>` | `wa-carousel` / `sl-carousel` | Accessible slotted-slide carousel with keyboard navigation, indicators, looping, and reduced-motion-aware autoplay |
| `<lr-carousel-item>` | `wa-carousel-item` / `sl-carousel-item` | Optional semantic slide wrapper for carousel content |
| `<lr-button-group>` | `wa-button-group` / `sl-button-group` | Responsive semantic grouping for related action controls |
| `<lr-image-comparer>` | `wa-comparison` / `sl-image-comparer` | Before/after slotted surfaces with a keyboard-accessible range divider |
| `<lr-zoomable-frame>` | `wa-zoomable-frame` | Sandboxed iframe preview with safe URL forwarding, discrete zoom levels, optional controls/interaction, and same-origin theme synchronization |
| `<lr-tab-group>` + `<lr-tab>` + `<lr-tab-panel>` | `wa-tab-group` / `wa-tab` / `wa-tab-panel` / `sl-tab-group` / `sl-tab` / `sl-tab-panel` | Tab strip with `placement` (logical `start`/`end` turn it vertical) and `activation="auto"`/`"manual"`; composed from the upstream `<lr-tab>`/`<lr-tab-panel>` child pairs |
| `<lr-checkbox>` | `wa-checkbox` / `sl-checkbox` | Boolean form control, `role="checkbox"` with a visual/`indeterminate` mixed state |
| `<lr-switch>` | `wa-switch` / `sl-switch` | Boolean toggle-switch form control, `role="switch"` on/off semantics |
| `<lr-menu>` | `sl-menu` | Inline semantic menu controller with real roving focus and typeahead (not a listbox); the mechanical rename stays inline, while an anchored menu button composes it inside `<lr-dropdown>` |
| `<lr-menu-item>` | `sl-menu-item` | Focusable action row owned by `<lr-menu>`, including checkbox items, nested submenus, and the canonical parent `lr-select` event |
| `<lr-menu-label>` | `sl-menu-label` | Non-interactive section heading inside `<lr-menu>`; `role="presentation"`, never a focus stop |
| `<lr-dropdown-item>` | `wa-dropdown-item` | Drop-in naming alias for `<lr-menu-item>`, including checkbox items and roving focus |
| `<lr-visually-hidden>` | `sl-visually-hidden` | Hides content from sight while leaving it in the accessibility tree; reveals itself while focus is inside, which is what makes it usable for skip links |
| `<lr-video>` | `wa-video` | Native-video-backed player with standard/full/none control presets, slotted control icons, visibility-aware autoplay, captions, fullscreen, and capped thumbnail-VTT previews |
| `<lr-video-playlist>` | `wa-video-playlist` | Direct-child video playlist with full/standard/none control forwarding, previous/next/index navigation, immutable selected-video metadata, safe one-player-at-a-time switching, automatic advancement, and explicit repeat modes |
| `<lr-avatar>` | `wa-avatar` / `sl-avatar` | Small, fixed-size identity marker — image, or an initials fallback with `lr-chip`-style tone recoloring |
| `<lr-card>` | `wa-card` / `sl-card` | Generic bordered content container (`header`/`media`/`footer`/`actions` slots) — a direct `<lr-*>` counterpart to `wa-card` |
| `<lr-details>` + `<lr-accordion>` + `<lr-accordion-item>` | `wa-details` / `wa-accordion` / `wa-accordion-item` / `sl-details` | Native disclosure and coordinated accordion panels |
| `<lr-breadcrumb>` + `<lr-breadcrumb-item>` | `wa-breadcrumb` / `wa-breadcrumb-item` / `sl-breadcrumb` / `sl-breadcrumb-item` | Responsive navigation trail |
| `<lr-format-number>` + `<lr-format-date>` + `<lr-format-bytes>` + `<lr-relative-time>` | `wa-format-*` / `wa-relative-time` / `sl-format-*` / `sl-relative-time` | Locale-aware formatting primitives |

**Original components, by area:**
- **Form controls, toasts, sparkline, and flags:** `<lr-currency-picker>`, `<lr-country-picker>`, `<lr-time-zone-picker>`, `<lr-unit-picker>`, `<lr-signature-pad>`, `<lr-phone-input>`, `<lr-native-time-input>`, `<lr-token-input>`, `<lr-toggle>`, `<lr-toggle-group>`, `<lr-flag>`, `<lr-locale-picker>`.
- **Additional media and interaction primitives:** `<lr-avatar-group>`, `<lr-lightbox>`, `<lr-timeline>`, `<lr-timeline-item>`, `<lr-tour>`.
- **Dashboard atoms:** `<lr-empty>`, `<lr-stat>`, `<lr-table>`, `<lr-gauge>`, `<lr-export-button>`, `<lr-multi-split>`, `<lr-widget>`, `<lr-word-cloud>`.
- **Temporal & graph:** `<lr-time-range>`, `<lr-sequence-playback>`, `<lr-heatmap>`, `<lr-funnel>`, `<lr-sequence-strip>`, `<lr-graph>`.
- **Flow canvas:** `<lr-flow-canvas>`, `<lr-flow-node>`, `<lr-flow-minimap>`, `<lr-flow-controls>`, `<lr-node-palette>`, `<lr-flow-run-status>`.
- **Knowledge graph & RAG exploration:** `<lr-graph-legend>`, `<lr-entity-card>`, `<lr-entity-chip>`, `<lr-neighbor-list>`, `<lr-path-strip>`, `<lr-community-card>`, `<lr-chunk-inspector>`, `<lr-source-picker>`, `<lr-provenance-panel>`, `<lr-mind-map>`, `<lr-knowledge-graph-explorer>`, `<lr-graph-query-builder>`, `<lr-entity-dossier>`, `<lr-embedding-explorer>`.
- **Retrieval & grounding:** `<lr-retrieval-search>`, `<lr-retrieval-results>`, `<lr-retrieval-trace>`, `<lr-grounding-summary>`, `<lr-claim-evidence>`, `<lr-context-inspector>`, `<lr-rag-answer>`, `<lr-retrieval-compare>`, `<lr-rag-eval-dashboard>`.
- **Knowledge base & document management:** `<lr-knowledge-base>`, `<lr-ingestion-queue>`, `<lr-document-library>`, `<lr-document-compare>`, `<lr-knowledge-base-admin>`.
- **Agent runs & observability:** `<lr-agent-run>`, `<lr-agent-workspace>`, `<lr-subagent-panel>`, `<lr-agent-trace>`, `<lr-mcp-app>`, `<lr-prompt-studio>`, `<lr-json-schema-viewer>`, `<lr-tool-timeline>`, `<lr-memory-panel>`, `<lr-policy-summary>`, `<lr-approval-queue>`.
- **Dashboards & orchestration:** `<lr-dashboard-grid>`, `<lr-filter-bar>`, `<lr-condition-builder>`, `<lr-drilldown-panel>`.
- **Evaluation:** `<lr-eval-dataset>`, `<lr-eval-run>`, `<lr-eval-result>`, `<lr-agent-eval-dashboard>`.
- **Overlays:** `<lr-context-menu>`.
- **Charts:** `<lr-box-plot>`, `<lr-histogram>`, `<lr-lite-chart>`.
- **Map & file-input:** `<lr-map>`, `<lr-drop-zone>`.
- **Conversation & Agent UI:** `<lr-chat-message>`, `<lr-message-parts>`, `<lr-chat-viewport>`, `<lr-prompt-input>`, `<lr-prompt-queue>`, `<lr-selection-toolbar>`, `<lr-realtime-session>`, `<lr-message-actions>`, `<lr-message-feedback>`, `<lr-branch-picker>`, `<lr-typing-indicator>`, `<lr-streaming-text>`, `<lr-streaming-text-core>`, `<lr-thinking-panel>`, `<lr-activity-feed>`, `<lr-task-list>`, `<lr-generation-metrics>`, `<lr-stream-status>`, `<lr-checkpoint>`, `<lr-handoff-divider>`, `<lr-code-block>`, `<lr-artifact-panel>`, `<lr-live-region>`, `<lr-chat-composer>`, `<lr-suggestion-chips>`, `<lr-emoji-picker>`, `<lr-attachment-chip>`, `<lr-attachment-trigger>`, `<lr-mention-popover>`, `<lr-tool-call-block>`, `<lr-tool-call-chip>`, `<lr-tool-result-view>`, `<lr-tool-result-dialog>`, `<lr-tool-approval-dialog>`, `<lr-confirm-bar>`, `<lr-tool-param-form>`, `<lr-change-review>`, `<lr-agent-question>`, `<lr-permission-rules>`, `<lr-permission-grant>`, `<lr-connector-manager>`, `<lr-background-runs>`, `<lr-research-progress>`, `<lr-budget-meter>`, `<lr-tool-select-dialog>`, `<lr-command-palette>`, `<lr-widget-renderer>`, `<lr-json-viewer>`, `<lr-citation-badge>`, `<lr-source-list>`, `<lr-source-card>`, `<lr-conversation-item>`, `<lr-virtual-list>`, `<lr-thread-list>`, `<lr-app-rail>`, `<lr-app-rail-item>`, `<lr-app-rail-group>`, `<lr-navigation-menu>`, `<lr-navigation-menu-item>`, `<lr-menubar>`, `<lr-menubar-item>`, `<lr-responsive-panel>`, `<lr-dock-panel>`, `<lr-model-select>`, `<lr-model-settings-panel>`, `<lr-voice-picker>`, `<lr-audio-visualizer>`, `<lr-push-to-talk>`, `<lr-transcript-feed>`, `<lr-context-meter>`, `<lr-usage-badge>`, `<lr-control-group>`, `<lr-reorder-list>`, `<lr-reorder-item>`, `<lr-pan-zoom>`, `<lr-chip>`, `<lr-chip-group>`, `<lr-kbd>`, `<lr-result-card>`, `<lr-result-field>`, `<lr-document-preview>`, `<lr-document-viewer>`, `<lr-svg-viewer>`, `<lr-image-viewer>`, `<lr-highlight-layer>`, `<lr-html-viewer>`, `<lr-xml-viewer>`, `<lr-dataset-viewer>`, `<lr-contact-viewer>`, `<lr-pdf-viewer>`, `<lr-page-rail>`, `<lr-av-player>`, `<lr-notebook-viewer>`, `<lr-spreadsheet-viewer>`, `<lr-csv-viewer>`, `<lr-geojson-viewer>`, `<lr-docx-viewer>`, `<lr-email-viewer>`, `<lr-calendar-viewer>`, `<lr-archive-viewer>`, `<lr-ebook-viewer>`, `<lr-pptx-viewer>`, `<lr-file-icon>`, `<lr-media-card>`, `<lr-stepper>`, `<lr-segmented>`, `<lr-swatch-picker>`, `<lr-diff-view>`, `<lr-commit-card>`, `<lr-poll-status>`, `<lr-code-block-core>`, `<lr-code-editor>`, `<lr-terminal>`, `<lr-stack-trace>`, `<lr-trace-tree>`, `<lr-span-waterfall>`, `<lr-test-results>`, `<lr-env-list>`, `<lr-file-tree>`, `<lr-browser-frame>`, `<lr-compare-panel>`, `<lr-rubric-form>`, `<lr-calendar>`, `<lr-markdown-core>`.

### Citation → document recipe

On `lr-citation-activate` from a `<lr-citation-badge>`, load the source into a `<lr-document-viewer>` and anchor it:

```js
document.addEventListener("lr-citation-activate", (e) => {
  const s = SOURCES[e.detail.sourceId]; // { name, mimeType, src, highlight: { id, tone, anchor } }
  const dv = document.getElementById("dv");
  Object.assign(dv, { name: s.name, mimeType: s.mimeType, src: s.src, highlights: [s.highlight] });
  if (dv.anchor === s.highlight.id) void dv.scrollToAnchor(s.highlight.id); // same anchor: jump explicitly
  else dv.anchor = s.highlight.id; // scroll, activate and flash once loaded
  dv.open = true;
});
```

An anchor is `{ kind: "text-quote", quote, prefix, suffix, page }`; `lr-anchor-result` reports `detail.found`. The reverse
direction listens for `lr-text-select` on the viewer and hands `detail.anchor` to the citation store.

## Known limitations

- `<lr-map>` requires an explicit `mapStyle` (no implicit tile-provider request); `<lr-file-input>` paste support
  depends on `clipboardData.files`, which some browsers populate only for images.
- Viewers that fetch a remote resource cap what they read at 25 MB (enforced while streaming) and, for the tabular
  viewers (`<lr-csv-viewer>`, `<lr-dataset-viewer>`, `<lr-spreadsheet-viewer>`), 10,000 rows and 1,000 columns; the
  localized `documentPreviewResourceTooLarge` message replaces the document and caps are not overridable.
  `<lr-document-preview>` caps only its text/JSON fetch, not the `image` path.

## Development

From the repo root (a pnpm workspace; contributor contract in `AGENTS.md`):

```bash
pnpm install && pnpm build   # tsc → dist/ (ESM + .d.ts)
pnpm test                    # @web/test-runner + Playwright (Chromium) + axe
pnpm lint                    # contract-policy + tsc --noEmit + type-surface tests
pnpm manifest                # custom-elements.json
```

## License

[MIT](./LICENSE) © 2026 Aceshooting
