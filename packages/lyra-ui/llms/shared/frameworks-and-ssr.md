# Frameworks and SSR

## Framework integration

Plain custom elements, so they work anywhere — with the usual two caveats. React 19/JSX, Vue 3,
and Svelte 5 projects can opt into the generated declarations shown under "TypeScript" without
installing or shipping a wrapper; import the normal granular registration entry separately.

- **Complex values must be property-bound, not attribute-bound.** An attribute stringifies:
  `rows="[object Object]"`. Use the framework's property syntax for anything that isn't a string,
  number, or boolean: Lit `.rows=${rows}`, Vue `:rows.prop="rows"` (or `.rows="rows"`), Angular
  `[rows]="rows"`, Svelte `bind:this` + assignment, React 19+ passes objects to custom-element
  properties natively (earlier React needs a ref).
- **Events are dashed custom events.** Lit `@lr-change=${…}`, React 19
  `onlr-change={…}`, Vue `@lr-change="…"`, Angular `(lr-change)="…"`, and Svelte 5
  `onlr-change={…}` (or the legacy `on:lr-change={…}`). Earlier React versions use
  `ref.addEventListener('lr-change', …)`.
- **Angular** additionally needs `CUSTOM_ELEMENTS_SCHEMA` in the module/component that uses the tags.
- In-DOM templates lower-case attribute names; camelCase property names only survive in framework
  templates and JS, never in hand-written HTML attributes.
- **Dev-mode unknown-attribute diagnostics ignore framework-owned scoping/debug attributes.**
  Angular's default emulated view encapsulation writes `_ngcontent-*`/`_nghost-*` scoping markers
  onto every element it manages, its dev builds add `ng-reflect-*` input reflections and
  `ng-version`, and Vue's scoped styles add `data-v-*` — none of these trigger the unknown-attribute
  warning. A genuinely misspelled or unsupported attribute still warns.

All three adapters use the generated `LyraComponentTypeMap` from
`@aceshooting/lyra-ui/framework-types`. Its per-tag entries contain the element type, writable
properties, event map and names, CSS property names, and attribute aliases. Existing per-component
framework props aliases and shared attribute/CSS helper exports remain available. The common map
and adapters emit empty JavaScript and do not register elements.

## SSR and declarative shadow DOM

When replacing the removed combined `ssr-loader.js` route, split browser hydration from component
registration and server rendering as shown below. The [v23-to-v24 migration guide](v23-to-v24-migration.md)
has the ordered upgrade steps and environment-specific import mapping.

Root, `all.js`, and granular component imports are server-safe under the supported Node 22+ runtime.
`@aceshooting/lyra-ui/ssr/all.js` is the **server-only** convenience entry: unlike the browser
`all.js`, it registers the complete inventory including the optional-peer families — defining those
tags never imports their peers (each component loads its own lazily, client-side), and the
browser-bundle argument for excluding them does not apply to a server render. Use the public
`@aceshooting/lyra-ui/ssr.js` entry for the tested Lit SSR contract. Its exported
`LYRA_SSR_SUPPORT_MATRIX`, `LYRA_SSR_RENDER_AND_HYDRATE_TAGS`, and
`LYRA_SSR_CLIENT_RENDER_TAGS` classify every inventory tag exactly once:

- `render-and-hydrate`: `@lit-labs/ssr` emits Declarative Shadow DOM, and the client reuses the
  existing shadow root and nodes.
- `client-render`: the server emits the host's serializable attributes and light DOM with no shadow
  template; the component renders when its definition upgrades in the browser. Use this for initial
  renders that require light-DOM traversal, layout, canvas, observers, media, or other browser APIs.

**Link the token layer in `<head>`.** Since 27.0.0 declarative shadow roots no longer carry the
shared `--lr-*` layer (one server-rendered `lr-button` is about 34 KB smaller); the browser adopts it
on the first connect, which for server-rendered markup is hydration. For a correct first paint
before hydration, link the static copy after the no-flash bootstrap and with `theme.css`:

```html
<link rel="stylesheet" href="/node_modules/@aceshooting/lyra-ui/dist/theme.css" />
<link rel="stylesheet" href="/node_modules/@aceshooting/lyra-ui/dist/styles/tokens-root.css" />
```

Hydration then skips the constructed copy. An application's **own** declarative shadow roots that
contain theme scopes (for example a `.lr-dark` region or a `data-lr-theme-scope` wrapper) include the
same `<link rel="stylesheet" href="…/tokens-root.css">` inside their template: document styles do not
reach into a shadow root until hydration adopts the layer there. Without any link and without
JavaScript, server-rendered components paint without resolved tokens, as a page without Lyra's styles
always did.

Server setup (the fallback must precede Lit's renderer):

```ts
import { lyraSsrElementRenderers } from "@aceshooting/lyra-ui/ssr.js";
import { render, LitElementRenderer } from "@lit-labs/ssr";
import { html } from "lit";

const result = render(html`<lr-page><main>Dashboard</main></lr-page>`, {
  elementRenderers: lyraSsrElementRenderers(LitElementRenderer),
});
```

In the browser, import `@aceshooting/lyra-ui/hydration.js` before any other module that can import
Lit. This installs `@lit-labs/ssr-client/lit-element-hydrate-support.js` before component
registration. `getLyraSsrMode(tagName)` reads one tag's tier, and
`diagnoseLyraHydration(document)` inspects current Lyra hosts in the supplied tree and every
reachable open shadow root, awaits registered hosts' current updates, and reports `ready`,
`unregistered`, `missing-shadow-root`, or `update-failed`. `ready` means the current update finished
and a shadow root exists; it does not claim that server markup was observed or hydrated. Read each
diagnostic's separate `mode` to distinguish the declared `render-and-hydrate` and `client-render`
tiers.

The loader preserves optional-peer isolation: import a root-excluded component's granular
registration after the loader. A fallback cannot serialize JS property bindings, so put initial
server state in attributes/light DOM or assign it client-side. A `render-and-hydrate` component
whose rendering depends on something only a browser can answer — its own light-DOM children, or a
browser global such as `EyeDropper` — reproduces the server's answer on the hydrating render and
corrects itself on the next update, so a slotted override lands one frame after hydration; a
browser-only mount is unaffected and renders the final result the first time. Layout/observer/canvas/media work
begins after hydration, and remote content is client-only.

**If hydration never runs at all** — a page that intentionally ships no script bundle, a reader
that fetches the raw HTML, or a crawler — a `render-and-hydrate` tag's declarative-shadow-DOM
output is either permanently complete and correct on its own, or only ever promised once hydration
executes; nothing in between is supported. `getLyraSsrStaticSafety(tagName)` (also
`LYRA_SSR_SUPPORT_MATRIX.declarativeShadowDom.staticSafety[tagName]`) returns which:
`'static-safe'` is the first guarantee, `'hydration-required'` is the second. Every
`render-and-hydrate` tag has one of the two; `pnpm test:ssr` fails closed on any tag that does
not, so there is no silent third case. Do not infer `'static-safe'` from a component "looking
static" — check the classification, because two components that look equally static can differ:

- `lr-details` is `'static-safe'`. Its native `<details>`/`<summary>` toggle is bound with a Lit
  *property* binding (`.open=${this.open}`), which the SSR renderer reflects to a real `open`
  attribute in the server markup, and the click listener that vetoes a user toggle is registered
  only by the component's own (unexecuted, without hydration) lifecycle code. With hydration JS
  never running, both facts together mean the browser's native disclosure behavior is what
  answers a click — so `lr-details` renders in the correct open/closed state and keeps expanding
  and collapsing indefinitely, with zero JavaScript.
- A canvas-painted component such as `lr-chart` is `'hydration-required'`: a `<canvas>`
  element has no pixels until script draws to it, so without hydration the server markup is
  present but visibly empty forever, not merely stale for one frame. `lr-lite-chart` is also
  `'hydration-required'`, but for a different reason: it renders real SVG (not canvas), and its
  default `layout="fit"` mode needs a ResizeObserver-measured host size before it can draw
  coordinate-based geometry, so without hydration it stays on its structurally-identical
  pre-measurement fallback rather than ever reaching final content.
