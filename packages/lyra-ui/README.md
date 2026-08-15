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
[![Node.js](https://img.shields.io/node/v/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![Lit](https://img.shields.io/badge/Lit-3-324FFF?logo=lit)](https://lit.dev/)
[![Web Components](https://img.shields.io/badge/Web%20Components-native-29ABE2)](https://www.webcomponents.org/)
[![avg per component](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.avgComponentGzipKb&label=avg%20per%20component&suffix=%20KB%20gzip&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![total gzip](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Faceshooting%2Flyra-ui%2Fmain%2Fpackages%2Flyra-ui%2Fscripts%2Fbundle-stats.json&query=%24.barrelGzipKb&label=total%20gzip&suffix=%20KB&color=blue)](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/scripts/bundle-stats.json)
[![types](https://img.shields.io/npm/types/%40aceshooting%2Flyra-ui)](https://www.npmjs.com/package/@aceshooting/lyra-ui)
[![license](https://img.shields.io/npm/l/%40aceshooting%2Flyra-ui)](./LICENSE)

<p align="center">
  <a href="https://www.lyra-ui.com/">
    <img src="https://raw.githubusercontent.com/aceshooting/lyra-ui/main/.github/readme/lyra-mark.svg" width="112" height="112" alt="Lyra UI constellation logo" />
  </a>
</p>

**Lyra UI — the free, independent web-component alternative.** A MIT-licensed [Lit](https://lit.dev)
library for accessible forms, dashboards, charts, data visualization, and Conversation & Agent UI.
It is a practical open-source alternative to [Shoelace](https://shoelace.style/) and
[Web Awesome](https://webawesome.com/), with 284 custom elements, native custom-element APIs,
tree-shakeable imports, its own `--lr-*` design tokens, built-in localization and RTL support,
and no runtime dependency on either project.

> **Independent implementation.** Lyra is not affiliated with, endorsed by, or a fork or rebrand of
> Shoelace or Web Awesome. Selected Web Awesome-compatible components retain documented public names
> under the `lr-` prefix to make migration easier; component notes identify differences. Shoelace
> users get a separate `sl-*` migration map because the APIs are not identical. No competitor runtime,
> theme, token namespace, or source code is required by Lyra.

## Install

```bash
npm install @aceshooting/lyra-ui
# runtime dependencies: Lit and Floating UI are installed transitively with this package
# optional peer: @aceshooting/lyra-flags, only needed for <lr-flag>
# optional peer: libphonenumber-js, only when creating a <lr-phone-input>
#   adapter with loadLibphonenumberAdapter(); it is never imported by lyra-ui
#   and international E.164 input works without it
# optional peer: d3-force, d3-drag, d3-zoom, d3-selection, only needed for <lr-graph>
# optional peer: chart.js, only needed for the <lr-*-chart>/<lr-histogram> family
# optional peer: chartjs-plugin-zoom, only when that family's zoom feature is enabled
# optional peer: chartjs-plugin-datalabels, only when data-labels or stack-totals is enabled
# optional peer: @sgratzl/chartjs-chart-boxplot, only needed for <lr-box-plot>
# optional peers: mammoth and dompurify, only needed for <lr-docx-viewer>
#   — Mammoth converts DOCX files to semantic HTML instead of pixel-exact Word page layout.
# optional peer: maplibre-gl, only needed for <lr-map> — lr-map styles the
#   generated canvas, markers, popups, and controls inside its shadow root.
#   Lyra supports MapLibre v5 and v6. v5's standard build includes its worker;
#   v6 is ESM-only, requires WebGL2, and also needs its module-worker URL
#   configured for your bundler before the first map is constructed.
#   <lr-map> requires an explicit `mapStyle`; it never initiates an implicit
#   request to a third-party tile service when that property is absent.
```

For example, Vite consumers using MapLibre v6 configure its self-contained worker once:

```js
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
```

Webpack, esbuild, Rollup, and direct-browser ESM use different worker URL forms; follow
[MapLibre's ESM installation guide](https://maplibre.org/maplibre-gl-js/docs/#esm) for the matching
setup.

## Usage

Import just what you use (tree-shakeable, granular entry points):

```js
import "@aceshooting/lyra-ui/components/lr-combobox.js";
import "@aceshooting/lyra-ui/components/lr-option.js";
```

The tag-shaped path is stable even if Lyra later reorganizes its internal family folders. Existing
family-shaped paths remain supported, but new application code should prefer
`components/<tag>.js`.

The new v8 application-shell and media surfaces have the same granular shape:

```js
import "@aceshooting/lyra-ui/components/lr-page.js";
import "@aceshooting/lyra-ui/components/lr-video.js";
import "@aceshooting/lyra-ui/components/lr-video-playlist.js";
```

Imports for behavior preserved under a new compatibility tag are explicit too:

```js
import "@aceshooting/lyra-ui/components/lr-native-time-input.js";
import "@aceshooting/lyra-ui/components/lr-pan-zoom.js";
import "@aceshooting/lyra-ui/components/lr-split-panel.js";
import "@aceshooting/lyra-ui/components/lr-alert.js";
```

These component entry points register their tags. For a class-only import (for subclassing or
type-directed composition), use the matching `.class.js` entry, such as
`@aceshooting/lyra-ui/components/overlays/empty/empty.class.js`; class-only entries do not touch the
custom-element registry.

```html
<lr-combobox label="Fruit" clearable>
  <lr-option value="a">Apple</lr-option>
  <lr-option value="b">Banana</lr-option>
</lr-combobox>
```

Each of the eleven families also has an entry point that registers every element in it —
`@aceshooting/lyra-ui/components/forms`, `.../components/overlays`, and so on for `agent-tools`,
`charts`, `conversation`, `data`, `layout`, `media`, `retrieval`, `utility` and `viewers`:

```js
import "@aceshooting/lyra-ui/components/forms"; // every form control
import "@aceshooting/lyra-ui/components/lr-input.js"; // just <lr-input>
```

A family entry point is **side-effectful by design**: importing it registers every tag in that
family — including the peer-gated tags `all.js` leaves out (see below), whose optional peers still
load lazily, on first use. Reach for one when you genuinely use most of a family and want a single
import; reach for the granular path — which is what every example in these docs uses — when you
don't, because a barrel cannot be tree-shaken down to the two elements you actually render.

…or pull the whole library:

```js
import "@aceshooting/lyra-ui/all.js";
```

> **Breaking in 8.0.0 — the package root no longer registers anything.** In 7.x, a bare
> `import '@aceshooting/lyra-ui'` had the side effect of defining every root-included tag. It does
> not any more: the root is now a **pure export surface**. `@aceshooting/lyra-ui/all.js` is the
> explicit compatibility path that carries that side effect, and rewriting the one specifier is the
> whole migration.
>
> Every named and type export stays on the root, at the same specifier, with the same name —
> `import { LyraSelect, type LyraSelectEventMap } from '@aceshooting/lyra-ui'` is unchanged, and it
> now costs you nothing at runtime. Only the side effect moved.
>
> Watch for this, because it is the genuinely nasty part: a missed migration does **not** throw a
> module error. The import still resolves, the build still succeeds, and the tags simply never
> upgrade — `<lr-select>` renders as an unknown inert element with its light DOM showing through and
> no console message. If elements stopped working after upgrading and nothing failed, this is why.

`all.js` registers 268 tags — every component **except** the 16 inventory-designated
optional-peer-family tags: `<lr-chart>` and its 8 typed subclasses, `<lr-box-plot>`,
`<lr-histogram>`, `<lr-map>`, `<lr-graph>`, `<lr-knowledge-graph-explorer>`, and
`<lr-geojson-view>` and `<lr-geojson-viewer>` (see Install above). Those always require their own explicit subpath import,
even when pulling the rest of the library in bulk:

```js
import "@aceshooting/lyra-ui/components/lr-chart.js";
import "@aceshooting/lyra-ui/components/lr-map.js";
import "@aceshooting/lyra-ui/components/lr-graph.js";
```

Granular per-component imports remain the recommendation. `all.js` exists so a 7.x application can
upgrade in one line, not because pulling 268 elements into a bundle to render four of them is a good
idea.

`all.js` registers `<lr-flag>` without pulling in the optional flag asset graph. If a
flag uses `country` or `language`, also import the peer registration entry once:

```js
import "@aceshooting/lyra-ui/components/media/flag/flag-peer.js";
```

Passing a pre-resolved `src` does not require that entry.

### Optional autoloader and CDN entry

Applications that receive arbitrary Lyra markup can opt into the inventory-driven autoloader
instead of registering the whole library up front. The manual entry is side-effect-free and loads
only known tags already present below the supplied root:

```ts
import { discover, start, stop } from "@aceshooting/lyra-ui/autoloader.js";
import { allDefined } from "@aceshooting/lyra-ui/utilities/defined.js";

await discover(document); // one scan
await start(document); // initial scan, then watch dynamic/Turbo-style replacements
await allDefined(document);
stop();
```

`discover()` and `start()` traverse caller-owned open shadow roots and honor scoped custom-element
registries. While a discovered element is importing and completing its first update, the loader
owns a `data-lr-autoload-pending` marker on it; `AUTOLOADER_PENDING_ATTRIBUTE` exports that exact
name for application FOUCE rules. Set `{ events: true }` to receive bubbling/composed
`lr-autoload-preload`, `lr-autoload-loaded`, `lr-autoload-error`, and
`lr-autoload-traversal-error` events. A rejected import is reported, its marker is cleared, and a
later discovery can retry it.

Traversal is iterative and bounded per discovery operation: `maxElements` defaults to `10_000`,
`maxRoots` to `2_000`, `maxDepth` to `256`, and `maxWork` to `100_000`; `maxConcurrency` defaults
to `16` definition/first-update tasks. Invalid limits throw `RangeError`. `discover()` and the
initial `start()` preflight the currently rendered tree and reject a traversal-limit failure before
loading it. Shadow content rendered by a successfully loaded element is then bounded cumulatively; a
failure there rejects after that parent definition, without starting the over-limit descendants. A
watched insertion emits `lr-autoload-traversal-error` with `{ limit, maximum, error }` when events
are enabled, and later bounded discovery work remains available.

Optional-peer tags are skipped by default. Opt in only after installing every peer named by that
tag's package metadata:

```ts
await start(document, {
  optionalPeers: ["dompurify", "postal-mime"],
  events: true,
});
```

Use `optionalPeers: 'all'` only when the complete optional-peer set is installed. The separate
side-effect entry auto-starts for direct-browser/CDN use and reads the same policy from its own
script element:

```html
<script
  type="module"
  src="https://esm.sh/@aceshooting/lyra-ui/autoloader-cdn.js"
  data-lyra-autoloader
  data-lyra-optional-peers="dompurify,postal-mime"
  data-lyra-autoload-events
></script>
```

Both autoloader entries are safe to import in Node: without a browser document they resolve inertly
and create no DOM globals. `allDefined()` waits for currently rendered, inventory-known tags and
their first updates, including tags produced by those updates; unknown `lr-*` names are ignored.
It does not load anything itself, so call it after explicit imports, `discover()`, or `start()`.

### External modal interop

When a third-party modal opens above an active Lyra dialog or drawer, suspend Lyra's document-level
modal ownership for that connected external root:

```ts
import { suspendLyraModalsFor } from "@aceshooting/lyra-ui/utilities/overlay-manager.js";

const externalModal = document.querySelector<HTMLElement>("#vendor-modal")!;
const release = suspendLyraModalsFor(externalModal);
// Call when the third-party modal closes. Calling it twice is safe.
release();
```

The handle is document-scoped and nestable. While at least one handle is active, Lyra yields Escape
and Tab routing and leaves only the external modal paths non-inert, without discarding its own stack
or focus-return targets. Disconnecting the external root or adopting it into another document
releases the suspension automatically.

Imperative toast (a drop-in for `react-hot-toast`):

```js
import { toast } from "@aceshooting/lyra-ui/components/overlays/toast/toaster.js";
toast({ message: "Saved", variant: "success" });
```

## For AI agents / LLMs

**Using this library from a consuming project?** The package ships a reference written for coding
assistants, split so a lookup costs a few hundred tokens instead of the whole catalog:

| Need                                                                                                 | Read                                                                     |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Which component to use, and its import path                                                          | [`llms/index.md`](./llms/index.md)                                       |
| One component's full API                                                                             | `llms/components/<tag>.md` — path derived from the tag, no search needed |
| Library-wide behavior (imports, events, forms, theming, i18n, TypeScript, frameworks, SSR, AI types) | [`llms/shared.md`](./llms/shared.md)                                     |
| Design tokens                                                                                        | [`llms/tokens.md`](./llms/tokens.md)                                     |
| Which optional peer a component needs                                                                | [`llms/peers.md`](./llms/peers.md)                                       |
| `wa-*`/`sl-*` migration classifications and safe codemod rules                                       | [`llms/migration.md`](./llms/migration.md)                               |
| Everything, concatenated (large)                                                                     | [`llms-full.txt`](./llms-full.txt)                                       |

[`llms.txt`](./llms.txt) is the short entry index over all of the above. Family files, this shared
guide, and the introductory sources are authored; `pnpm run llms` combines them with the generated
index, per-component pages, tokens, peers, and migration reference. CI freshness-checks the derived
artifacts against `custom-elements.json` and the authored sources.

**Claude Code users:** this repo is also a plugin marketplace — installing the `lyra-ui` plugin gives
Claude the same reference as a skill, plus `/lyra-ui:migrate-from-wa`,
`/lyra-ui:migrate-from-shoelace` and `/lyra-ui:update` commands.

**Contributing to this repo itself?** See [`../../AGENTS.md`](../../AGENTS.md) instead — that's a
contributor guide for agents working _on_ lyra-ui, not the same document as the above.

## Upgrading from 7.x

8.0.0 removes naming and default accidents, completes mapped public contracts, and adds new platform
surface for SSR, framework typing, guarded loading, and opt-in styles. Existing Lyra-original
behavior displaced by a mapped contract moves to a truthful compatibility tag instead of
disappearing. Almost every intentional break below is a find-and-replace, and where a default flips
it flips to the mapped public contract — an attribute renamed into its own negation is the most
expensive mistake available here, because the renamed markup parses cleanly and every instance that
doesn't carry it silently adopts the opposite behavior.

### Tag renames

| 7.x              | 8.0.0            | Also                                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-tabs>`      | `<lr-tab-group>` | The `lr-tabs-change` event splits into `lr-tab-hide` (outgoing tab) then `lr-tab-show` (incoming), and `--lr-tabs-*` custom properties become `--lr-tab-group-*`. The group now also accepts `<lr-tab>` / `<lr-tab-panel>` children; the library's own `slot`/`label` panel shape still works unchanged. |
| `<lr-tree-node>` | `<lr-tree-item>` |                                                                                                                                                                                                                                                                                                          |

Neither old name is registered as an alias. A tag that silently keeps working under its old name is
how a rename looks finished while half of it is inert.

### Component contract moves and default changes

Two existing tags now carry the mapped contract their names promise. Rename the old behavior when
that is what the application needs:

| 7.x behavior                                     | 8.0.0 destination        | What the old tag means now                                                       |
| ------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------- |
| Browser-native `<lr-time-input>`                 | `<lr-native-time-input>` | `<lr-time-input>` is the locale-aware segmented field and popup.                 |
| Slotted/image `<lr-zoomable-frame>` pan and zoom | `<lr-pan-zoom>`          | `<lr-zoomable-frame>` is a sandboxed iframe preview with discrete zoom controls. |

The following changes do not require a tag rename, but code that relied on the former default or
exact TypeScript/event shape needs an explicit update:

- `<lr-select>.value` is typed `string | string[]`; `multiple` opts into the array-valued runtime
  mode. Narrow the value after checking `multiple` rather than assuming a string.
- A bare `<lr-button>` now uses `appearance="accent"`. Write `appearance="filled"` to preserve the
  former visual tier.
- `<lr-input type="password">` no longer adds a reveal button unless `password-toggle` is present,
  and `<lr-input type="number">` leaves native spin buttons visible unless `without-spin-buttons`
  (or `no-spin-buttons`) is present.
- `<lr-pagination>` now defaults `page-size` to `10`, not `20`; its page-change detail also includes
  `pageSize`, and the cancelable `lr-before-page-change` precedes it.
- `<lr-skeleton>` defaults to `effect="none"`, not `pulse`; `<lr-mutation-observer>` defaults
  `child-list` to false, not true.
- `<lr-format-date>` and `<lr-relative-time>` default an unset date to the construction-time current
  instant. `<lr-format-bytes>` uses decimal `unit-step="1000"`; write `1024` to retain the former
  scaling.
- `<lr-popover>` emits cancelable `lr-show`/`lr-hide` before state changes and settles the new
  after-events after motion. `<lr-tooltip>` replaces `delay` with independent `show-delay` and
  `hide-delay`.
- Slider input/change details now include the active thumb and full value/range context. Readers of
  `detail.value` continue to work; exact one-key object assertions must accept the wider shape.

The component-family reference documents every aligned default beside the affected property. The
contract-aware migration report identifies upstream-origin rewrites; the separate `lyra-v7`
profile described below makes the former popup/popover/tooltip defaults explicit.

The exact registration imports for the new and moved surfaces are:

```js
import "@aceshooting/lyra-ui/components/lr-page.js";
import "@aceshooting/lyra-ui/components/lr-video.js";
import "@aceshooting/lyra-ui/components/lr-video-playlist.js";
import "@aceshooting/lyra-ui/components/lr-native-time-input.js";
import "@aceshooting/lyra-ui/components/lr-pan-zoom.js";
```

### Attribute and property renames

Each row is a mechanical rewrite in your own markup or CSS. Three of them also change what happens
when the attribute is _absent_, so grep for the tag as well as for the old attribute.

| 7.x                                                | 8.0.0                                  | What to check                                                                                                                             |
| -------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-dialog no-light-dismiss>`                     | `<lr-dialog light-dismiss>`            | Polarity un-inverted, so the default flips: a backdrop click no longer dismisses a dialog unless you opt in. `<lr-drawer>` inherits this. |
| `<lr-pagination hide-summary>`                     | `<lr-pagination with-summary>`         | Same flip: the localized "showing X–Y of Z" row is now opt-in.                                                                            |
| `<lr-pagination total-items>`                      | `<lr-pagination total>`                | Leaving `total` unset renders the empty state, so a missed rename is visible rather than silent.                                          |
| `<lr-avatar src>`                                  | `<lr-avatar image>`                    |                                                                                                                                           |
| `<lr-drawer placement>`                            | default `start` → `end`                | A drawer with no `placement` now enters from the logical end edge; write `placement="start"` to keep the old side.                        |
| `<lr-slider>` `::part(fill)`                       | `::part(indicator)`                    | Rename the selector in your own CSS; the old part name matches nothing and fails silently.                                                |
| `<lr-flag detailed>`                               | `<lr-flag variant="detailed">`         | The deprecated boolean is gone.                                                                                                           |
| `<lr-attachment-chip size>`, `<lr-file-icon size>` | `bytes`                                | These were byte counts wearing the name of the size ladder.                                                                               |
| `<lr-dock-panel size>` / `min-size` / `max-size`   | `extent` / `min-extent` / `max-extent` | Same reason: a CSS length along the docked axis, not a size step.                                                                         |

`<lr-combobox>`'s `with-clear` is no longer marked deprecated. Both upstream spellings of the clear
button — `with-clear` and `clearable` — are now first-class on `<lr-input>`, `<lr-select>` and
`<lr-combobox>` alike, so there is nothing to rewrite in either direction.

### Security-preserving differences

Some upstream behavior is intentionally not made automatic:

- `<lr-include>` sanitizes every fetched or same-page fragment, has no script-executing mode, and
  defaults `mode` to `same-origin` instead of `cors`. A migration that depends on cross-origin or
  script execution remains unchanged with a location-aware warning.
- Link-like Lyra controls always contribute `noopener noreferrer` to `rel` whenever `target` is set,
  and always strip `opener`. Author `rel` tokens are merged rather than ignored, so `nofollow`, `me`
  and `license` survive the rename — `<lr-button>` and `<lr-breadcrumb-item>` therefore migrate
  automatically as of 9.0.0. `<lr-app-rail-item>` still derives `rel` from `target` alone.
- `<lr-zoomable-frame>` rejects active/non-embeddable URL schemes, always renders a sandbox, and
  will not combine `allow-scripts` with `allow-same-origin`. `<lr-video>` validates media and
  thumbnail URLs and byte-caps remote thumbnail VTT input.

These are deliberate fail-closed contracts. The migration report records them instead of emitting
markup that appears converted while weakening the application's security boundary.

### One styling vocabulary

`variant`, `tone` and `kind` used to mean the same thing on different components, and `appearance`
meant two unrelated things. There is now one name per concept, library-wide.

- **`tone` → `variant`** on `<lr-avatar>`, `<lr-avatar-group>`, `<lr-chip>` and `<lr-confirm-bar>`,
  and on `<lr-activity-feed>`'s entry objects — along with its `tone-dot*` CSS parts, now
  `variant-dot*`. No alias for any of them.
- **`appearance="card|plain"` → `frame="card|plain"`** on the thirteen container components that had
  it (`<lr-stat>`, `<lr-agent-run>`, `<lr-task-list>`, `<lr-result-card>`, `<lr-commit-card>`,
  `<lr-stack-trace>`, `<lr-entity-card>`, `<lr-source-card>`, `<lr-community-card>`,
  `<lr-media-card>`, `<lr-chat-composer>`, `<lr-flow-controls>`, `<lr-flow-run-status>`).
  `appearance` now means how a control fills itself and nothing else:
  `accent | filled | outlined | filled-outlined | plain`.
- **`<lr-button>`'s default `appearance` is now `accent`**, and `filled` is a genuinely quieter tier.
  The two used to render identically for every variant except neutral.
- **`size` accepts both ladders everywhere** — this library's `2xs|xs|s|m|l|xl` and the upstream
  `small|medium|large` — so a migrated `size="small"` needs no rewrite.
- **`<lr-badge>`, `<lr-tag>` and `<lr-chip>` are no longer unconditionally pill-shaped.** They
  default to a rounded rectangle; add `pill` for the old fully-rounded ends.

### Tokens and theming

- **`theme.css` now declares cascade layers**: `@layer lr-base, lr-theme, lr-utilities, lr-overrides`,
  with the tokens in `lr-theme`. Any _unlayered_ declaration of yours now beats every Lyra one
  regardless of specificity or load order, so a plain `:root { --lr-theme-… }` override always wins
  with no `!important`. If you already wrap your overrides in your own `@layer`, they now sort
  relative to `lr-theme` rather than losing to an unlayered `:root` — name your layer in an
  `@layer` statement after importing `theme.css`, or move those rules out of a layer entirely.
- **`--lr-font-size-md` is removed**; use `--lr-font-size-m`. The two were the same value under two
  names, which is why `<lr-button>` rendered `size="m"` and `size="l"` at identical text sizes.
- **Compound motion tokens are split into duration and easing** (`--lr-duration-*` +
  `--lr-easing-*`). The compound `--lr-transition-*` tokens still resolve, composed from the two.
- **Shadows are five tiered steps** (`--lr-shadow-xs` … `--lr-shadow-xl`), declared per mode with
  much heavier dark-mode alphas, because a single near-black step against a near-black surface is not
  a luminance difference at all. `--lr-shadow` still resolves (to the `m` step) and a theme that set
  `--lr-theme-shadow-color` keeps working; a theme that overrode `--lr-shadow` directly should move to
  the step it meant.
- **Hover and press are a color mix, not `filter: brightness()`** — tune them library-wide with
  `--lr-color-mix-hover` / `--lr-color-mix-active` against `--lr-color-mix-partner`.
  `--lr-hover-brightness` still resolves but no component reads it.
- **New `--lr-color-surface-overlay`** for modal panels (the page surface in light mode, lighter than
  the page in dark), a **new `--lr-terminal-bg-*` set** for ANSI background colors, and a new
  `--lr-form-control-*` tier (`height`, `font-size`, `padding-inline`, `padding-block`, `gap`,
  `radius`) — one ladder shared by every control, retuned per `size` step.
- Colors moved where the generated ramp put them, including the brand seed. Restoring the old hex
  values by hand would reintroduce the contrast failures the ramp exists to prevent.
- The value-named `--lr-size-<value>` tokens are unchanged and still resolve, but the family is
  frozen: existing entries may disappear as call sites find a semantic home, and none will be added.
  Don't build new theming on them — reach for `--lr-space-*`, `--lr-radius*`, `--lr-font-size-*` or
  `--lr-form-control-*` instead.

### Localization

**Pluralized messages are now CLDR category objects** selected through `Intl.PluralRules`, replacing
the paired `<key>` + `<key>Plural` convention. A catalog passed to `registerLyraLocale()`, or a
per-instance `.strings`, that used the old pair must be rewritten — with that locale's real
categories, which for Russian is four and for Arabic six:

```ts
// 7.x
registerLyraLocale("en", {
  toolCount: "{count} tool",
  toolCountPlural: "{count} tools",
});

// 8.0.0
registerLyraLocale("en", {
  toolCount: { one: "{count} tool", other: "{count} tools" },
});
```

Ten translation catalogs now ship as side-effect-only modules, so a common locale no longer needs a
hand-written catalog at all:

```js
import "@aceshooting/lyra-ui/translations/fr.js"; // also ar, de, es, fa, he, ja, pt-BR, ru, zh-CN
```

`fa` and `he` are complete RTL catalogs. Locale lookup applies the normal regional fallback, so
`fa-IR` resolves through `fa` and `he-IL` through `he`; set `dir="rtl"` on the document or an
ancestor so layout and directional keyboard behavior follow the chosen language.

### Packaging

- **`@aceshooting/lyra-ui/internal/*` is no longer a published subpath.** The supported helpers moved
  to `@aceshooting/lyra-ui/utilities/*` (one module per helper, or the whole set from
  `@aceshooting/lyra-ui/utilities`), which now also carries `FormAssociated` and `groupByRecency` —
  previously reachable only through the side-effectful root barrel. Rewrite
  `@aceshooting/lyra-ui/internal/positioner.js` as `@aceshooting/lyra-ui/utilities/positioner.js`,
  and likewise for `a11y`, `announcer`, `icons`, `layered-layout`, `lyra-element`,
  `overlay-manager`, `prefix` and `scroll-lock`. Anything else that lived under `internal/` was never
  a public API and has no replacement subpath.

## Migrating from Web Awesome or Shoelace

The "Mirrors" column records a design/API relationship, not blanket permission to rename a tag.
Every pinned Web Awesome and Shoelace component has a machine-readable migration classification:
`exact`, `rewritten`, `warning-required`, `conceptual-only`, or `unsupported`. Only `exact` and fully
specified `rewritten` mappings are changed automatically. The other three remain untouched and are
reported with their source location, so an incomplete migration cannot leave inert public members
behind while appearing to have succeeded.

Where the two upstreams disagree on a name for the same thing, Lyra accepts both spellings rather
than forcing a rewrite. The clear button is the clearest case: Web Awesome spells it `with-clear`,
Shoelace spells it `clearable`, and `<lr-input>`, `<lr-select>` and `<lr-combobox>` each honour both.
Neither spelling is deprecated, and neither needs rewriting in either direction — whichever one your
markup already carries keeps working.

The same compatibility rule applies when the upstreams disagree on a property's write type.
`lr-input.autocorrect` and `lr-textarea.autocorrect` always read as booleans, matching Web Awesome.
Input also accepts Shoelace's `'off'`/`'on'` property writes; Textarea accepts its wider string
surface, normalizing `'off'`/`'false'` to `false` and other strings to `true`. Both render the native
attribute canonically as `autocorrect="off"` or `autocorrect="on"`.

`lr-option` likewise keeps live/default selection separate: the `selected` attribute initializes
`defaultSelected` and the parent control's reset default (property writes intentionally do not
reflect), while `selected` is property-only live state. Selecting an option at runtime never
rewrites the declarative default.

```html
<sl-button-group label="Actions">
  <sl-resize-observer @sl-resize="sync"></sl-resize-observer>
</sl-button-group>

<!-- becomes -->
<lr-button-group label="Actions">
  <lr-resize-observer @lr-resize="sync"></lr-resize-observer>
</lr-button-group>
```

**Automating the safe subset.** The package ships the version-matched `lyra-ui-migrate` CLI. It
reads a compact packaged projection of the validated component inventory, applies only
contract-recorded tag/member/default/registration-import rewrites, and can write a stable JSON
report for CI or human review. Replace `<version>` with the exact Lyra version you are migrating to:

```bash
npx --package @aceshooting/lyra-ui@<version> lyra-ui-migrate --check \
  --report=migration.json path/to/your/src
npx --package @aceshooting/lyra-ui@<version> lyra-ui-migrate path/to/your/src
```

The supported package identities are `@awesome.me/webawesome` and `@awesome.me/webawesome-pro`
for Web Awesome, plus `@shoelace-style/shoelace`. Directory targets include HTML, standalone CSS,
JavaScript, TypeScript, JSX, Vue, Svelte, MDX, and Markdown files.

The report records file, line, column, migration origin, tag/member, action, target, and warning code.
Supported side-effect component deep imports are routed through the target's inventory registration
module. Proven, tier-compatible root registration closures use `@aceshooting/lyra-ui/all.js`;
root-excluded targets receive granular registration imports instead. An automatic-looking tag with
no matching side-effect registration in the scanned target set stays unchanged with
`REGISTRATION_CLOSURE_REQUIRED`; include the registration-owning entry file in the scan rather than
accepting an inert `lr-*` result. A mapped target with optional runtime dependencies adds an
`OPTIONAL_PEER_REQUIRED` entry naming every package the consumer must install. Imports with
bindings, unknown subpaths, dynamic values, aliased component values that use a rewritten member,
unsafe security/default changes, conceptual mappings, and unsupported components remain unchanged
with an actionable warning. An aliased member blocks that mapping across the whole scanned target set
so the codemod never rewrites its registration import while leaving an old member behind. A second
run is byte-idempotent. Comments, prose, unrelated identifiers/packages, and partial strings are not
treated as component uses. `--check` never writes files and exits nonzero while a rewrite or warning
remains.

**Preserving Lyra 7 overlay defaults.** This is a separate, opt-in profile; the default command
above continues to scan only Web Awesome and Shoelace uses. Run it first in dry-run mode:

```bash
npx --package @aceshooting/lyra-ui@<version> lyra-ui-migrate --origin=lyra-v7 --dry-run \
  --report=lyra-v7-migration.json path/to/your/src
```

The profile never renames an `lr-*` tag or import. It inserts attributes only when absent:

| Component      | Lyra 7 behavior made explicit                                                   |
| -------------- | ------------------------------------------------------------------------------- |
| `<lr-popup>`   | `strategy="fixed"`, `placement="bottom-start"`, `distance="4"`, `flip`, `shift` |
| `<lr-popover>` | `placement="bottom-start"`, `distance="4"`, `without-arrow`                     |
| `<lr-tooltip>` | `distance="6"`, `without-arrow`                                                 |

Boolean `true` is emitted as canonical attribute presence; the positive inverse
`without-arrow` is used instead of serializing `arrow="false"`. Existing explicit values are
untouched. An opaque framework attribute spread or DOM alias blocks that component profile across
the scanned target set with a location-aware warning, so the tool cannot silently insert a default
beside a value it cannot see. Review or expand the dynamic value, rerun, then apply without
`--dry-run`; a final run should report no changes.

The inventory does not treat `dir` or `lang` as component-member drift: both are platform-global
HTML passthrough attributes. It likewise excludes Web Awesome's `did-ssr` hydration marker, which is
upstream runtime bookkeeping rather than an authored member to copy onto a Lyra component.

The same inventory reviews accessibility behavior separately from static API shape. Every one of
the 145 pinned upstream mappings names an upstream and Lyra behavior profile covering semantics,
naming, keyboard, focus, state, announcements, and motion. It stores the exact missing/additive
comparison and a rationale; an automatic mapping is rejected if its target profile drops a reviewed
behavior. These profiles summarize published public contracts and Lyra's authored contract plus
automated tests. They are not evidence of manual screen-reader, assistive-technology, or human
accessibility review; see [the accessibility evidence statement](../../docs/accessibility.md).

Shoelace is now a historical predecessor to Web Awesome, but its component vocabulary remains
familiar to many teams. The table below is a porting guide, not an automatic-rename allowlist; the
inventory classification and codemod report decide which individual uses are mechanically safe:

| Shoelace                             | Lyra                                 | Migration note                                                                                                                                           |
| ------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<sl-button>`                        | `<lr-button>`                        | Check `variant`, `appearance`, and loading behavior.                                                                                                     |
| `<sl-input>` / `<sl-textarea>`       | `<lr-input>` / `<lr-textarea>`       | String `autocorrect` property writes remain accepted but read back as booleans; preserve the native editing/form contract and review label/error markup. |
| `<sl-select>` / `<sl-option>`        | `<lr-select>` / `<lr-option>`        | `defaultSelected`/the `selected` attribute is the reset default; live `selected` is property-only. Review option and value events.                       |
| `<sl-dialog>` / `<sl-drawer>`        | `<lr-dialog>` / `<lr-drawer>`        | Review close reasons, focus behavior, and slots.                                                                                                         |
| `<sl-card>` / `<sl-badge>`           | `<lr-card>` / `<lr-badge>`           | Review appearance tokens and dismiss events.                                                                                                             |
| `<sl-alert>`                         | `<lr-alert>`                         | Closed by default, with the same properties, slots, lifecycle, parts, and identity-preserving `toast()` contract under the `lr-` prefix.                 |
| `<sl-spinner>` / `<sl-progress-bar>` | `<lr-spinner>` / `<lr-progress-bar>` | Built-in status copy is localized through Lyra's runtime.                                                                                                |

For either migration, start with the codemod report. Update a package import or custom-element prefix
only for an automatic row, or after completing the manual port named by a warning; then run the
component's accessibility story and check its API notes for behavior that cannot be inferred from
the tag name alone. Lyra's own `--lr-theme-*` variables are the only theme inputs it reads. For a
staged Web Awesome migration, map existing values explicitly in application CSS; Lyra does not read
competitor token variables itself.

Everything else in the tables below — marked `— (extra)` — has no Web Awesome equivalent to
migrate _from_ in the first place, so there's nothing to rename: install the package and import
what you need (see Usage above). That's most of this library, including every dashboard atom
(stat cards, gauges, empty/skeleton states), the whole chart family, the temporal/graph/tree
components, `<lr-map>`, and the entire **Conversation & Agent UI** family (chat messages,
streaming text, tool-call chips/dialogs, citations, model/settings pickers, and more) — Web
Awesome has no chat/agent UI component family at all.

## Theming, internationalization & RTL

Every component is built on the same three guarantees, verified across the whole library rather
than opt-in per component:

**Theming.** Components read independent `--lr-theme-*` variables and standalone defaults. Lyra
does not depend on another library's theme or token namespace. For a ready-made light/dark base
theme, import `@aceshooting/lyra-ui/theme.css` once and toggle `.lr-light`/`.lr-dark` (or the
matching `data-lr-theme` attribute) on an ancestor:

```css
@import "@aceshooting/lyra-ui/theme.css";
```

Tooling can consume the canonical DTCG interchange document from
`@aceshooting/lyra-ui/design-tokens.json`. The generated
`@aceshooting/lyra-ui/design-tokens.css` entry supplies explicit light/dark fixture selectors for
previews and design-tool validation; it is not a replacement for the production `theme.css`.

```html
<body class="lr-dark">
  <lr-button variant="brand">Save</lr-button>
</body>
```

Applications can override any `--lr-theme-*` input directly:

```css
:root {
  --lr-theme-color-surface-default: #101827;
  --lr-theme-color-text-normal: #f8fafc;
  --lr-theme-color-brand-fill-loud: #60a5fa;
  --lr-theme-font-size-m: 1rem;
  --lr-theme-border-radius-m: 0.5rem;
}
```

`theme.css` declares `@layer lr-base, lr-theme, lr-utilities, lr-overrides` and puts its own tokens
in `lr-theme`, so an _unlayered_ rule of yours — like the `:root` block above — wins over every Lyra
declaration regardless of specificity or which stylesheet the bundler emitted first. The optional
`native.css` and `utilities.css` assets use `lr-base` and `lr-utilities`; `lr-overrides` remains
available for application rules. See [`llms/tokens.md`](./llms/tokens.md) for the complete shared token list.
Component-specific `--lr-*` custom properties remain available for local overrides.

Canvas components automatically repaint after observable theme attributes, stylesheet/link nodes,
CSSOM changes, adopted stylesheets, and relevant media-query changes. If an application theme engine
changes computed tokens through another mechanism, invalidate the owning browser realm explicitly:

```ts
import { invalidateLyraTheme } from "@aceshooting/lyra-ui/utilities/theme.js";

invalidateLyraTheme(); // global document realm
invalidateLyraTheme(shadowRoot); // realm owning this root, element, or document
```

The optional argument selects a realm, not a subtree. Calls are safe during SSR and coalesce into
each connected canvas consumer's normal redraw schedule.

**Optional light-DOM styles.** Import either bundle independently when an application wants Lyra's
token vocabulary outside component shadow roots:

```css
@import "@aceshooting/lyra-ui/native.css";
@import "@aceshooting/lyra-ui/utilities.css";
```

`native.css` styles only native descendants of an explicit `.lr-native` scope; it has no root reset
and does not style the scope marker itself. `utilities.css` provides exact, low-specificity `lr-*`
classes for layout, logical sizing, gap/alignment/wrap, prose/text, accessible hiding, FOUCE, and
`<lr-page>` mobile/desktop allocation helpers. Both are layered, tokenized, RTL-safe, and optional.
See [`llms/shared.md`](./llms/shared.md#optional-native-styles-and-css-utilities) for the complete
class inventory and override hooks.

**Frontend quality guarantees.** Every component is designed as a native custom element and tested
for the contract that applies to its shape: semantic roles and accessible names inside shadow DOM,
keyboard navigation, bubbling/composed public events, native form association and validity, logical
CSS for RTL, narrow-container layouts, reduced motion, and forced-colors behavior. Form controls
expose label, hint, error, focus, editing, reset, and validity behavior instead of hiding the useful
native contract behind a private input. Heavy integrations such as Chart.js, MapLibre, D3, Shiki,
Markdown, phone-number metadata, and flag artwork remain optional peer dependencies.

**Internationalization.** Every built-in string (button labels, status announcements,
`aria-label`s) resolves through a small runtime, in two ways you can combine:

```ts
import {
  registerLyraLocale,
  setLyraLocale,
} from "@aceshooting/lyra-ui/localization.js";

// App-wide: register translations once, anywhere in the app.
registerLyraLocale("fr", { close: "Fermer", retry: "Réessayer" /* ... */ });
setLyraLocale("fr"); // or just set <html lang="fr">/an ancestor `lang` — components pick it up
```

The dedicated `localization.js` entry is side-effect-free: it does not register the component
graph. The package root continues to re-export the same runtime for compatibility, but importing
the root remains registration-free in v8.

```html
<!-- Per-instance: override specific keys on one element without a global registry. -->
<lr-toast .strings=${{ close: 'Fermer' }}></lr-toast>
```

No rebuild, no per-locale bundle, no per-component API to learn — register the strings once and
every component that uses that key picks it up reactively, including ones added after your app's
first render.

Lyra's default messages are English fallbacks, while applications own the translated catalog. Date,
number, byte, relative-time, and calendar formatting use the browser's `Intl` APIs and the resolved
locale. Consumer-provided labels, values, file names, and message content are never altered by the
localization layer. The same runtime also covers accessible names, descriptions, validation messages,
live-region announcements, empty states, status labels, and action buttons; use `.strings` for a
component-specific override when needed.

**RTL.** Set `dir="rtl"` on `<html>` or any ancestor — every component mirrors its layout
automatically via CSS logical properties and swaps directional keyboard navigation (e.g. the arrow
keys in a date grid or a roving-tabindex list) to match. `lang`/`locale` select translations and
`Intl` data but do not silently change writing direction; pair `lang="ar"`, `lang="he"`, or
`lang="fa"` with `dir="rtl"`. Components do not force their own `dir`, so they remain composable
inside mixed-direction layouts.

## Component status, versioning, and deprecation

Every component carries an explicit `stable` or `experimental` status plus the earliest published
`since` version in the manifest and generated reference. Stable components are production-ready.
Experimental components remain open to design review, but once published their public APIs receive
the same semver protection as stable components; experimental is not permission for a silent minor
release break.

Deprecation is separate metadata. A deprecated component or member names its replacement,
deprecation version, rationale, and earliest removal version. If deprecated in major version M, it
remains available for the complete M+1 line and cannot be removed before M+2. See
[`llms/shared.md`](./llms/shared.md#component-status-versioning-and-deprecation) for the full policy.

## SSR & Declarative Shadow DOM

Every Lyra entry point is server-safe under Node 20+ — the package root, `all.js`, the family
barrels, and every granular registration module alike. The `@aceshooting/lyra-ui/ssr-loader.js`
entry installs Lit's hydration hook before registering Lyra (it still pulls the whole `all.js`
closure, so it is unaffected by the 8.0.0 root split) and exports the machine-readable
`LYRA_SSR_SUPPORT_MATRIX`. New integrations that want granular registration can import
`@aceshooting/lyra-ui/hydration.js` first instead, then their own component modules. The matrix has
two explicit tiers:

- `render-and-hydrate` components emit Declarative Shadow DOM (DSD) and reuse that shadow root and
  its nodes during browser hydration.
- `client-render` components preserve the host, serializable attributes, and light DOM in the
  server response, then create their shadow DOM when the browser upgrades them. This tier covers
  components whose initial render needs light-DOM traversal, layout, canvas, observers, or media
  APIs that Lit's intentionally small server DOM does not emulate.

Configure Lit's server renderer with Lyra's fallback before `LitElementRenderer`:

```ts
import {
  lyraSsrElementRenderers,
  LYRA_SSR_SUPPORT_MATRIX,
} from "@aceshooting/lyra-ui/ssr-loader.js";
import { render, LitElementRenderer } from "@lit-labs/ssr";
import { collectResult } from "@lit-labs/ssr/lib/render-result.js";
import { html } from "lit";

const result = render(html`<lr-page><main>Dashboard</main></lr-page>`, {
  elementRenderers: lyraSsrElementRenderers(LitElementRenderer),
});
const markup = await collectResult(result);
```

On the client, make the loader the first import that can reach Lit; it installs
`@lit-labs/ssr-client/lit-element-hydrate-support.js` before loading component definitions:

```ts
import {
  diagnoseLyraHydration,
  getLyraSsrMode,
} from "@aceshooting/lyra-ui/ssr-loader.js";

const diagnostics = await diagnoseLyraHydration(document);
```

Root-excluded optional-peer families still use their granular registration import after the loader;
the loader does not make optional peers eager. Property bindings cannot be serialized by a fallback
renderer, so express initial fallback state as attributes/light DOM or assign properties on the
client. A `render-and-hydrate` component whose rendering depends on something only a browser can
answer — its own light-DOM children, or a browser global such as `EyeDropper` — reproduces the
server's answer on the hydrating render and corrects itself on the very next update rather than
contradicting the markup it is hydrating, so a slotted override or an eyedropper button appears one
frame after hydration. A browser-only mount (no server markup) is unaffected and still renders the
final result the first time. Layout measurement, observers, canvas, and media playback start after hydration; remote
content remains client-only. CI renders every inventory tag, verifies both tiers, and crawls a real
Chromium DSD response (including `lr-page`) with strict hydration warnings/errors and DOM-identity
checks. The exported matrix is the authoritative per-tag list as components evolve.

## Framework integration (React, Vue, Angular, Svelte)

Lyra ships plain custom elements with no framework-specific wrapper package, so the friction is the
same friction any custom-element library has with a non-Lit framework, not anything Lyra-specific:

For tag, property, event, element-ref, and CSS-custom-property types in framework templates, import
the matching opt-in declaration entry once in your application's type graph:

```ts
import type {} from "@aceshooting/lyra-ui/custom-elements-jsx"; // React 19 / JSX
import type {} from "@aceshooting/lyra-ui/vue";
import type {} from "@aceshooting/lyra-ui/svelte";
```

These entry points are generated from the same Custom Elements Manifest as the editor metadata.
They contain types only: they add no runtime wrapper or framework dependency, and they do not
register elements. Keep importing the granular registration modules your application uses, for
example `import '@aceshooting/lyra-ui/components/lr-input.js'`.

- **Property vs. attribute binding.** A complex-typed property (an object, array, or function — e.g.
  `.strings`, `.selectedRows`, `.markers`) must be bound as a JS _property_, not a stringified
  attribute. Use Vue's `:prop` binding (or the `.prop` modifier), Angular's `[prop]="value"` template
  binding, or a plain property assignment; Svelte's compiler binds to a matching element property
  automatically when one exists, so `prop={value}` mostly just works. A bare `attr="value"` or string
  interpolation only ever sets a string attribute — fine for `variant="brand"`, wrong for anything
  non-string.
- **Angular needs `CUSTOM_ELEMENTS_SCHEMA`.** Angular's template compiler rejects unknown elements
  and properties by default. Add `schemas: [CUSTOM_ELEMENTS_SCHEMA]` to the module (or standalone
  component) that uses any `<lr-*>` tag so Angular stops trying to resolve it as an Angular
  component.
- **Custom events need the framework's DOM event-binding syntax, not its component-event
  shorthand.** A framework's usual event shorthand (Vue's `@event` on a _Vue component_, Angular's
  `(event)` output binding) is wired for that framework's own event system; a plain custom element's
  events are native `CustomEvent`s and need the same binding path used for native DOM events —
  `onlr-change={handler}` in React 19, `@lr-change="handler"` in Vue,
  `(lr-change)="handler()"` in Angular, or `onlr-change={handler}` in Svelte 5
  (`on:lr-change={handler}` remains accepted by Svelte's legacy event-directive syntax). Use
  `element.addEventListener('lr-change', handler)` directly when a template binding isn't
  available. Lyra's own event names are consistently kebab-case (`lr-change`, `lr-cell-click`,
  `lr-selection-change`, …) rather than camelCase, specifically to stay friendly to this binding
  path — some other custom-element libraries use camelCase event names, which can silently fail to
  bind in an in-DOM (non-compiled) Vue template because HTML attribute/directive names are
  case-insensitive there; `addEventListener` works regardless of case either way.

## Editor autocomplete (VS Code, JetBrains)

TypeScript consumers already get tag/attribute completion for free from the generated
`HTMLElementTagNameMap`. Plain HTML, and in-DOM Vue or Angular templates, don't go through that type
graph, so this package also ships small editor data files generated from `custom-elements.json`:
`vscode-html-data.json` (tag and attribute completion, with slot and CSS-part reference tables in
each tag's hover description) and `vscode-css-data.json` (every `--lr-*` custom property). Point VS Code's
[`html.customData`](https://code.visualstudio.com/docs/languages/html#_html-custom-data) and
[`css.customData`](https://code.visualstudio.com/docs/languages/css#_css-custom-data) settings at
them — typically in a workspace `.vscode/settings.json` so the whole team picks it up:

```json
{
  "html.customData": [
    "./node_modules/@aceshooting/lyra-ui/vscode-html-data.json"
  ],
  "css.customData": ["./node_modules/@aceshooting/lyra-ui/vscode-css-data.json"]
}
```

Both settings accept an array, so add these alongside any other custom-data files the workspace
already references. WebStorm/IntelliJ users get the same tag, attribute, and custom-property
completion automatically from the bundled `web-types.json` — JetBrains IDEs pick up a dependency's
`web-types.json` with no extra configuration once the package is installed. The selected plain
custom-element schemas do not define structural slot or CSS-part completion fields, so those names
remain available as reference prose in each element's hover description rather than as completion
items.

Build tools can import the published manifest directly through its explicit package export:

```ts
import manifest from '@aceshooting/lyra-ui/custom-elements.json' with { type: 'json' };
```

## Components

The catalog below lists all 284 tags in the current Custom Elements Manifest, grouped by
capability. The manifest and live docs are the authoritative sources for the complete generated
API details.

**Form controls, toasts, sparkline, and flags**

| Component                                    | Mirrors                                                                         | Notes                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-combobox>` + `<lr-option>`              | `wa-combobox` / `wa-option` / `sl-option`                                       | Filterable single/multi select, form-associated; options separate live `selected` from attribute-backed/reset `defaultSelected`; `xs`–`xl` sizing; async rich rows and retained selection payloads via `source`/`selectedRows`; virtual scrolling with `max-render` |
| `<lr-select>`                                | `wa-select` / `sl-select`                                                       | Closed-list single-select, button trigger (not a text input, no filtering); form-associated, shares `<lr-option>` with `lr-combobox`                                                                                                                                |
| `<lr-date-picker>`                           | `wa-date-picker`                                                                | Inline calendar, single + range                                                                                                                                                                                                                                     |
| `<lr-date-input>`                            | `wa-date-input`                                                                 | Date field + calendar popover, form-associated                                                                                                                                                                                                                      |
| `<lr-phone-input>`                           | — (extra)                                                                       | Country-aware telephone field with canonical E.164 form values; numbering metadata is supplied through an optional adapter                                                                                                                                          |
| `<lr-toast>` + `<lr-toast-item>` + `toast()` | `wa-toast` / `wa-toast-item`                                                    | Stacking notifications                                                                                                                                                                                                                                              |
| `<lr-sparkline>`                             | `wa-sparkline`                                                                  | Zero-dependency inline SVG                                                                                                                                                                                                                                          |
| `<lr-textarea>`                              | `wa-textarea` / `sl-textarea`                                                   | Form-associated multiline field with label/hint/error chrome, auto-resize, native editing passthrough, and caret APIs                                                                                                                                               |
| `<lr-input>`                                 | `wa-input` / `sl-input`                                                         | Form-associated single-line field (`text`/`password`/`email`/`number`) with label/hint/error chrome and a built-in password-visibility toggle                                                                                                                       |
| `<lr-number-input>` + `<lr-time-input>`      | `wa-number-input` / `wa-time-input`                                             | Numeric input and locale-aware segmented time input                                                                                                                                                                                                                 |
| `<lr-native-time-input>`                     | — (extra)                                                                       | Preserved browser-native time field for Lyra 7 compatibility                                                                                                                                                                                                        |
| `<lr-color-picker>`                          | `wa-color-picker` / `sl-color-picker`                                           | Form-associated native color picker with label/hint chrome                                                                                                                                                                                                          |
| `<lr-checkbox-group>`                        | `wa-checkbox-group`                                                             | Form-associated group of checkboxes with array values and group validation                                                                                                                                                                                          |
| `<lr-token-input>`                           | — (extra)                                                                       | Editable, removable form-associated token list                                                                                                                                                                                                                      |
| `<lr-icon>` + `<lr-icon-button>`             | `wa-icon` / `sl-icon` / `sl-icon-button`                                        | Dependency-free SVG icons and accessible icon-only actions                                                                                                                                                                                                          |
| `<lr-button>`                                | `wa-button` / `sl-button`                                                       | Generic action-button primitive (`variant`/`appearance`/`size`/`loading`), owns `type="submit"`/`"reset"` via its browser-resolved form owner, including an external owner named by `form`                                                                          |
| `<lr-radio>` + `<lr-radio-group>`            | `wa-radio` / `wa-radio-group` / `sl-radio` / `sl-radio-group`                   | Form-associated single-choice controls with roving arrow-key navigation and group validation                                                                                                                                                                        |
| `<lr-radio-button>`                          | `sl-radio-button`                                                               | The same single-choice control rendered as a button; a `LyraRadio` subclass, so a `<lr-radio-group>` accepts either tag and consecutive siblings collapse into one segmented control                                                                                |
| `<lr-otp-input>`                             | `wa-otp-input`                                                                  | Form-associated one-time-code field — presentational segments over one real input, so paste, SMS autofill and mobile keyboards work natively and the control stays one tab stop                                                                                     |
| `<lr-spinner>`                               | `wa-spinner` / `sl-spinner`                                                     | Localized indeterminate busy indicator with reduced-motion support                                                                                                                                                                                                  |
| `<lr-progress-bar>` + `<lr-progress-ring>`   | `wa-progress-bar` / `wa-progress-ring` / `sl-progress-bar` / `sl-progress-ring` | Determinate or indeterminate progress indicators                                                                                                                                                                                                                    |
| `<lr-flag>`                                  | — (extra)                                                                       | Country/language flags for i18n pickers — needs the optional peer `@aceshooting/lyra-flags`                                                                                                                                                                         |
| `<lr-locale-picker>`                         | — (extra)                                                                       | Closed-list locale switcher over the library's own locale registry (`getRegisteredLyraLocales()`) or an explicit `locales` catalog; selecting a row calls `setLyraLocale()` unless `lr-change` is cancelled                                                         |

**Additional media and interaction primitives**

| Component                              | Mirrors                                   | Notes                                                                              |
| -------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `<lr-animated-image>`                  | `wa-animated-image` / `sl-animated-image` | Animated image playback with a captured still frame and reduced-motion support     |
| `<lr-animation>`                       | `wa-animation` / `sl-animation`           | Web Animations API wrapper for declarative preset or custom animations             |
| `<lr-avatar-group>`                    | — (extra)                                 | Responsive avatar grouping with a localized overflow indicator                     |
| `<lr-include>`                         | `wa-include` / `sl-include`               | Loads sanitized HTML or text content from a URL                                    |
| `<lr-known-date>`                      | `wa-known-date`                           | Form-associated date entry control with separate day, month, and year fields       |
| `<lr-lightbox>`                        | — (extra)                                 | Full-screen modal image viewer with navigation and pan/zoom                        |
| `<lr-qr-code>`                         | `wa-qr-code` / `sl-qr-code`               | Canvas QR renderer; needs the optional peer `qrcode`                               |
| `<lr-random-content>`                  | `wa-random-content`                       | Random, unique, or sequential slotted-content selection with autoplay              |
| `<lr-timeline>` + `<lr-timeline-item>` | — (extra)                                 | Vertical or horizontal chronological event layout                                  |
| `<lr-tour>`                            | — (extra)                                 | Anchored onboarding tour with spotlight, keyboard navigation, and focus management |

**Dashboard atoms**

| Component                    | Mirrors                                         | Notes                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-empty>`                 | — (extra)                                       | Generic empty/no-data state                                                                                                                                                                                          |
| `<lr-skeleton>`              | `wa-skeleton` / `sl-skeleton`                   | Loading placeholder (pulse/sheen)                                                                                                                                                                                    |
| `<lr-scroller>`              | `wa-scroller`                                   | Responsive overflow surface with optional navigation controls                                                                                                                                                        |
| `<lr-resize-observer>`       | `wa-resize-observer` / `sl-resize-observer`     | Lifecycle-managed ResizeObserver for slotted elements                                                                                                                                                                |
| `<lr-intersection-observer>` | `wa-intersection-observer`                      | Lifecycle-managed IntersectionObserver for slotted elements                                                                                                                                                          |
| `<lr-mutation-observer>`     | `wa-mutation-observer` / `sl-mutation-observer` | Lifecycle-managed MutationObserver for slotted elements                                                                                                                                                              |
| `<lr-stat>`                  | — (extra)                                       | KPI/stat card with trend pill and an optional breakdown row list; either can carry an `exactValue` shown as a hover/focus tooltip alongside the rounded/formatted display value                                      |
| `<lr-data-grid>`             | `wa-data-grid`                                  | Virtualized client/server data grid with sorting, filtering, grouping, selection, column controls, tree/detail rows, paging, CSV export, and the complete experimental 3.11 public surface                           |
| `<lr-table>`                 | — (extra)                                       | Sort/select-aware data table with optional controlled filtering, client/server-friendly pagination, loading state, consumer-owned inline editing, expandable rows, sticky columns, and responsive `priority` columns |
| `<lr-pagination>`            | `wa-pagination`                                 | Controlled previous/next and validated page-jump navigation with a localized range summary, loading/empty states, RTL icons, and container-responsive stacking                                                       |
| `<lr-gauge>`                 | — (extra)                                       | Radial, full-circle ring, or linear meter with a per-instance fill token                                                                                                                                             |
| `<lr-export-button>`         | — (extra)                                       | Injection-safe CSV/JSON downloads plus event-handled custom format descriptors and controlled busy state                                                                                                             |
| `<lr-copy-button>`           | `wa-copy-button` / `sl-copy-button`             | Standalone icon-only copy-to-clipboard button for a plain text value, no positioning opinion                                                                                                                         |
| `<lr-multi-split>`           | — (extra)                                       | Resizable multi-panel layout; one pane can opt into responsive `collapse` (`"start"`/`"end"`) to a fixed-width rail, then a floating overlay card, as the split's container narrows                                  |
| `<lr-split-panel>`           | `wa-split-panel` / `sl-split-panel`             | Exact two-pane split contract with named `start`/`end` content, percent/pixel positioning, primary-pane sizing, snapping, constraints, and an accessible divider                                                     |
| `<lr-widget>`                | — (extra)                                       | Card shell with collapsible header, fullscreen, and customizable chrome                                                                                                                                              |
| `<lr-word-cloud>`            | — (extra)                                       | Zero-dependency SVG word/tag cloud, spiral-placed by weight                                                                                                                                                          |
| `<lr-badge>` + `<lr-tag>`    | `wa-badge` / `wa-tag` / `sl-badge` / `sl-tag`   | Compact semantic status labels                                                                                                                                                                                       |
| `<lr-alert>`                 | `sl-alert`                                      | Closed-by-default inline alert with timed dismissal, countdown, and identity-preserving toast promotion                                                                                                              |
| `<lr-callout>`               | `wa-callout`                                    | Dismissible inline status, warning, and error message surface                                                                                                                                                        |
| `<lr-divider>`               | `wa-divider` / `sl-divider`                     | Horizontal or vertical semantic separator                                                                                                                                                                            |
| `<lr-rating>`                | `wa-rating` / `sl-rating`                       | Keyboard-accessible star rating slider                                                                                                                                                                               |

**Temporal & graph**

| Component                      | Mirrors                                                 | Notes                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-time-range>`              | — (extra)                                               | Two-handle brush/scrubber over a numeric domain                                                                                                                                                                                                                                                                               |
| `<lr-sequence-playback>`       | — (extra)                                               | Play/pause sequence index stepper over `itemCount`, with `currentIndex` and `lr-sequence-step`                                                                                                                                                                                                                                |
| `<lr-heatmap>`                 | — (extra)                                               | DPR-aware Canvas heatmap with matrix and calendar (`mode="calendar"`) layouts, `fit-to-width` responsive scaling                                                                                                                                                                                                              |
| `<lr-sequence-strip>`          | — (extra)                                               | Compact, one-thin-cell-per-item strip visualizing a sequence of categorical states with an optional secondary per-cell marker — pure CSS/flex, no chart.js/SVG/canvas; a named roving `role="list"` whose `role="listitem"` cells are individually inspectable with Arrow/Home/End navigation but deliberately non-activating |
| `<lr-graph>`                   | — (extra)                                               | Force-directed node-link diagram with pan/zoom/drag, directed/styled relationship links, and rich accessible metadata — needs the optional peer deps `d3-force`, `d3-drag`, `d3-zoom`, `d3-selection`                                                                                                                         |
| `<lr-tree>` + `<lr-tree-item>` | `wa-tree` / `wa-tree-item` / `sl-tree` / `sl-tree-item` | Expand/collapse hierarchy with structured icon/label/description/badge rows, optional richer accessible labels, and APG tree keyboard navigation                                                                                                                                                                              |

**Flow canvas — workflow & DAG diagramming**

| Component              | Mirrors   | Notes                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<lr-flow-canvas>`     | — (extra) | Pannable/zoomable DAG workflow canvas — positions node cards, draws SVG edges, and runs a shared layered auto-layout for unpositioned nodes; readonly (viewer) by default, opt into editor gestures individually via `nodes-draggable`/`connectable`/`droppable`; a controlled component, never mutates `nodes`/`edges` itself |
| `<lr-flow-node>`       | — (extra) | The default workflow node card — header/body/toolbar chrome, tool-lifecycle `status` tones, and named connection-handle elements edges anchor to; purely presentational, used as `lr-flow-canvas`'s default card, a slotted override, or standalone                                                                            |
| `<lr-flow-minimap>`    | — (extra) | Corner overview map of a `lr-flow-canvas` — scaled node rectangles plus a draggable viewport rectangle; resolves its target canvas via `for` (or the nearest ancestor) and reads geometry only from the canvas's `registerCompanion()` snapshots, never `nodes` directly                                                       |
| `<lr-flow-controls>`   | — (extra) | The canvas's zoom-in/zoom-out, fit, and interaction-lock button cluster; drives only view state on a resolved `for` canvas, never touches `nodes`/`edges`                                                                                                                                                                      |
| `<lr-node-palette>`    | — (extra) | Searchable, categorized node library for workflow editors — drag an item onto a canvas or place it by keyboard, emitting `lr-palette-place`/`lr-select`; never creates nodes or touches a canvas's data itself                                                                                                                 |
| `<lr-flow-run-status>` | — (extra) | Execution-state companion for a `lr-flow-canvas` — pushes a `FlowRunDecorations` map into the resolved canvas and renders a compact "{done} of {total} steps complete" run-summary strip; pure pushed state, never executes or polls anything                                                                                  |

**Knowledge graph & RAG exploration**

| Component                       | Mirrors   | Notes                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-graph-legend>`             | — (extra) | Node-type legend for a paired `lr-graph` — one swatch/label/count row per node type, doubling as visibility filters via `lr-visibility-change`; never reads or writes a graph directly                                                                                                                                                                                                    |
| `<lr-entity-card>`              | — (extra) | Knowledge-graph entity dossier card — type badge, description, key/value property rows, degree, community chip, and a built-in "focus in graph" action (`lr-entity-activate`); never fetches or focuses a graph itself                                                                                                                                                                    |
| `<lr-entity-chip>`              | — (extra) | Inline `@entity` mention for agent prose — flow content, keyboard-focusable, with a hover/focus preview popover; the knowledge-graph sibling of `lr-citation-badge`, carrying ids through events only                                                                                                                                                                                     |
| `<lr-neighbor-list>`            | — (extra) | One entity's relationship rows — relation, direction, neighbor — with per-row navigate and expand-in-graph affordances; never computes neighbors itself or mutates a graph                                                                                                                                                                                                                |
| `<lr-path-strip>`               | — (extra) | Compact, horizontally scrollable node → relation → node chain rendering "why A connects to B" (GraphRAG local-search reasoning paths); one-dimensional and presentational, no path finding                                                                                                                                                                                                |
| `<lr-community-card>`           | — (extra) | GraphRAG community/cluster summary card — label, LLM summary excerpt, member count, member chips with overflow, and a drill-in action (`lr-drill`); doesn't own community rendering or membership fetching                                                                                                                                                                                |
| `<lr-chunk-inspector>`          | — (extra) | Ranked retrieved-chunks list — relevance score bars with tier tones, expandable chunk text, and a `lr-chunk-open` deep-link event that lands a chunk in `lr-document-viewer`; never fetches, ranks, or dedupes                                                                                                                                                                            |
| `<lr-source-picker>`            | — (extra) | Checkbox tree/list scoping which sources ground the next answer — tri-state folders, select-all, type icons, search; deliberately not form-associated, an immediate app-state scoping panel wired through `lr-sources-change`                                                                                                                                                             |
| `<lr-provenance-panel>`         | — (extra) | Sectioned grounding-breakdown disclosure panel for one answer (Entities / Relationships / Communities / Text chunks), composing `lr-entity-chip`/`lr-path-strip`/`lr-community-card`/`lr-chunk-inspector`; pure projection and event conduit, no fetching                                                                                                                                 |
| `<lr-mind-map>`                 | — (extra) | Radial expandable topic tree (NotebookLM-style mind map) — zero-dependency SVG with a closed-form radial layout; hierarchy only, no cross-links, force simulation, communities, or edge labels (that's `lr-graph`)                                                                                                                                                                        |
| `<lr-knowledge-graph-explorer>` | — (extra) | Orchestration-level surface for exploring a knowledge graph — the `lr-graph` canvas plus entity search, type filters, neighborhood expansion, pinned nodes, path finding between pins, and a details overlay; composes `lr-graph`, `lr-graph-legend`, `lr-entity-card`, `lr-neighbor-list`, `lr-path-strip`, and `lr-popover.showAt()` rather than re-implementing graph rendering itself |
| `<lr-graph-query-builder>`      | — (extra) | Editor for a single typed relationship/path filter (`GraphQuery`) over a knowledge graph — start/end entity anchors, relationship-type and node-type pickers with a removable active-filter chip display, a traversal direction, a min/max hop range, validation, and a host-persisted saved-query list; a serializable query model for GraphRAG workflows                                |
| `<lr-entity-dossier>`           | — (extra) | Full entity detail surface — a persistent header (`lr-entity-card` plus a confidence `lr-stat`) above an `lr-tab-group` strip for Relationships (`lr-neighbor-list`), Supporting chunks (`lr-chunk-inspector`), and Provenance (`lr-provenance-panel`); pure layout, never fetches or mutates graph/document state                                                                        |
| `<lr-embedding-explorer>`       | — (extra) | Accessible SVG projection of host-provided embedding points with cluster coloring, filtering, roving keyboard focus, and `lr-point-select`; it never computes embeddings or owns dimensionality reduction                                                                                                                                                                                 |

**Retrieval & grounding**

| Component                 | Mirrors   | Notes                                                                                                                                                                                                                                                                                                                |
| ------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-retrieval-search>`   | — (extra) | Query bar for a retrieval/RAG surface — query text, an active-filter/scope chip row, a vector/keyword/hybrid mode selector, and loading/error/empty status feedback; fully controlled, emits `lr-search` only and never performs retrieval itself                                                                    |
| `<lr-retrieval-results>`  | — (extra) | Orchestration-level ranked-chunk-list surface — deduplication, optional grouping by source, multi-selection, pagination/infinite loading, and a compact/expanded presentation switch; composes an `lr-chunk-inspector` per row and an internal `lr-virtual-list` for large result sets                               |
| `<lr-retrieval-trace>`    | — (extra) | Retrieval pipeline's stage timeline (query rewriting, embedding, retrieval, reranking, filtering) rendered through `lr-span-waterfall`, plus a disclosure list exposing each stage's evidence (chunks via `lr-chunk-inspector`, free-form text, and/or metadata); never fetches or computes retrieval results itself |
| `<lr-grounding-summary>`  | — (extra) | Claim-level scorecard for one generated answer — supported/unsupported claim counts, citation coverage, an optional confidence score, warnings, and (when supplied) a list of evidence citations; composes `lr-stat` and `lr-citation-badge`, pure projection and event conduit                                      |
| `<lr-claim-evidence>`     | — (extra) | One claim's support verdict, score, citations, and evidence excerpts, with typed citation activation for opening the original source                                                                                                                                                                                 |
| `<lr-context-inspector>`  | — (extra) | Inspection view of the exact context assembled for a model call — per-segment token estimates via `lr-context-meter`, source attribution via `lr-citation-badge`, copy/export affordances, and truncation-boundary/redaction-marker rendering; pure projection, never fetches, estimates, or redacts itself          |
| `<lr-rag-answer>`         | — (extra) | Grounded answer surface composing sanitized Markdown, claim-level grounding summary, citation badges, and source cards; controlled, localized, and emits citation/retry events without fetching data                                                                                                                 |
| `<lr-retrieval-compare>`  | — (extra) | Side-by-side comparison of retrieval runs, including latency, hit count, score, and overlapping source identifiers; controlled and computation-free                                                                                                                                                                  |
| `<lr-rag-eval-dashboard>` | — (extra) | Aggregate RAG quality scorecard for groundedness, citation coverage, relevance, recall, latency, and cost, with per-case drill-in events                                                                                                                                                                             |

**Knowledge base & document management**

| Component                   | Mirrors   | Notes                                                                                                                                                                                                                                                                                      |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<lr-knowledge-base>`       | — (extra) | Source list for a retrieval knowledge base — sync status, indexing health, permissions, and per-row create/sync/pause/delete affordances; a controlled data view that never syncs or indexes anything itself, only presents `sources` and emits request-only events                        |
| `<lr-ingestion-queue>`      | — (extra) | Controlled list of documents moving through an ingestion pipeline (upload → text extraction → chunking → embedding → indexing), each row showing its stage, progress, chunk/embedding counts, and a retry or cancel affordance; presentation only, virtualizes above `virtualizeAt` items  |
| `<lr-document-library>`     | — (extra) | Searchable, filterable inventory of documents with versions, tags, owners, freshness, and bulk selection; composes `lr-table` for the grid and `lr-input`/`lr-combobox` for search and tag-facet filtering — a controlled data view, no upload/sync/mutation of its own                    |
| `<lr-document-compare>`     | — (extra) | Side-by-side or inline comparison of two document versions, composed from `lr-diff-view` (`view="diff"`, the default) and `lr-document-preview` (`view="side-by-side"`), with proportional scroll sync and matching-highlight activation keeping the two independent preview panes aligned |
| `<lr-knowledge-base-admin>` | — (extra) | Tabbed knowledge-base operations shell composing source management and ingestion queue views; controlled, action-forwarding, and suitable for host-owned settings content                                                                                                                  |

**Agent runs & observability**

| Component              | Mirrors   | Notes                                                                                                                                                                                                                                                                                                          |
| ---------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-agent-run>`       | — (extra) | Top-level shell for one `AgentRun` — lifecycle-status badge, elapsed time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, plus `tasks`/`tools`/`reasoning`/`output` composition slots; a shell only, every piece of per-step rendering routes through an existing primitive |
| `<lr-agent-workspace>` | — (extra) | Responsive controlled AI workspace composing the transcript, composer, agent run, tool timeline, retrieval results, grounding summary, and context inspector, with replaceable message/details/composer slots                                                                                                  |
| `<lr-subagent-panel>`  | — (extra) | Parent/child agent hierarchy with lifecycle status, task summaries, and typed selection/cancel events; the host owns orchestration                                                                                                                                                                             |
| `<lr-agent-trace>`     | — (extra) | Provider-neutral agent/LLM trace view — a span-kind filter row, a handoff quick-jump list, and the full trace hierarchy, all rendered through `lr-trace-tree` over one shared `LyraSpan[]` array                                                                                                               |
| `<lr-mcp-app>`         | — (extra) | Sandboxed MCP Apps host with a required resource descriptor containing a non-empty URI and exactly one of HTML or source URL, plus CSP and permission-policy inputs; validates remote URLs, uses a no-referrer frame, and emits ready plus host-authorized request events                                      |
| `<lr-prompt-studio>`   | — (extra) | Versioned prompt editing and testing workspace with variable inputs, controlled run events, and version-selection events                                                                                                                                                                                       |
| `<lr-json-schema-viewer>` | — (extra) | Read-only, recursively rendered JSON Schema browser for tool inputs, structured outputs, and protocol payloads                                                                                                                                                                                              |
| `<lr-tool-timeline>`   | — (extra) | Chronological list of an agent run's tool/function calls, each rendered through `lr-tool-call-chip` (name/status/duration) and `lr-tool-result-view` (args/result), with per-entry retry counts, sensitive-field redaction, and a shared `lr-tool-approval-dialog` for entries gated behind human approval     |
| `<lr-memory-panel>`    | — (extra) | Agent working-memory surface — short-term context and long-term memories, each item's confidence and optional grounding provenance via `lr-provenance-panel`, with add/remove/forget actions gated behind an `lr-confirm-bar` confirmation step                                                                |
| `<lr-policy-summary>`  | — (extra) | Read-only list of guardrail, permission, privacy, and tool-policy decisions (`allow`/`deny`/`needs-review`), each with an always-visible, accessible explanation never conveyed by color alone; composes `lr-badge`, with `lr-details` for optional richer detail                                              |
| `<lr-approval-queue>`  | — (extra) | Keyboard-accessible pending human-approval list composing `lr-tool-approval-dialog`; forwards namespaced selection, decision, and close events without owning persistence                                                                                                                                      |

**Dashboards & orchestration**

| Component                | Mirrors   | Notes                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-dashboard-grid>`    | — (extra) | Responsive, keyboard-accessible widget grid — positions `layout` entries on a CSS Grid, composing `lr-widget` + `lr-widget-renderer` for each cell's default content, with drag/resize/collision handled as controlled events; readonly (viewer) by default, opt into editor gestures via `cells-draggable`/`cells-resizable`                                                      |
| `<lr-filter-bar>`        | — (extra) | Row of dashboard filters declared by the host (`filters`) rather than invented by this component — each composes an existing Lyra input (`lr-select`/`lr-combobox`/`lr-date-input`), plus a removable `lr-chip-group` summary and a reset button; controlled, emits a single `lr-input` carrying the full resulting value                                                          |
| `<lr-condition-builder>` | — (extra) | Composable condition builder for tabular/dashboard data — a flat list of field/operator/value rows combined with one AND/OR combinator; fully controlled, distinct from `lr-graph-query-builder`'s typed graph/path queries                                                                                                                                                        |
| `<lr-drilldown-panel>`   | — (extra) | Controlled navigation from a chart/table datum to its related evidence, documents, entities, or agent runs — a breadcrumb trail (`lr-breadcrumb`) over `path` plus, per category the current node has content for, the matching existing primitive (`lr-source-card`, `lr-document-preview`, `lr-entity-card`), wrapped in `lr-tab-group` only when more than one category applies |

**Evaluation**

| Component                   | Mirrors   | Notes                                                                                                                                                                                                                                                                                |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<lr-eval-dataset>`         | — (extra) | Dataset management for an evaluation suite — a filterable/taggable list of `EvalExample` rows via `lr-table`, an `lr-chip`/`lr-chip-group` tag-based browse filter, and add/remove/import/export affordances; fully controlled, never mutates `examples` or performs I/O itself      |
| `<lr-eval-run>`             | — (extra) | Evaluation batch's live progress — an overall `lr-progress-bar` counting terminal (done/error/cancelled) examples against the batch total, plus one `lr-details` disclosure per example showing input/output, an optional `lr-grounding-summary`, and an optional `lr-tool-timeline` |
| `<lr-eval-result>`          | — (extra) | Rubric scoring, human review, and comparison across a single evaluation example's runs — composes `lr-table` for the runs comparison table, `lr-rubric-form` for the selected run's human-review scoring, and `lr-diff-view` to compare a run's output against a baseline run        |
| `<lr-agent-eval-dashboard>` | — (extra) | Evaluation metric dashboard with locale-aware KPI cards, optional trend chart, and selectable run history; controlled and emits metric/run selection events                                                                                                                          |

**Overlays**

| Component                                         | Mirrors                                                                    | Notes                                                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-popover>` + `<lr-tooltip>` + `<lr-dropdown>` | `wa-popover` / `wa-tooltip` / `wa-dropdown` / `sl-tooltip` / `sl-dropdown` | Floating UI-positioned, RTL-aware overlay primitives with light dismiss and trigger ARIA wiring                                                                                  |
| `<lr-popup>`                                      | `wa-popup` / `sl-popup`                                                    | The low-level anchored-positioning primitive the three above are built on — placement, flip/shift, arrow and virtual anchoring, with no dismiss, focus or ARIA policy of its own |

**Charts**

| Component                                                                                                                                                            | Mirrors                                                                                                                                                     | Notes                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-chart>`                                                                                                                                                         | `wa-chart`                                                                                                                                                  | Core Chart.js wrapper (`LyraChartSeries`-based, plus raw `config` passthrough) with bounded `appendData()` streaming and `exportData('csv'          | 'png')`— needs`chart.js`, plus `chartjs-plugin-zoom`when`zoom`is enabled and`chartjs-plugin-datalabels`when`data-labels`/`stack-totals` is enabled |
| `<lr-bar-chart>`, `<lr-line-chart>`, `<lr-pie-chart>`, `<lr-doughnut-chart>`, `<lr-scatter-chart>`, `<lr-bubble-chart>`, `<lr-radar-chart>`, `<lr-polar-area-chart>` | `wa-bar-chart` / `wa-line-chart` / `wa-pie-chart` / `wa-doughnut-chart` / `wa-scatter-chart` / `wa-bubble-chart` / `wa-radar-chart` / `wa-polar-area-chart` | Typed `<lr-chart>` subclasses with tag-specific defaults and the full writable `LyraChartType` vocabulary — same optional peer deps as `<lr-chart>` |
| `<lr-box-plot>`                                                                                                                                                      | — (extra)                                                                                                                                                   | Box-and-whisker chart from precomputed five-number summaries — needs `chart.js` and `@sgratzl/chartjs-chart-boxplot`                                |
| `<lr-histogram>`                                                                                                                                                     | — (extra)                                                                                                                                                   | Bins raw values (`binValues()`) and renders a bar chart — same optional peer deps as `<lr-chart>`                                                   |
| `<lr-lite-chart>`                                                                                                                                                    | — (extra)                                                                                                                                                   | Dependency-free bar/line chart (plain SVG/DOM) with bounded `appendData()` streaming and `exportData('csv'                                          | 'svg')` — **no optional peer deps**, for projects that forbid a charting dependency outright                                                       |

**Map & file-input**

| Component         | Mirrors         | Notes                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<lr-map>`        | — (extra)       | maplibre-gl wrapper with declarative legend, choropleth GeoJSON layer, and point markers (via `markers` property), plus a raw `map` escape hatch — needs the optional peer `maplibre-gl` and an explicit `mapStyle` (see Install above); no third-party tile style is requested implicitly |
| `<lr-file-input>` | `wa-file-input` | Drag-drop + click-to-browse file dropzone, emits raw `File[]` (no CSV/XLSX parsing — that's host-specific)                                                                                                                                                                                 |

**Conversation & Agent UI — chat/agent product building blocks**

Web Awesome has no chat/agent UI component family at all, so every component in this table is
original to lyra-ui (`— (extra)`) — there's nothing to migrate from. See
[`llms-full.txt`](./llms-full.txt) for the full API (properties, events, parts, tokens) behind
each one-liner below.

| Component                                                                              | Mirrors                                                                                 | Notes                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lr-chat-message>`                                                                    | — (extra)                                                                               | Role-based (`user`/`assistant`/`system`) message bubble shell; avatar/badges header, status-aware footer (built-in retry on `status="failed"`), attachments strip — renders no message content itself, just the chrome around a slotted body                                                                      |
| `<lr-message-parts>`                                                                   | — (extra)                                                                               | Provider-neutral renderer for ordered text, reasoning, tool-call, tool-result, citation, file, and declarative widget parts                                                                                                                                                                                       |
| `<lr-chat-viewport>`                                                                   | — (extra)                                                                               | Transcript scroll container: stick-to-bottom while an answer streams, a "jump to latest" pill, and an unread divider; auto-detects slotted `<lr-chat-message>` children vs. a single nested `<lr-virtual-list>` (virtual mode) and defers scrolling to it                                                         |
| `<lr-prompt-input>`                                                                    | — (extra)                                                                               | Composite multimodal prompt surface for text, attachments, source selection, and send/stop behavior; deliberately event-submitted rather than a native successful form control                                                                                                                                    |
| `<lr-prompt-queue>`                                                                    | — (extra)                                                                               | Controlled queue of pending prompts with reorder, edit, remove, and submit-next request events                                                                                                                                                                                                                    |
| `<lr-selection-toolbar>`                                                               | — (extra)                                                                               | Contextual toolbar for actions on selected transcript text, positioned from a host-supplied selection rectangle                                                                                                                                                                                                   |
| `<lr-realtime-session>`                                                                | — (extra)                                                                               | Voice/realtime session controller surface that visualizes connection and speaking state and emits connect, disconnect, mute, and interrupt requests                                                                                                                                                               |
| `<lr-message-actions>`                                                                 | — (extra)                                                                               | Per-message action toolbar for `<lr-chat-message>`'s `actions` slot — opt-in copy/regenerate/edit/feedback built-ins plus a default slot for custom controls (e.g. a slotted `<lr-branch-picker>`); `role="toolbar"` with APG roving-tabindex across every stop                                                   |
| `<lr-message-feedback>`                                                                | — (extra)                                                                               | Thumbs up/down for one assistant message with an optional inline reason-chips + free-text comment disclosure; emits, never persists — the host reflects a prior rating back via `value`                                                                                                                           |
| `<lr-branch-picker>`                                                                   | — (extra)                                                                               | The "‹ 2 / 5 ›" navigator across regenerated/edited message variants; pure controlled (`lr-branch-change`, never mutates its own `index`) — same contract `<lr-pagination>` establishes for `page`; renders nothing while `count < 2`                                                                             |
| `<lr-typing-indicator>`                                                                | — (extra)                                                                               | Purely presentational "assistant is responding" cue; `dots`/`pulse`/`cursor` variants                                                                                                                                                                                                                             |
| `<lr-streaming-text>`                                                                  | — (extra)                                                                               | Token-coalescing incremental text renderer for streamed output; auto-detects Markdown (or force via `markdown`), optional blinking cursor                                                                                                                                                                         |
| `<lr-thinking-panel>`                                                                  | — (extra)                                                                               | Collapsible panel for an agent's intermediate reasoning transcript; `live` mode auto-scrolls (stick-to-bottom) while streaming, `post-hoc` doesn't                                                                                                                                                                |
| `<lr-activity-feed>`                                                                   | — (extra)                                                                               | Append-only streaming log of granular agent actions ("Searching the web…"), collapsing to a localized "Completed N steps" summary once the run ends; virtualizes above `virtualizeAt` entries, shares the `follow`/`lr-follow-change` stick-to-bottom contract                                                    |
| `<lr-task-list>`                                                                       | — (extra)                                                                               | Live, collapsible tracker for an agent's plan — ordered steps with per-step lifecycle status and one level of nested sub-steps; controlled `items`, mirrors `<lr-stepper>`'s `steps` contract but read-only (several steps can be `running` at once, no selection)                                                |
| `<lr-generation-metrics>`                                                              | — (extra)                                                                               | Ticking elapsed-time / token-count / throughput readout with explicit `idle`/`running`/`complete` status and a built-in Stop button while running                                                                                                                                                                 |
| `<lr-stream-status>`                                                                   | — (extra)                                                                               | Compact transport-health indicator (`idle`/`connecting`/`streaming`/`stalled`) with heartbeat-aware stall detection via `recordActivity()`                                                                                                                                                                        |
| `<lr-checkpoint>`                                                                      | — (extra)                                                                               | Inline conversation restore-point marker between messages; its Restore affordance confirms inline, then hands the host a `lr-restore` event — persists and restores nothing itself                                                                                                                                |
| `<lr-handoff-divider>`                                                                 | — (extra)                                                                               | Labeled separator marking control transfer between agents in a transcript ("Transferred to Research Agent"), with an optional agent avatar; purely presentational, announced once via an internal `<lr-live-region>` on connect                                                                                   |
| `<lr-markdown>`                                                                        | `wa-markdown`                                                                           | Sanitized Markdown → HTML (GFM tables, fenced code, links); lazy-loads the optional peers `marked` + `dompurify`                                                                                                                                                                                                  |
| `<lr-code-block>`                                                                      | — (extra)                                                                               | Fenced code display with a copy button, optional line numbers, lazy-loaded `shiki` grammars, and built-in GreyCat/GCL highlighting                                                                                                                                                                                |
| `<lr-artifact-panel>`                                                                  | — (extra)                                                                               | Shell around one agent-generated artifact — title/kind header, preview↔code toggle, version navigation with restore, a streaming indicator, and built-in copy/download actions; renders none of the artifact itself, content is slotted                                                                           |
| `<lr-live-region>`                                                                     | — (extra)                                                                               | Throttled/coalesced ARIA live-region announcer for streaming UIs, built on the reusable internal `Announcer` engine                                                                                                                                                                                               |
| `<lr-chat-composer>`                                                                   | — (extra)                                                                               | Auto-resizing message `<textarea>` + built-in send/stop button; form-associated, Enter-to-send with Shift+Enter/IME handling                                                                                                                                                                                      |
| `<lr-suggestion-chips>`                                                                | — (extra)                                                                               | Starter prompts (empty thread) or follow-up suggestions (after a response) as a horizontally scrollable chip row; activation hands the prompt to the host — never composes or sends anything itself                                                                                                               |
| `<lr-emoji-picker>`                                                                    | — (extra)                                                                               | Searchable, keyboard-navigable, form-associated emoji picker; ships no emoji data of its own (`groups` is consumer-suppliable) with an optional convenience auto-loader for a default set                                                                                                                         |
| `<lr-attachment-chip>`                                                                 | — (extra)                                                                               | Pre-send or sent file chip with thumbnail/size/upload-progress/retry; derives metadata from a real `File` or from persisted server metadata                                                                                                                                                                       |
| `<lr-attachment-trigger>`                                                              | — (extra)                                                                               | Attach-file affordance for a composer's leading slot; a single icon button, or a `<lr-menu>` when more than one capability (`files`/`image`/`camera`/`audio`) is configured                                                                                                                                       |
| `<lr-mention-popover>`                                                                 | — (extra)                                                                               | Caret-anchored `@`-mention/`/`-command autocomplete popover for a host-owned `<textarea>`/`<input>`; never takes DOM focus itself                                                                                                                                                                                 |
| `<lr-tool-call-chip>`                                                                  | — (extra)                                                                               | Compact inline pill for one tool/function call mid-conversation; status-aware glyph/color, optional hover/focus detail tooltip                                                                                                                                                                                    |
| `<lr-tool-result-view>` + `registerToolRenderer()`                                     | — (extra)                                                                               | Dispatches a tool call's result to a host-registered renderer (by tool name or shape `matches()`), falling back to `<lr-json-viewer>`                                                                                                                                                                             |
| `<lr-tool-result-dialog>`                                                              | — (extra)                                                                               | Full tool-call detail overlay: status/duration header plus a consumer-assembled `body` slot (typically a `<lr-tab-group>` of Input/Preview/JSON/Raw)                                                                                                                                                              |
| `<lr-tool-approval-dialog>`                                                            | — (extra)                                                                               | Human-in-the-loop approve/deny gate for one proposed tool call, with an optional inline JSON argument editor before approving                                                                                                                                                                                     |
| `<lr-confirm-bar>`                                                                     | — (extra)                                                                               | Inline, non-modal approve/deny block for one proposed action — the in-flow sibling of `<lr-tool-approval-dialog>` for confirmations that shouldn't hijack focus; same `lr-approve`/`lr-deny` event shapes and localization keys as the dialog                                                                     |
| `<lr-tool-param-form>`                                                                 | — (extra)                                                                               | Renders one form control per property of a flat JSON Schema object, for ad hoc tool invocation or approval-time argument editing                                                                                                                                                                                  |
| `<lr-tool-select-dialog>`                                                              | — (extra)                                                                               | Category-grouped, filterable, searchable dialog for picking which agent tools are enabled in a conversation                                                                                                                                                                                                       |
| `<lr-command-palette>`                                                                 | — (extra)                                                                               | Searchable command menu with groups, keyboard navigation, async-friendly registration, and `mod+k` opening                                                                                                                                                                                                        |
| `<lr-widget-renderer>`                                                                 | — (extra)                                                                               | Renders an agent-streamed declarative JSON widget tree through an immutable allowlisted `type -> lyra tag` registry created with `createWidgetTypeRegistry()`; mapped nodes are real elements with props assigned as JS properties (never `innerHTML`), reused by key across a re-resolve                              |
| `<lr-json-viewer>`                                                                     | — (extra)                                                                               | Collapsible, copyable tree view for an arbitrary JSON value; path-keyed expand state survives a streamed in-place `data` patch                                                                                                                                                                                    |
| `<lr-citation-badge>`                                                                  | — (extra)                                                                               | Inline `[n]` citation marker with a hover/focus preview popover and confidence/verification-status coloring                                                                                                                                                                                                       |
| `<lr-source-list>` + `<lr-source-card>`                                                | — (extra)                                                                               | Collapsible "Sources" panel for one chat message, grouping per-source cards with an excerpt + "Show more" full-text toggle                                                                                                                                                                                        |
| `<lr-conversation-item>`                                                               | — (extra)                                                                               | Selectable chat-history row with inline rename; usable standalone or as `<lr-virtual-list>`'s `renderItem()` payload                                                                                                                                                                                              |
| `<lr-virtual-list>`                                                                    | — (extra)                                                                               | Generic windowed/virtualized list host — renders only the viewport's rows as real DOM, for a multi-thousand-row history sidebar                                                                                                                                                                                   |
| `<lr-thread-list>`                                                                     | — (extra)                                                                               | Conversation sidebar — grouped, searchable chat-session list with pin/archive/delete/rename affordances; data mode renders `<lr-conversation-item>` rows through an internal `<lr-virtual-list>`, slotted mode renders host-supplied items as-is                                                                  |
| `<lr-app-rail>` + `<lr-app-rail-item>`                                                 | — (extra)                                                                               | Responsive navigation rail: `full` ↔ `icon-only` ↔ `mobile` overlay, tracked off live viewport-width breakpoints; the item provides an accessible icon/label link or button                                                                                                                                       |
| `<lr-page>`                                                                            | `wa-page`                                                                               | Responsive application shell with header, navigation, aside, main, footer, and mobile navigation state under one page-level layout contract                                                                                                                                                                       |
| `<lr-responsive-panel>`                                                                | — (extra)                                                                               | The same slotted content docked inline in normal layout flow (desktop) or as a fullscreen/bottom-sheet overlay (mobile)                                                                                                                                                                                           |
| `<lr-dock-panel>`                                                                      | — (extra)                                                                               | Single panel docked to one edge of its container, drag/keyboard-resizable and collapsible — the single-edge counterpart to `<lr-multi-split>`'s multi-sibling-panel case                                                                                                                                          |
| `<lr-model-select>`                                                                    | — (extra)                                                                               | Provider/model picker: closed dropdown over a fixed `catalog`, or a filterable free-text combobox when there isn't one (or `allow-custom` is set)                                                                                                                                                                 |
| `<lr-model-settings-panel>`                                                            | — (extra)                                                                               | Fixed `<lr-model-select>` + `<lr-slider>` composition for picking a model and tuning its sampling temperature in one `lr-change`                                                                                                                                                                                  |
| `<lr-voice-picker>`                                                                    | — (extra)                                                                               | TTS voice selector over a host-supplied `catalog`, mirroring `lr-model-select`'s closed-dropdown/free-text-combobox dual mode and form-association verbatim, extended with a standalone preview button that plays a `previewUrl` or defers to the host's own TTS                                                  |
| `<lr-audio-visualizer>`                                                                | — (extra)                                                                               | Presentational canvas-drawn voice-activity visualization (bars or waveform), the LiveKit-BarVisualizer counterpart — driven by a `MediaStream`, a numeric `level` (e.g. from `<lr-push-to-talk>`'s `lr-level`), or `state` alone for ambient animation                                                            |
| `<lr-push-to-talk>`                                                                    | — (extra)                                                                               | Mic capture button owning the full `getUserMedia` + `MediaRecorder` lifecycle (permission, recording, optional chunked streaming, teardown) — native browser APIs only, no SDK; `mode="hold"` (press-and-hold) or `mode="toggle"`                                                                                 |
| `<lr-transcript-feed>`                                                                 | — (extra)                                                                               | Live captions for an in-progress voice session — speaker-grouped entries, interim-vs-final styling with in-place `id`-keyed upgrades, and the same stick-to-bottom `follow`/`lr-follow-change` contract `lr-terminal` uses                                                                                        |
| `<lr-slider>`                                                                          | `wa-slider` / `sl-range`                                                                | Numeric range control (e.g. an LLM "temperature" setting), form-associated, mirrors native `<input type="range">` semantics                                                                                                                                                                                       |
| `<lr-context-meter>`                                                                   | — (extra)                                                                               | Segmented bar/ring occupancy meter for a token budget or context window, split across labeled categories                                                                                                                                                                                                          |
| `<lr-usage-badge>`                                                                     | — (extra)                                                                               | Compact, static resource strip for one message or run — tokens in/out, cost, latency, with a hover/focus tooltip breakdown; purely formatting, renders nothing at all when every segment is unset                                                                                                                 |
| `<lr-dialog>` + `confirm()`                                                            | `wa-dialog` / `sl-dialog`                                                               | General-purpose modal/overlay (focus-trapped, Escape/backdrop-dismissible, scroll-locking, dialog stacking); `confirm()` is a promise-based `window.confirm()` replacement built on it                                                                                                                            |
| `<lr-drawer>`                                                                          | `wa-drawer` / `sl-drawer`                                                               | Modal panel anchored to the logical start/end edge or top/bottom, sharing dialog focus, dismissal, stacking, and scroll-lock behavior                                                                                                                                                                             |
| `<lr-carousel>`                                                                        | `wa-carousel` / `sl-carousel`                                                           | Accessible slotted-slide carousel with keyboard navigation, indicators, looping, and reduced-motion-aware autoplay                                                                                                                                                                                                |
| `<lr-carousel-item>`                                                                   | `wa-carousel-item` / `sl-carousel-item`                                                 | Optional semantic slide wrapper for carousel content                                                                                                                                                                                                                                                              |
| `<lr-button-group>`                                                                    | `wa-button-group` / `sl-button-group`                                                   | Responsive semantic grouping for related action controls                                                                                                                                                                                                                                                          |
| `<lr-control-group>`                                                                   | — (extra)                                                                               | Responsive layout wrapper for a row of mixed form controls and action buttons, centered rather than stretched (unlike `<lr-button-group>`)                                                                                                                                                                        |
| `<lr-reorder-list>` + `<lr-reorder-item>`                                              | — (extra)                                                                               | Generic flat-list reorder primitive: per-row move-up/move-down buttons plus a Ctrl/Cmd+Arrow keyboard shortcut, emitting the full new order on every move                                                                                                                                                         |
| `<lr-image-comparer>`                                                                  | `wa-comparison` / `sl-image-comparer`                                                   | Before/after slotted surfaces with a keyboard-accessible range divider                                                                                                                                                                                                                                            |
| `<lr-pan-zoom>`                                                                        | — (extra)                                                                               | Bounded zoom and scrollable panning for slotted content or an image source, preserving Lyra 7's former zoomable-frame behavior                                                                                                                                                                                    |
| `<lr-zoomable-frame>`                                                                  | `wa-zoomable-frame`                                                                     | Sandboxed iframe preview with safe URL forwarding, discrete zoom levels, optional controls/interaction, and same-origin theme synchronization                                                                                                                                                                     |
| `<lr-tab-group>` + `<lr-tab>` + `<lr-tab-panel>`                                       | `wa-tab-group` / `wa-tab` / `wa-tab-panel` / `sl-tab-group` / `sl-tab` / `sl-tab-panel` | Tab strip with `placement` (logical `start`/`end` turn it vertical) and `activation="auto"`/`"manual"`; accepts the upstream `<lr-tab>`/`<lr-tab-panel>` child pairs or this library's own `slot`/`label` panel-attribute shape                                                                                   |
| `<lr-checkbox>`                                                                        | `wa-checkbox` / `sl-checkbox`                                                           | Boolean form control, `role="checkbox"` with a visual/`indeterminate` mixed state                                                                                                                                                                                                                                 |
| `<lr-switch>`                                                                          | `wa-switch` / `sl-switch`                                                               | Boolean toggle-switch form control, `role="switch"` on/off semantics                                                                                                                                                                                                                                              |
| `<lr-menu>` + `<lr-menu-item>`                                                         | `sl-menu` / `sl-menu-item`                                                              | Anchored dropdown menu around a consumer-supplied trigger; WAI-ARIA "menu button" pattern with real roving focus (not a listbox)                                                                                                                                                                                  |
| `<lr-menu-label>`                                                                      | `sl-menu-label`                                                                         | Non-interactive section heading inside `<lr-menu>`; `role="presentation"`, never a focus stop                                                                                                                                                                                                                     |
| `<lr-dropdown-item>`                                                                   | `wa-dropdown-item`                                                                      | Drop-in naming alias for `<lr-menu-item>`, including checkbox items and roving focus                                                                                                                                                                                                                              |
| `<lr-chip>` + `<lr-chip-group>`                                                        | — (extra)                                                                               | Content-agnostic label pill (tag/filter/scope indicator) and a flex-wrap group with a "+N" overflow indicator                                                                                                                                                                                                     |
| `<lr-kbd>`                                                                             | — (extra)                                                                               | Keyboard-shortcut chip; renders platform-appropriate glyphs (⌘ vs. Ctrl) from a single `"mod+k"`-style `keys` string                                                                                                                                                                                              |
| `<lr-visually-hidden>`                                                                 | `sl-visually-hidden`                                                                    | Hides content from sight while leaving it in the accessibility tree; reveals itself while focus is inside, which is what makes it usable for skip links                                                                                                                                                           |
| `<lr-result-card>` + `<lr-result-field>`                                               | — (extra)                                                                               | Small bordered card + label/value row shell, for giving custom `lr-tool-result-view` renderers a consistent look with no bespoke box                                                                                                                                                                              |
| `<lr-document-preview>`                                                                | — (extra)                                                                               | Format-dispatching document/attachment viewer (`text/*`/JSON inline, `image/*` inline, else a download fallback) plus a host-driven async-conversion status shell                                                                                                                                                 |
| `<lr-document-viewer>`                                                                 | — (extra)                                                                               | Dialog-hosted, format-dispatching full document viewer with a pluggable renderer registry                                                                                                                                                                                                                         |
| `<lr-svg-viewer>`                                                                      | — (extra)                                                                               | Optional-DOMPurify sanitized inline SVG document viewer                                                                                                                                                                                                                                                           |
| `<lr-image-viewer>`                                                                    | — (extra)                                                                               | Full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation — the landing surface for `region`-anchored citations; distinct from `<lr-svg-viewer>` (vector documents) and `<lr-image-comparer>` (before/after)                                                                  |
| `<lr-highlight-layer>`                                                                 | — (extra)                                                                               | Presentational overlay that paints highlight rectangles (percent-of-box coordinates) over positioned content and owns their activation/flash styling and keyboard access — the shared overlay engine behind `<lr-svg-viewer>`, `<lr-image-viewer>`, and `<lr-pdf-viewer>`                                         |
| `<lr-html-viewer>`                                                                     | — (extra)                                                                               | Optional-DOMPurify sanitized inline HTML document viewer                                                                                                                                                                                                                                                          |
| `<lr-xml-viewer>`                                                                      | — (extra)                                                                               | Collapsible, copyable `DOMParser`-based tree view for XML documents, mirroring `<lr-json-viewer>`'s UX (`collapsed-depth`, `copyable`, path-keyed expand state) for elements, attributes, comments, CDATA, and processing instructions; imperative `search()`/`searchNext()` like the other anchor-target viewers |
| `<lr-dataset-viewer>`                                                                  | — (extra)                                                                               | Optional-PapaParse accessible TSV/PSV/delimited dataset table viewer                                                                                                                                                                                                                                              |
| `<lr-contact-viewer>`                                                                  | — (extra)                                                                               | vCard contact viewer with support for multiple contacts and common fields                                                                                                                                                                                                                                         |
| `<lr-pdf-viewer>`                                                                      | — (extra)                                                                               | Optional-PDF.js renderer with pagination, zoom, selectable text, and virtualized page canvases                                                                                                                                                                                                                    |
| `<lr-page-rail>`                                                                       | — (extra)                                                                               | Virtualized vertical thumbnail rail for page-addressed documents with per-page highlight heat markers — **wired** mode tracks a live `PageThumbnailSource` (e.g. `lr-pdf-viewer`) or **mediated** mode binds `page-count`/`page` directly                                                                         |
| `<lr-av-player>`                                                                       | — (extra)                                                                               | Audio/video player on a native `<audio>`/`<video>` element with a cue transcript synced to `currentTime`, `time-range` anchor/highlight support, an optional dependency-free waveform, and playback-rate control; virtualizes its transcript through `<lr-virtual-list>`                                          |
| `<lr-video>`                                                                           | `wa-video`                                                                              | Native-video-backed player with standard/full/none control presets, slotted control icons, visibility-aware autoplay, captions, fullscreen, and capped thumbnail-VTT previews                                                                                                                                     |
| `<lr-video-playlist>`                                                                  | `wa-video-playlist`                                                                     | Direct-child video playlist with full/standard/none control forwarding, previous/next/index navigation, immutable selected-video metadata, safe one-player-at-a-time switching, automatic advancement, and explicit repeat modes                                                                                  |
| `<lr-notebook-viewer>`                                                                 | — (extra)                                                                               | Read-only Jupyter notebook (nbformat 4.x) renderer composing existing components per cell — Markdown cells through `<lr-markdown>`, code cells through `<lr-code-block>`, rich outputs preferring image/HTML/JSON/plain-text in order; optional-DOMPurify sanitizes raw HTML/SVG output                           |
| `<lr-spreadsheet-viewer>`                                                              | — (extra)                                                                               | Optional-SheetJS `.xlsx`/`.xls` workbook viewer with sheet tabs and virtualized rows                                                                                                                                                                                                                              |
| `<lr-csv-viewer>`                                                                      | — (extra)                                                                               | Optional-PapaParse CSV viewer with quoted-field support and virtualized rows                                                                                                                                                                                                                                      |
| `<lr-geojson-viewer>`                                                                  | — (extra)                                                                               | Document-registry bridge that renders a fetched `.geojson`/`application/geo+json` file through `<lr-map>`'s `dataLayers` (falls back to `<lr-json-viewer>` without the optional `maplibre-gl` peer); the former `<lr-geojson-view>` remains a compatibility alias                                                 |
| `<lr-docx-viewer>`                                                                     | — (extra)                                                                               | Optional-Mammoth DOCX viewer that renders sanitized semantic HTML                                                                                                                                                                                                                                                 |
| `<lr-email-viewer>`                                                                    | — (extra)                                                                               | Optional-PostalMime `.eml` viewer with sanitized HTML and plain-text fallback                                                                                                                                                                                                                                     |
| `<lr-calendar-viewer>`                                                                 | — (extra)                                                                               | Optional-ical.js `.ics` viewer for event summaries and times                                                                                                                                                                                                                                                      |
| `<lr-archive-viewer>`                                                                  | — (extra)                                                                               | Dependency-free bounded ZIP central-directory metadata viewer; lists entry names and declared sizes without inflating or previewing entry content                                                                                                                                                                 |
| `<lr-ebook-viewer>`                                                                    | — (extra)                                                                               | Renders `.epub` ebooks with the optional `epubjs` peer                                                                                                                                                                                                                                                            |
| `<lr-pptx-viewer>`                                                                     | — (extra)                                                                               | Best-effort client-side `.pptx` viewer with a persistent fidelity notice                                                                                                                                                                                                                                          |
| `<lr-file-icon>`                                                                       | — (extra)                                                                               | Tokenized, localized file-format badge with MIME and filename fallback metadata                                                                                                                                                                                                                                   |
| `<lr-media-card>`                                                                      | — (extra)                                                                               | Lightweight inline preview for one already-sent image/video/file attachment inside a rendered chat message                                                                                                                                                                                                        |
| `<lr-avatar>`                                                                          | `wa-avatar` / `sl-avatar`                                                               | Small, fixed-size identity marker — image, or an initials fallback with `lr-chip`-style tone recoloring                                                                                                                                                                                                           |
| `<lr-card>`                                                                            | `wa-card` / `sl-card`                                                                   | Generic bordered content container (`header`/`media`/`footer`/`actions` slots) — a direct `<lr-*>` counterpart to `wa-card`                                                                                                                                                                                       |
| `<lr-stepper>`                                                                         | — (extra)                                                                               | Ordered multi-step wizard navigation — label + index, current/completed/locked/error state, click-to-jump, data-driven and controlled                                                                                                                                                                             |
| `<lr-segmented>`                                                                       | — (extra)                                                                               | Single-select text/icon button row with the WAI-ARIA APG `radiogroup` contract built in (roving tabindex, automatic activation)                                                                                                                                                                                   |
| `<lr-swatch-picker>`                                                                   | — (extra)                                                                               | Single-select picker over a fixed set of color swatches — `radiogroup` semantics (roving tabindex, automatic activation), themeable selection ring                                                                                                                                                                |
| `<lr-diff-view>`                                                                       | — (extra)                                                                               | Real two-string line diff (LCS-aligned), rendered as interleaved unified-diff output                                                                                                                                                                                                                              |
| `<lr-commit-card>`                                                                     | — (extra)                                                                               | Compact commit summary — subject, author/time, diffstat, per-file changes — that links file rows out to a diff view                                                                                                                                                                                               |
| `<lr-poll-status>`                                                                     | — (extra)                                                                               | "Next scheduled refresh" countdown with a built-in pause control and live-region announcements                                                                                                                                                                                                                    |
| `<lr-code-block-core>`                                                                 | — (extra)                                                                               | Build-lean `lr-code-block` variant for a consumer whose `languages` map already covers every language it renders — never references shiki's full ~200-language table                                                                                                                                              |
| `<lr-code-editor>`                                                                     | — (extra)                                                                               | Dependency-free form-associated multiline code editor with line numbers and selection APIs                                                                                                                                                                                                                        |
| `<lr-terminal>`                                                                        | — (extra)                                                                               | Read-only ANSI console for streamed agent/tool output; not a PTY — no stdin/keystroke handling, no cursor-addressed full-screen apps                                                                                                                                                                              |
| `<lr-stack-trace>`                                                                     | — (extra)                                                                               | Parses common V8/JS-TS, Firefox/Safari, and Python stack traces into a leading message plus activatable frames, folding `internalPatterns`-matching frames (`node_modules/`, `node:internal`, …) behind a count-labeled toggle; falls back to verbatim text when nothing parses                                   |
| `<lr-trace-tree>`                                                                      | — (extra)                                                                               | Collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith run-tree style) — kind icon, name, status, an inline duration bar on the shared trace time scale, optional tokens/cost columns; consumes the same `LyraSpan[]` as `<lr-span-waterfall>`                                                    |
| `<lr-span-waterfall>`                                                                  | — (extra)                                                                               | Horizontal-timeline projection of the same `LyraSpan[]` `<lr-trace-tree>` consumes — a time axis, one row per span in start order, status-toned bars (Langfuse timeline / Temporal event-history style)                                                                                                           |
| `<lr-test-results>`                                                                    | — (extra)                                                                               | Pass/fail suite summary with per-status counts, status filter toggles, and per-test rows whose failures auto-expand by default and can host rich slotted detail (a diff or code block) alongside the plain failure message                                                                                        |
| `<lr-env-list>`                                                                        | — (extra)                                                                               | Masked key/value list for environment variables and secrets, with per-row reveal and copy; masking is presentational only, not a security boundary                                                                                                                                                                |
| `<lr-file-tree>`                                                                       | — (extra)                                                                               | File-explorer preset over `<lr-tree>` + `<lr-file-icon>` — path-keyed nodes with git-status/diff-count badges, lazy directory loading, and select/open events                                                                                                                                                     |
| `<lr-browser-frame>`                                                                   | — (extra)                                                                               | Presentational "agent computer" viewport — a screenshot/frame stream (or slotted live media), read-only URL display, action-ping overlays, and take-over/stop affordances; no automation transport, take-over is an event                                                                                         |
| `<lr-compare-panel>`                                                                   | — (extra)                                                                               | Side-by-side A/B output comparison with a winner vote (LMSYS-arena / LangSmith-pairwise style) — two slotted panes, a vote bar, synchronized reading                                                                                                                                                              |
| `<lr-rubric-form>`                                                                     | — (extra)                                                                               | Configurable annotation rubric (LangSmith annotation-queue style) — score/category/comment keys with a submit-and-next flow; each key routes to an existing sibling control (`<lr-segmented>`/`<lr-slider>`, `<lr-select>`/`<lr-checkbox-group>`, `<lr-textarea>`)                                                |
| `<lr-calendar>`                                                                        | — (extra)                                                                               | Responsive month calendar with event markers and agenda mode                                                                                                                                                                                                                                                      |
| `<lr-details>` + `<lr-accordion>` + `<lr-accordion-item>`                              | `wa-details` / `wa-accordion` / `wa-accordion-item` / `sl-details`                      | Native disclosure and coordinated accordion panels                                                                                                                                                                                                                                                                |
| `<lr-breadcrumb>` + `<lr-breadcrumb-item>`                                             | `wa-breadcrumb` / `wa-breadcrumb-item` / `sl-breadcrumb` / `sl-breadcrumb-item`         | Responsive navigation trail                                                                                                                                                                                                                                                                                       |
| `<lr-format-number>` + `<lr-format-date>` + `<lr-format-bytes>` + `<lr-relative-time>` | `wa-format-*` / `wa-relative-time` / `sl-format-*` / `sl-relative-time`                 | Locale-aware formatting primitives                                                                                                                                                                                                                                                                                |
| `<lr-markdown-core>`                                                                   | — (extra)                                                                               | Build-lean `lr-markdown` variant for a consumer whose `languages` map already covers every language it renders — never references shiki's full ~200-language table                                                                                                                                                |

### Citation → document recipe

Wiring a `<lr-citation-badge>` click to open a `<lr-document-viewer>` at the cited passage, flashed:

```html
<p>
  …revenue grew 12%<lr-citation-badge
    index="1"
    source-id="doc-1"
  ></lr-citation-badge
  >.
</p>
<lr-document-viewer id="dv"></lr-document-viewer>
```

```js
const SOURCES = {
  "doc-1": {
    name: "annual_report.pdf",
    mimeType: "application/pdf",
    src: "/files/annual_report.pdf",
    highlight: {
      id: "cite-1",
      tone: "accent",
      anchor: {
        kind: "text-quote",
        quote: "revenue grew 12% year over year",
        prefix: "Overall ",
        suffix: ", driven",
        page: 12,
      },
    },
  },
};
document.addEventListener("lr-citation-activate", (e) => {
  const s = SOURCES[e.detail.sourceId];
  if (!s) return;
  const dv = document.getElementById("dv");
  Object.assign(dv, { name: s.name, mimeType: s.mimeType, src: s.src });
  dv.highlights = [s.highlight];
  dv.anchor = s.highlight.id; // scroll + activate + flash once the pdf loads
  dv.open = true;
});
document.getElementById("dv").addEventListener("lr-anchor-result", (e) => {
  if (!e.detail.found) console.warn("citation passage not found");
});
```

The reverse direction ("select a passage → cite it") is the same wiring inverted: listen for
`lr-text-select` on the viewer and hand `detail.anchor` to the host's citation store.

## Known limitations

A non-exhaustive list of gaps a new consumer should know about before adopting:

- `<lr-map>` requires an explicit `mapStyle`. Omitting it produces a localized configuration
  failure and initiates no implicit request to a third-party tile provider.
- `<lr-file-input>`'s paste-from-clipboard support (`paste`, on by default) depends on
  `clipboardData.files`, which some browsers populate only for image data.
- The document viewers that fetch a remote resource (`<lr-archive-viewer>`, `<lr-calendar-viewer>`,
  `<lr-contact-viewer>`, `<lr-csv-viewer>`, `<lr-dataset-viewer>`, `<lr-docx-viewer>`,
  `<lr-document-preview>`, `<lr-ebook-viewer>`, `<lr-email-viewer>`, `<lr-html-viewer>`,
  `<lr-pdf-viewer>`, `<lr-pptx-viewer>`, `<lr-spreadsheet-viewer>`, `<lr-svg-viewer>`) cap
  what they will read: 25 MB per resource (enforced while streaming, so it holds even when the server
  omits `Content-Length`), and — for `<lr-csv-viewer>`, `<lr-dataset-viewer>` and
  `<lr-spreadsheet-viewer>`, which parse tabular data — 10,000 rows and 1,000 columns. Exceeding a
  cap surfaces the localized `documentPreviewResourceTooLarge` message instead of the document. These
  caps are **not** currently overridable per component. One path is exempt because it never fetches the
  bytes itself: `<lr-document-preview>` caps only its text/JSON fetch, leaving the `image` path
  (which hands `src` straight to an `<img>`) uncapped.

## Development

Run from the repo root (this package is part of a pnpm workspace):

```bash
pnpm install
pnpm test        # @web/test-runner + Playwright (Chromium) + axe a11y
pnpm lint        # contract-policy + tsc --noEmit + public type-surface tests
pnpm build       # tsc → dist/ (ESM + .d.ts)
pnpm manifest    # custom-elements.json
pnpm docs        # Storybook docs site, demos this package + lyra-flags together
```

## License

[MIT](./LICENSE) © 2026 Aceshooting
