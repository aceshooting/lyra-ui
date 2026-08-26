## Breaking changes, fixes, and renames in 9.0.0

`<lr-trace-tree>` and `<lr-subagent-panel>`: `label` no longer defaults to `''`; it is
`string | undefined` and omitted means "use the localized default" — an explicit `label=""` now
renders empty instead of silently falling back.

`<lr-commit-card>`: `filesCollapsed`/`files-collapsed` renamed to `filesExpanded`/`files-expanded`,
with the default inverted (`filesExpanded = false`) so the rendered starting state is unchanged;
update `el.filesCollapsed = true` to `el.filesExpanded = false` (and vice versa).

`<lr-agent-trace>`: `hideBars`/`hide-bars` renamed to `showBars`/`show-bars` (default `true`),
matching the positive-polarity `showTokens`/`showCost` on the same element; update
`el.hideBars = true` to `el.showBars = false` (and vice versa).

`<lr-evaluation-run>` is renamed to `<lr-eval-run>` (class `LyraEvaluationRun` → `LyraEvalRun`).
Every `Evaluation*`-prefixed exported type is renamed to `Eval*` (`EvaluationContentFormat` →
`EvalContentFormat`, `EvaluationContent` → `EvalContent`, `EvaluationExampleResult` →
`EvalExampleResult`, `EvaluationExampleToggleDetail` → `EvalExampleToggleDetail`,
`EvaluationCitationSelectDetail` → `EvalCitationSelectDetail`, `EvaluationToolApprovalDetail` →
`EvalToolApprovalDetail`, `EvaluationToolActivateDetail` → `EvalToolActivateDetail`,
`EvaluationToolRenderErrorDetail` → `EvalToolRenderErrorDetail`, `EvaluationClaimSelectDetail` →
`EvalClaimSelectDetail`, `LyraEvaluationRunEventMap` → `LyraEvalRunEventMap`), matching sibling
`lr-eval-dataset`/`lr-eval-result`. The localized string keys and their English text are unchanged —
only the tag/class/type names moved.

`<lr-schema-viewer>` is renamed to `<lr-json-schema-viewer>` (class `LyraSchemaViewer` →
`LyraJsonSchemaViewer`, event map `LyraSchemaViewerEventMap` → `LyraJsonSchemaViewerEventMap`),
freeing the generic name for a future non-JSON schema viewer. `JsonSchemaNode`/`SchemaValidationIssue`
and the `--lr-schema-viewer-*` CSS custom properties are unchanged.

Security fix (non-breaking): `<lr-mcp-app>`'s `postMessage` call to its sandboxed frame now always
uses the correctly computed target origin instead of an inverted check that previously fell through
to the wildcard `'*'` origin unconditionally.

## `lr-tool-call-chip`

A compact inline pill representing one tool/function call an agent made mid-conversation, e.g.
`web_search: Searching web…` with a `running` spinner. First-party invention (no Web Awesome
equivalent). It owns no detail surface of its own — activating it (click or Enter/Space while
focused) fires `lr-tool-call-chip-select`; a consumer wires that to opening a
`<lr-tool-result-dialog>` (or anything else) at the call site, keeping the chip reusable wherever
a compact call summary is useful, with or without a detail surface behind it.

**Properties:**

- `name: string = ''` — the tool/function name, e.g. `web_search`
- `category: string = ''` — optional grouping label, e.g. `research`
- `status: 'pending'|'running'|'success'|'error'|'denied' = 'pending'` (reflected) — drives the
  glyph, accent color, and `status-text`; same status vocabulary as `<lr-tool-result-dialog>` so a
  call's chip and its detail dialog always agree; unknown runtime values render the pending icon,
  text, and accessible label instead of failing the update
- `summary: string = ''` — short human-readable status text, e.g. `Searching web…`
- `durationMs?: number` (attribute `duration-ms`) — how long the call took, in milliseconds; the
  `duration` part is omitted entirely when unset
- `icon: string = ''` — literal icon hint (e.g. an emoji) rendered when the `icon` slot is empty;
  ignored once anything is assigned to `slot="icon"`
- `callId: string = ''` (attribute `call-id`) — unique identifier for this invocation, echoed back
  in `lr-tool-call-chip-select`'s detail so a listener can correlate the click with the call it fired for

**Events:** `lr-tool-call-chip-select` (`detail: { name: string; callId: string }`) — fired on
click or Enter/Space activation of the pill, exactly once per activation. The `lr-tool-chip-select`
alias (deprecated since 4.0.0) was removed in 9.0.0; listen for `lr-tool-call-chip-select` instead —
the detail is identical.

**Methods:** `focus(options?)`, `blur()`, and `click()` delegate to the internal native chip
button, so programmatic focus/activation reaches the same semantic owner as pointer and keyboard
interaction.

**Slots:** default (rich tooltip/detail content — e.g. the tool's raw arguments or a short preview —
shown in a floating tooltip on hover/focus; nothing renders at all, no hover affordance, when this
slot is empty), `icon` (overrides the built-in per-status glyph entirely via native slot-fallback
content — assigned content wins; otherwise the `icon` prop is rendered as a literal hint; otherwise
the built-in glyph for the current `status` is used)

**CSS parts:** `base` (the clickable `<button>`), `icon`, `label` (wrapper around `category`, `name`,
`summary`), `category`, `name`, `summary`, `meta` (wrapper around `status-text` and `duration`),
`status-text`, `duration`, `tooltip` (the floating detail popup, only meaningful while open)

**Themeable custom properties:** `--lr-tool-call-chip-spin` (default `var(--lr-transition-ambient)`,
i.e. `1.8s ease-in-out` at the shipped token value and `0.001ms linear` under
`prefers-reduced-motion` — running-icon animation duration/timing) and `--lr-transition-ambient`
(default `1.8s ease-in-out` — pending-icon pulse duration/timing).
`--lr-tool-call-chip-accent`, `--lr-tool-call-chip-bg`, and `--lr-tool-call-chip-border` are public
component hooks whose private defaults follow `status` (e.g. `pending` →
`--lr-color-text-quiet`/`--lr-color-surface`/`--lr-color-border`; `running` → brand; `success` →
success; `error` → danger; `denied` → warning). Set them on an ancestor to retheme a subtree or
directly on one chip; either public value remains authoritative in every status. Shared tokens
referenced: `--lr-color-text-quiet`, `--lr-color-surface`, `--lr-color-border`,
`--lr-color-brand`/`-brand-quiet`, `--lr-color-success`/`-success-quiet`,
`--lr-color-danger`/`-danger-quiet`, `--lr-color-warning`/`-warning-quiet`, `--lr-color-text`,
`--lr-space-xs/-s/-m`, `--lr-radius`, `--lr-shadow`, `--lr-focus-ring-*`,
`--lr-transition-fast`.

> Retheming a group of chips from outside `<lr-tool-call-chip>` (e.g. per-tool or per-status
> colors)? Set the component hooks above on their ancestor wrapper. Use `--lr-theme-*` instead only
> when changing a shared semantic palette input for the entire subtree.

**Optional peer deps:** none.

```html
<lr-tool-call-chip
  name="web_search"
  category="research"
  status="running"
  summary="Searching web…"
  duration-ms="820"
  call-id="call_123"
>
  <pre slot="icon" style="display:none"></pre>
  <code>{"query": "lyra ui components"}</code>
</lr-tool-call-chip>
<script type="module">
  document
    .querySelector("lr-tool-call-chip")
    .addEventListener("lr-tool-call-chip-select", (e) => openDetail(e.detail.callId));
</script>
```

The default slot's tooltip is positioned with the same `internal/positioner.js` `place()` helper
`<lr-combobox>` uses for its listbox (`placement: 'top-start'`), and appears/disappears instantly
on hover/focus/blur/mouseleave with no fade transition and no "pointer moved into the tooltip"
tracking — it's documented as read-only preview content, not an interactive surface meant to retain
focus of its own. `denied` gets its own warning-toned glyph and color (a policy rejection, not a
runtime failure) distinct from `error`'s danger tone, matching `<lr-tool-result-dialog>`'s
identical status vocabulary so a call reads the same way in both places. Duration formatting is
sub-1000ms `"820ms"`, else trimmed to at most one decimal of seconds (`"1.5s"`, `"2s"`).

**Known gotchas:**

- the default slot is checked for emptiness by scanning `Array.from(this.children)` for elements
  once on first update, then kept in sync via `slotchange` — only _element_ children count (a bare
  text node assigned to the default slot won't trigger the tooltip)
- the native button always keeps its purpose-specific generated name (`"name — summary — Status —
duration"`). A host `aria-label` remains on the host and is not cloned onto that button; even an
  explicit empty host label never leaves the actionable button unnamed
- the `icon` slot is decorative by contract. Its wrapper is both `aria-hidden` and `inert`, so do
  not place links, buttons, or other controls there; use the chip activation or detail slot instead
- Escape only dismisses the tooltip when it's open; it does not fire any event or otherwise affect
  `status`/`open` state, since the chip has no "open" state of its own beyond the tooltip

---

## `lr-tool-result-view`

Renders a tool call's result via whichever custom renderer a host app has registered for it,
falling back to `<lr-json-viewer>` whenever no renderer matches, a candidate renderer's
`matches()` predicate throws during dispatch, a renderer's optional `load()` rejects, or its
`render()` throws. First-party invention (no Web Awesome equivalent). This component
owns none of the actual visual weight of a populated tool result — that's entirely whatever the
registered renderer returns; `<lr-tool-result-view>` is just the dispatch + fallback + loading-state
shell around it.

**Properties:**

- `registry?: ToolRendererRegistry` (property only, no attribute) — a custom
  `ReadonlyMap<string, ToolRendererDefinition>` to dispatch against instead of the module-level
  default registry (see `registry.ts` below). Assignment synchronously copies at most 10,000
  entries behind a frozen readonly facade. Later mutation of the source map is not observed;
  create and reassign a new map to update dispatch. Definition records are cloned and frozen while
  callback identities are retained; lazy-load caching remains stable per assigned snapshot.
- `toolName: string = ''` (attribute `tool-name`) — the tool's name; the primary dispatch key
- `result: unknown` (property only, no attribute) — the tool call's result payload, handed to the
  matched renderer's `render()` (and to `matches()` for shape-based dispatch, and to the
  `<lr-json-viewer>` fallback)
- `args: unknown` (property only, no attribute) — the tool call's original arguments, if available,
  handed to the matched renderer's `render()` alongside `result`
- `fallback: ToolResultFallback = 'json'` (reflected), where exported `ToolResultFallback =
'json' | 'text'` — fallback-kind selector. `"json"` (the default) is
  an unconditional `<lr-json-viewer>`. `"text"` renders a _string_ `result` as preformatted text
  instead — falling back to the `"json"` behavior when `result` isn't a string, so setting
  `fallback="text"` defensively against an unpredictable result shape never renders broken output.
  Foreign runtime values normalize to the reflected `"json"` default.
- `copyable: boolean = false` (reflected) — shows a copy-to-clipboard affordance alongside the
  fallback view, for either `fallback` kind: forwarded to `<lr-json-viewer>`'s own `copyable` for
  `"json"`, or a `<lr-copy-button>` rendered next to the text for `"text"`.
- `status: 'pending'|'running'|'success'|'error'|'denied' = 'success'` (reflected) — the outcome of
  the currently-rendered result, as reported by the matched renderer's own `context.reportStatus()`
  (see below). Reset to `'success'` immediately before every `render()` call, so a renderer that
  never calls `reportStatus` — including every pre-existing 2-arg renderer written before this
  property existed — leaves it at that default, and a later renderer that stays quiet doesn't
  inherit a stale outcome left behind by a previous one. Same status vocabulary as
  `<lr-tool-result-dialog>`/`<lr-tool-call-chip>`.

**Events:** `lr-render-error` (`detail: { toolName: string; error: unknown }`) — fired immediately
before falling back to `<lr-json-viewer>`, whether because no renderer matched, a candidate
renderer's `matches()` predicate threw during dispatch, a renderer's `load()` rejected, or its
`render()` threw.

**Slots:** none.

**CSS parts:** `base` — the root wrapper around the resolved renderer's output (or the loading/
fallback view); it keeps `aria-busy="true"` while a lazy renderer is loading and explicitly returns
to `aria-busy="false"` afterward. `fallback-text` — the `<pre>` element for the `fallback="text"` kind's preformatted
result text (only present in that mode). `fallback-copy` — the `<lr-copy-button>` shown when
`copyable` is set alongside the `fallback="text"` kind (only present when both are set).

**Themeable custom properties:** `--lr-tool-result-view-font` (default `var(--lr-font-mono)`, the
library's shared monospace stack, so a `--lr-theme-font-family-mono` override reaches it) — only used by the
`fallback="text"` kind's `[part='fallback-text']`. Otherwise none — the component's own styling is
deliberately minimal; all visible styling comes from whatever renderer/`<lr-skeleton>`/
`<lr-json-viewer>`/`<lr-copy-button>` child is currently mounted.

**Optional peer deps:** none required by the component itself — individual registered renderers may
of course pull in whatever they need (a charting library, a markdown renderer), which is exactly what
the lazy `load()` path in the registry exists for.

```html
<lr-tool-result-view tool-name="get_weather"></lr-tool-result-view>
<script type="module">
  const view = document.querySelector("lr-tool-result-view");
  view.result = { tempC: 21, condition: "cloudy" };
  view.args = { city: "Brussels" };
  view.addEventListener("lr-render-error", (e) => console.warn("renderer failed", e.detail));
</script>
```

### `registerToolRenderer()` and the tool-renderer registry (`registry.ts`)

A type-keyed dispatch registry — a tiny plugin system so a host app can teach
`<lr-tool-result-view>` how to draw the result of e.g. a `get_weather` or `run_query` tool call
without this library knowing anything about either. Every registered instance dispatches against
this same module-level registry unless a given `<lr-tool-result-view>`'s `registry` property is
set to a different readonly map snapshot.

**`ToolRendererDefinition`** — an exclusive
`DirectToolRendererDefinition | LazyToolRendererDefinition` union. Runtime registration, custom
registry lookup, and loaded-module boundaries validate the same shape, so plain JavaScript cannot
silently register `{}`, combine `render` with `load`, or cache an invalid loaded definition:

- direct: `render: (result: unknown, args: unknown, context?: ToolRenderContext) => unknown` and
  `load?: never` — renders the
  result (and the args that produced it) as UI. Typed as `unknown` rather than Lit's
  `TemplateResult` so any lit-html-renderable value works (a plain string, a DOM node, an array of
  templates) — consumers already own their own Lit import and don't need this module to add one.
  The 3rd `context` argument is additive: it's the _last_ positional parameter, so a pre-existing
  2-arg `render(result, args)` function stays assignable to this type unchanged — JS/TS function
  assignability allows an implementation with fewer parameters than its declared type. Direct
  callers may omit `context`; component invocations always provide it. Use
  `context?.reportStatus(status)` (see `ToolRenderContext` below) to signal a non-throwing outcome
  — e.g. an application-level failure the renderer still drew real UI for — instead of throwing,
  which discards that UI for the `<lr-json-viewer>` fallback instead
- either branch may include `matches?: (payload: unknown) => boolean` — facade/shape-based dispatch predicate, consulted only
  when no exact `toolName` key matches (see dispatch order below); only ever consulted _before_
  `load` resolves when supplied inline at registration time — a definition that needs shape-based
  dispatch and also wants to lazy-load its `render` should register a lightweight synchronous
  `matches` up front alongside `load`
- lazy: `load: () => Promise<DirectToolRendererDefinition | { default:
DirectToolRendererDefinition }>` and `render?: never` — lazy loader
  for a code-split renderer, so a host app can defer the cost of a rarely-used or heavy renderer
  (e.g. one pulling in a charting library) instead of paying for it on every page that merely
  registers it. Resolves to either a definition directly, or a `{ default }`-shaped module namespace
  object, so `load: () => import('./my-renderer.js')` works unmodified when that module's default
  export is itself a `ToolRendererDefinition`

**`ToolRenderContext`** — the shape of `render()`'s 3rd argument:

- `reportStatus: (status: ToolResultStatus) => void` — reports this render's outcome without
  throwing. `ToolResultStatus` is `'pending' | 'running' | 'success' | 'error' | 'denied'`, the same
  union `<lr-tool-result-dialog>`/`<lr-tool-call-chip>` use, re-exported from this module. Calling
  it is entirely optional: a renderer that never calls it leaves `<lr-tool-result-view>`'s `status`
  property at its default, `'success'`. This threads through the lazy `load()` path exactly the
  same way — a `render()` resolved via `load()` receives the same 3rd `context` argument as one
  registered directly.

```ts
registerToolRenderer("run_query", {
  render: (result, _args, context) => {
    if ((result as { rows?: unknown[] })?.rows === undefined) {
      context?.reportStatus("error");
      return html`<p class="query-error">The query returned no result set.</p>`;
    }
    return html`<query-result-table
      .rows=${(result as { rows: unknown[] }).rows}
    ></query-result-table>`;
  },
});
```

**Exports:**

- `registerToolRenderer(name: string, def: ToolRendererDefinition): void` — registers (or
  overwrites) the renderer for `name` in the module-level default registry
- `getDefaultToolRendererRegistry(): ToolRendererRegistry` — returns the default `Map` that
  `registerToolRenderer()` writes to and every `<lr-tool-result-view>` reads from unless its own
  `registry` prop is set
- `findToolRenderer(toolName: string, payload: unknown, registry?: ToolRendererRegistry):
ToolRendererDefinition | undefined` — the dispatch function `<lr-tool-result-view>` calls
  internally on every resolve; exposed for direct use/testing too
- `loadToolRenderer(def: ToolRendererDefinition): Promise<DirectToolRendererDefinition>` — resolves `def`
  to a definition guaranteed to carry a real `render`, awaiting/unwrapping `def.load()` when present
  (or returning `def` unchanged otherwise)
- `clearToolRenderers(): void` — test-only utility that empties the default registry and its
  `load()` cache, so one test's `registerToolRenderer()` calls can't leak into the next

**Dispatch order** (`findToolRenderer`), exactly as `<lr-tool-result-view>`'s own `resolve()` uses
it:

1. An exact `toolName` key match in the registry.
2. Failing that, the first entry — in registration order, since a `Map` already iterates that way —
   whose `matches(payload)` returns `true`. Useful when several tool names share one result shape
   (e.g. every `*_search` tool returning `{ results: [...] }`) or when the caller doesn't reliably
   know the tool name at all.
3. `undefined` if neither matches — `<lr-tool-result-view>` falls back to `<lr-json-viewer>` and
   fires `lr-render-error`.

Once a definition is found, if it carries `load`, `<lr-tool-result-view>` shows a
decorative `<lr-skeleton shape="rect" height="4rem">` while `loadToolRenderer()` resolves it.
The nested skeleton has announcements disabled; the stable `base` busy state and an ordinary,
visually hidden localized Loading label expose the in-progress state without creating a shadow-root
live region. The resolved
`load()` promise is cached keyed by _definition object identity_ (a `WeakMap`, not by tool-name
string) — two different registries that happen to reuse the same tool-name string get independently
cached loads, and any given lazy definition's `load()` runs at most once no matter how many times
it's dispatched to, across every `<lr-tool-result-view>` instance that resolves to it. A **rejected**
`load()` is _not_ cached — nor is a load that resolves to an invalid/another-lazy definition. The
definition stays registered, so a later resolution attempt (e.g. after a transient network failure)
gets a fresh `load()` call rather than being stuck replaying one failed promise forever.

```ts
import { registerToolRenderer } from "@aceshooting/lyra-ui/components/agent-tools/tool-result-view/registry.js";

registerToolRenderer("get_weather", {
  render: (result, args) =>
    html`<weather-card .data=${result} .city=${args?.city}></weather-card>`,
});

// Lazily loaded, shape-based fallback for every *_search tool:
registerToolRenderer("web_search", {
  matches: (payload) =>
    typeof payload === "object" && payload !== null && "results" in payload,
  load: () => import("./search-result-renderer.js"), // default export is a ToolRendererDefinition
});
```

**Known gotchas:**

- `<lr-tool-result-view>` re-resolves (re-runs the full dispatch → load → render pipeline)
  whenever `toolName`, `result`, `args`, or `registry` changes, or on first update — a stale
  in-flight `load()` superseded by a newer change is detected via an internal generation counter and
  its result is discarded rather than clobbering a more recent render
- registering under the same `name` twice silently overwrites the earlier definition — there is no
  warning or error
- `matches` is a linear scan over every registered definition's `matches` in registration order; it
  only runs when the exact-name lookup misses, so tool names with a direct registration never pay
  that scan cost
- `status` is reset to `'success'` immediately before every `render()` call, not merely at
  construction — a renderer that reported `'error'` on one result does not leave that status
  behind once dispatch moves on to a different (quiet) renderer; a `reportStatus()` call that
  arrives asynchronously after a _newer_ resolve has already started (a stale promise the previous
  render kicked off) is detected via the same generation counter as the `load()` staleness guard
  and discarded rather than clobbering the newer status
- **don't type a custom renderer against a hand-rolled, over-generic function signature** (e.g.
  `render: (...args: any[]) => unknown`, or a locally-declared narrower alias then cast to
  `ToolRendererDefinition`) — write the registration as a plain object literal (as in every example
  above) or annotate it as `ToolRendererDefinition` directly, so TypeScript checks the actual
  current `render`/`matches`/`load` shape, including the `context: ToolRenderContext` 3rd
  parameter and the exact `ToolResultStatus` string union `reportStatus` accepts. A loosened/`any`
  signature type-checks either way but silently gives up the compiler's ability to catch a typo'd
  status string or a dropped `context` parameter
- `fallback` implements exactly two kinds, `"json"` and `"text"`; any _other_ runtime value
  normalizes to reflected `"json"`, while `"text"` with a non-string result uses the JSON view.
  Only `"text"` renders
  `[part="fallback-text"]`/`[part="fallback-copy"]`

---

## `lr-tool-result-dialog`

A full tool-call detail overlay: a status/duration header plus a `body` slot where a consumer
typically places a `<lr-tab-group>` with Input/Preview/JSON/Raw panels. First-party invention (no Web
Awesome equivalent). This component knows nothing about what's inside that slot — it only supplies
the modal chrome around it. It keeps its own shadow template rather than nesting a `<lr-dialog>`,
so slot-forwarding does not put a forwarding `<slot>` where a slotted `<lr-tab-group>`'s own light-DOM
child scan expects real projected content, while its modal behavior participates in the shared
overlay stack.

**Properties:**

- `open: boolean = false` (reflected) — whether the dialog is open; set it directly or use the
  lifecycle methods below
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — opt in to backdrop-click
  dismissal; Escape and the built-in close button remain available without it
- `accessibleLabel: string | null = null` (attribute `aria-label`) — a host attribute names the
  host itself, while the dialog panel remains labelled by its visible tool-name title instead of
  cloning that name. A direct property assignment made without the attribute can name the panel
- `toolName: string = ''` (attribute `tool-name`) — the tool's name, rendered prominently in the
  header
- `status: 'pending'|'running'|'success'|'error'|'denied' = 'pending'` (reflected) — drives the
  header's status badge; same status vocabulary as `<lr-tool-call-chip>`
- `durationMs?: number` (attribute `duration-ms`) — how long the call took, in milliseconds; omitted
  from the header entirely when unset
- `maximized: boolean = false` (reflected) — near-fullscreen presentation of the same open dialog

**Methods:** `show(): void` opens the dialog; `hide(reason: ToolResultDialogCloseReason = 'api'):
void` is the reasoned API dismissal;
`close(reason: ToolResultDialogCloseReason = 'api'): void` closes the dialog (no-op if already
closed), emits `lr-close` with `reason`, and returns focus to whatever had it before
the dialog opened. Built-in triggers call this with `'escape'`, `'backdrop'` when `lightDismiss` is
enabled, or `'close-button'`; a
consumer's own close affordance (e.g. a footer action button) should call it directly with its own
reason string so every dismissal path funnels through the same event.

**Events:** `lr-close` (`detail: ToolResultDialogCloseReason` — `'escape'|'backdrop'|
'close-button'|'api'|string`) fired exactly once per dismissal (`'backdrop'` requires
`lightDismiss`); `lr-maximize-change` (`detail:
{ readonly maximized: boolean }`, the new `maximized` state) fired when the header's
maximize/restore toggle is clicked.

**Slots:** `body` (the dialog's main content — typically a `<lr-tab-group>` with Input/Preview/JSON/Raw
panels, entirely consumer-assembled), `footer` (optional action buttons, rendered in a bottom row —
the footer row itself is hidden via `[hidden]` when nothing is slotted)

**CSS parts:** `backdrop`, `panel` (`role="dialog"` while open), `header`, `title` (wrapper around
tool name/status/duration), `tool-name`, `status`, `duration`, `header-actions`, `maximize-button`,
`close-button`, `body`, `footer`

**Themeable custom properties:** `--lr-tool-result-dialog-overlay-color` (default
`var(--lr-color-overlay)` — the backdrop scrim color, the shared token `<lr-dialog>` and
`<lr-widget>` also read, so one theme override restyles every scrim in the app),
`--lr-tool-result-dialog-maximized-inset` (default `max(var(--lr-space-l),
var(--lr-safe-area-*))` on each side — the inset applied to the panel while `[maximized]`, so the
panel clears a notch or home indicator; overridable e.g. to leave a persistent app rail visible), and
`--lr-tool-result-dialog-spin` (default `var(--lr-transition-ambient)`, i.e. `1.8s ease-in-out`,
and effectively stopped under reduced motion because that token collapses to `0.001ms linear`), plus shared
tokens `--lr-color-surface/-border/-text-quiet/-brand/-brand-quiet/-success/-success-quiet/
-danger/-danger-quiet/-warning/-warning-quiet`, `--lr-space-*`, `--lr-radius`, `--lr-shadow`,
`--lr-icon-button-size`, `--lr-focus-ring-*`, `--lr-transition-base`.

**Optional peer deps:** none.

```html
<lr-tool-result-dialog tool-name="run_query" status="success" duration-ms="1240">
  <lr-tab-group slot="body">
    <div slot="preview" label="Preview">…</div>
    <div slot="json" label="JSON"><lr-json-viewer></lr-json-viewer></div>
  </lr-tab-group>
  <button slot="footer">Rerun</button>
</lr-tool-result-dialog>
<script type="module">
  const dialog = document.querySelector("lr-tool-result-dialog");
  dialog.querySelector("lr-json-viewer").data = result;
  dialog.open = true;
  dialog.addEventListener("lr-close", () => (dialog.open = false));
  dialog.addEventListener("lr-maximize-change", (e) =>
    console.log("maximized:", e.detail.maximized)
  );
</script>
```

While open, `[part="panel"]` takes `role="dialog"` + `aria-modal="true"` with `aria-labelledby`
pointing at the tool-name element, document scroll is locked, and Tab/Shift+Tab are bounded to the
panel's own focusable content in header-buttons → `body` slot → `footer` slot order (resolved
shadow-piercingly, so a slotted custom element's real focusable target inside its own shadow root is
found too). On open, focus moves to the first focusable element (falling back to the panel itself);
on close, focus returns to whatever element triggered the open (captured at open time via the active
element, since the trigger typically lives entirely outside this component). `maximized` toggles
between the constrained modal size and a near-fullscreen size within the same open dialog and
open/close lifecycle — unlike `<lr-widget>`'s fullscreen mode there's no separate non-modal resting
state, so no additional scroll-lock/focus-trap bookkeeping is needed for that transition alone.
Backdrop clicks leave the dialog open by default; add `light-dismiss` to opt in, matching
`<lr-dialog>`, `<lr-drawer>`, and `<lr-lightbox>`.

**Known gotchas:**

- a reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if `open` was still `true` across the
  move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no intervening update, so
  `willUpdate` never reruns to notice `open` did not change
- this component deliberately does **not** compose `<lr-dialog>` internally; it keeps its own
  panel template so a slotted `<lr-tab-group>` (or any other light-DOM-scanning child) sees real
  projected content rather than a forwarding `<slot>`, while still sharing the overlay stack
- `close()` is a no-op when `open` is already `false` — calling it twice in a row only fires
  `lr-close` once
- the `maximize`/`close` buttons are always the first elements in the Tab order while open,
  regardless of visual position, followed by `body` then `footer` content

**Additional API surface:**

- `--lr-tool-result-dialog-running-color` — Running status foreground. Default: `var(--lr-color-brand)`.
- `--lr-tool-result-dialog-running-bg` — Running status background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-tool-result-dialog-pending-color` — Pending status foreground. Default: `var(--lr-color-text-quiet)`.
- `--lr-tool-result-dialog-pending-bg` — Pending status background. Default: `transparent`.
- `--lr-tool-result-dialog-success-color` — Success status foreground. Default: `var(--lr-color-success)`.
- `--lr-tool-result-dialog-success-bg` — Success status background. Default: `var(--lr-color-success-quiet)`.
- `--lr-tool-result-dialog-error-color` — Error status foreground. Default: `var(--lr-color-danger)`.
- `--lr-tool-result-dialog-error-bg` — Error status background. Default: `var(--lr-color-danger-quiet)`.
- `--lr-tool-result-dialog-denied-color` — Denied status foreground. Default: `var(--lr-color-warning)`.
- `--lr-tool-result-dialog-denied-bg` — Denied status background. Default: `var(--lr-color-warning-quiet)`.

---

## `lr-tool-select-dialog`

A category-grouped, filterable, searchable tool-enablement dialog for picking which agent tools are
available in a conversation. It keeps its own panel template rather than nesting `<lr-dialog>`, so
it has no dependency on the general-purpose dialog, while its modal behavior participates in the
shared overlay stack. First-party invention (no Web Awesome equivalent).

**Exported types:**

- `ToolSelectDialogTool { id: string; name: string; description?: string; category?: string; icon?:
string; disabled?: boolean; disabledReason?: string }` — one selectable agent tool. `category` groups
  the row into a heading; tools with no `category` (or an empty/whitespace-only one) fall into a
  trailing localized "Other" bucket. A caller category literally named `"Other"` remains its own
  ordinary, first-seen category and is not merged into or reordered with that uncategorized bucket.
  `icon` is a literal glyph (e.g. an emoji) rendered next to `name` — an opaque string, not a registry
  lookup, the same convention `<lr-tool-call-chip>`'s `icon` uses. `disabled` individually gates a
  tool regardless of `useDefaults`/`selectedToolIds` (e.g. a tool requiring admin approval);
  `description` and `disabledReason` are supporting descriptions associated with the checkbox
  through its stable `aria-describedby` owner; only `name` contributes to the checkbox's accessible
  name. `disabledReason` is ignored when `disabled` is falsy.
- `ToolSelectFilter = (tool: ToolSelectDialogTool, query: string) => boolean` — a predicate deciding
  whether `tool` matches an already-trimmed, already-lowercased `query`. Assign `filter` to replace the
  built-in case-insensitive name/description substring match entirely (mirrors `<lr-combobox>`'s
  `OptionFilter` convention).
- `ToolSelectionChangeDetail { selectedToolIds: string[]; useDefaults: boolean }` — the `lr-change` detail
  shape.
- `ToolSelectDialogCloseReason = 'escape' | 'backdrop' | 'api' | string` — the `lr-close` detail;
  `'escape'`/`'backdrop'` come from the dialog's own built-in dismiss triggers, any other string is
  whatever a caller passes to `close()` directly.

**Properties:**

- `open: boolean = false` (reflected) — set it directly or use the lifecycle methods below.
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — opt in to backdrop-click
  dismissal; Escape remains available without it.
- `tools: ToolSelectDialogTool[] = []` (attribute: false) — the full set of tools a consumer offers,
  across all categories. `id` is the public identity: empty/blank ids are omitted and when provider
  data repeats one, the first occurrence wins consistently for grouping, filtering, counts,
  selection, and emitted ids.
- `selectedToolIds: string[] = []` (attribute: false) — the currently-enabled tool ids. Empty/blank ids
  are omitted and repeated ids are treated as one selection.
- `useDefaults: boolean = false` (attribute `use-defaults`, reflected) — whether the conversation is
  using the default tool set (`true`) or a custom selection (`false`).
- `label?: string` — the dialog's visible heading and accessible name. Omission uses localized
  `selectTools`; every supplied string, including `"Select tools"` and `""`, remains literal.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — a host attribute names the
  host; the panel remains labelled by its visible heading instead of cloning that name. A direct
  property assignment made without the attribute can name the panel.
- `searchPlaceholder?: string` (attribute `search-placeholder`) — omission uses localized
  `searchToolsPlaceholder`; every supplied string, including `"Search tools…"` and `""`, remains
  literal as placeholder copy. Empty/whitespace-only copy leaves the field visually empty while
  its accessible name falls back to localized `searchToolsPlaceholder`.
- `filter: ToolSelectFilter | null = null` (attribute: false) — overrides the built-in
  case-insensitive name/description substring match.
- `autocomplete: string = ''`, `spellcheck: boolean = true`, `autocapitalize: string = ''`,
  `autoCorrect: string = ''` (`autocorrect`), `inputMode: string = ''` (`inputmode`), and
  `enterKeyHint: string = ''` (`enterkeyhint`) — forwarded to the search `<input>`.

**Methods:** `show(): void` opens the dialog; `hide(reason: ToolSelectDialogCloseReason = 'api'):
void` performs the reasoned API dismissal;
`close(reason: ToolSelectDialogCloseReason = 'api'): void` closes the dialog, emits `lr-close` with
`reason`, and returns focus to whatever had it before the dialog opened.

**Events:** `lr-change` (`detail: ToolSelectionChangeDetail` — the proposed enabled-tool selection and
`useDefaults` state) is cancelable and fires before either property changes. Calling
`preventDefault()` retains the current `selectedToolIds`/`useDefaults` values and restores the built-in
checkbox or switch. A host can prevent a proposal while it validates or persists it, then assign
the desired detail values after that work succeeds. `lr-close`
(`detail: ToolSelectDialogCloseReason` — fired exactly once per dismissal, via Escape, a backdrop
click when `lightDismiss` is enabled, or a `close()` call), and no-detail `focus`/`blur` events
re-dispatched when the internal search input gains or loses focus.
Native `input`/`change` and prefixed `lr-input` implementation events from the built-in checkbox and
switch controls stop at the dialog boundary; listen for the single aggregate `lr-change` proposal.

**Slots:** `footer` — optional action buttons (e.g. a "Done" button), rendered in a bottom row. Changes
already apply live via `lr-change`, so this slot is purely optional; only visually shown once it has
assigned elements.

**CSS parts:** `backdrop`, `panel`, `header`, `title`, `subtitle`, `search-row`, `search-input`,
`defaults-row`, `defaults-toggle`, `defaults-hint`, `body` (the keyboard-focusable scroll region),
`empty`, `category`, `category-heading`,
`category-count`, `category-list`, `tool-row`, `tool-checkbox`, `tool-name`, `tool-icon`,
`tool-description`, `tool-disabled-reason`, `limit`, `load-more`, `footer`

**Themeable custom properties:** `--lr-tool-select-dialog-overlay-color` (default
`var(--lr-color-overlay)` — the backdrop scrim color, the same shared token
`<lr-dialog>`/`<lr-tool-result-dialog>` read), plus shared `--lr-space-*`,
`--lr-color-surface/-border/-text/-text-quiet/-warning`, `--lr-radius`, `--lr-shadow`,
`--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none — internally renders `<lr-checkbox>` and `<lr-switch>`, both bundled
dependencies of this package imported directly, not optional peers.

```html
<lr-tool-select-dialog label="Select tools">
  <button slot="footer" id="done-btn">Done</button>
</lr-tool-select-dialog>
<script type="module">
  const dialog = document.querySelector("lr-tool-select-dialog");
  dialog.tools = [
    { id: "search", name: "Web search", category: "Research" },
    { id: "python", name: "Python", category: "Code", description: "Run sandboxed Python" },
    { id: "admin", name: "Admin console", disabled: true, disabledReason: "Requires admin approval" },
  ];
  dialog.selectedToolIds = enabledToolIds;
  dialog.useDefaults = usingDefaults;
  dialog.open = true;
  dialog.addEventListener("lr-change", (e) =>
    updateTools(e.detail.selectedToolIds, e.detail.useDefaults)
  );
  dialog.addEventListener("lr-close", () => (dialog.open = false));
  dialog.querySelector("#done-btn").addEventListener("click", () => dialog.close("done"));
</script>
```

`useDefaults` is a single top-level switch: while `true`, every per-tool checkbox renders disabled
(still reflecting whatever `selected` holds — populate that with the actual default tool set whenever
`useDefaults` is true) alongside a hint explaining that turning the switch off is how to customize.
Turning it off is the only control that both flips `useDefaults` to `false` _and_ unlocks the per-tool
checkboxes for editing.

**Known gotchas:**

- No built-in footer/close button — dismissal happens via Escape, an opted-in (`light-dismiss`)
  backdrop click, or a consumer's own `footer`-slotted action calling `close()` directly.
- A row is effectively disabled whenever _either_ its own `tool.disabled` is true _or_ the top-level
  `useDefaults` switch is on — a tool without `disabled` set can still render as a locked checkbox while
  `useDefaults` is true.
- `disabledReason` text only renders when both `tool.disabled` and `tool.disabledReason` are set.
- Tool descriptions and disabled reasons are checkbox descriptions, not label content: the tool
  name remains the concise accessible name and the supporting text is linked through the checkbox's
  stable description bridge.
- Categories are grouped in first-seen order across `tools`; an empty/whitespace-only `category` folds
  into a trailing "Other" bucket that's always rendered last. A category left with zero matches after
  filtering is dropped entirely, not rendered as an empty heading. A caller-supplied category
  literally named `"Other"` is not the internal uncategorized sentinel: it stays in first-seen order
  and remains separate even when uncategorized tools are also present.
- Reconnecting the element while still `open` (e.g. a drag-and-drop reparent that keeps the same
  instance) resumes its shared overlay registration and re-acquires the scroll lock dropped in
  `disconnectedCallback`.
- The search input is the first focusable element in the panel and receives focus automatically on open.
- Matching rows mount in batches of 200. Selected matches reserve positions in the current batch,
  and a localized `[part="limit"]` notice plus `[part="load-more"]` button mounts the next 200;
  searching always considers the complete first-wins tool catalog.

---

## `lr-thinking-panel`

A collapsible panel for an AI agent's intermediate reasoning/"thinking" transcript, kept visually
and semantically distinct from its final response. First-party invention (no Web Awesome
equivalent). Same collapsible header-button-plus-region shape as `<lr-source-list>`; the default
slot is entirely free-form (a consumer-composed `<lr-streaming-text>`, `<lr-markdown>`, or
plain text) — this component has no dependency on either.

**Properties:**

- `label?: string` — omitted localizes `thinkingPanelLabel` (`'Thinking'` in the built-in English
  catalog). Any supplied string is an explicit override and renders verbatim, including
  `label="Thinking"` under a non-English `.strings` catalog and `label=""`.
- `compact: boolean = false` (reflected) — tightens the header/body padding and the header's
  internal gap for dense transcript rows. This is only a density control: its card border and
  surface remain, so use `frame="plain"` when surrounding message chrome already supplies them.
- `frame: LyraFrame = 'card'` (reflected) — the library-wide container-frame vocabulary
  (`'card' | 'plain'`). `'card'` keeps the bordered, filled outer container. `'plain'` removes its
  border, background, and corner radius so a nested panel does not double an existing frame;
  it retains the header/body divider and the active regular or compact padding. The exported
  `ThinkingPanelAppearance` alias names this same union.
- `expanded: boolean = false` (reflected) — starts collapsed, matching `<lr-source-list>`'s
  default.
- `mode: 'live' | 'post-hoc' = 'live'` (reflected) — `'live'` while reasoning is actively streaming
  in; `'post-hoc'` once it's complete and being reviewed after the fact. Drives two concrete
  behavior differences, see prose below.
- `durationMs?: number` (attribute `duration-ms`) — how long the reasoning took. Omitted entirely
  (nothing rendered in `'post-hoc'`, a pulsing placeholder in `'live'`) while unset.

**Methods:** `scrollToBottom(): void` — scrolls `[part="body"]` to its current bottom immediately
(no smooth-scroll animation). Safe to call directly, e.g. from a host that wants to force a
jump-to-latest action of its own.

**Events:** cancelable `lr-toggle-request` (`detail: { expanded: boolean }`) fires before a header
activation changes state. Prevent it to retain the current `expanded` value. An accepted request
then updates `expanded` and emits the non-cancelable committed `lr-toggle` with the same detail;
vetoed requests never emit the committed event. `lr-follow-change` (`detail: { following: boolean }`)
reports user scroll release or re-engagement; direct `follow` assignments do not echo it.

**Slots:** default (the reasoning/thinking content; entirely free-form)

**CSS parts:** `base`, `header`, `label`, `duration`, `toggle`, `body`

`[part="body"]` is unconditionally `tabindex="0"`: it is a capped-height, independently scrollable
region whose content (plain text, a non-interactive `<lr-streaming-text>`) is often not focusable
itself, so without its own tab stop a keyboard user could never scroll it — the same convention
`<lr-code-block>`'s `[part="body"]` and `<lr-virtual-list>`'s `[part="base"]` follow. It therefore
carries both affordances that go with a real tab stop: an inward `--lr-focus-ring-*` outline while
`:focus-visible` (inward so the region's own `overflow` cannot clip it), and a subtler
`--lr-color-border` outline on pointer hover, so a mouse user also sees that the transcript is a
separately scrollable region.

**Themeable custom properties:** `--lr-thinking-panel-max-block-size` (default
`var(--lr-size-16rem)`, i.e. `16rem` — consumer-overridable cap on how tall `[part="body"]` grows
before it scrolls internally; not
exposed as a component property since it's a pure layout knob, not something a template branches
on), and `--lr-thinking-panel-pending-color` (default `var(--lr-color-brand)`) — the live-mode
pending duration/toggle accent without changing the shared brand token;
`--lr-thinking-panel-compact-header-padding` (default `var(--lr-space-2xs) var(--lr-space-s)`) —
`[part="header"]` padding while `compact`; `--lr-thinking-panel-compact-header-gap` (default
`var(--lr-space-2xs)`) — gap between the toggle, label, and duration while `compact`; and
`--lr-thinking-panel-compact-body-padding` (default `var(--lr-space-s)`) — `[part="body"]`
padding while `compact`. Plus shared
`--lr-color-border`/`-surface`/`-text`/`-text-quiet`/`-brand`/`-brand-quiet`,
`--lr-space-xs`/`-s`/`-m`, `--lr-radius`, `--lr-focus-ring-width`/`-color`/`-offset`,
`--lr-transition-fast`/`-base`.

**Optional peer deps:** none.

```html
<lr-thinking-panel label="Reasoning" mode="live" expanded>
  <lr-streaming-text
    content="Considering the user's constraints…"
    streaming
  ></lr-streaming-text>
</lr-thinking-panel>

<lr-thinking-panel label="Reasoning" mode="post-hoc" duration-ms="4200">
  <p>Finished reasoning, collapsed by default.</p>
</lr-thinking-panel>

<div class="message-frame">
  <lr-thinking-panel compact frame="plain" expanded>
    Reasoning nested inside message chrome without a second card frame.
  </lr-thinking-panel>
</div>
```

`mode` drives two concrete behavior differences, not just a styling hook. **Header hint:** while
`duration-ms` is unset, `'live'` shows a pulsing "Thinking…" placeholder in `[part="duration"]`;
`'post-hoc'` shows nothing there. Once `duration-ms` is set, both modes show the same static
"Thought for …" text. **Auto-scroll:** only `'live'` mode auto-follows new content appended to the
default slot while `expanded`; `'post-hoc'` never scrolls on its own.

Live-mode auto-scroll ("stick to bottom") is the classic chat-transcript convention: while
`mode="live"` and `expanded`, new content keeps the panel scrolled to its latest line — unless the
user has manually scrolled up to re-read earlier content (tracked via a `scroll` listener on
`[part="body"]`: every user-driven scroll records whether the body was left within 48px of its own
max scroll position, and only a mutation that arrives while that's still true triggers a follow-up
scroll). Opening an already-`'live'` panel — or a still-`expanded` panel later becoming `'live'` —
always resets this to "anchored" and jumps to the latest content. New content is detected via a `MutationObserver` on this element's own light DOM
(`childList`+`subtree`+`characterData`), not `slotchange`, since streamed reasoning typically
appends chunks to an existing node's `textContent` rather than re-slotting a whole new element per
token; scroll-to-bottom calls are coalesced to at most one per animation frame under a fast token
stream.

**Known gotchas:**

- The `MutationObserver` only watches this element's own light-DOM subtree — it cannot see a
  mutation that happens entirely inside a slotted custom element's own shadow root (e.g. a
  `<lr-markdown>` re-rendering its shadow tree after a `content` change). A slotted element whose
  own internal updates should drive auto-scroll needs to append/mutate visible light-DOM text
  itself (as `<lr-streaming-text>` does), or the host can call `scrollToBottom()` directly.
- Either half of the pair can trigger the jump-to-bottom/reset-stickiness behavior, as long as the
  _other_ half already holds: an `expanded` transition to `true` while `mode` is already `'live'`,
  **or** a `mode` transition to `'live'` while the panel is already `expanded`, both jump to the
  bottom and reset stickiness. Only a change that leaves the panel in some other combination
  (collapsed, or `mode !== 'live'`) skips it.
- The sticky-bottom flag starts `true` internally, so a panel that mounts already `expanded` and
  `mode="live"` follows its very first content mutation even before any `scroll` event has fired.

---

## `lr-stack-trace`

Parses common V8/JS-TS, Firefox/Safari, and Python stack traces into a leading message plus
activatable frames, splitting chained/caused-by errors (`Caused by:`, `[cause]:`, Python's "direct
cause"/"During handling" separators) into separate groups. Frames matching `internalPatterns` fold
behind a count-labeled toggle. A malformed or non-safe-integer location remains visible as raw,
non-activatable text. Falls back to verbatim raw text when nothing parses. First-party invention
(no Web Awesome equivalent).

**Properties:**

- `trace: string = ''` — the raw stack trace text to parse and render.
- `collapseInternal: boolean = true` (attribute: `collapse-internal`) — folds runs of internal
  frames behind a toggle.
- `internalPatterns: readonly (string | RegExp)[] = DEFAULT_INTERNAL_PATTERNS` (attribute: false) —
  clone-owned, bounded, frozen file-path substrings/`RegExp`s that mark a frame as internal.
  Reassign a new array after changing the matcher sequence.
- `copyable: boolean = true` — shows a copy-to-clipboard button for the raw trace text.
- `maxHeight: string = ''` (attribute: `max-height`) — caps the rendered block size and enables an
  internal scrollbar once content exceeds it (any valid CSS length). Empty string (the default)
  grows with content.
- `frame: LyraFrame = 'card'` (reflected) — container treatment, in the library-wide `frame`
  vocabulary (`'card' | 'plain'`). `'card'` keeps the bordered, filled, padded box. `'plain'` removes
  the border, background, padding and corner radius, so a trace nested inside an
  `lr-result-card`/`lr-agent-run` — which already draws a border — doesn't double the frame. The
  `max-height` scroll cap and the copy/frame affordances are unaffected either way, and `'plain'`
  wins over `compact` when both are set. The exported alias `StackTraceAppearance` is retained as a
  name for the same union.
- `compact: boolean = false` (reflected) — tighter root padding and between-group spacing for dense
  contexts (a trace as a row in an error list, a side panel), the same density convention
  `lr-agent-run`, `lr-commit-card`, `lr-result-card`, `lr-task-list`, `lr-terminal` and
  `lr-thinking-panel` already pair with `frame`. Purely density: the border, corner radius and
  background stay, so reach for `frame="plain"` to drop the chrome. Added in 9.0.0.

**Events:**

- `lr-frame-select` (`detail: { file: string; line: number; column?: number; raw: string }`) — a
  frame with a safe parsed location was activated. `column` is always undefined for Python frames,
  which carry no column information. Malformed or unsafe locations render as raw text and never
  emit this event.
- `lr-copy` (`detail: { ok: true; text: string }`) — the raw, unparsed trace text, fired only after the
  clipboard write resolves successfully.
- `lr-error` (no detail) and `lr-copy-error` (`detail: { ok: false; text: string; reason:
'unsupported'|'denied'|'failed'; error: unknown }`) — compatibility and detailed failure signals. A rejected or
  unavailable clipboard never enters the success state or emits `lr-copy`.

**Slots:** none.

**CSS parts:** `base` (the root wrapper; respects `max-height`, tightens its padding under
`compact`, and drops its card chrome under `frame="plain"`), `message` (the leading error
message text for a group), `group` (one chained-error group of frames), `frame` (a selectable
frame button, carrying `data-internal` for internal frames, or a non-activatable raw row for an
unsafe location), `frame-function` (the frame's function name), `frame-location` (the frame's
`file:line:col` text), `internal-toggle` (the collapse/expand toggle for a run of internal frames),
`limit` (the resource-ceiling status when additional frames are omitted), `raw` (the verbatim fallback when zero structured frames parsed), `copy-button` (only rendered
while `copyable`).

**Themeable custom properties:** `--lr-stack-trace-max-height` (default `none`),
`--lr-stack-trace-font` (default `var(--lr-font-mono)`),
`--lr-stack-trace-internal-frame-color` (default `var(--lr-color-text-quiet)`) — internal-frame
foreground, `--lr-stack-trace-interactive-color` (default `var(--lr-color-brand)`) — frame
hover/focus, internal-toggle, and copy-button-hover accent, plus the two density hooks
`--lr-stack-trace-compact-padding` (default `var(--lr-space-2xs)`, `[part="base"]` padding while
`compact`, overridden entirely by `frame="plain"`) and `--lr-stack-trace-compact-gap` (default
`var(--lr-space-2xs)`, the space below `[part="message"]` and between `[part="group"]`s while
`compact`). The scoped color hooks avoid changing
the shared quiet/brand tokens used by surrounding UI. Plus shared tokens
`--lr-color-border`/`-surface`/`-text`/`-text-quiet`/`-brand`, `--lr-radius`,
`--lr-border-width-thin`, `--lr-space-xs`/`-s`/`-2xs`, `--lr-font-size-sm`/`-xs`,
`--lr-font-weight-bold`/`-semibold`, `--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-stack-trace></lr-stack-trace>
<script type="module">
  const stackTrace = document.querySelector("lr-stack-trace");
  stackTrace.trace = "TypeError: boom\n    at doThing (/app/src/util.js:10:5)";
  stackTrace.addEventListener("lr-frame-select", (e) =>
    console.log(e.detail.file, e.detail.line)
  );
</script>
```

The package root also exports the pure
`parseStackTrace(trace: string, options?: StackTraceParseOptions): StackTraceParseResult` helper
(plus `DEFAULT_INTERNAL_PATTERNS`, `STACK_TRACE_LIMITS`, and the `StackFrame`, `StackGroup`,
`StackTraceParseOptions`, and `StackTraceParseResult` types) — the same parser this component uses,
exposed standalone so a consumer can parse or unit-test traces without instantiating the element.
Pass custom classifiers as `{ internalPatterns: ['node_modules/', /vendor\//] }`. The result is
`{ groups, truncated, source }`, where `source` is the bounded raw-text fallback.

**Known gotchas:**

- an internal-frame run only collapses behind the `internal-toggle` when it is two or more
  consecutive internal frames; a single isolated internal frame renders as a normal `frame` button
  (there is nothing useful to fold).
- when `trace` doesn't match any supported format, `parseStackTrace().groups` is empty and the
  component renders the result's bounded `source` verbatim in a `raw` part instead of silently
  dropping content.
- every coordinate of an activatable frame must be a JavaScript safe integer. A malformed or
  overlarge location remains visible as a non-activatable raw row; if no safe frame is left, the
  component uses the verbatim `raw` fallback.

---

## `lr-tool-approval-dialog`

A human-in-the-loop gate: presents one proposed tool/function call (`toolName` + `args`) and blocks an
agent from executing it until a person explicitly approves or denies it, with an optional inline
"edit the arguments before approving" step. First-party invention (no Web Awesome equivalent). It
keeps its own panel template rather than nesting `<lr-dialog>`, so it has no dependency on the
general-purpose dialog component, while its modal behavior participates in the shared overlay stack.

Approve/Deny/Edit are built-in chrome, not a `footer` slot a consumer must assemble — there is exactly
one correct action set for "approve this call". The `footer` slot is offered only for _supplementary_
content alongside those buttons (e.g. a "remember this choice for this tool" checkbox); its content
renders at the start of the action row, before Deny/Edit/Approve.

**Exported types:**

- `ApprovalAction = 'approve' | 'deny'` — shared imperative vocabulary for an approval operation
  that is proposed or awaiting persistence
- `ApprovalDecision = 'approved' | 'denied'` — shared final-outcome vocabulary, deliberately
  separate from `ApprovalAction`
- `ToolApprovalDialogCloseReason = 'escape' | 'backdrop' | 'approve' | 'deny' | 'api' | string` — the
  `lr-close` detail; `'escape'`/`'approve'`/`'deny'` come from the dialog's built-in triggers,
  `'backdrop'` requires `lightDismiss`, and any other string is whatever a caller passes to
  `close()` directly.

**Properties:**

- `open: boolean = false` (reflected) — set it directly or use the lifecycle methods below
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — opt in to backdrop-click
  dismissal; Escape and the built-in decision buttons remain available without it
- `accessibleLabel: string | null = null` (attribute `aria-label`) — a host attribute names the
  host; the panel remains labelled by its visible heading rather than cloning the same name. A
  direct property assignment made without the attribute can name the panel
- `proposalKey: string = ''` (attribute `proposal-key`) — immutable identity/generation for the
  open proposal. Change it whenever a source reuses the same visible tool name/arguments for a new
  proposal; draft, editing, validation-announcement, and pending-decision state reset immediately
- `toolName: string = ''` (attribute `tool-name`) — the proposed call's name, e.g. `web_search`;
  drives the heading and the dialog's accessible name
- `args: unknown = {}` (attribute: false) — the proposed call's arguments, rendered via
  `<lr-json-viewer>` read-only, or stringified into a `<textarea>` while editing
- `editable: boolean = true` (reflected) — whether an "Edit" affordance is offered at all (assign
  `false` via a PROPERTY binding, e.g. `.editable=${false}` — a `?editable=${false}`
  boolean-attribute binding cannot override a true default). When `false`, `args` is always shown
  read-only and can never be changed before approval.
- `spellcheck: boolean = false`, `autocapitalize: string = 'off'`,
  `autoCorrect: string = 'off'` (attribute `autocorrect`), `autocomplete: string = 'off'`,
  `wrap: 'hard'|'soft'|'off' = 'soft'`, `inputMode: string = ''` (attribute `inputmode`),
  and `enterKeyHint: string = ''` (attribute `enterkeyhint`) — forwarded to the raw-JSON
  `<textarea>` while editing; the defaults keep browser editing assistance from changing JSON text.
  `pending: 'approve' | 'deny' | null = null` (reflected) — which decision is awaiting host
  resolution while an `lr-approve`/`lr-deny` listener has called `preventDefault()` on the
  now-cancelable event; the pending button shows `loading`, the other is `disabled` (Approve is
  also still `disabled` while an in-progress edit is invalid JSON, independent of `pending`).
  Escape and an enabled backdrop dismissal are suppressed while `pending` is set. Finalize by calling
  `close('approve'|'deny')`, or clear `.pending` back to `null` to bounce back to the undecided
  state; `pending` also resets to `null` every time the dialog re-opens.

**Methods:** `show(): void` opens the dialog; `hide(reason: ToolApprovalDialogCloseReason = 'api'):
void` and `close(reason = 'api'): void` close through the same reasoned lifecycle, emit `lr-close`,
and return focus to whatever had it before opening; all are no-ops when already in the target state.

**Events:** `lr-approve` (`detail: { args: unknown }` — the current, already-parsed arguments: the
original `args` prop, or the user's edited-and-validated version if an edit was in progress.
Cancelable: a listener calling `preventDefault()` sets `pending` to `'approve'` instead of
closing; otherwise always followed by `lr-close` with reason `'approve'`), `lr-deny` (no detail —
`this.emit('lr-deny')` is called with no second argument, so per the DOM spec's `CustomEventInit`
default, `event.detail` is `null`, not `undefined`. Cancelable, same `pending` mechanism, setting
`pending` to `'deny'`; otherwise always followed by `lr-close` with reason `'deny'`), `lr-close`
(`detail: ToolApprovalDialogCloseReason` — fired exactly once per dismissal, via Escape, an opted-in
backdrop click, the Approve/Deny buttons, or a `close()` call), and no-detail `focus`/`blur` events
re-dispatched when the raw-JSON editor gains or loses focus.

**Slots:** `footer` — optional supplementary content (e.g. a "remember this choice" checkbox),
rendered before the built-in Deny/Edit/Approve buttons.

**CSS parts:** `backdrop`, `panel`, `header`, `tool-name`, `body`, `args-view`, `args-editor`, `error`,
`footer`, `deny-button`, `edit-button`, `approve-button`,
`deny-button-base`, `deny-button-label`, `deny-button-start`, `deny-button-end`,
`deny-button-spinner`, `approve-button-base`, `approve-button-label`, `approve-button-start`,
`approve-button-end`, `approve-button-spinner` (`deny-button`/`approve-button` are each an
`<lr-button>` host; these five per-button parts are re-exported from its own `lr-button` parts via
`exportparts`. Each `*-button-base` route accepts the button's same-node `base` and `button`
wrapper aliases, so either name survives the nested shadow boundary; `edit-button` stays a plain
`<button>`, unaffected by this).

**Themeable custom properties:** `--lr-tool-approval-dialog-overlay-color` (default
`var(--lr-color-overlay)` — the backdrop scrim color, the same shared token `<lr-dialog>` and
`<lr-tool-select-dialog>` read), `--lr-tool-approval-dialog-mono-font` (default
`var(--lr-font-mono)`, the library's shared monospace stack — used by both `tool-name` and the
raw-JSON editor), `--lr-tool-approval-dialog-invalid-border-color` (default
`var(--lr-color-danger)` — border color of the invalid raw-JSON editor, independently retunable
without changing error text or other danger-coloured surfaces), and
`--lr-tool-approval-dialog-hover-border-color` (default `var(--lr-color-brand)` — border color of
the raw-JSON args editor on hover, giving mouse users the same "this is editable" affordance every
other text-entry surface in the library provides), plus shared tokens
`--lr-space-xs/-s/-m/-l`, `--lr-color-surface`, `--lr-color-border`, `--lr-radius`,
`--lr-shadow`, `--lr-color-brand`, `--lr-color-on-brand`, `--lr-color-danger`,
`--lr-color-text`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none — internally renders `<lr-json-viewer>`, a bundled dependency of this
package, not an optional peer.

```html
<lr-tool-approval-dialog tool-name="send_email"></lr-tool-approval-dialog>
<script type="module">
  const dialog = document.querySelector("lr-tool-approval-dialog");
  dialog.args = { to: "ops@example.com", subject: "Deploy finished" };
  dialog.addEventListener("lr-approve", (e) => runTool(e.detail.args));
  dialog.addEventListener("lr-deny", () => console.log("denied"));
  dialog.addEventListener("lr-close", (e) => console.log("closed:", e.detail));
  dialog.open = true;
</script>
```

While `editable`, an Edit button swaps the read-only `<lr-json-viewer>` for a plain `<textarea>`
pre-filled with `JSON.stringify(args, null, 2)`. Every keystroke re-validates with `JSON.parse` — the
Approve button is `disabled` for as long as the current textarea content fails to parse, so a
malformed edit can never be silently approved as either the broken text or a stale copy of the
original args. The same button relabels to "Cancel" while editing; clicking it discards the draft
entirely and returns to the read-only view of the _original_ `args` — there is no separate "save"
step independent of Approve itself. Both `editing` and any in-progress draft reset back to the
read-only view whenever the dialog opens or `proposalKey`/`toolName`/`args` identifies a replacement
proposal, so a reused instance never leaks one proposal's half-finished edit into the next.

The raw-JSON editor deliberately fixes native `resize` to `vertical`, so a user can make a long
draft taller without changing the dialog's constrained inline size. This focused approval flow has
no generic resize property or auto-grow mode; compose a dedicated editor around the approval UI
when either behavior is required.

The visible JSON error remains ordinary descriptive text. A transition from a valid draft into
invalid JSON is additionally appended once to the shared assertive light-DOM announcement sink;
further invalid keystrokes do not repeat it. An invalid draft already present at initial mount or
reconnect establishes a silent baseline rather than replaying stale context.

Initial focus deliberately does _not_ land on Approve: approving a tool call is a consequential,
potentially irreversible action, so a user who opens the dialog and reflexively presses Enter/Space
before reading anything should deny, not approve. Deny gets the initial focus instead — the same
"focus the safe action" convention a native destructive-confirmation dialog typically follows for its
own Cancel button. Tab/Shift+Tab are bounded to the panel's own focusable content, and
`<lr-json-viewer>`'s internal controls plus slotted custom-element controls are found through the
shared composed-tree focus traversal used by the other modal families.

**Known gotchas:**

- `editable` defaults to `true` and reflects — see the property note above about overriding it with a
  property binding, not a boolean-attribute binding.
- `lr-deny` has no detail payload: its `event.detail` is `null`, not `undefined`.
- a consumer flipping `editable` off while an edit is already in progress automatically exits edit mode
  and discards the draft, so an unreachable "Cancel" affordance is never left stranded on screen.
- reconnecting the element while still `open` (e.g. a drag-and-drop reparent that keeps the same
  instance) resumes its shared overlay registration and re-acquires the ref-counted scroll lock
  dropped in `disconnectedCallback` — `willUpdate()` alone wouldn't otherwise notice, since
  disconnect/reconnect fire back-to-back with no update in between.
- the Approve button's native `disabled` attribute (while the draft is invalid JSON) automatically
  excludes it from the shared Tab trap, whose focusable-set computation skips disabled controls.
- the raw-JSON `args-editor` textarea defaults to `spellcheck="false"`, `autocapitalize="off"`,
  `autocorrect="off"`, and `autocomplete="off"` because its content is JSON, never prose. These
  native editing-assistance values remain configurable through the corresponding properties for
  integrations that intentionally need different browser behavior.
- `deny-button`/`approve-button` are `<lr-button>` hosts (`variant="neutral"`/`"brand"` — the dialog
  itself has no `variant` property, unlike its in-flow sibling `<lr-confirm-bar>`, so the Approve
  button is always `brand` here) — `--lr-button-*` theming reaches them directly. A consumer
  previously styling `::part(deny-button)`/`::part(approve-button)` for
  padding/border/font/`:hover`/`:focus-visible` must move that CSS onto the re-exported
  `deny-button-base`/`approve-button-base` sub-parts instead. `edit-button` is unaffected and stays
  a raw `<button>`.
- Backdrop clicks leave the dialog open by default; add `light-dismiss` to opt in, matching
  `<lr-dialog>`, `<lr-drawer>`, `<lr-lightbox>`, and the sibling tool dialogs.
- An `lr-approve`/`lr-deny` listener can call `preventDefault()` to keep the decision open while
  its own async work is in flight — see `pending` above. While `pending` is set, Escape and an
  enabled backdrop dismissal are suppressed, so a consumer that never resolves the pending decision leaves the
  dialog open until it clears `.pending` or calls `close()` directly itself.

---

## `lr-tool-param-form`

Renders one form control per top-level property of a JSON Schema object, for ad hoc tool invocation or
approval-editing UIs (e.g. "the agent wants to call `create_event(title, attendees, allDay)` — let the
user tweak the arguments before running it"). First-party invention (no Web Awesome equivalent).
With no host name, the `base` part is the accessible `role="group"`; a native external `<label for>`
can name the form-associated host. A non-empty host `aria-label` remains on the host as the sole
aggregate semantic owner, so `base` omits its duplicate role/name. The individual generated fields
keep their own purpose-specific names in every case.

**Supported schema subset:** a _flat_ object whose properties use one primitive `type`
(`'string'`, `'number'`, `'integer'`, or `'boolean'`), `required` property presence, string `enum`,
primitive `const`, and the `title`/`description`/`default` annotations. Nested objects, arrays, type
unions, `oneOf`/`anyOf`/`allOf`, `$ref`, string/numeric constraints, and schema-valued
`additionalProperties` are not interpreted. An unsupported property type renders a visible fallback
and makes the form invalid instead of being silently accepted. Schemas are bounded to 100 fields
and 500 enum choices per field; exceeding either ceiling leaves only the bounded prefix mounted and
fails the form closed with a localized form-wide error. A null, array, or other malformed property
definition is a schema-shape error, never misreported as a value-serialization failure.

**Exported types:**

- `ToolParamFormPropertyType = 'string' | 'number' | 'integer' | 'boolean'` — the four leaf property
  types this renderer understands
- `ToolParamFormPrimitive = string | number | boolean` — values accepted by the supported `const`
- `ToolParamFormProperty { readonly type: ToolParamFormPropertyType; readonly enum?: readonly
string[]; readonly description?: string; readonly title?: string; readonly default?: unknown;
readonly const?: ToolParamFormPrimitive; readonly autocomplete?: string; readonly spellcheck?:
boolean; readonly autocapitalize?: string; readonly autoCorrect?: string; readonly inputMode?:
string; readonly enterKeyHint?: string }` — one `schema.properties`
  entry. `enum` is only meaningful when `type` is `'string'` (rendered as a `<lr-select>`); `const`
  enforces one exact primitive value; `title` is the display label; `description` is helper text;
  `default` pre-fills a field whenever `value` doesn't already have that key. For a free-form
  string field, `autocomplete`, `spellcheck`, `autocapitalize`, `autoCorrect`, `inputMode`, and
  `enterKeyHint` forward the corresponding native editing hints to the rendered text input;
  `spellcheck` defaults to `true`, and the other hints are omitted unless supplied.
- `FlatToolParamSchema { readonly type: 'object'; readonly properties:
Readonly<Record<string, ToolParamFormProperty>>; readonly required?: readonly string[] }` — the
  (intentionally flat) schema shape this component can render.
- `ToolParamFormValue = Readonly<Record<string, unknown>>` — the clone-owned argument model.

**Properties:**

- `schema: FlatToolParamSchema = { type: 'object', properties: {} }` (attribute: false) — a
  detached, deeply frozen assignment snapshot, capped at 100 fields and required keys and 500 enum
  choices per field. Exceeding a cap keeps the bounded prefix but fails validation closed. Create
  and reassign a new schema after changes; mutating the caller's prior object has no effect.
- `value: ToolParamFormValue = {}` (attribute: false) — a detached, deeply frozen assignment
  snapshot, capped at 10,000 entries per array/plain record, 50,000 total nodes, and 16 nested
  levels. Unsafe or oversized assignments fail serialization closed. Create and reassign a new
  value after changes; mutating the caller's prior object has no effect. It represents exactly
  what the consumer last assigned.
  A field with no entry in `value` but a schema `default` _displays_ (and is _emitted_, via
  `lr-input`) as that default, but the `value` property itself is left alone until the user actually
  edits that field. JSON Schema ordinarily treats `default` as an annotation; this renderer
  deliberately materializes it before validation/submission, so a valid default can satisfy
  `required`.
- `name: string = ''` — submission key for optional native `<form>` participation
- `disabled: boolean = false` (reflected)
- `customError: string | null = null` (attribute `custom-error`) — reflected consumer validation
  message
- `form: HTMLFormElement | null = null` — browser-resolved owner (and an assignable external owner);
  readonly `labels: NodeList`, `validity: ValidityState`, `validationMessage: string`,
  `willValidate: boolean`, and `effectiveDisabled: boolean` expose the native FACE state

**Getters:**

- `effectiveValue: ToolParamFormValue` — a detached, deeply frozen `value` snapshot with every
  property missing from it filled in
  from `schema`'s own `default`; this is what actually renders and what `lr-input`'s detail carries.
  A key the user has explicitly cleared (a real own property set to `undefined`) stays cleared rather
  than snapping back to its default — only a key genuinely absent from `value` falls back.
- `errors: Readonly<Record<string, string>>` — a frozen effective validation-error snapshot.
  Intrinsic errors use their schema property key; a schema-wide/serialization error or consumer
  custom-validity message uses `base`, the whole-control part. It is independent of which fields
  have been visited.
- `formError: string` — a schema-wide/JSON-serialization error that has no honest field key; empty
  when the current effective value is safe to submit.

**Methods:**

- `getForm(): HTMLFormElement | null` — returns the browser-resolved owning form.
- `checkValidity(): boolean` — synchronously updates `ElementInternals` from the current assigned
  snapshots and returns validity without revealing inline errors.
- `reportValidity(): boolean` — performs the same synchronization, reveals all current field/root
  errors, focuses the first invalid generated field when one exists, and delegates to native
  `ElementInternals.reportValidity()`. If `required` contains an unmet key absent from
  `properties`, there is no generated control to focus, so a localized, programmatically focusable
  root error names that dangling key instead.
- `setCustomValidity(message: string): void` — the standard channel for a rejection the schema
  cannot express ("the tool rejected these arguments"). A non-empty `message` raises `customError`
  and becomes `validationMessage`, so the form fails `checkValidity()`, blocks submission, and
  matches `:state(invalid)`; `''` clears it. Two independent layers: this control already raises
  `customError` intrinsically for a malformed schema or an unsupported field type, and
  `setCustomValidity('')` clears only the consumer's layer — a still-malformed schema stays invalid
  with its own message restored, and clearing never forces a form with an unmet `required` property
  valid. The consumer's error survives every intrinsic recomputation in between (each field edit
  re-runs the validity sync) and a `form.reset()`, matching a native control. The message is
  whole-control state exposed as `errors.base`; it is caller-supplied content and is used verbatim,
  never localized.
- `click(): void` — forwards a host click to the first generated field's control, so the form
  behaves like a single control under both a `<label>`-driven and a programmatic click; a no-op
  while `disabled`.

**Events:** `lr-input` (deeply frozen `detail: { value: ToolParamFormValue }` — the full detached
current value snapshot, every property with defaults resolved, not just the field that changed),
`lr-validity-change` (deeply frozen
`detail: { valid: boolean; errors: Readonly<Record<string, string>> }` — deduplicated on
effective native validity, including consumer custom errors and own/fieldset validation barring;
fired once up front at connect time and after every effective change; serialization-only failures
publish their root message as `errors.base` and `formError`), and no-detail `focus`/`blur` events for
generated native text/number inputs. The composed
`<lr-select>` controls already bubble their own focus/blur bridges through the host.
Their implementation events (`input`, `change`, `lr-change`, select show/hide, and option mutation)
are contained at the form boundary; consumers receive the single form-level `lr-input` contract.
`lr-invalid` (no detail) is the bubbling/composed, cancelable alias emitted when the complete
parameter form fails a native validity check; preventing it also prevents the native `invalid`
event's default validation UI.

**Slots:** none.

**The required marker.** A field whose key is listed in `schema.required` marks its `[part="label"]`
with the library's shared required marker — the same `::after` rule and the same three properties
every labelled control in the library uses (`--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset`), so retuning or
suppressing the marker application-wide reaches this form's fields
too (see `llms/shared.md` → "The required-field marker"). Requiredness here is **per field**, not per host:
the host carries no `required` attribute, so the marker keys off a `data-required` attribute the
component sets on each `[part="field"]` wrapper. That attribute is component-owned bookkeeping —
never write it, and note that `::part(field)[data-required]` is invalid CSS (an attribute selector
cannot follow `::part()`), so it is not a selector hook you can use from outside. Enum and boolean
fields render as `<lr-select>` controls with their own labels. The outer schema validator owns
presence, so the nested control stays `.required=false` while its host receives
`aria-required="true"` for a required property.

**CSS parts:** `base` (the aggregate `role="group"`), `field`, `label`, `control`, `description`,
`error`, `unsupported`, `empty`.
`control` is the native `<input>` for a `'string'` (non-enum) or `'number'`/`'integer'` field — one
shared part name across both the text and number inputs, and deliberately _not_ present on the
`'boolean'`/enum (`<lr-select>`), or unsupported-type fallback branches, which are
composed components with their own part surfaces rather than raw natives. It is purely an additive
external theming hook: the internal `.control` class the stylesheet targets is unchanged.

**Themeable custom properties:** `--lr-tool-param-form-invalid-border-color` (default
`var(--lr-color-danger)`) — border color of an invalid generated native text or number input.
This component-scoped indirection retints invalid borders without changing error text, required
markers, or other danger-coloured surfaces. Shared tokens remain available for the rest of the
form: `--lr-space-l/-xs/-s`, `--lr-color-border`, `--lr-radius`, `--lr-color-surface`,
`--lr-color-danger`, `--lr-color-text-quiet`, `--lr-focus-ring-width/-color/-offset`,
`--lr-opacity-disabled`.

**Optional peer deps:** none — internally renders `<lr-select>` and `<lr-option>`, both bundled
dependencies of this package imported directly, not optional peers.

```html
<lr-tool-param-form></lr-tool-param-form>
<script type="module">
  const form = document.querySelector("lr-tool-param-form");
  form.schema = {
    type: "object",
    properties: {
      title: { type: "string", title: "Title" },
      attendees: { type: "string", enum: ["team", "everyone"], default: "team" },
      allDay: { type: "boolean", title: "All day" },
    },
    required: ["title"],
  };
  form.value = draftArgs;
  form.addEventListener("lr-input", (e) => (draftArgs = e.detail.value));
  form.addEventListener("lr-validity-change", (e) => (formIsValid = e.detail.valid));
</script>
```

This component owns no Submit/Cancel/Approve chrome — a consumer composes it inside their own dialog
(e.g. `<lr-tool-approval-dialog>`) and reads `.value`/`.errors`/`checkValidity()` (or calls
`reportValidity()` right before acting). Fields render in `Object.keys(schema.properties)` order
(insertion order). A `'string'` property with a non-empty `enum` renders as a `<lr-select>` of
`<lr-option>`s; a plain `'string'` renders a text `<input>`; `'number'`/`'integer'` render a numeric
`<input type="number">` (`step="1"` for integer, `step="any"` for number); `'boolean'` renders a
tri-state `<lr-select>` with localized Unset/True/False choices. This preserves the semantic
difference between an absent optional property and an explicit `false`. Enum and boolean
descriptions/errors flow through `<lr-select>`'s `.hint`/`.errorText` control chrome. The outer
component owns JSON Schema validity: `required` means an own property is present, so `''`, `0`, and
`false` are valid present values. Use `{ type: 'boolean', const: true }` together with `required`
for a must-confirm field; the select still does not impose its own nonempty semantics, while the
outer validator enforces both presence and the exact `true` value.

Visible field and root validation errors remain ordinary descriptive text. When user interaction or
`reportValidity()` makes one or more new errors visible, their distinct messages are coalesced into
one addition to the shared assertive light-DOM announcement sink. Initial and reconnect renders
establish a silent baseline, so pre-existing validation state is not replayed.

Optional native `<form>` participation is implemented via `ElementInternals` attached directly in the
constructor (`static formAssociated = true`) rather than a string-value mixin, since this component's
value is a whole object: the value present on first connection is cloned as the native default, and
`formResetCallback()` restores a fresh clone of that default while clearing touched/interaction state.
Consumer-set custom validity remains in force until explicitly cleared, matching native controls. The
`formDisabledCallback(disabled)` tracks inherited fieldset state separately from the author-owned
`disabled` property. JSON serialization is guarded: circular values, `BigInt`, throwing getters/`toJSON`, and
non-finite numbers cannot escape from an assignment or leave stale form data; the form entry is
temporarily removed and `formError`/custom validity are set until a serializable value replaces it.
This is layered on top of the primary `value` + `lr-input`/`lr-validity-change` contract.
The same safe serialized object is used as session-history/autofill state. Restoration accepts only
a JSON object, falls back to `{}` for malformed/non-object state, and does not emit `lr-input`.

**Known gotchas:**

- a schema property whose `type` isn't `'string'`/`'number'`/`'integer'`/`'boolean'` renders an inline
  "Unsupported field type" message exposed as `[part="unsupported"]` and fails closed with custom
  validity instead of throwing or being silently dropped.
- inline per-field errors only render once a field has been visited (`focusout`) at least once, or
  after an explicit `reportValidity()` call — `checkValidity()` alone never reveals them, matching
  every other form control in this library (`<lr-select>`/`<lr-combobox>`/`<lr-model-select>`
  all avoid flashing red before the user has touched anything).
- a key listed in `schema.required` but absent from `schema.properties` still fails closed. Because
  no field exists for that dangling reference, `reportValidity()` renders and focuses a localized
  root error naming the key rather than leaving an invisible, unreachable validity failure.
- `effectiveValue` distinguishes "key absent from `value`" (falls back to `default`) from "key present
  but `undefined`" (stays cleared and counts as absent for `required`) via `hasOwnProperty`, not an
  `=== undefined` fallback check.
- additional value keys are retained and submitted (matching JSON Schema's default open-object
  behavior), but schema-valued/false `additionalProperties` is outside this renderer's subset.
- `value` and `schema` are detached, deeply frozen assignment-time snapshots. Reassign either
  property after changing caller-owned input; direct in-place mutation cannot alter the component,
  and neither its own `checkValidity()`/`reportValidity()` nor native form validation resnapshots the
  original object.
- `lr-validity-change` fires once immediately at connect time even before any user interaction, so a
  form with an unmet required field announces `valid: false` on mount, not only after the first edit.

---

## `lr-result-card` / `lr-result-field`

A small, tightly-coupled pair giving any custom `lr-tool-result-view` renderer (registered via
`registerToolRenderer()` in `../tool-result-view/registry.js`) a consistent "small bordered card +
label/value row" visual language, without each one hand-rolling its own box. Neither component has
any code dependency on the tool-result-view registry itself — they're generically usable anywhere a
small card/field shell is useful.

### `lr-result-card`

A small bordered card shell. Purely visual, with no state of its own beyond slot-presence tracking.

**Properties:**

- `heading: string = ''` — small heading for the card. Leave unset for an untitled card (e.g. a bare
  block of `lr-result-field` rows with no natural heading).
- `compact: boolean = false` (reflected) — tighter header/body padding for dense contexts (a card
  rendered as a row in a transcript or result list), same convention as `<lr-agent-run>`'s own
  `compact`. Purely a density knob: the border and background stay, so use `frame="plain"`
  instead to drop the chrome entirely. When both are set, plain leaves compact padding and gaps
  intact.
- `frame: LyraFrame = 'card'` (reflected) — container treatment, in the library-wide `frame`
  vocabulary (`'card' | 'plain'`), the same property `<lr-agent-run>`/`<lr-card>` carry. `'card'`
  (the default) keeps the bordered, filled box. `'plain'` removes the border, background, and corner
  radius, so a card nested inside a host frame that already draws a border (e.g.
  `<lr-tool-result-view>`'s own chrome) doesn't double it. Plain controls only the chrome; compact
  padding and gaps still apply when both are set. The exported alias `ResultCardAppearance` is
  retained as a name for the same union.
- `withActions: boolean = false` (attribute `with-actions`, reflected) — explicit first-render
  presence hint for the `actions` slot. Client-only markup normally does not need it because the
  component detects assigned actions during upgrade; set it before both server and browser first
  render when an actions-only header must be present in the no-JavaScript response and reused by
  hydration.

**Events:** none.

**Slots:** default (the card body — typically one or more `lr-result-field` rows, though any
content is accepted), `actions` (small header controls, e.g. a copy button, rendered alongside the
heading).

**CSS parts:** `base` (outer bordered container), `header` (present in the DOM at all times so a
later `slotchange` on `actions` is still observed, but `hidden` whenever there's no `heading` and no
`actions` content), `heading` (truncates with an ellipsis when it overflows; carries its own native
`title` attribute — the full string — so hovering the truncated text reveals it via the browser's
default tooltip, scoped to just this element rather than the whole card), `actions` (`hidden`
whenever the slot has no assigned content), `body`.

**Themeable custom properties:** `--lr-result-card-compact-header-padding` (default
`var(--lr-space-xs)`) — `[part="header"]` block/inline padding while `compact`;
`--lr-result-card-compact-header-gap` (default `var(--lr-space-xs)`) — gap between
`[part="header"]`'s heading and actions while `compact`, one step tighter than the uncompacted
`--lr-space-s`; `--lr-result-card-compact-body-padding` (default `var(--lr-space-xs)`) —
`[part="body"]` padding while `compact`; `--lr-result-card-compact-body-gap` (default
`var(--lr-space-2xs)`) — gap between `[part="body"]`'s children while `compact`, one step tighter
than the uncompacted `--lr-space-xs`. The two gap knobs mean `compact` now tightens interior spacing,
not only the padding box — a compact card no longer keeps full-size gaps inside a shrunken frame.
Plus shared tokens — `--lr-space-2xs`/`-xs`/`-s`, `--lr-color-border`/`-surface`/`-text`,
`--lr-radius`.

### `lr-result-field`

A single label/value row — e.g. "Status: 200 OK" or "Duration: 340ms" — rendered as a dense
"label: value" line by default, matching the compact, small-card presentation this pair exists for.

**Properties:**

- `label: string = ''` — the field name, e.g. "Status". Leave unset to render a value with no label.
- `value: string = ''` — plain-text value, e.g. "200 OK". Ignored once the default slot carries real
  content.

**Events:** none.

**Slots:** default — rich value content (e.g. a `lr-chip` status badge, or a plain text override),
taking precedence over `value` whenever it has any assigned content. "Real content" means any
assigned _element_ (even one with no text of its own, like an attribute-driven status badge) or any
non-whitespace text node — both a rich slotted badge and a plain-text override are caught.

**CSS parts:** `base` (row container), `label` (including its trailing colon), `value` (wrapper
around either the slotted content or the plain `value` text).

**Themeable custom properties:** shared tokens only — `--lr-space-xs`, `--lr-color-text`/
`-text-quiet`, `--lr-font`.

**Optional peer deps:** none (either component).

```html
<lr-result-card heading="Weather">
  <lr-result-field label="Status" value="200 OK"></lr-result-field>
  <lr-result-field label="Duration" value="340ms"></lr-result-field>
  <lr-result-field label="Provider">
    <lr-chip variant="success">OpenWeather</lr-chip>
  </lr-result-field>
</lr-result-card>
```

**Known gotchas:**

- `HTMLElement.textContent` read on a shadow-DOM wrapper containing a `<slot>` does NOT include the
  slot's assigned/projected light-DOM content — only literal fallback children of the `<slot>` tag
  itself (there are none here). Asserting against `[part="value"]`'s own `.textContent` to check
  rendered slotted content will read as empty even when the component is rendering correctly;
  assert against the slot's `assignedNodes()`/`assignedElements()` instead.

---

## `lr-compare-panel`

Side-by-side A/B output comparison with a winner vote (LMSYS-arena / LangSmith-pairwise style): two
slotted panes, a vote bar, synchronized reading.

**Properties:** `labelA: string = ''` (attribute `label-a`) and `labelB: string = ''` (attribute
`label-b`) — pane headings. `vote: 'a' | 'b' | 'tie' | 'both-bad' | null = null` (reflected) — the
recorded winner, host-writable to reflect a previously-recorded vote back. `itemId: string = ''`
(attribute `item-id`) — an opaque id round-tripped through `lr-vote`. Changing only `itemId` clears
the prior vote; assigning both `itemId` and a controlled `vote` in one update preserves the explicit
vote regardless of property assignment order. `allowedVotes: readonly CompareVote[] = ['a', 'b',
'tie', 'both-bad']` (attribute: false) is the positive list of choices to render, always projected
in that canonical order; repeated/foreign values do not create controls. The list is clone-owned,
bounded, and frozen; reassign a new array after changing the allowed choices. `syncScroll: boolean =
false` (attribute `sync-scroll`) links both panes'
scroll position. `disabled: boolean = false` (reflected) disables every vote button and suppresses
`lr-vote`.

**Slots:** `a` (the first output — any content, a chat message, markdown, a viewer), `b` (the second
output), and `prompt` (optional shared-input header above both panes).

**Events:** `lr-vote` — `detail: { choice: 'a' | 'b' | 'tie' | 'both-bad'; itemId: string }`.
This is a cancelable veto point emitted before `vote` changes; call `preventDefault()` to preserve
the prior vote.

**CSS parts:** `base` (the outer wrapper), `prompt` (the optional prompt header, hidden when the
`prompt` slot is empty), `panes` (the row, or under 640px column, wrapping both panes), `pane-a`,
`pane-b` (each pane's labeled scroll region), `pane-header` (a pane's visible heading), `vote-bar`
(the `role="group"` row of vote buttons), `vote-button` (one vote button), and `live-region` (the
internal vote-announcement live region).

**Themeable custom properties:** `--lr-compare-panel-max-height` (default `var(--lr-size-24rem)`) —
cap on each pane's scroll region before it scrolls internally;
`--lr-compare-panel-selected-background` (default `var(--lr-color-brand-quiet)`),
`--lr-compare-panel-selected-border-color` (default `var(--lr-color-brand)`), and
`--lr-compare-panel-selected-color` (default `var(--lr-color-brand)`), and
`--lr-compare-panel-selected-font-weight` (default `var(--lr-font-weight-semibold)`) style the
selected vote button without changing shared brand tokens.

## `lr-span-waterfall`

The horizontal-timeline projection of the same `LyraSpan[]` `<lr-trace-tree>` consumes: a time
axis, one row per span in start order, status-toned bars (Langfuse timeline / Temporal
event-history style).

**Properties:** `spans: LyraSpan[] = []` (attribute: false) — `LyraSpan { id: string; parentId?:
string; name: string; kind: 'agent' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'other';
startMs: number; endMs?: number; status: 'pending' | 'running' | 'success' | 'error' | 'denied';
tokensIn?: number; tokensOut?: number; costText?: string; detail?: string }`, exported from
`trace-tree/span.ts`. `startMs`/`endMs` are milliseconds **relative to the trace start**, not
wall-clock timestamps; `endMs` is absent while the span is still running. `costText` is preformatted
by the host (e.g. `"$0.0012"`) and rendered verbatim, never parsed or summed. One flat array powers
both this component (timeline projection via `startMs`/`endMs`) and `lr-trace-tree` (hierarchy
projection via `parentId`) — never two shapes. Foreign runtime `kind` and `status` values render
as `'other'` and `'pending'` rather than throwing, although hosts should continue to use the
documented literal sets. At most 500 unique valid spans mount; when `activeSpanId` resolves beyond
the ordinary input-order budget, that span and its ancestor path reserve positions so the
controlled active state remains visible. A localized `[part="limit"]` note exposes truncation.
`activeSpanId: string | null = null`
(attribute `active-span-id`), `viewStartMs: number | null = null` (attribute `view-start-ms`) and
`viewEndMs: number | null = null` (attribute `view-end-ms`) — override the auto-computed time
window, `hideAxis: boolean = false` (attribute `hide-axis`), and `label: string = ''`.

The granular `@aceshooting/lyra-ui/components/agent-tools/trace-tree/trace-tree.js` entry also
type-exports `LyraSpanKind` and `LyraSpanStatus`, and exports
`normalizeLyraSpanKind(value)` / `normalizeLyraSpanStatus(value)` for normalizing provider data
before assigning `spans`. These helpers are intentionally granular-only rather than root-barrel
exports.

**Events:** `lr-span-select` — `detail: { spanId: string }`, a bar/row was activated (click, Enter,
Space).

**CSS parts:** `base`, `axis` (the time-ruler row, hidden when `hideAxis`), `tick`, `tick-label`,
`row`, `name` (the row's name gutter), `bar-track`, `bar` (the interactive, focusable status-toned
bar), `meta` (secondary row info, shown inline under 480px), `status-text`, `duration`, `empty` (shown
when `spans` is empty), `limit` (the 500-span projection notice), and `live-region`.
The interactive `bar` keeps a 24px minimum target in both axes even when its duration-derived
paint width would otherwise be only a few pixels.

The terminal axis tick is end-aligned so its label remains inside the allocated chart width. Roving
keyboard focus is computed from the currently rendered/filtered span ids, so a hidden active span
cannot leave the component with no `tabindex="0"` stop.

**Themeable custom properties:** `--lr-span-waterfall-name-width` (default `8rem`),
`--lr-span-waterfall-stripe-speed` (a `running` span's striped-bar animation duration; defaults to
`--lr-duration-ambient` — the bare-duration token, not the `--lr-transition-ambient`
duration+easing shorthand, which is invalid in an `animation-duration` slot), and
`--lr-span-waterfall-row-active-bg` (default
`var(--lr-color-brand-quiet)`) — the background of the active (`activeSpanId`) row.
Status-scoped bar hooks are `--lr-span-waterfall-success-color` (default
`var(--lr-color-success)`), `--lr-span-waterfall-error-color` (default
`var(--lr-color-danger)`), `--lr-span-waterfall-denied-color` (default
`var(--lr-color-warning)`), `--lr-span-waterfall-running-color` (default
`var(--lr-color-brand)`) for the running stripe foreground,
`--lr-span-waterfall-running-stripe-color` (default `var(--lr-color-brand-quiet)`) for its
contrasting background, and `--lr-span-waterfall-pending-border-color` (default
`var(--lr-color-border-strong)`) for pending bars.

That last one follows the convention every **state-scoped** custom property in this family uses, and
it is worth reading once: it is an inline `var()` fallback at its point of use and is deliberately
**not** declared on `:host`, so it can be set on the element _or on any ancestor_ and still reach the
rule that consumes it. It exists because Shadow Parts forbids an attribute selector after `::part()`
— `::part(row)[data-active]` and every selector like it is invalid CSS — so before it, the only way
to restyle a state-dependent surface was to override a library-wide `--lr-color-*` token, which repaints
every other surface reading that token. Every `*-active-*`, `*-selected-*` and per-state color
property below works the same way.

## `lr-task-list`

A live, collapsible tracker for an agent's plan: ordered steps with per-step lifecycle status and one
level of nested sub-steps, embedded in the transcript. `items` is controlled and never mutated by this
component. Unlike `<lr-stepper>`'s single-`current` navigation, task-list has no selection and
several steps may be `running` at once. By default it is a status report; `reorderable` adds
controlled keyboard reorder requests without changing ownership of `items`. Status changes and
confirmed moves are announced through an internal `<lr-live-region>`.

**Properties:** `items: readonly TaskItem[] = []` (attribute: false) — `TaskItem { id: string; label: string;
status: TaskStatus; detail?: string; children?: readonly TaskItem[] }` with `TaskStatus = 'pending' |
'running' | 'success' | 'error'` (both exported here). `detail` is an optional secondary plain-text
line; `children` is exactly **one** level of sub-steps — a child's own `children` is ignored with a
`console.warn`. Runtime non-record rows and rows without a nonempty string `id` are omitted before
rendering, summaries, announcements, and reorder validation. While `reorderable`, every retained
top-level task and direct child must additionally have a globally unique `id`; duplicate data stays
visible but fails closed, with no row keyboard stops or reorder requests.
`reorderable: boolean = false` (reflected) enables Ctrl/Cmd+ArrowUp/ArrowDown on a focused task.
It emits a request only; the host must assign a new reordered `items` array before the task visibly
moves or an announcement is made. `label?: string` omits into localized `taskListLabel` (`'Tasks'`
in the built-in English catalog); any supplied value is an explicit verbatim override, including
`'Tasks'` under a non-English `.strings` catalog and `''`. `headingLevel: LyraHeadingLevel = '3'`
(attribute `heading-level`, reflected) — `1`–`6` expose the visible header as that semantic heading
level around either its disclosure button or static content, invalid untyped values retain level 3,
and `none` is the explicit visual-only opt-out — `expanded: boolean = true` (reflected), and
`collapsible: boolean = true`. `compact: boolean = false` (reflected) — tighter header/body padding
and item gap for dense contexts (a plan tracker nested in an already-padded transcript row), same
convention as `<lr-agent-run>`'s/`<lr-source-card>`'s `compact`; purely a density knob, the border
and background stay. `frame: LyraFrame = 'card'` (reflected) — container treatment, in the
library-wide `frame` vocabulary (`'card' | 'plain'`); `'plain'` removes `[part="base"]`'s border,
background, and corner radius so a list embedded in a container that already draws a border (an
agent-run panel, a message bubble) doesn't double it. The exported alias `TaskListAppearance` is
retained as a name for the same union.

**Slots:** `detail-<id>` — dynamic, one per item id (e.g. `slot="detail-step-3"`); rich detail under
that item's label, typically a `<lr-tool-call-chip>` or file `<lr-chip>`.

**Events:** `lr-toggle` — the header was activated, expanding or collapsing the panel. `detail: {
expanded }`. `lr-reorder` — Ctrl/Cmd+ArrowUp/ArrowDown requests moving the focused task within its
own sibling list. `detail: { taskId, parentTaskId, fromIndex, toIndex }`; `parentTaskId` is `null`
for a top-level task and indices are sibling-scoped. It fires only while `reorderable` with unique,
nonempty ids.
A boundary key is a silent no-op, so it never reparents a child; the component announces success only
after the host's rendered array confirms the exact requested swap.

**CSS parts:** `base`, `header` (a `<button>` when `collapsible`, plain content otherwise, within
the configured semantic heading), `label`,
`summary` (the visible "N of M completed" summary, top-level items only), `toggle` (the chevron
indicator, only rendered when `collapsible`), `body` (the list of items, `hidden` while collapsed),
`item` (`role="listitem"`; carries `data-status`/`data-id`/`data-depth` and is focusable only for
valid `reorderable` data), `status-icon`, `item-label`, `item-detail`, and `item-children` (the
nested `role="list"` wrapper around a top-level item's children).

**Themeable custom properties:** `--lr-task-list-spin` (default `var(--lr-transition-ambient)`, i.e.
`1.8s ease-in-out`, collapsing to `0.001ms linear` under `prefers-reduced-motion`) — running-status
icon spin animation duration/timing; `--lr-task-list-compact-header-padding` (default
`var(--lr-space-2xs) var(--lr-space-s)`) — `[part="header"]` padding while `compact`;
`--lr-task-list-compact-header-gap` (default `var(--lr-space-2xs)`) — gap between `[part="header"]`'s
label/summary/toggle while `compact`, one step tighter than the header's uncompacted
`--lr-space-xs`, so `compact` tightens the header's _interior_ spacing and not just its padding;
`--lr-task-list-compact-header-font-size` (default `var(--lr-font-size-sm)`) — `[part="header"]`
font size while `compact`, completing the compact header's typography alongside its padding and
gap;
`--lr-task-list-compact-gap` (default `var(--lr-space-2xs)`) — gap between `[part="body"]`'s item
rows while `compact`; `--lr-task-list-compact-body-padding` (default `var(--lr-space-2xs)
var(--lr-space-s) var(--lr-space-s)`) — `[part="body"]` padding while `compact`;
`--lr-task-list-pending-color` (default `var(--lr-color-text-quiet)`),
`--lr-task-list-running-color` (default `var(--lr-color-brand)`),
`--lr-task-list-success-color` (default `var(--lr-color-success)`), and
`--lr-task-list-error-color` (default `var(--lr-color-danger)`) independently retint the matching
status icons without changing shared status tokens.

## `lr-terminal`

A read-only ANSI console for streamed agent/tool output. Not a PTY: no stdin/keystroke handling, no
cursor-addressed full-screen apps. An ANSI sequence split across chunks retains at most 4,096
characters; an overlong unterminated CSI/OSC sequence is dropped and the next write resumes from a
clean parser boundary.

**Properties:** `content: string = ''` — initial/replaceable buffer content, parsed for ANSI/SGR
codes. `replace(content: string): void` synchronously replaces the parsed buffer and reactive
`content` source, preserving commit order with same-turn `write()`/`clear()` calls.
`maxScrollback: number = 5000` (attribute `max-scrollback`), `follow: boolean = true`
(reflected) — stick-to-bottom, `wrap: boolean = true` (reflected), `copyable: boolean = true`
(reflected) and `downloadable: boolean = false` (reflected) toggle the toolbar buttons, `filename:
string = 'terminal.log'`, `announceOutput: boolean = false` (attribute `announce-output`),
`accessibleLabel: string = ''` (attribute `aria-label`), `highlights: readonly LyraHighlight[] = []` (attribute:
false), and `activeHighlightId: string | null = null` (attribute: false). Empty/blank highlight ids
and later duplicates are omitted before painting, focus ownership, active lookup, and activation
events. A non-empty host `aria-label` is forwarded to the nested `role="log"`; an absent or explicit
empty value uses the localized terminal-purpose fallback, so the actionable log remains named.
`compact: boolean = false` (reflected) — tightens `[part="toolbar"]`'s padding and gap and each
rendered line's inline padding for a terminal embedded in an already-padded transcript row, the same
convention `<lr-task-list>` and `<lr-thinking-panel>` use; purely a density knob, the card border and
background stay. `frame: LyraFrame = 'card'` (reflected) — container treatment in the library-wide
`frame` vocabulary (`'card' | 'plain'`); `'plain'` removes `[part="base"]`'s border, corner radius,
and raised surface so a terminal nested inside a container that already draws a border (an agent-run
panel, a message bubble) doesn't double it, while keeping the toolbar/log divider and whichever
regular or compact padding applies. `anchorKinds:
LyraAnchor['kind'][] = ['line-range']` is readonly — a scrollback buffer addresses positions by line number, so `line-range` is the
only kind `scrollToAnchor()` resolves; `page`/`text-quote`/`region` belong to the paginated document
viewers, not here. `<lr-terminal>` is not registered in the document-renderer registry, so this field
is a plain readonly property rather than the `DocumentAnchorTarget` mixin's `override readonly` one.

**Methods:** `write(text)` appends ANSI-parsed text to the buffer, subject to the bounded partial
sequence behavior above. `clear()` empties the buffer.
`scrollToBottom()` and `scrollToAnchor(anchor): Promise<boolean>` control scroll position.
`search(query): Promise<number>` (resolves the match count after the resulting render),
`searchNext()`, `searchPrevious()`, and `clearSearch()` drive in-buffer text search — matching is
line-granular (a match identifies a whole line, not a character range) and capped, so `matchCount`
stops climbing on a pathologically repetitive buffer. `getPlainText()` returns the SGR-stripped
plain text of the whole buffer.

**Events:** `lr-copy` (`detail: { ok: true, text }`, emitted only after a successful clipboard write),
`lr-error` (no detail) and `lr-copy-error` (`detail: { ok: false, text, reason, error }`) on clipboard failure,
`lr-download` (`detail: { filename }`, cancelable — by
default the component creates a plain-text `Blob`/object URL and activates a synthetic
`<a download>`; `preventDefault()` suppresses that built-in download so the host can substitute
server-side or other handling),
`lr-follow-change` (`detail: { following }`), `lr-search-change` (`detail: { query, matchCount,
matchCountExact, activeIndex }`; `matchCountExact` is `false` once a search hits the 10,000-match
ceiling, marking `matchCount` as a lower bound rather than an exact total),
`lr-highlight-activate` (`detail: { highlightId }`), and `lr-text-select` (`detail: {
text, anchor, rects }`).

**CSS parts:** `base`, `toolbar` (only rendered when copy/download are enabled), `copy-button`,
`download-button`, `viewport` (the `role="log"` scrollable region), `line` (one rendered line; carries
`data-line-number`/`data-match`/`data-highlight-tone`, and is forwarded via `exportparts` so
`lr-terminal::part(line)` reaches the rendered lines from a consumer stylesheet despite them living
in the internal `<lr-virtual-list>`'s shadow root), `jump-to-latest` (shown while `follow` is
disengaged and new output has arrived), `line-interactive`, `line-highlight-accent`,
`line-highlight-success`, `line-highlight-warning`, `line-highlight-danger`, `line-highlight-neutral`,
`line-match`, `line-active-match`, and `announcer` (the visually-hidden, `aria-hidden` mirror
of the text last announced while `announce-output` is set).

`[part="announcer"]` is a styling and inspection surface only — it carries **no** live-region role
of its own. The announcement itself goes to the library's shared **light-DOM** polite region,
appended to the consumer's `<body>` and marked `data-lr-live-region="polite"`, because a live
region inside a shadow root is not reliably announced (JAWS with Firefox ignores one outright). A
test therefore asserts against that shared region, not `::part(announcer)`; the part remains the
right hook for styling, and for reading back what the terminal last announced.

**Themeable custom properties:** `--lr-terminal-height` (default `var(--lr-size-20rem)`) — the
viewport's block size; not declared on `:host`, so it is inherited from the host or any ancestor.
`--lr-terminal-highlight-accent-bg` (default `var(--lr-color-brand-quiet)`),
`--lr-terminal-highlight-success-bg` (default `var(--lr-color-success-quiet)`),
`--lr-terminal-highlight-warning-bg` (default `var(--lr-color-warning-quiet)`),
`--lr-terminal-highlight-danger-bg` (default `var(--lr-color-danger-quiet)`), and
`--lr-terminal-highlight-neutral-bg` (default `var(--lr-color-surface)`) — the background of a
`highlights[]` entry of the matching `tone`. `--lr-terminal-compact-toolbar-padding` (default
`var(--lr-space-2xs) var(--lr-space-xs)`) and `--lr-terminal-compact-toolbar-gap` (default
`var(--lr-space-2xs)`) retune `[part="toolbar"]`'s padding and button gap while `compact`, and
`--lr-terminal-compact-line-padding-inline` (default `var(--lr-space-xs)`) retunes each rendered
line's inline padding while `compact` — all three sit behind inline `var()` fallbacks, so a
transcript can retune every nested terminal at once without restating the rules. Each highlight
background is decoupled from the identical shared token it
falls back to (e.g. `accent`'s `--lr-color-brand-quiet` is also the copy/download-button hover tint)
so retinting one tone doesn't repaint the other surface reading that token, and from any
`::part('line')` stylesheet override — the background is applied inline, so a stylesheet rule can't
beat it without `!important`.

**The ANSI/SGR palette is two token sets, not one.** SGR gives the sixteen colour names two
different jobs, and each job is themed separately:

- `--lr-terminal-color-<name>` — **foregrounds**, i.e. `CSI 30`–`37` and `CSI 90`–`97`, drawn _on_
  the terminal panel.
- `--lr-terminal-bg-<name>` — **backgrounds**, i.e. `CSI 40`–`47` and `CSI 100`–`107`, drawn _under_
  the panel's text.

`<name>` is `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white` and their
`bright-` counterparts — 32 tokens in all, each with its own `--lr-theme-terminal-color-*` /
`--lr-theme-terminal-bg-*` retheme hook, and each with a separate light- and dark-mode value.

The two sets exist because each is solved against a different reference, which is what makes the two
cases a program cannot avoid legible:

1. every `--lr-terminal-color-*` clears 4.5:1 against `--lr-color-surface-raised` — the panel
   `<lr-terminal>` paints for itself — so **any foreground is legible on the panel**;
2. every `--lr-terminal-bg-*` clears 4.5:1 against the panel's default text colour, which is the
   foreground actually in effect whenever a program sets a background and no explicit colour, so
   **the default foreground is legible on any background**.

A single shared set could not do both: foregrounds solved against a light panel are all dark, so
`ESC[41m` would paint a near-black red behind near-black text. An _explicit_ foreground+background
pair (`ESC[30;47m`) is the emitting program's choice and is not guaranteed here, exactly as in a
native terminal — sixteen against sixteen is 256 combinations, several degenerate by construction.

Each colour keeps its canonical ANSI hue (a terminal's red has to look like red, or escape sequences
stop meaning what every other terminal makes them mean); only lightness is solved for. The
consequence worth stating: on a light panel every background is a light tint, so `ESC[40m` ("black
background") renders as the darkest tint that still leaves the default text readable rather than as
literal black. Extended-colour sequences follow the same split: 256-colour indices 0–15 resolve to
the role-matching named token (so `ESC[48;5;1m` gets the background red, not the foreground one),
while indices 16–255 and truecolor become literal `rgb()` values — those are content-supplied rather
than token-driven, and carry no contrast guarantee.

**Additional API surface:**

- `--lr-terminal-search-outline-color` — Outline color for a line containing a non-active search match. Default: `var(--lr-color-warning)`.
- `--lr-terminal-search-active-outline-color` — Outline color for the active search match's line. Default: `var(--lr-color-brand)`.

While a search query is active, writes, scrollback trimming, `content` replacement, and `clear()`
recompute the exact match count and emit `lr-search-change` only when that public search snapshot
actually changes. Pending output announcements are canceled by clear/replacement, disabling
`announceOutput`, or disconnect, so stale text is never announced after it has been removed.
A multi-line highlight paints every retained covered line but exposes exactly one keyboard/click
owner at the anchor's start, or at the first surviving covered line after scrollback trims that
start. Its accessible name combines the caller label with visible line text (or a localized line
number for an empty line), avoiding duplicate tab stops for one logical highlight.

## `lr-trace-tree`

A collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith run-tree style): kind icon,
name, status, an inline duration bar on the shared trace time scale, and optional tokens/cost
columns. Consumes the same `LyraSpan[]` as `<lr-span-waterfall>`.

**Properties:** `spans: LyraSpan[] = []` (attribute: false) — the same `LyraSpan` shape documented
under `lr-span-waterfall` above (exported from `trace-tree/span.ts`); hierarchy comes from
`parentId`, and a span whose `parentId` is missing or doesn't resolve within the same array renders
as a root rather than being dropped. `activeSpanId: string | null = null`
(attribute `active-span-id`), `label?: string`, `showTokens: boolean = false` (attribute
`show-tokens`) — surfaces `tokensIn`/`tokensOut`, `showCost: boolean = false` (attribute
`show-cost`) — surfaces `costText`, and `hideBars: boolean = false` (attribute `hide-bars`).
`label` is an optional accessible-name override for the `role="tree"` element: omission localizes
the default, and any supplied string — including `''` — is rendered verbatim.
Token counts render only when finite and non-negative; invalid metrics are omitted rather than
reaching `Intl.NumberFormat`. A row's accessible name includes its optional `detail` text as well
as its name/status/metrics, and updates when the supplied span data changes. Every trace view uses
the same bounded runtime projection: provider records are normalized with deterministic first-wins
identity, then at most 500 mount. The controlled `activeSpanId` and its resolvable ancestor path
reserve positions before ordinary input-order spans. Non-object records, empty/blank ids, non-finite
starts/ends, and later duplicate ids are omitted; negative starts clamp to zero, ends clamp to at
least their start, unknown kinds become `other`, and unknown statuses become `pending`. A localized
`[part="limit"]` note exposes truncation.

**Methods:** `expandAll()` and `collapseAll()` set every row's expanded state at once.

**Events:** `lr-span-select` (`detail: { spanId: string }`, a row was activated) and `lr-span-toggle`
(`detail: { spanId: string; expanded: boolean }`, a row was expanded or collapsed).

**CSS parts:** `base` (`role="tree"`), `header` (the column-header row, only when
`showTokens`/`showCost`), `row` (`role="treeitem"`), `toggle`, `icon`, `name`, `detail`, `status-text`,
`duration`, `tokens-in`, `tokens-out` (when `showTokens`), `cost` (when `showCost`), `bar-track`,
`bar`, `empty` (shown when `spans` is empty), `limit` (the 500-span projection notice), and
`live-region`.

**Themeable custom properties:** `--lr-trace-tree-row-active-bg` (default
`var(--lr-color-brand-quiet)`) — the background of the active (`activeSpanId`) row — and
`--lr-trace-tree-row-active-color` (default `var(--lr-color-text)`) — the color of that row's
secondary text (`detail`, `duration`, `tokens-in`, `tokens-out`, `cost`, and the `pending`
`status-text` label). Same state-scoped-property convention described under `lr-span-waterfall`
above: an inline `var()` fallback rather than a `:host` declaration, so either can be set on the
element or any ancestor, and they exist because `::part(row)[data-active]` is invalid CSS.
`--lr-trace-tree-max-indent` (default `var(--lr-size-12rem)`) caps visual nesting indentation;
semantic `aria-level` remains exact at deeper levels.

**Contrast note:** the active row is more than a tint. Its secondary text would sit at ~4.25:1
against the default tint if it stayed at `--lr-color-text-quiet`, so it rises to full-strength
`--lr-color-text` while the row is active, and the semantic `status-text` labels are rendered as
`color-mix(in srgb, var(--lr-color-<tone>) 75%, var(--lr-color-text))` — keeping the status hue
(an error row stays red) while clearing the 4.5:1 floor (success 4.46 → 6.18, `denied` 4.28 →
5.96). Both adjustments are theme-symmetric, because `--lr-color-text` flips with the color
scheme. `[part='bar']` is deliberately untouched: it is a non-text graphic on a 3:1 floor, and its
saturation is the row's primary status signal.

The two properties are a **pair**. The defaults assume the active background stays on the same
side of the lightness midpoint as the ambient surface, so a consumer who sets
`--lr-trace-tree-row-active-bg` to a dark tint in light mode (or a light one in dark mode) must
set `--lr-trace-tree-row-active-color` to match, and should re-check the status-label tones
against the new tint as well.

**Additional API surface:**

- `--lr-trace-tree-toggle-hover-bg` — Toggle hover background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-trace-tree-success-color` — Success status text and bar. Default: `var(--lr-color-success)`.
- `--lr-trace-tree-error-color` — Error status text and bar. Default: `var(--lr-color-danger)`.
- `--lr-trace-tree-denied-color` — Denied status text and bar. Default: `var(--lr-color-warning)`.
- `--lr-trace-tree-running-color` — Running status text and stripe. Default: `var(--lr-color-brand)`.
- `--lr-trace-tree-pending-color` — Pending status text and bar. Default: `var(--lr-color-text-quiet)`.
- `--lr-trace-tree-bar-track-bg` — Duration bar track. Default: `var(--lr-color-surface-raised)`.
- `--lr-trace-tree-running-stripe-bg` — Running stripe contrast. Default: `var(--lr-color-brand-quiet)`.

## `lr-activity-feed`

An append-only streaming log of granular agent actions ("Searching the web…", "Read
src/index.ts"), collapsing to a localized "Completed N steps" summary once the run is over. Entries
never change state once added — a step whose status mutates in place belongs to `<lr-task-list>`
instead. Implements the shared follow (stick-to-bottom) contract. At/above `virtualizeAt`
entries, the body renders through an internal `<lr-virtual-list>` instead of a plain keyed list.

**Properties:** `entries: ActivityEntry[] = []` (attribute: false) — `ActivityEntry { id: string;
text: string; icon?: string; timestamp?: Date | string; variant?: LyraVariant }` (exported here).
`icon` is a literal glyph hint (e.g. an emoji), the same convention `lr-tool-call-chip.icon` uses; a
small variant dot renders in its place when omitted. Empty/blank ids and later duplicate ids are
omitted before the summary, keyed render, or virtualization path is chosen. `LyraVariant = 'neutral' | 'brand' | 'success'
| 'warning' | 'danger'` is the library-wide semantic vocabulary, so an entry is toned with the same
five values as every other `variant` in the library. An invalid `timestamp` string is treated as
unset. `mode: 'live' | 'post-hoc' =
'live'` (reflected), `follow: boolean = true` (reflected), `expanded: boolean = false` (reflected),
`label?: string` — omission localizes `activityFeedLabel` (`'Activity'` in the built-in English
catalog), while any supplied string is a verbatim override, including `'Activity'` under a
non-English `.strings` catalog and `''`. A present host `aria-label` names the owned list in both
plain and virtualized rendering paths while `label` remains the visible header text —
`showTimestamps: boolean = false` (attribute `show-timestamps`),
`formatTimestamp?: (date: Date) => string` (attribute: false), `renderText?: (entry: ActivityEntry)
=> TemplateResult` (attribute: false) — overrides the default plain-text `entry-text` rendering with
arbitrary rich content (e.g. rendered markdown, or markdown plus a trailing tool-call chip list),
identically whether or not the feed is currently virtualized; fully replaces `[part="entry-text"]`
rather than augmenting it, and `virtualizeAt: number = 199` (attribute
`virtualize-at`).

**Events:** `lr-toggle` (`detail: { expanded }`, the header was activated) and
`lr-follow-change` (`detail: { following }`, `follow` released or re-engaged).

**CSS parts:** `base`, `header` (a `<button>`), `status-dot` (pulses while `mode="live"`), `label`,
`summary`, `toggle`, `body` (the scrollable region, or the internal virtual-list), `entry` (carries
`data-variant`), `entry-icon`, `variant-dot` (the dot rendered inside `entry-icon` when the entry
sets no literal `icon`), `variant-dot-neutral`/`variant-dot-brand`/`variant-dot-success`/
`variant-dot-warning`/`variant-dot-danger` (each also carries `variant-dot`), `entry-text`, and
`entry-timestamp` (only while `showTimestamps` and a valid `timestamp` is set). Every entry-level
part is reachable in both rendering paths, virtualized or not.

**Themeable custom properties:** `--lr-activity-feed-max-height` (default `16rem`) — cap on how
tall the expanded body grows before it scrolls internally; and
`--lr-activity-feed-live-status-color` (default `var(--lr-color-brand)`) — background color of
`status-dot` while `mode="live"`, independently retunable without changing other brand surfaces.

**Known gotchas:**

- The variant dot's color is selected by its _part name_, not by `[data-variant]`: `::part()` cannot
  be followed by an attribute selector, so
  `lr-activity-feed::part(variant-dot)[data-variant='success']` never matches. Target
  `lr-activity-feed::part(variant-dot-success)` instead. `data-variant` remains on both the entry
  and the dot for DOM queries.

## `lr-commit-card`

A compact commit summary (subject, author/time, diffstat, per-file changes) that links file rows out
to a diff view.

**Properties:** `hash: string = ''`, `message: string = ''`, `author: string = ''`, `timestamp?:
number` (attribute: false, epoch milliseconds), `files: CommitFileChange[] = []` (attribute: false) —
`CommitFileChange { path: string; additions: number; deletions: number; status?: GitStatus }`
(exported here), where `GitStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' |
'conflicted' | 'ignored'` (shared with `lr-file-tree`); the diffstat is summed from `additions`/
`deletions` across `files`. Counts are normalized to finite non-negative integers before per-file
display, total arithmetic, localization, and accessible summaries. `path` is the file identity;
empty/blank paths and later duplicates are omitted before both diffstat arithmetic and row events. `filesExpanded:
boolean = false` (attribute `files-expanded`, reflected — renamed from `filesCollapsed` in 9.0.0,
default inverted so the rendered starting state is unchanged: `el.filesCollapsed = true` becomes
`el.filesExpanded = false`), and `copyable: boolean = true` (reflected).
`compact: boolean = false` (reflected) — tighter `[part="base"]` padding for a commit rendered as a
row in a list or PR timeline, same convention as `<lr-agent-run>`'s own `compact`; the border stays,
so pair it with `frame="plain"` to drop the chrome entirely. `frame: LyraFrame = 'card'` (reflected)
— container treatment, in the library-wide `frame` vocabulary (`'card' | 'plain'`), the same
property `<lr-agent-run>`/`<lr-card>` carry: `'card'` keeps the bordered, padded box, `'plain'`
removes the border, padding, and corner radius so a commit nested in a host list that already draws
its own row chrome doesn't double it; `plain` wins over `compact` when both are set. The exported
alias `CommitCardAppearance` is retained as a name for the same union.

**Slots:** `actions` — trailing header controls (e.g. an "open PR" button).

**Events:** `lr-file-select` (`detail: { filePath: string }`), `lr-toggle` (`detail: { collapsed: boolean
}`), and `lr-copy` (`detail: { ok: true; text: string }`, fired only after the full-hash clipboard write
resolves successfully). A failed or unavailable write emits the compatibility `lr-error` event
(no detail) and `lr-copy-error` (`detail: { ok: false; text: string; reason:
'unsupported'|'denied'|'failed'; error: unknown }`) instead; failure never emits `lr-copy`.

**CSS parts:** `base`, `subject`, `body`, `hash`, `meta`, `author`, `time`, `diffstat`, `additions`,
`deletions`, `files-toggle`, `file` (carries `data-status`), `file-path`, `file-status`,
`file-additions`, `file-deletions`, `copy-button`, and `actions`.

`file-status` is the one-letter git-status badge (`A`/`M`/`D`/`R`/`U`/`C`/`!`) rendered inside
`[part="file-path"]`, present only for a file that has a `status`. The letter alone is meaningless to
a screen reader, so the element carries the localized expansion as its `aria-label` — "Modified",
"Added", … — reusing `<lr-file-tree>`'s shared `gitStatusAdded`/`gitStatusModified`/
`gitStatusDeleted`/`gitStatusRenamed`/`gitStatusUntracked`/`gitStatusConflicted`/`gitStatusIgnored`
message keys, so one `registerLyraLocale()` registration (or one `.strings` override) translates the
badge in both components at once.

**Themeable custom properties:** `--lr-commit-card-compact-padding` (default `var(--lr-space-s)`) —
`[part="base"]` padding while `compact`.

## `lr-test-results`

A pass/fail suite summary with per-status counts, status filter toggles, and per-test rows whose
failures auto-expand by default and can host rich slotted detail (e.g. a diff or code block)
alongside the plain failure message.

**Properties:** `suites: readonly TestSuiteResult[] = []` (attribute: false) — `TestSuiteResult { id: string;
name: string; tests: readonly TestCaseResult[] }` and `TestCaseResult { id: string; name: string; status:
TestStatus; durationMs?: number; message?: string }`, with `TestStatus = 'passed' | 'failed' |
'skipped' | 'running'` (all three exported here). `statusFilter: readonly TestStatus[] =
[]` (attribute: false) — empty shows every status. `runId: string | null = null` (attribute
`run-id`) identifies the source run, and `runState: TestRunState = 'idle'` (attribute `run-state`,
reflected) exposes its lifecycle. `autoExpandFailures: boolean = true`
(attribute `auto-expand-failures`). A duration renders only when it is finite and non-negative;
invalid/negative values are omitted rather than reaching `Intl.NumberFormat`. Empty/blank suite and
test ids are omitted; retained suite ids, then test ids within each suite, use deterministic
first-wins identity. Foreign runtime statuses normalize
once to the localized neutral `skipped` state, so every accepted row contributes to one coherent
summary count and renders a label/glyph.

Summary counts cover the complete normalized input. At most 1,000 rows mount for the active filter;
manually expanded identities reserve positions first, failed rows next, then ordinary input-order
rows. A localized `[part="limit"]` note exposes truncation without losing the complete counts.

**Slots:** `detail-{encodedSuiteId}:{encodedTestId}` — collision-free suite-scoped rich detail for
a test. Derive the complete name with the exported
`testResultDetailSlotName(suiteId, testId)` helper. Well-formed ids use `encodeURIComponent`
segments; isolated UTF-16 surrogates, which that built-in rejects, use deterministic uppercase
`%uXXXX` code-unit escapes. It renders after the plain `message` once expanded (for example, suite
`unit` and test `same` use `slot="detail-unit:same"`). This is the only detail slot the component
reads, and exactly one is mounted per row. The legacy `detail-{suiteId}-{testId}` and
`detail-{testId}` spellings were removed in 9.0.0 — content assigned to either is never slotted and
never makes a row expandable; migrate by deriving the name with
`testResultDetailSlotName(suiteId, testId)`. Slot listeners remain mounted while detail is absent,
so appending matching slotted content after the component's first render immediately enables the
row's disclosure.

**Events:** `lr-test-select` (`detail: { suiteId: string; testId: string }`, a test row's name was
activated), `lr-filter-change` (`detail: { statuses: TestStatus[] }` — the complete next filter set; the
component updates its own `statusFilter` first, then emits),
and `lr-toggle` (`detail: { suiteId: string; testId: string; expanded: boolean }`, a row's failure
detail was expanded/collapsed). The suite-scoped identity shape is invariant even when `testId` is
globally unique. Manual expansion state is keyed by that same suite+test pair.
Each expand/collapse action's localized accessible name includes both suite and test names, so
repeated row controls remain distinguishable.

Passed, failed, and skipped rows use language-neutral decorative marks (`✓`, `×`, and `–`); the
adjacent localized status word carries the meaning. Running rows use the decorative spinner.

**CSS parts:** `base`, `summary` (the status-count strip), `count` (carries `data-status`), `filter`,
`filter-toggle` (carries `data-status`/`aria-pressed`), `suite`, `suite-header`, `test` (carries
`data-status`), `test-status`, `test-name`, `test-duration`, `test-expand-toggle`, `failure`
(hidden while collapsed), `failure-message`, `limit`, and `empty`.

**Themeable custom properties:** `--lr-test-results-filter-active-bg` (default
`var(--lr-color-brand-quiet)`), `--lr-test-results-filter-active-border` (default
`var(--lr-color-brand)`) and `--lr-test-results-filter-active-color` (default
`var(--lr-color-brand)`) — the background, border color and text color of a pressed (active) status
filter toggle. All three follow the state-scoped-property convention described under
`lr-span-waterfall`: inline `var()` fallbacks rather than `:host` declarations, so each can be set on
the element or on any ancestor. They exist because
`::part(filter-toggle)[aria-pressed='true']` is invalid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so restyling the pressed state otherwise meant overriding the
library-wide brand tokens. Per-result status foregrounds are independently exposed through
`--lr-test-results-passed-color` (default `var(--lr-color-success)`),
`--lr-test-results-failed-color` (default `var(--lr-color-danger)`),
`--lr-test-results-skipped-color` (default `var(--lr-color-text-quiet)`), and
`--lr-test-results-running-color` (default `var(--lr-color-brand)`).
`--lr-test-results-spinner-size` (default `var(--lr-size-1em)`) controls the composed spinner's
diameter in a running test row without requiring an override of `lr-spinner`'s token.

## `lr-confirm-bar`

An inline, non-modal approve/deny block for one proposed action — the in-flow sibling of
`lr-tool-approval-dialog` for confirmations that should sit in the transcript instead of hijacking
focus. Same `lr-approve`/`lr-deny` event shapes as the dialog, and the same
`toolApprovalHeading`/`toolApprovalArgsLabel`/`deny`/`approve` localization keys, so the two always
translate in lockstep. Non-modal by contract: no focus trap, no scroll lock, no Escape/backdrop
semantics, and it never steals focus when it appears in the transcript. DOM and tab order put Deny
before Approve. On activation, focus moves synchronously to `[part="status"]` (an always-rendered,
`tabindex="-1"` element) before the Deny/Approve buttons unmount.

**Properties:** `toolName: string = ''` (attribute `tool-name`) — drives the default heading through
the existing `toolApprovalHeading`/`toolApprovalGenericTool` dialog keys. `heading: string = ''` —
free-form heading override for non-tool proposals; wins over `toolName`. `args: unknown = undefined`
(attribute: false) — shown read-only inside a collapsed `lr-details` + `lr-json-viewer` when
defined. `decision: 'approved' | 'denied' | null = null` (reflected) — decided state, set by the
component on activation and host-writable (an externally-resolved decision renders identically but
emits nothing). `variant: ConfirmBarVariant = 'neutral'` (reflected) — `'neutral' | 'danger'`, a
genuine two-member subset of the library-wide `LyraVariant` vocabulary (spelled as an `Extract` of
it, so the two can never drift): a confirmation is either routine or destructive, and
`brand`/`success`/`warning` have no meaning for a proposal awaiting a yes/no. `compact: boolean = false`
(reflected) — collapses the bar from a stacked `display: block` card into a single tightly-padded
inline row, for a confirmation that has to live inside an existing container: a table cell, a card's
action row, a toolbar. The host becomes `inline-flex`, and the narrow-allocation `@container`
treatment is switched off — a compact bar is _expected_ to be narrow, so stretching the buttons to
fill would be exactly wrong. It is a density knob only: the border, corner radius and background
stay. Retune it through `--lr-confirm-bar-compact-padding`/`-gap`. Everything else is unchanged: the
event shapes, the focus-to-`[part="status"]`-before-unmount contract, and `role="group"` with its
heading label. `frame: LyraFrame = 'card'` (reflected) — `'card' | 'plain'`, imported from the
library's shared container-frame vocabulary and behaving exactly as it does on `lr-agent-run`,
`lr-commit-card`, `lr-result-card`, `lr-task-list`, `lr-terminal` and `lr-thinking-panel`:
`'plain'` removes the border, background, padding and corner radius so a bar nested inside a
container that already draws a border doesn't double it, and wins over `compact` when both are set.
Before 9.0.0 `compact` alone did both jobs; a bar that relied on that now needs
`compact frame="plain"`. `ConfirmBarDecision = ApprovalDecision | null` names the final-state type.
`pending: ApprovalAction | null = null` (reflected) — which action is awaiting host
resolution while an `lr-approve`/`lr-deny` listener has called `preventDefault()` on the
now-cancelable event; the pending button shows `loading`, the other is `disabled`. Set `.decision`
to finalize, or clear `.pending` back to `null` to bounce back to the undecided state.

**Slots:** default — supplementary body content between the heading and the actions (e.g. a
`lr-diff-view`). `footer` — extra content at the start of the action row.

**Events:** `lr-approve` (`detail: { args }` — the `args` prop as-is, identical shape to
`lr-tool-approval-dialog`), `lr-deny` (no detail, identical to the dialog).

**CSS parts:** `base` (`role="group"`), `heading`/`tool-name`, `body`, `args` (the
details/json-viewer wrapper, only rendered when `args` is defined), `footer`, `deny-button`,
`approve-button` (each an `<lr-button>` host, named identically to the dialog's parts),
`deny-button-base`, `deny-button-label`, `deny-button-start`, `deny-button-end`,
`deny-button-spinner`, `approve-button-base`, `approve-button-label`, `approve-button-start`,
`approve-button-end`, `approve-button-spinner` (re-exported from each button's own
`lr-button` parts via `exportparts`; each `*-button-base` route accepts the same-node `base` and
`button` wrapper aliases), `status` (the decided-state text, always present in the DOM as a focus
landing spot).

**Themeable custom properties:** the `compact` density is retunable through two properties, both
scoped to `[part="base"]` while `compact`: `--lr-confirm-bar-compact-padding` (default
`var(--lr-space-s)`, any padding shorthand — overridden entirely by `frame="plain"`) and
`--lr-confirm-bar-compact-gap` (default `var(--lr-space-s)`, the gap between the row's items). They
are inline `var()` fallbacks at their point of use rather than `:host` declarations, so either can
be set on the element _or on any ancestor_, which is what makes "tighten every compact confirm bar
in this panel" a one-rule change on the panel. The chrome-removing
`--lr-confirm-bar-compact-border`, `--lr-confirm-bar-compact-background` and
`--lr-confirm-bar-compact-radius` properties were removed in 9.0.0 along with `compact`'s chrome
behavior: chrome is now `frame`'s job, so keep the default `frame="card"` (and restyle via
`::part(base)`) instead of re-chroming a chrome-less compact bar.

Two further properties recolor the decided state: `--lr-confirm-bar-approved-color` (default
`var(--lr-color-success)`) and `--lr-confirm-bar-denied-color` (default `var(--lr-color-danger)`) —
`[part="status"]`'s text/icon color under `:host([decision='approved'])` and
`:host([decision='denied'])` respectively. Same inline-`var()`-fallback shape as the compact set.
They exist because `::part(status)[decision]` is invalid CSS, so recoloring just this component's
decided state previously meant re-pointing the library-wide `--lr-color-success`/`-danger` tokens and
repainting everything else that reads them.

**Known gotchas:**

- `[part="status"]` is always rendered and must never be given `display: none`. Deciding moves focus
  to it synchronously, before the Deny/Approve buttons unmount, so hiding it would drop focus to
  `<body>`. The shipped `:empty` rule on it has never matched, and that is load-bearing.
- `[part="deny-button"]`/`[part="approve-button"]` are `<lr-button>` hosts. Deny is
  `variant="neutral" appearance="outlined"`; Approve is `variant="brand"` (`"danger"` under this
  component's own `variant="danger"`) at `lr-button`'s default `appearance="accent"`, so the
  destructive-or-primary action is the loud one and the safe action recedes. `--lr-button-*` theming
  reaches both directly. A
  consumer previously styling `::part(deny-button)`/`::part(approve-button)` for
  padding/border/font/`:hover`/`:focus-visible` must move that CSS onto the re-exported
  `deny-button-base`/`approve-button-base` sub-parts instead — the outer part now resolves to the
  `<lr-button>` host, where those declarations either do nothing or must be re-expressed through
  `lr-button`'s own parts/custom properties.
- An `lr-approve`/`lr-deny` listener can call `preventDefault()` to keep the decision open while
  its own async work is in flight — see `pending` above.

```html
<lr-tool-call-chip status="pending"></lr-tool-call-chip>
<lr-confirm-bar tool-name="run_shell"></lr-confirm-bar>
<script type="module">
  const bar = document.querySelector("lr-confirm-bar");
  bar.args = args;
  bar.addEventListener("lr-approve", (e) => run(e.detail.args));
  bar.addEventListener("lr-deny", () => cancel());
</script>
```

An `lr-approve`/`lr-deny` listener that needs to await its own async work before finalizing calls
`preventDefault()` and sets `.decision` (or clears `.pending`) once it resolves:

```ts
bar.addEventListener("lr-approve", (e) => {
  e.preventDefault();
  runApproval(e.detail.args)
    .then(() => {
      bar.decision = "approved";
    })
    .catch(() => {
      bar.pending = null;
    }); // bounce back, retry
});
```

## `lr-browser-frame`

Presentational "agent computer" viewport: a screenshot/frame stream (or slotted live media), a
read-only URL display, action-ping overlays, and take-over/stop affordances. No automation transport
(no CDP/WebRTC/WebSocket) and no input relay — take-over is an event; the host swaps in its own
interactive element (e.g. an iframe). No replay scrubber (compose `lr-sequence-playback` with
`itemCount` set to the screenshot count, then drive `frameSrc` from `currentIndex` whenever
`lr-sequence-step` emits `detail: { currentIndex }`); no console/network drawers (compose
`lr-terminal`/`lr-json-viewer`); no
pan/zoom of the frame content (slot the image/video inside a `lr-zoomable-frame` instead, though
the pings overlay assumes the unzoomed content box in that composition).

**Properties:** `frameSrc: string = ''` (attribute `frame-src`) — image/MJPEG stream URL rendered as
an `<img>` (safe-URL-gated via `safeMediaSrc`); ignored once the default slot has content. `url:
string = ''` — address shown read-only in the toolbar (`dir="ltr"`, truncating, full value in
`title`). `phase: LyraStreamPhase = 'idle'` (reflected; `'idle' | 'connecting' | 'streaming' |
'stalled'`). `controller:
'agent' | 'user' = 'agent'` (reflected) — who is driving; switches the take-over button's label.
`pings: BrowserPing[] = []` (attribute: false, each `{ id, x, y, kind: 'click' | 'type' | 'scroll' |
'move' }` — `x`/`y` are percent (0–100) of the frame's `object-fit: contain` content box,
letterboxing-aware). Empty/blank ping ids and later duplicates are omitted before overlay rendering. `controls:
boolean = true` — render the built-in take-over/stop buttons.

**Slots:** default — host-owned live element (e.g. `<video>` or an interactive `<iframe>`), replacing
the `frame-src` image. `actions` — extra toolbar controls.

**Events:** `lr-take-over` — `detail: { controller }`, the _requested_ controller (`'user'` when
"Take over" is pressed, `'agent'` when "Hand back" is). `lr-stop` — stop the agent's browser
session, no detail.

**CSS parts:** `base` (`role="group"`), `toolbar`, `url`, `status` (visible, non-live text),
`controller-badge`, `actions`, `take-over-button`, `stop-button`, `viewport`, `frame` (the
`frame-src` `<img>`, absent once the default slot is populated), `ping` (one action-ping marker,
carries `data-kind`).

After mount, each `phase` transition is appended to the shared polite light-DOM announcement sink.
The phase already shown on initial mount or reconnect establishes a silent baseline, including a
phase write queued while detached.

**Themeable custom properties:** `--lr-browser-frame-aspect-ratio` (default `16 / 9`) — the
viewport's aspect ratio.

```html
<lr-browser-frame phase="streaming" url="https://example.com"></lr-browser-frame>
<script type="module">
  const frame = document.querySelector("lr-browser-frame");
  frame.pings = pings;
  frame.addEventListener("lr-take-over", (e) => setController(e.detail.controller));
  frame.addEventListener("lr-stop", () => stopSession());
</script>
```

**Additional API surface:**

- `--lr-browser-frame-controller-background` — Controller badge background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-browser-frame-controller-color` — Controller badge text color. Default: `var(--lr-color-brand)`.
- `--lr-browser-frame-ping-click-color` — Click-ping border color. Default: `var(--lr-color-brand)`.
- `--lr-browser-frame-ping-type-color` — Type-ping border color. Default: `var(--lr-color-success)`.
- `--lr-browser-frame-ping-scroll-color` — Scroll-ping border color. Default: `var(--lr-color-warning)`.
- `--lr-browser-frame-ping-move-color` — Move-ping border color. Default: `var(--lr-color-text-quiet)`.

## `lr-artifact-panel`

Shell around one agent-generated artifact: a title/kind header, a preview↔code toggle, version
navigation with restore, a streaming indicator, and built-in copy/download actions. Renders none of
the artifact itself — content is slotted. No content rendering of its own (slots own it), no
dialog/dock chrome (compose `lr-dialog`/`lr-dock-panel`/`lr-multi-split`), no version storage or
diffing (host state; diffs via `lr-diff-view`), no code editing (`lr-code-editor`).

**Properties:** `label?: string` — the artifact's title, shown in the header; omitting it reads back
`undefined` and localizes the `artifactPanelLabel` default for the view-toggle group's accessible name
(with no visible title), while an explicit empty string renders no visible or accessible label.
`kind: string = ''`
— a short kind label (e.g. `document`, `code`), shown as a badge next to `label`. `view: 'preview' |
'code' = 'preview'` (reflected) — which slot is currently visible. `versions: ArtifactVersion[] = []`
(attribute: false, each `{ id, label? }`) — the artifact's version history, oldest first; the last
entry is the latest version. Empty/blank ids and later duplicate ids are omitted before navigation, active lookup,
position counts, and restore events. The active entry's optional `label` renders beside its localized
position. `activeVersionId: string | null = null` (attribute `active-version-id`) — the currently
viewed version's id, or `null` for "the latest version." Removing the named version reconciles the
property to `null` without a user-action event, so reinserting that id cannot unexpectedly repin it.
`streaming: boolean = false` (reflected) — whether the artifact is still being generated; sets
`aria-busy` on the body and shows a text indicator (not animated, so it stays legible under reduced
motion). `copyText: string = ''` (attribute `copy-text`) — the text copied to the clipboard by the
copy button; empty hides the button. `downloadSrc: string = ''` (attribute `download-src`) — the
download URL, sanitized through `safeDownloadHref()` (`http:`/`https:`/`blob:` only — narrower than
the media/resource allowlist, which also permits `data:`); an empty value hides the button. The
sanitizer runs at click time, not render time, so a _non-empty but rejected_ URL still renders the
button and simply emits nothing when pressed. The component never navigates on its own: it emits
`lr-download` with the sanitized `src` and leaves the actual download to the host.
`downloadName: string = ''` (attribute `download-name`) — the suggested filename reported in the
`lr-download` event detail.

**Slots:** default — preview-view content (markdown/html-viewer/browser-frame/image). `code` —
code-view content (typically a `lr-code-block`); the preview/code toggle only renders once this
slot has assigned content. Assigning `view='code'` without assigned code content normalizes back to
`preview`, including after mount. `actions` — extra header controls, rendered between the version
navigation and the built-in copy/download buttons.

**Events:** `lr-view-change` (`detail: { view }`), `lr-version-change` (`detail: { versionId }`,
fired when the previous/next navigation moves to a different version), `lr-restore` (`detail: {
versionId }`, fired by the restore-this-version button; mutates nothing itself), `lr-copy`
(`detail: { ok: true, text }`, after the clipboard write fulfills), `lr-error` plus
`lr-copy-error` (`detail: { ok: false, text, reason, error }`) on a localized failure, and
`lr-download` (`detail: { filename, src }`, with the required sanitized download URL).

**CSS parts:** `base`, `header`, `label`, `kind`, `view-toggle` (rendered only once the `code` slot
has content), `view-button` (carries `data-view="preview"` or `data-view="code"`), `version-nav`
(rendered only once `versions` is non-empty), `version-previous`, `version-previous-glyph` (the `‹`
chevron inside `version-previous`, mirrored via `scaleX(-1)` under `:dir(rtl)`), `version-next`,
`version-next-glyph` (the `›` chevron inside `version-next`, mirrored the same way), `version-position`
(the "Version N of M" text), `version-label` (the active version's optional caller-supplied label),
`restore-button` (rendered only while the active version isn't the latest), `actions`, `copy-button`
(rendered only while `copyText` is non-empty), `download-button`
(rendered only while `downloadSrc` is non-empty), `body`, `streaming-indicator` (rendered only while
`streaming`).

**Themeable custom properties:** `--lr-artifact-panel-view-active-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-artifact-panel-view-active-color` (default
`var(--lr-color-brand)`) — the background and text color of the pressed (active) preview/code toggle
button. Both follow the state-scoped-property convention described under `lr-span-waterfall`: inline
`var()` fallbacks rather than `:host` declarations, so either can be set on the element or on any
ancestor. They exist because `::part(view-button)[aria-pressed='true']` is invalid CSS, leaving the
library-wide brand tokens as the only prior lever.

```html
<lr-artifact-panel label="report.md" kind="document">
  <lr-markdown id="preview"></lr-markdown>
  <lr-code-block slot="code" id="code" language="markdown"></lr-code-block>
</lr-artifact-panel>
<script type="module">
  const panel = document.querySelector("lr-artifact-panel");
  panel.versions = versions;
  panel.querySelector("#preview").content = markdown;
  panel.querySelector("#code").code = markdown;
  panel.addEventListener("lr-restore", (e) => restoreVersion(e.detail.versionId));
</script>
```

## `lr-agent-run`

Top-level shell for one agent run: status, elapsed time, current step, model/cost summary, arbitrary
metrics, and Cancel/Retry actions. Built-in and application-defined lifecycle statuses are supported;
`statusLabels` and `statusVariants` customize unknown status kinds. Named `header` and `summary` slots
replace the corresponding built-in chrome, while `tasks`, `tools`, `reasoning`, `output`, and
`actions` support host-controlled composition.

The nine built-in status kinds are `idle`, `queued`, `collecting`, `running`, `waiting-input`,
`waiting-approval`, `done`, `error`, and `cancelled`; arbitrary application-defined string kinds are
also accepted. Live elapsed time and Cancel are available for `running`, `collecting`,
`waiting-input`, and `waiting-approval`. `queued` is pending rather than actively ticking or
cancelable. Retry is available for `error` and `cancelled`.

**Properties:**

- `run: AgentRun | null = null` (attribute: false) — **`AgentRun`, imported from
  `@aceshooting/lyra-ui/ai`** (`src/ai/types.ts`): `{ id: string; status: AgentStatus; startedAt?:
number; endedAt?: number; model?: string; costEstimate?: number; steps: readonly AgentStep[] }`, where
  `AgentStatus { kind: AgentStatusKind; message?: string }` and `AgentStep { id: string; kind:
string; label: string; status: AgentStatus; startedAt?: number; endedAt?: number }`. All timestamps
  are epoch milliseconds; `AgentStep.kind` is deliberately free-form (an agent's own step taxonomy is
  application-defined) — unlike `LyraSpan['kind']`'s closed union. The record and its nested step
  collection are clone-owned, bounded, and frozen; pass a new object to update it. `null` renders
  the shared `lr-empty` `noData` state. A runtime summary record that has not loaded `steps` yet
  renders with an empty task slot, and a step whose status has not arrived yet renders as pending
- `metrics: readonly AgentRunMetric[] = []` (attribute: false) — `AgentRunMetric { id: string; label: string;
value: string | number; variant?: BadgeVariant }` (exported here), e.g. prompt/completion token
  counts; `variant` tones `[part="metric-value"]` via `data-variant`, including the full
  `neutral`/`brand`/`success`/`warning`/`danger` badge vocabulary. Empty/blank ids and later duplicates are omitted
  before metric rendering
- `formatCost?: (cost: number) => string` (attribute: false) — overrides the default plain
  `Intl.NumberFormat` rendering of `run.costEstimate` fed to the composed `lr-usage-badge`'s
  `cost-text`; use it to add a currency symbol, which this library never assumes on a host's behalf
- `statusLabels: Readonly<Record<string, string>> = {}` (attribute: false) — clone-owned labels for
  _application-defined_ `AgentStatusKind` values; the nine built-in kinds stay localized by Lyra
- `statusVariants: Readonly<Record<string, BadgeVariant>> = {}` (attribute: false) — clone-owned
  badge variants for application-defined kinds; unknown kinds default to `neutral`

The collection and status-map properties above are bounded frozen snapshots. Mutating a previously
assigned array or record has no effect; create and reassign a new value after changes.

- `showCancel: boolean = true` (attribute `show-cancel`) / `showRetry: boolean = true` (attribute
  `show-retry`) — whether the built-in buttons may render at all, still gated by the run's own
  status. Both use a `true`-defaulting string converter, so plain-HTML `show-cancel="false"` works; a
  `?show-cancel=${false}` boolean-attribute binding starting from absent markup does not
- `compact: boolean = false` (reflected) — tighter root padding and header/body gap for dense
  contexts (a run rendered as a row in a list, or in a side panel); same convention as `lr-empty`'s
  `compact`. Purely a density knob: the border and background stay, so reach for
  `frame="plain"` instead when the goal is to drop the chrome entirely
- `frame: LyraFrame = 'card'` (reflected) — container treatment, in the library-wide `frame`
  vocabulary (`'card' | 'plain'`), the same property `<lr-card>` and every other card-shaped
  component carries. `'card'` keeps the bordered, filled, padded box; `'plain'` removes the
  border, background, padding and corner radius, so a run nested inside a host container that
  already draws a border doesn't double it. `plain` wins over `compact` when both are set — there is
  no padding left to tighten. The built-in Cancel/Retry buttons draw their own border and background
  and stay visibly interactive either way. The exported alias `AgentRunAppearance` is retained as a
  name for the same union

**Events:** `lr-cancel` (`detail: CancelEventDetail` = `{ reason?: string }`, from
`@aceshooting/lyra-ui/ai`; `reason` is `undefined` from the built-in button), `lr-run-retry`
(`detail: RetryEventDetail` = `{ attempt: number; messageId?: string }`, same module — `attempt` is
this component's own retry counter, reset when `run.id` changes).

**Slots:** `header` and `summary` replace the corresponding built-in chrome; `tasks`, `tools`,
`reasoning`, `output`, and `actions` are host-controlled composition regions.

**CSS parts:** `base`, `header`, `status`, `status-badge`, `status-message`,
`elapsed` (the live ticker), `elapsed-static` (a terminal run's frozen duration), `summary`, `model`,
`usage`, `current-step`, `current-step-icon`, `current-step-label`, `body`, `tasks`, `tools`,
`reasoning`, `output`, `actions`, `cancel-button`, `retry-button`, `metric-label`, `metric-value`
(carries `data-variant`), `metric` (one metric label/value pair), `empty`.

**Themeable custom properties:** `--lr-agent-run-spin` (default `var(--lr-transition-ambient)`, i.e.
`1.8s ease-in-out`, collapsing to `0.001ms linear` under `prefers-reduced-motion`) — the
current-step icon's rotation duration/timing. `--lr-agent-run-compact-padding` (default
`var(--lr-space-s)`) and `--lr-agent-run-compact-gap` (default `var(--lr-space-s)`) — `[part="base"]`'s
padding, and the gap between its header and body, while `compact`; both are ignored while `compact`
is unset. Like the other density/state properties in this family they are inline `var()` fallbacks at
their point of use rather than `:host` declarations, so either can be set on the element _or on any
ancestor_ — one rule on a run list retunes every compact run inside it.

**Additional API surface:**

- `--lr-agent-run-metric-brand-color` — Brand metric value. Default: `var(--lr-color-brand)`.
- `--lr-agent-run-metric-danger-color` — Danger metric value. Default: `var(--lr-color-danger)`.
- `--lr-agent-run-metric-success-color` — Success metric value. Default: `var(--lr-color-success)`.
- `--lr-agent-run-metric-warning-color` — Warning metric value. Default: `var(--lr-color-warning)`.

## `lr-agent-trace`

Provider-neutral agent/LLM trace view combining span-kind filters, handoff quick-jumps, and a
hierarchical trace tree from one shared `spans` array.

**Properties:**

- `spans: LyraSpan[] = []` (attribute: false) — the full, unfiltered array; identical contract to
  `lr-trace-tree.spans` (see `lr-span-waterfall` above for the `LyraSpan` shape). Controlled and
  never mutated
- `activeSpanId: string | null = null` (attribute `active-span-id`) — controlled selection forwarded
  into the composed `lr-trace-tree`; also updated locally (and re-emitted as `lr-span-select`) when a
  span is activated from either the tree or the handoff quick-jump list, so it works as a two-way
  binding
- `hiddenKinds: LyraSpan['kind'][] = []` (attribute: false) — span kinds hidden from the tree
  (`'agent' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'other'`). Empty shows every kind;
  pre-settable (e.g. to hide `retriever`/`embedding` by default) and readable back after
  `lr-span-visibility-change`
- `label?: string` — forwarded to the composed `lr-trace-tree`. Omission leaves that tree's own
  `label` unset so it localizes its own default; any supplied string (including `''`) is
  forwarded verbatim
- `showTokens: boolean = false` (attribute `show-tokens`), `showCost: boolean = false` (attribute
  `show-cost`), `showBars: boolean = true` (attribute `show-bars`, renamed from `hideBars` in
  9.0.0 to match the positive polarity of its two siblings above — default inverted so the
  rendered starting state is unchanged: `el.hideBars = true` becomes `el.showBars = false`) — all
  forwarded verbatim

**Events:** `lr-span-select` (`detail: { spanId: string }`), `lr-span-toggle` (`detail: { spanId: string;
expanded: boolean }`), and `lr-span-visibility-change` (`detail: { hiddenKinds:
LyraSpan['kind'][] }`). The internal graph legend's generic `lr-visibility-change` event is
contained; consumers receive this trace-domain event instead.

`spans` is normalized through the same at-most-500-record projection as `<lr-trace-tree>` before
filtering, handoff lookup, and tree rendering. The controlled active span and its ancestor path
reserve positions, and malformed records plus later duplicate ids are omitted, so the composed
surfaces cannot disagree.

**CSS parts:** `base`, `filter` (the composed `lr-graph-legend` filter row, only rendered while
`spans` is non-empty), `handoffs` (the quick-jump list wrapper, only rendered while at least one
visible span has `kind: 'agent'`), `handoff` (one entry — a `<button>` wrapping an
`lr-handoff-divider`, carrying `data-active`), `tree` (the composed `lr-trace-tree`).

**Themeable custom properties:** `--lr-agent-trace-handoff-active-bg` (default
`var(--lr-color-brand-quiet)`) — the background of the active (`activeSpanId`) handoff quick-jump
entry. Same state-scoped-property convention described under `lr-span-waterfall`: an inline `var()`
fallback rather than a `:host` declaration, settable on the element or any ancestor, and it exists
because `::part(handoff)[data-active]` is invalid CSS. The composed tree's own
`--lr-trace-tree-row-active-bg` and `--lr-trace-tree-row-active-color` are separate knobs and
inherit straight through, so restyling both surfaces means setting both — and they carry the
pairing caveat documented under `lr-trace-tree` above: the tree's active-row defaults assume the
active background stays on the same side of the lightness midpoint as the ambient surface, so a
tint that crosses it needs the matching text color set too.

## `lr-context-inspector`

Inspection view of model-call context segments, with token estimates, source citations, redaction
markers, and copy/export controls.

**Properties:**

- `segments: readonly ContextInspectorSegment[] = []` (attribute: false) — `ContextInspectorSegment { id:
string; label: string; text: string; tokens: number; tone?: ContextMeterTone; citation?: Citation;
truncated?: boolean; omittedTokens?: number; redactions?: readonly ContextInspectorRedaction[] }` (exported
  here). One entry per piece of the assembled final prompt (system prompt, retrieved chunk, one
  history turn, …). `text` is the segment's **final** text, exactly as sent to the model
  (post-redaction/post-truncation). `tokens` is the estimated count, fed straight to
  `lr-context-meter`'s segment `value`; `label` feeds both the segment heading and the meter's
  segment label. `citation` is **`Citation` from `@aceshooting/lyra-ui/ai`** and renders an
  `lr-citation-badge` carrying its `sourceId`/`label`. `omittedTokens` is shown in the
  truncation-boundary marker when `truncated` is set. `ContextInspectorRedaction { start: number;
end: number; reason?: string }` marks character ranges within `text` that are redaction
  placeholders; `reason` becomes the marker's `title`/accessible reason, falling back to a localized
  "Redacted". Segment `id` is the stable public identity; empty/blank ids and later duplicates are omitted before
  meter values, rendering, copy/export serialization, and citation events are derived. A valid-id
  streaming segment whose `text` is not available yet remains visible with an empty body and empty
  copy/export text rather than rejecting the render.
- `total: number = 0` — the full token budget `segments` are measured against; passed straight to
  `lr-context-meter.total`
- `label: string = ''` — accessible group name, and the embedded meter's visible caption (e.g.
  "128K context window")
- `exportFormats: readonly LyraExportFormatOption[] = ['json']` (attribute: false) — forwarded to the embedded
  `lr-export-button`; one id renders a plain button, more than one a format-choice menu
- `exportFilename: string = 'context'` (attribute `export-filename`) — download filename (no
  extension) passed to `lr-export-button`

**Events:** `lr-citation-activate` (`detail: { sourceId: string; index: number }`, surfaced by a
segment's embedded `lr-citation-badge`), `lr-citation-open` (`detail: { sourceId: string; index:
number; href?: string }`, the "full preview" signal), `lr-copy` (`detail: { ok: true; text: string }`, from the
embedded `lr-copy-button`), `lr-export` (`detail: { format: string }`, from the embedded
`lr-export-button`), `lr-export-complete` (`detail: { format: string }`, after a non-cancelled export
finishes), `lr-error` (the embedded clipboard write failed), `lr-copy-error` (`detail: { ok: false;
text: string; reason: string; error: unknown }`, the detailed clipboard failure),
`lr-toolbar-actions-change` (no detail, surfaced unchanged when the embedded copy button's logical
toolbar action changes availability or backing trigger),
`lr-export-error` (`detail: { format: ExportFormat; error: unknown }`, the embedded export could not
complete), and the cancelable `lr-show` / `lr-hide` lifecycle events from the embedded export-format
menu. These composed child events surface unchanged; the inspector does not emit duplicate copies.

**CSS parts:** `base`, `toolbar`,
`segments`, `segment`, `segment-header`, `segment-label`, `segment-text`, `segment-tokens`,
`meter` (the embedded `lr-context-meter`), `citation`, `redaction` (one redaction placeholder
marker), `truncation-boundary`, `copy-button`, `export-button`, `empty`.

## `lr-eval-dataset`

Filterable and taggable evaluation-example list with add, remove, import, and export affordances.

**Properties:**

- `examples: readonly EvalExample[] = []` (attribute: false) — `EvalExample { id: string; input: string;
expectedOutput?: string; tags?: readonly string[]; metadata?: Record<string, unknown> }` (exported here).
  Deliberately its own small shape rather than reusing anything from `src/ai/types.ts` — none of that
  module's interfaces models "one row of a labeled eval dataset". `input`/`expectedOutput` are plain
  strings (not structured payloads), rendered as plain text by every column's `cell()`. Fully
  controlled: add/remove/import/export are all _requests_; the host mutates and passes the array
  back. Empty/blank ids and later duplicate ids are omitted before selection, filtering, mutation requests, and the
  nested grid are derived. Distinct tag chips are ordered with the component's effective-locale
  collation
- `searchable: boolean = false` (reflected) — built-in free-text search over `input`,
  `expectedOutput`, and `tags` (case-insensitive substring)
- `autocomplete: string = ''`, `spellcheck: boolean = true`, `autocapitalize: string = ''`,
  `autoCorrect: string = ''` (attribute `autocorrect`), `inputMode: string = ''` (attribute
  `inputmode`), and `enterKeyHint: string = ''` (attribute `enterkeyhint`) — native
  editing-assistance and virtual-keyboard hints forwarded only to the internal search input while
  `searchable`; empty string leaves the corresponding browser default in effect
- `accept: string = ''` — forwarded to the internal `lr-file-input`'s `accept` (e.g. `'.json,.csv'`);
  empty accepts any type
- `exportFormats: ExportFormatOption[] = ['csv', 'json']` (attribute: false) — forwarded to the
  internal `lr-export-button`
- `disabled: boolean = false` (reflected) — disables every add/remove/import/export affordance, e.g.
  while a host-side mutation is still in flight
- `label: string = ''` — purpose-specific accessible name for the nested grid; defaults to the
  localized `evalDatasetLabel`. A host `aria-label` remains on the custom-element host as its
  overall name and is not cloned onto the independently interactive grid

**Events:** `lr-example-select` (`detail: { exampleId: string | null }`),
`lr-example-add-request` (`detail: null` — no payload; `emit()`
normalizes an omitted detail to `null`, never `undefined`), `lr-example-remove-request` (`detail: { exampleId:
string }`), `lr-import-request` (`detail: { files: File[] }`), `lr-export-request` (`detail: {
format: string }`), and the deliberate nested-table pass-through `lr-sort` (`detail: { phase:
'commit'; sortKey: string; sortDir: 'asc' | 'desc' }`). `focus`/`blur` —
re-dispatched (no detail) when the internal search field (only rendered while `searchable`) gains or
loses focus, since native focus neither bubbles nor crosses the shadow boundary.
All three built-in columns are sortable; activating one of their headers produces that commit for
the host to apply to its controlled `examples` array.

**CSS parts:** `base`, `toolbar`, `search`, `search-input`, `tag-filter`, `grid`,
`add-button`, `remove-button`, `import`, `export`.

**Known gotchas:**

- Shrinking `examples` out from under live UI state is handled: a `selectedId` that no longer matches
  any row resets to `null`, and an active tag filter that no longer matches any row's `tags` is
  dropped rather than silently matching zero rows forever.
- A search or tag filter that hides the selected row also clears that selection and emits
  `lr-example-select` with `{ exampleId: null }`, so the Remove control never acts on an invisible
  row.

## `lr-eval-result`

Rubric scoring and human-review surface for comparing the runs of one evaluation example.

Composes `lr-table` (the comparison table), `lr-rubric-form` (the review surface), and
`lr-diff-view` (baseline↔selected output diff) rather than re-deriving any of their behavior.
The table uses `label` or the localized purpose-specific evaluation-runs name. A host `aria-label`
on `<lr-eval-result>` remains the overall host name and is not cloned onto the independently
interactive table; use `label` to distinguish several comparison grids on one page.

**Properties:**

- `runs: EvalRunResult[] = []` (attribute: false) — `EvalRunResult { id: string; label: string;
model?: string; promptVersion?: string; output: string; scores?: RubricValue; review?: RubricValue }`
  (exported here). One entry per model or prompt version being compared for a single evaluation
  example. `scores`/`review` use the same `RubricValue` shape `lr-rubric-form` itself reads and
  writes, so a `TableColumn`'s `cell()` accessor and the rubric form's own `value` binding read a
  run's fields with no conversion. Empty/blank ids and later duplicate run ids are omitted before selection, diff,
  grid, and review-event lookup. A valid-id streaming run whose `output` has not arrived yet remains
  selectable and supplies an empty output to the diff
- `columns: TableColumn<EvalRunResult>[] = []` (attribute: false) — plain pass-through to
  `lr-table.columns`, not re-derived here; malformed, empty/blank, and later duplicate column keys are omitted
- `rubricKeys: RubricKey[] = []` (attribute: false) — plain pass-through to `lr-rubric-form.keys`;
  empty/blank and later duplicate rubric keys are omitted
- `label: string = ''` — accessible name for the independently interactive comparison grid;
  falls back to the localized evaluation-runs name when unset
- `selectedRunId: string | null = null` (attribute `selected-run-id`) — the run open for review and the diff's
  **new** side; falls back to `runs[0]?.id` when empty
- `baselineRunId: string | null = null` (attribute `baseline-run-id`) — the run compared against and the
  diff's **old** side; falls back to `runs[0]?.id` when empty
- `reviewSkippable: boolean = false` (attribute `review-skippable`) — shows a Skip control on the
  review form (forwarded to `lr-rubric-form.skippable`)
- `disabled: boolean = false` (reflected) — disables the review form's controls only; the comparison
  grid stays interactive (selecting a run to inspect is not a mutation)

**Events:** `lr-run-activate` (`detail: { runId: string; run: EvalRunResult }`), `lr-review-input` (`detail: { runId:
string; value: RubricValue }`), `lr-review-validity-change` (`detail: { runId: string; valid:
boolean; errors: Record<string, string> }`), `lr-review-submit` (`detail: { runId: string; value:
RubricValue }`), `lr-review-skip` (`detail: { runId: string }`).

**CSS parts:** `base`, `empty`, `grid`, `diff`, `diff-view`,
`diff-labels`, `diff-label-old`, `diff-label-new`, `review`.

## `lr-eval-run`

Evaluation-batch progress view with overall progress and one disclosure per example. Inputs and
outputs may render as Markdown or code, with optional grounding and tool-trace sections.

**Properties:**

- `examples: readonly EvalExampleResult[] = []` (attribute: false) — `EvalExampleResult { id:
string; label?: string; status: AgentStatusPresentation; input: EvalContent; output:
EvalContent; grounding?: GroundingAssessment; citations?: readonly Citation[]; toolTrace?:
readonly ToolTimelineEntry[] }`
  (exported here). `AgentStatusPresentation` extends the shared **`AgentStatus` from
  `@aceshooting/lyra-ui/ai`** with optional caller presentation `{ label?, variant?, terminal?,
active? }`. `label` and `variant` customize application-defined lifecycle display, `message`
  renders as status detail, and `terminal` controls completion counting (falling back to the built-in
  `done`/`error`/`cancelled` map). This preserves the shared run-lifecycle vocabulary rather than
  inventing a parallel pass/fail enum; rubric scoring is `lr-eval-result`'s job, not this one's.
  `EvalContent { text: string; format?: EvalContentFormat; language?: string }` keeps
  each payload's rendering metadata together. `EvalContentFormat = 'markdown' | 'code'` —
  `'markdown'` (the default when unset) renders via `lr-markdown`; `'code'` uses `lr-code-block`
  and consults that payload's `language` for shiki.
  `grounding`/`citations` (both from `@aceshooting/lyra-ui/ai`) compose directly into
  `lr-grounding-summary`'s `assessment`/`citations`, and `toolTrace` directly into
  `lr-tool-timeline.entries` — no adapters. `citations` is consulted only while `grounding` is also
  set; an omitted `grounding` or empty `toolTrace` renders no such section for that example. `label`
  falls back to a localized "Example {index}" (1-based, array order). Controlled and never mutated;
  empty/blank ids and later duplicate example ids are omitted before progress, disclosure state, and correlated child
  events are derived. A valid-id streaming example whose `status`, `input`, or `output` has not
  arrived yet remains visible: status defaults to idle and either missing content payload renders
  as empty Markdown until the host replaces the collection
- `total: number | null = null` — the batch's expected total example count. `null` derives it from
  `examples.length`; set it explicitly while a batch is still streaming and the eventual total is
  already known. An explicit total below the current observed count is raised to `examples.length`,
  so progress never reports an impossible total
- `label: string = ''` — header label and accessible-name source; falls back to a localized
  "Evaluation run"

**Events:** `lr-example-toggle` (`detail: EvalExampleToggleDetail` = `{ exampleId: string; expanded:
boolean }`), `lr-example-citation-select` (`detail: EvalCitationSelectDetail` = `{ exampleId:
string; citation: Citation }` — the nested `lr-grounding-summary`'s own `{ citation }` correlated
with the example it came from, so a host needn't walk the DOM), `lr-example-tool-approval-decide`
(`detail: EvalToolApprovalDetail` = `ToolTimelineApprovalDetail & { exampleId: string }` =
`{ invocationId: string; approved: boolean; args?: unknown; sourceKey?: string; exampleId: string
}`). The approval
event is cancelable: calling `preventDefault()` propagates the veto to the nested
`lr-tool-approval-decide`, preserving its pending dialog and current edited arguments while the
host resolves asynchronous validation. The component also contains and correlates other composed
child events as `lr-example-claim-select` (`{ exampleId, claim }`),
`lr-example-tool-activate` (`{ exampleId, invocationId, sourceKey? }`), and
`lr-example-tool-render-error` (`{ exampleId, invocationId, sourceKey?, toolName, error }`).

**CSS parts:** `base`, `header`,
`header-label`, `progress`, `summary`, `counts`, `count`, `examples`, `example`, `example-summary`,
`example-label`, `example-status`, `example-status-message`, `input-section`, `input`, `output-section`, `output`,
`grounding-section`, `grounding-summary`, `tool-trace-section`, `tool-trace`, `section-heading`,
`live-region`, `empty`.

## `lr-policy-summary`

Read-only list of guardrail, permission, privacy, and tool-policy decisions with accessible
allow, deny, or needs-review explanations.

**Properties:** `decisions: PolicyDecision[] = []` (attribute: false) — `PolicyDecision { id: string;
category: PolicyDecisionCategory; label: string; state: PolicyDecisionState; explanation: string;
detail?: string }`, with `PolicyDecisionCategory = 'guardrail' | 'permission' | 'privacy' | 'tool'`
and `PolicyDecisionState = 'allow' | 'deny' | 'needs-review'` (all three exported here). `label` is
host-supplied data rendered as-is, never localized (a rule name, or a tool name for `category:
'tool'`). `explanation` is an **always-visible** plain-text reason — `state` is never conveyed by
color alone; it tones the badge as `allow` → success, `deny` → danger, `needs-review` → warning,
while the always-visible explanation remains plain text. `detail` is optional richer evidence
(matched rule text, policy id) revealed through
progressive disclosure. Controlled and never mutated — pass a new array to update it.
`id` is the stable decision identity; empty/blank ids and later duplicates are omitted before counts, disclosure state,
and rows are derived.

**Events:** none. Read-only and display-only: this component never mutates a decision and offers no
resolve/acknowledge action — see `lr-tool-approval-dialog`/`lr-confirm-bar` for a real approve/deny
gate.

**CSS parts:** `base`, `empty`, `summary`, `count`, `state-badge`,
`list`, `decision`, `decision-header`, `category`, `label`, `detail`, `explanation`.

**Themeable custom properties:** `--lr-policy-summary-count-allow-color` (default
`var(--lr-color-success)`), `--lr-policy-summary-count-deny-color` (default
`var(--lr-color-danger)`) and `--lr-policy-summary-count-needs-review-color` (default
`var(--lr-color-warning)`) — the text color of each state's count in the summary strip. All three
follow the state-scoped-property convention described under `lr-span-waterfall`: inline `var()`
fallbacks rather than `:host` declarations, so each can be set on the element or on any ancestor.
They exist because `::part(count)[data-state='deny']` is invalid CSS — Shadow Parts forbids an
attribute selector after `::part()` — so retoning one state's count otherwise meant overriding the
library-wide status tokens and repainting every other surface reading them.

## `lr-tool-timeline`

Chronological list of agent tool/function calls composed from tool-call, result, and approval
primitives, with retry counts and sensitive-field redaction.

**Properties:**

- `entries: readonly ToolTimelineEntry[] = []` (attribute: false) — `ToolTimelineEntry` **extends
  `ToolInvocation` from `@aceshooting/lyra-ui/ai`** (`{ id: string; name: string; args:
Record<string, unknown>; status: ToolCallStatus; result?: unknown; error?: string }`, where
  `ToolCallStatus = 'pending' | 'running' | 'success' | 'error' | 'denied'`) with `{ startedAt?:
number; endedAt?: number; retryCount?: number; redactedFields?: readonly string[]; needsApproval?: boolean;
approved?: boolean; sourceKey?: string; icon?: string }`. `sourceKey` identifies the owning run or
  source generation when invocation ids can be reused; every expansion, activation, renderer error,
  and approval draft is correlated by `(sourceKey, id)`. Entries with empty/blank invocation ids
  are omitted; a blank optional `sourceKey` is treated as absent. Duplicate occurrences of the same
  pair are normalized before any lookup with a deterministic first-occurrence-wins policy. `icon` is a
  literal hint forwarded to the composed tool-call chip. A foreign runtime `status` normalizes once
  to `pending` before both the timeline row and its composed chip render.
  Timestamps are epoch milliseconds; entries sort ascending by `startedAt`,
  and an entry with none sorts after every timed entry (keeping its relative position among other
  untimed ones) and renders no visible timestamp. `startedAt`+`endedAt` derive the `durationMs`
  handed to the per-entry `lr-tool-call-chip`. `retryCount: 2` means the call reached its current
  state on its third try; `0`/omitted renders no retry indicator. `redactedFields` are dotted paths
  within `args`/`result`/`error` to mask in the rendered detail view (e.g.
  `['args.apiKey', 'result.rows.0.ssn']`, or a bare `'args'`/`'result'`/`'error'` to mask a whole
  branch); an unmatched path is a no-op, never an error — and redaction is **never** applied to the
  copy of `args` handed to the approval dialog. While `needsApproval` is `true` and `approved` is
  still `undefined`, activating the entry's chip opens the shared approval dialog instead of merely
  firing the chip's own selection event
- `approvalEditable: boolean = true` (attribute `approval-editable`, reflected) — forwarded to the
  shared approval dialog's `editable`: whether a reviewer may edit an entry's arguments before
  approving. Uses a `true`-defaulting string converter, so plain-HTML `approval-editable="false"`
  works
- `formatTimestamp?: (date: Date) => string` (attribute: false) — overrides the default
  `hour:minute` rendering of each entry's `startedAt`
- `pendingApproval: ToolTimelineApprovalPending = null` (read-only) — `'approve'` or `'deny'` while
  a listener has vetoed `lr-tool-approval-decide` and the timeline is holding the shared dialog for
  host persistence; otherwise `null`

**Methods:** `finalizePendingApproval(): void` closes a held dialog after the host has persisted and
applied its controlled `entries` update (it never mutates `entries` itself). `revertPendingApproval():
void` releases a held dialog after persistence fails, retaining the reviewer’s current argument edit
so they can retry. Both are no-ops when no decision is held.

At most 500 unique entries mount. Open disclosures and the entry under approval review reserve
positions before later ordinary history is omitted; a localized `[part="limit"]` note exposes the
bounded projection. Redaction is deferred until a disclosure opens and memoized while the entry's
payload and path list are unchanged. It is bounded to 100 paths, 64 levels, 10,000 visited nodes,
and 4,096 characters per path; crossing a ceiling masks the affected branch instead of exposing
data or exhausting the page.

**Events:** `lr-tool-activate` (`detail: { invocationId: string; sourceKey?: string }`) for a
non-approval entry activation and `lr-tool-render-error` (`detail: { invocationId: string;
sourceKey?: string; toolName: string; error: unknown }`) for a contained nested renderer failure.
The raw child chip-selection, renderer-error, details, and dialog events do not leak across the
timeline boundary. `lr-tool-approval-decide` (`detail: ToolTimelineApprovalDetail` =
`ToolApprovalEventDetail & { args?: unknown; sourceKey?: string }` = `{ invocationId: string;
approved: boolean; args?: unknown; sourceKey?: string }`, extending the shared detail from
`@aceshooting/lyra-ui/ai`). `args` is present only when
`approved` is `true`, and may differ from what the entry originally proposed — the dialog's inline
edit step can hand back different arguments. A listener that only needs `{ invocationId, approved }`
can ignore it; one actually executing the tool needs it. This is a cancelable veto point:
`preventDefault()` preserves the pending approval dialog and its current inline argument edits
instead of closing/resetting them, sets `pendingApproval`, and requires the host to call
`finalizePendingApproval()` after persistence succeeds or `revertPendingApproval()` after it fails.

```ts
timeline.addEventListener("lr-tool-approval-decide", async (event) => {
  event.preventDefault();
  try {
    await persistDecision(event.detail);
    timeline.entries = applyDecision(timeline.entries, event.detail);
    timeline.finalizePendingApproval();
  } catch {
    timeline.revertPendingApproval();
  }
});
```

**CSS parts:** `base`,
`entry`, `entry-marker`, `entry-header`, `entry-timestamp`, `entry-body`, `entry-details`,
`entry-result`, `entry-error`, `entry-retries`, `entry-retries-count`, `entry-retries-label`,
`entry-redacted-indicator`, `entry-approval-status`, `approval-dialog`, `empty`, `limit`.
Each entry's `lr-details` disclosure has a localized contextual summary naming that tool call, not a
repeated bare "Details" label.

**Themeable custom properties:** `--lr-tool-timeline-gap` (default `var(--lr-space-l)`) — vertical
gap between entries; `--lr-tool-timeline-marker-size` (default `var(--lr-size-0-625rem)`) — the
per-entry timeline marker dot's size, which also sets the entry grid's leading column width;
`--lr-tool-timeline-denied-marker-color` (default `var(--lr-color-warning)`) — rail-dot color for a
`status="denied"` entry, decoupled from the pending-approval border color below so either can be
retinted independently; `--lr-tool-timeline-pending-marker-color` (default
`var(--lr-color-text-quiet)`) — rail-dot color for a `status="pending"` entry;
`--lr-tool-timeline-pending-approval-border-color` (default
`var(--lr-color-warning)`) — color of the entry body's leading border while that entry's
`data-pending-approval` is `"true"`.

**Additional API surface:**

- `--lr-tool-timeline-running-marker-color` — Running rail dot. Default: `var(--lr-color-brand)`.
- `--lr-tool-timeline-success-marker-color` — Success rail dot. Default: `var(--lr-color-success)`.
- `--lr-tool-timeline-error-marker-color` — Error rail dot. Default: `var(--lr-color-danger)`.
- `--lr-tool-timeline-approved-bg` — Approved badge background. Default: `var(--lr-color-success-quiet)`.
- `--lr-tool-timeline-approved-color` — Approved badge foreground. Default: `var(--lr-color-success)`.
- `--lr-tool-timeline-denied-bg` — Denied badge background. Default: `var(--lr-color-danger-quiet)`.
- `--lr-tool-timeline-denied-color` — Denied badge foreground. Default: `var(--lr-color-danger)`.
- `--lr-tool-timeline-error-color` — Expanded error text. Default: `var(--lr-color-danger)`.

## `lr-agent-eval-dashboard`

Controlled evaluation overview with metric cards, a dependency-free trend chart, and run-status
history. It never launches or scores evaluations.

**Properties:** `metrics: AgentEvaluationMetric[] = []` (attribute: false), where each metric is
`{ id, label, value, format?: 'number' | 'percent' | 'milliseconds' | 'currency' }`; `currency:
string = 'USD'` is the ISO 4217 code used by currency-formatted metrics (invalid codes safely fall
back to USD). `runs:
AgentEvaluationDashboardRun[] = []` (attribute: false), where each run is `{ id, label, status:
AgentStatusValue, metrics?: Record<string, number> }`. `AgentStatusValue` accepts either a compact
`AgentStatusKind` string or an `AgentStatusPresentation` object (`{ kind, message?, label?,
variant?, terminal?, active? }`), preserving explicit caller labels/messages and badge variants.
`metricId: string | null = null`; `label?: string` — omission localizes the heading while an
explicit empty string renders no heading/name; `showChart: boolean = true`; `chartHeight: string =
'220px'`; `maxRenderedRuns: number = 100` (attribute `max-rendered-runs`, clamped to 1–500) bounds
both the run list and the chart projection.
Empty metric/run ids are omitted and later duplicates use deterministic first-occurrence-wins
normalization before cards, selectors, chart series, row lookup, and emitted events are derived.

**Events:** `lr-metric-change` (`{ metricId }`, emitted when a metric selector is activated) and
`lr-run-activate` (`{ runId, run }`).

**CSS parts:** `base`, `heading`, `metrics`, `metric`, `chart`, `runs`, `runs-heading`, `run`,
`run-label`, `run-meta`, `run-status`, `run-status-message`, `empty`.

**Additional API surface:**

- `--lr-agent-eval-dashboard-active-border` — Active metric border. Default: `var(--lr-color-brand)`.
- `--lr-agent-eval-dashboard-active-background` — Active metric background. Default: `var(--lr-color-brand-quiet)`.

## `lr-approval-queue`

Keyboard-accessible queue of pending tool calls backed by one reusable `lr-tool-approval-dialog`.
It never executes tools or persists decisions.

**Properties:** `requests: ToolApprovalRequest[] = []` (attribute: false), where each request is
`{ id, toolName, args, status?: 'pending' | 'approved' | 'denied' }`;
`selectedInvocationId: string | null = null` (attribute `selected-invocation-id`);
`open: boolean = false`; `editable: boolean = true`; `label?: string` — omission localizes the
heading while an explicit empty string renders no heading/name. Later duplicate request
ids and empty/blank ids are omitted before count, selection, dialog lookup, or decision events are
derived.

**Events:** `lr-approval-select` (`{ invocationId }`), `lr-approval-decision` (`{ invocationId,
approved, args? }`), and `lr-approval-close` (`{ invocationId, reason }`).
`lr-approval-decision` is cancelable; calling `preventDefault()` vetoes the nested approve/deny
request and keeps the decision dialog pending.

Resolved rows (`approved`/`denied`) are never actionable. Replacing `requests` reconciles stale
selection and dialog state before another activation can use it; a request that disappears or is
resolved while open closes the dialog, and reentrant host updates during selection cannot reopen a
stale request.

**CSS parts:** `base`, `heading-row`, `heading`, `count`, `list`, `request`, `request-info`,
`tool-name`, `request-id`, `status`, `empty`. The `[part='request']` row matching
`selectedInvocationId`
carries both `data-selected="true"` (the styling hook) and `aria-current="true"` (the semantic
state), so the selection is announced, not merely painted. Other request rows explicitly render
`data-selected="false"` and `aria-current="false"`.

**Additional API surface:**

- `--lr-approval-queue-selected-border` — Selected request border. Default: `var(--lr-color-brand)`.

## `lr-mcp-app`

Sandbox host for executable MCP App-style resources. Inline documents run in a unique-origin iframe
with a trusted CSP meta placed before every caller-controlled HTML token; comment and script-text
head decoys therefore cannot bypass the policy. Remote documents accept only relative or HTTP(S)
URLs and use a fixed `no-referrer` policy; active-document `data:` and `blob:` URLs are rejected.
The frame can only request tool calls, messages, navigation, logs, and clamped resizing through
typed events. Capabilities are denied unless explicitly enabled in `resource.permissions`.

**Properties:**

- `resource: McpAppResource | null = null` (attribute: false) — a non-empty logical `uri` plus
  exactly one executable source: `{ uri, html, src?: never, ... }` for inline content or
  `{ uri, src, html?: never, ... }` for a relative/HTTP(S) document URL. Shared optional fields are
  `title`, `csp`, `permissions`, and `metadata`. Runtime validation enforces the non-empty identity,
  exact-one-source invariant, and remote URL scheme even for untyped JavaScript callers. CSP domain
  arrays accept HTTP(S) origins only. The resource and nested CSP arrays are clone-owned, bounded,
  and frozen; reassign a new resource record after changes. Permissions are optional booleans for
  camera, microphone, geolocation, clipboard read, and clipboard write.
- `height: number = 320`, `maxHeight: number = 800` (attribute `max-height`) — requested and maximum
  frame heights in pixels; runtime values and resize requests clamp to 120–10,000.
- `label: string = ''`; `accessibleLabel: string | null = null` (attribute `aria-label`). A present
  host `aria-label` stays on the custom-element host as its overall name instead of being cloned
  inward. The iframe title uses `label`, then resource title, then the localized fallback; an
  explicitly empty host label does not suppress those fallbacks, so the executable frame remains
  named. A direct non-empty `accessibleLabel` property value names the frame when no host attribute
  is present.

**Methods:** `postHostContext(context: unknown): void` posts host state into the active frame;
`postToolResult(requestId: string, options: McpAppToolResultOptions): void` resolves a prior tool
request with exactly one of `{ frameGeneration, result }` or `{ frameGeneration, error }`. Missing,
stale, or ambiguous correlation fails closed. Both methods are no-ops before a frame exists.

**Exported types:** `McpAppResource`, `McpAppCsp`, `McpAppPermissions`,
`McpAppToolCallDetail`, `McpAppToolResultOptions`, and `LyraMcpAppEventMap`.

**Events:** `lr-mcp-ready` (`{ uri }`), `lr-mcp-tool-call`
(`{ requestId?, name, args, frameGeneration }`), `lr-mcp-send-message` (`{ message }`),
`lr-mcp-open-link` (`{ href }`), `lr-mcp-log`
(`{ level, value }`), and `lr-mcp-resize` (`{ height }`). These are host-authorized requests; the
component does not execute tools, send messages, or navigate itself.

Changing `resource`, adopting the host into another document, or reconnecting it mounts a fresh
iframe/window generation; messages from the prior `contentWindow` are ignored even when two
opaque-origin inline documents otherwise look alike.

The host-to-frame direction is correlated the same way. `lr-mcp-tool-call`'s
`detail.frameGeneration` is an opaque id for the frame generation that raised the request; passing
it in `postToolResult()`'s required options makes the component drop a reply whose generation no
longer matches the mounted frame. That matters because a tool call is inherently asynchronous — the
host does real work before replying, and a conversation UI can replace or reconnect `resource` on
the same element meanwhile. An uncorrelated reply would otherwise reach a completely unrelated app.

```ts
element.addEventListener("lr-mcp-tool-call", async (event) => {
  const { requestId, name, args, frameGeneration } = event.detail;
  if (!requestId) return;
  const result = await runTool(name, args);
  element.postToolResult(requestId, { frameGeneration, result });
});
```

Changing only `height`/`maxHeight` updates frame geometry without returning an already-ready frame
to its loading state. The initial host context reports `effectiveLocale`, so inherited/document
locale and per-element locale overrides follow the same precedence as the rest of Lyra UI.

Loading and unavailable messages remain ordinary visible text. After the initial baseline, adding
or replacing a valid resource announces the localized loading state through the shared polite
light-DOM sink; changing from an available resource to no resource announces unavailability through
the shared assertive sink. Initial and reconnect renders stay silent.

**CSS parts:** `base`, `frame`, `loading`, `error`.

**Slots:** none. **Optional peer deps:** none.

```ts
import "@aceshooting/lyra-ui/components/agent-tools/mcp-app/mcp-app.js";
```

## `lr-prompt-studio`

Prompt-development workbench for ordered role messages, `{{variable}}` substitution, saved
versions, resolved preview, and save/run intents. Message and variable edits emit a cancelable
`lr-change` proposal carrying their complete next state before updating the component's current
arrays; persistence and execution remain host-owned.

**Properties:** `messages: readonly PromptStudioMessage[] = []` and
`variables: readonly PromptStudioVariable[] = []` are property-only editor state: user edits emit a
cancelable `lr-change` before updating the current arrays, while the host remains responsible for
persistence.
`versions: readonly PromptStudioVersion[] = []` is a property-only host-controlled input;
empty/blank message and version ids are omitted and later duplicates use deterministic first-wins
identity before rendering, editing, focus, selection, and events;
runtime `null`/non-array values for any of the three not-yet-loaded collections render as empty;
`selectedVersionId: string | null = null` (attribute `selected-version-id`); `label: string = ''`;
`heading: string = ''` — visible toolbar heading, falling back to the localized Prompt Studio
label when unset;
`running: boolean = false`, `disabled: boolean = false`, and `reorderable: boolean = false`
(all reflected). `reorderable` adds native move-up/move-down controls for each message. A move first
emits a cancelable request, so a host can veto it while persisting the proposed order and later
assign the accepted `messages` array. Native prose-editing assistance is forwarded to every message
textarea and variable input through `spellcheck: boolean = true`, `autocapitalize: string = ''`,
and `autoCorrect: string = ''` (attribute `autocorrect`); `wrap: PromptStudioWrap = 'soft'` applies
to message textareas only.

**Exported types:** `PromptStudioRole = ChatMessageRole | 'tool'`, where the shared
`ChatMessageRole` is `'system' | 'user' | 'assistant'`;
`PromptStudioMessage = { id, role, content, name? }`; `PromptStudioVariable = { name, value,
description? }`; `PromptStudioVersion = { id: string; label: string; messages:
readonly PromptStudioMessage[]; variables?: readonly PromptStudioVariable[]; createdAt?: string }`; and
`PromptStudioState = { messages, variables }`; `PromptStudioWrap = 'hard' | 'soft' | 'off'`; and
`PromptStudioMessageReorderDetail = { messages, messageId, fromIndex, toIndex }`.

**Events:** cancelable `lr-change` (`{ messages, variables }`, the complete proposed next state,
fired before it is applied — prevent it to keep the current state unchanged), `lr-run`, `lr-save`
(both carry complete messages/variables); `lr-version-select` (`{ version }`); and cancelable
`lr-message-reorder` (`{ messages, messageId, fromIndex, toIndex }`) before an accepted move
updates the component and emits `lr-change`. Prevent `lr-message-reorder` to keep the current
order; the listener may persist `detail.messages` and assign it back when ready. Plus `focus` and
`blur` (no detail), re-dispatched
from the host — bubbling and composed — whenever a message textarea or a variable input gains or
loses focus. They exist because the native `focus`/`blur` events neither bubble nor cross the shadow
boundary, so without the re-dispatch an
`editor.addEventListener('focus', …)` would never fire at all. They are re-dispatches of real
focus movement, not a synthetic host-level focus signal: moving between two fields inside the
studio emits a `blur` and then a `focus`.

**CSS parts:** `base`, `toolbar`, `editor`, `messages`, `message`, `message-role`,
`message-content`, `message-actions`, `move-message-up`, `move-message-down`, `remove-message`,
`add-message`, `variables`, `variable`, `versions`, `version`, `preview`, `save`, `run`.

Each `message-content` textarea deliberately keeps native vertical resizing. Prompt Studio exposes
neither a configurable `resize` surface nor auto-grow behavior; use a dedicated editor when either
is required.

Each message's role select and content editor has a localized contextual accessible name containing
its one-based message index and purpose (plus the current role for content), so repeated controls do
not collapse to indistinguishable generic names.

**Slots:** none. **Optional peer deps:** none.

```ts
import "@aceshooting/lyra-ui/components/agent-tools/prompt-studio/prompt-studio.js";
```

**Additional API surface:**

- `--lr-prompt-studio-field-hover-border` — Enabled field hover border. Default: `var(--lr-color-brand)`.
- `--lr-prompt-studio-version-selected-border` — Selected version border. Default: `var(--lr-color-brand)`.
- `--lr-prompt-studio-version-selected-bg` — Selected version background. Default: `var(--lr-color-brand-quiet)`.
- `--lr-prompt-studio-version-selected-color` — Selected version foreground. Default: `var(--lr-color-text)`.
- `--lr-prompt-studio-version-selected-hover-bg` — Selected version hover background. Default: `color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-hover))`.

## `lr-json-schema-viewer`

Recursive JSON Schema inspector with property/branch selection, required and constraint display,
validation issues, `$ref` visibility, composition branches, cycle protection, and a depth ceiling.
It intentionally does not fetch remote references or validate values.

**Properties:** clone-owned, bounded, frozen `schema: JsonSchemaNode | null = null` and
`issues: readonly SchemaValidationIssue[] = []` (attribute: false); reassign a new schema record or
issue array after changes. `selectedPath: string | null = null` (attribute `selected-path`) —
`null` means no selection, while the empty string is the valid JSON Pointer for the schema root;
`maxDepth: number = 20` (attribute `max-depth`, clamped to 100); `label: string = ''`.

**Exported types:** `JsonSchemaNode` covers `$ref`, type/title/description, properties/items,
readonly required/enum/examples and oneOf/anyOf/allOf collections, and const/default while preserving unknown schema
keywords. `SchemaValidationIssue = { path: string; message: string; severity?: 'error' | 'warning'
| 'info' }`. At runtime, a Swagger-style boolean or string `required` keyword is treated as no
JSON-Schema required-property list instead of rejecting the entire tree.

**Events:** `lr-schema-select` (`{ schemaPath, schema }`, with an RFC 6901-style JSON Pointer).

**CSS parts:** `base`, `tree`, `node`, `node-selected`, `node-trigger`, `name`, `type`, `required`,
`description`, `constraints`, `issue`, `limit`, `issue-limit`, `empty`. `issue-limit` is the
localized resource-ceiling status shown when caller-supplied validation issues exceed the rendered
issue cap.

`[part='issue']` carries `data-severity` and each severity has its own styling: `error` reads the
danger tokens, `warning` the warning tokens, and `info` its own pair —
`--lr-schema-viewer-info-border` (default `var(--lr-color-brand)`) and `--lr-schema-viewer-info-bg`
(default `var(--lr-color-brand-quiet)`). Brand rather than a dedicated info palette because this
library has no `--lr-color-info-*` token; before these existed an `info` issue rendered identically
to an `error`, which read as a false alarm. Both are inline `var()` fallbacks at their point of use,
so either can be set on the element or on any ancestor — `::part(issue)[data-severity='info']` is
invalid CSS, so this is the only way to recolor one severity without touching the others.

**Themeable custom properties:** `--lr-schema-viewer-max-indent` (default `var(--lr-size-12rem)`)
caps visual nesting indentation while preserving complete JSON Pointer paths;
`--lr-schema-viewer-info-border`, `--lr-schema-viewer-info-bg` (see above); otherwise shared tokens
only.

Rendering is capped independently at 500 schema nodes and 500 validation issues; `limit` and
`issue-limit` show their respective truncation as ordinary, non-live status text. Newly reaching or
changing either ceiling after the initial baseline appends the localized message to the shared
polite light-DOM announcement sink; initial and reconnect renders stay silent. Issues are indexed by
path once before recursive rendering instead of rescanning the full input for every node. Cycles stop
at the repeated node rather than recursing. **Slots:** none. **Optional peer deps:** none.

```ts
import '@aceshooting/lyra-ui/components/lr-json-schema-viewer.js';
```

**Additional API surface:**

- `part="limit"` — Resource-ceiling status shown when additional nodes are omitted.
- `part="issue-limit"` — Resource-ceiling status shown when additional validation issues are omitted.
- `--lr-schema-viewer-selected-border` — Selected node branch. Default: `var(--lr-color-brand)`.
- `--lr-schema-viewer-error-border` — Error issue border. Default: `var(--lr-color-danger)`.
- `--lr-schema-viewer-error-bg` — Error issue background. Default: `var(--lr-color-danger-quiet)`.
- `--lr-schema-viewer-warning-border` — Warning issue border. Default: `var(--lr-color-warning)`.
- `--lr-schema-viewer-warning-bg` — Warning issue background. Default: `var(--lr-color-warning-quiet)`.

## `lr-subagent-panel`

Controlled nested-agent hierarchy with lifecycle badges, task/model context, guarded progress,
selection, cancel, and retry intents. `SubagentRun.parentId` creates nesting; cycles and orphan
parents remain renderable instead of recursing forever.

**Properties:** `runs: SubagentRun[] = []` (attribute: false);
`selectedRunId: string | null = null` (attribute `selected-run-id`); `label?: string` — an
accessible-name override for the `role="tree"` element, where omission reads back `undefined` and
localizes the default while any supplied string, including `''`, renders verbatim.
`SubagentRun = { id: string; parentId?: string; label: string; status: AgentStatusKind; task?:
string; model?: string; progress?: number; startedAt?: number; endedAt?: number; metadata?:
Record<string, unknown> }`.
Empty/blank run ids are omitted and later duplicate ids are ignored before hierarchy, focus,
counts, selection, and events.

**Events:** `lr-run-activate` (`{ runId, run }`), `lr-cancel` (`{ runId }`), and
`lr-run-retry` (`{ runId }`).

**CSS parts:** `base`, `list`, `run`, `run-selected`, `run-row`, `run-trigger`, `label`, `status`,
`task`, `model`, `progress`, `actions`, `cancel`, `retry`, `limit`, `empty`.

At most 500 runs render, and visual indentation is capped at 12 levels while ARIA hierarchy keeps
the logical depth. The visible `limit` text is ordinary and non-live; newly reaching or changing the
run ceiling after the initial baseline appends the localized message to the shared polite light-DOM
announcement sink, while initial and reconnect renders stay silent. The roving treeitem accepts
Enter/Space as well as pointer activation for `lr-run-activate`; cancel/retry action names include the
run label so repeated row actions remain distinguishable to assistive technology. Progress is finite
and clamped. **Slots:** none.
**Optional peer deps:** none.

```ts
import "@aceshooting/lyra-ui/components/agent-tools/subagent-panel/subagent-panel.js";
```

**Additional API surface:**

- `part="limit"` — Resource-ceiling status shown when additional runs are omitted.
- `--lr-subagent-panel-selected-border` — Selected run border. Default: `var(--lr-color-brand)`.
- `--lr-subagent-panel-progress-track` — Progress track. Default: `var(--lr-color-border)`.
- `--lr-subagent-panel-progress-fill` — Progress fill. Default: `var(--lr-color-brand)`.

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-agent-tools-activity-feed-activity-feed-contracts`** — Supporting data types and helpers for this component family.
  `ActivityEntry {
  id: unknown;
  text: unknown;
  icon: unknown;
  timestamp: unknown;
  variant: unknown;
}`
  `ActivityFeedFollowChangeDetail {
  following: unknown;
}`
  `ActivityFeedToggleDetail {
  expanded: unknown;
}`

- **`components-agent-tools-agent-eval-dashboard-agent-eval-dashboard-contracts`** — Supporting data types and helpers for this component family.
  `AgentEvaluationDashboardRun {
  id: unknown;
  label: unknown;
  status: unknown;
  metrics: unknown;
}`
  `AgentEvaluationMetric {
  id: unknown;
  label: unknown;
  value: unknown;
  format: unknown;
}`

- **`components-agent-tools-agent-run-agent-run-contracts`** — Supporting data types and helpers for this component family.
  `AgentRunMetric {
  id: unknown;
  label: unknown;
  value: unknown;
  variant: unknown;
}`

- **`components-agent-tools-agent-status-presentation-contracts`** — Supporting data types and helpers for this component family.
  `agentStatusKind(/* public names: status */): unknown`
  `agentStatusLabel(/* public names: status */): unknown`
  `agentStatusMessage(/* public names: status */): unknown`
  `AgentStatusPresentation {
  label: unknown;
  variant: unknown;
  terminal: unknown;
  active: unknown;
  kind: unknown;
  message: unknown;
}`
  `agentStatusVariant(/* public names: status, fallback */): unknown`
  `isAgentStatusActive(/* public names: status */): unknown`
  `isAgentStatusTerminal(/* public names: status */): unknown`

- **`components-agent-tools-approval-queue-approval-queue-contracts`** — Supporting data types and helpers for this component family.
  `ToolApprovalRequest {
  id: unknown;
  toolName: unknown;
  args: unknown;
  status: unknown;
}`

- **`components-agent-tools-approval-state-contracts`** — Supporting data types and helpers for this component family.
  `approvalAction(/* public names: decision */): unknown`
  `approvalDecision(/* public names: action */): unknown`

- **`components-agent-tools-artifact-panel-artifact-panel-contracts`** — Supporting data types and helpers for this component family.
  `ArtifactVersion {
  id: unknown;
  label: unknown;
}`

- **`components-agent-tools-browser-frame-browser-frame-contracts`** — Supporting data types and helpers for this component family.
  `BrowserPing {
  id: unknown;
  x: unknown;
  y: unknown;
  kind: unknown;
}`

- **`components-agent-tools-commit-card-commit-card-contracts`** — Supporting data types and helpers for this component family.
  `CommitFileChange {
  path: unknown;
  additions: unknown;
  deletions: unknown;
  status: unknown;
}`

- **`components-agent-tools-context-inspector-context-inspector-contracts`** — Supporting data types and helpers for this component family.
  `ContextInspectorRedaction {
  start: unknown;
  end: unknown;
  reason: unknown;
}`
  `ContextInspectorSegment {
  id: unknown;
  label: unknown;
  text: unknown;
  tokens: unknown;
  tone: unknown;
  citation: unknown;
  truncated: unknown;
  omittedTokens: unknown;
  redactions: unknown;
}`

- **`components-agent-tools-eval-dataset-eval-dataset-contracts`** — Supporting data types and helpers for this component family.
  `EvalExample {
  id: unknown;
  input: unknown;
  expectedOutput: unknown;
  tags: unknown;
  metadata: unknown;
}`

- **`components-agent-tools-eval-result-eval-result-contracts`** — Supporting data types and helpers for this component family.
  `EvalRunResult {
  id: unknown;
  label: unknown;
  model: unknown;
  promptVersion: unknown;
  output: unknown;
  scores: unknown;
  review: unknown;
}`

- **`components-agent-tools-evaluation-run-evaluation-run-contracts`** — Supporting data types and helpers for this component family.
  `EvalCitationSelectDetail {
  exampleId: unknown;
  citation: unknown;
}`
  `EvalClaimSelectDetail {
  exampleId: unknown;
  claim: unknown;
}`
  `EvalContent {
  text: unknown;
  format: unknown;
  language: unknown;
}`
  `EvalExampleResult {
  id: unknown;
  label: unknown;
  status: unknown;
  input: unknown;
  output: unknown;
  grounding: unknown;
  citations: unknown;
  toolTrace: unknown;
}`
  `EvalExampleToggleDetail {
  exampleId: unknown;
  expanded: unknown;
}`
  `EvalToolActivateDetail {
  exampleId: unknown;
  invocationId: unknown;
  sourceKey: unknown;
}`
  `EvalToolApprovalDetail {
  exampleId: unknown;
  args: unknown;
  sourceKey: unknown;
  invocationId: unknown;
  approved: unknown;
}`
  `EvalToolRenderErrorDetail {
  exampleId: unknown;
  toolName: unknown;
  error: unknown;
  invocationId: unknown;
  sourceKey: unknown;
}`

- **`components-agent-tools-mcp-app-mcp-app-contracts`** — Supporting data types and helpers for this component family.
  `McpAppCsp {
  connectDomains: unknown;
  resourceDomains: unknown;
  frameDomains: unknown;
}`
  `McpAppPermissions {
  camera: unknown;
  microphone: unknown;
  geolocation: unknown;
  clipboardRead: unknown;
  clipboardWrite: unknown;
}`
  `McpAppToolCallDetail {
  requestId: unknown;
  name: unknown;
  args: unknown;
  frameGeneration: unknown;
}`

- **`components-agent-tools-policy-summary-policy-summary-contracts`** — Supporting data types and helpers for this component family.
  `PolicyDecision {
  id: unknown;
  category: unknown;
  label: unknown;
  state: unknown;
  explanation: unknown;
  detail: unknown;
}`

- **`components-agent-tools-prompt-studio-prompt-studio-contracts`** — Supporting data types and helpers for this component family.
  `PromptStudioMessage {
  id: unknown;
  role: unknown;
  content: unknown;
  name: unknown;
}`
  `PromptStudioMessageReorderDetail {
  messages: unknown;
  messageId: unknown;
  fromIndex: unknown;
  toIndex: unknown;
}`
  `PromptStudioState {
  messages: unknown;
  variables: unknown;
}`
  `PromptStudioVariable {
  name: unknown;
  value: unknown;
  description: unknown;
}`
  `PromptStudioVersion {
  id: unknown;
  label: unknown;
  messages: unknown;
  variables: unknown;
  createdAt: unknown;
}`

- **`components-agent-tools-run-events-contracts`** — Supporting data types and helpers for this component family.
  `AgentRunActivateDetail {
  runId: unknown;
  run: unknown;
}`

- **`components-agent-tools-schema-viewer-schema-viewer-contracts`** — Supporting data types and helpers for this component family.
  `JsonSchemaNode {
  $ref: unknown;
  type: unknown;
  title: unknown;
  description: unknown;
  properties: unknown;
  items: unknown;
  required: unknown;
  enum: unknown;
  const: unknown;
  default: unknown;
  examples: unknown;
  oneOf: unknown;
  anyOf: unknown;
  allOf: unknown;
}`
  `SchemaValidationIssue {
  path: unknown;
  message: unknown;
  severity: unknown;
}`

- **`components-agent-tools-stack-trace-stack-trace-parse-contracts`** — Supporting data types and helpers for this component family.
  `parseStackTrace(/* public names: trace, options */): unknown`
  `StackFrame {
  functionName: unknown;
  file: unknown;
  line: unknown;
  column: unknown;
  internal: unknown;
  raw: unknown;
}`
  `StackGroup {
  message: unknown;
  frames: unknown;
}`
  `StackTraceParseOptions {
  internalPatterns: unknown;
}`
  `StackTraceParseResult {
  groups: unknown;
  truncated: unknown;
  source: unknown;
}`

- **`components-agent-tools-subagent-panel-subagent-panel-contracts`** — Supporting data types and helpers for this component family.
  `SubagentRun {
  id: unknown;
  parentId: unknown;
  label: unknown;
  status: unknown;
  task: unknown;
  model: unknown;
  progressRatio: unknown;
  startedAt: unknown;
  endedAt: unknown;
  metadata: unknown;
}`

- **`components-agent-tools-task-list-task-list-contracts`** — Supporting data types and helpers for this component family.
  `TaskItem {
  id: unknown;
  label: unknown;
  status: unknown;
  detail: unknown;
  children: unknown;
}`
  `TaskListToggleDetail {
  expanded: unknown;
}`

- **`components-agent-tools-test-results-test-results-contracts`** — Supporting data types and helpers for this component family.
  `TestCaseResult {
  id: unknown;
  name: unknown;
  status: unknown;
  durationMs: unknown;
  message: unknown;
}`
  `testResultDetailSlotName(/* public names: suiteId, testId */): unknown`
  `TestSuiteResult {
  id: unknown;
  name: unknown;
  tests: unknown;
}`

- **`components-agent-tools-thinking-panel-thinking-panel-contracts`** — Supporting data types and helpers for this component family.
  `ThinkingPanelToggleDetail {
  expanded: unknown;
}`

- **`components-agent-tools-tool-call-chip-tool-call-chip-contracts`** — Supporting data types and helpers for this component family.
  `ToolChipSelectDetail {
  name: unknown;
  callId: unknown;
}`

- **`components-agent-tools-tool-result-view-registry-contracts`** — Supporting data types and helpers for this component family.
  `DirectToolRendererDefinition {
  render: unknown;
  result: unknown;
  args: unknown;
  context: unknown;
  load: unknown;
  matches: unknown;
  payload: unknown;
}`
  `findToolRenderer(/* public names: toolName, payload, registry */): unknown`
  `getDefaultToolRendererRegistry(): unknown`
  `LazyToolRendererDefinition {
  render: unknown;
  load: unknown;
  default: unknown;
  matches: unknown;
  payload: unknown;
}`
  `loadToolRenderer(/* public names: def */): unknown`
  `registerToolRenderer(/* public names: name, def */): unknown`
  `ToolRenderContext {
  reportStatus: unknown;
  status: unknown;
}`

- **`components-agent-tools-tool-select-dialog-tool-select-dialog-contracts`** — Supporting data types and helpers for this component family.
  `ToolSelectDialogTool {
  id: unknown;
  name: unknown;
  description: unknown;
  category: unknown;
  icon: unknown;
  disabled: unknown;
  disabledReason: unknown;
}`
  `ToolSelectionChangeDetail {
  selectedToolIds: unknown;
  useDefaults: unknown;
}`

- **`components-agent-tools-tool-timeline-tool-timeline-contracts`** — Supporting data types and helpers for this component family.
  `ToolTimelineActivateDetail {
  invocationId: unknown;
  sourceKey: unknown;
}`
  `ToolTimelineApprovalDetail {
  args: unknown;
  sourceKey: unknown;
  invocationId: unknown;
  approved: unknown;
}`
  `ToolTimelineEntry {
  sourceKey: unknown;
  icon: unknown;
  startedAt: unknown;
  endedAt: unknown;
  retryCount: unknown;
  redactedFields: unknown;
  needsApproval: unknown;
  approved: unknown;
  id: unknown;
  name: unknown;
  args: unknown;
  status: unknown;
  result: unknown;
  error: unknown;
}`
  `ToolTimelineRenderErrorDetail {
  toolName: unknown;
  error: unknown;
  invocationId: unknown;
  sourceKey: unknown;
}`

- **`components-agent-tools-trace-tree-span-contracts`** — Supporting data types and helpers for this component family.
  `LyraSpan {
  id: unknown;
  parentId: unknown;
  name: unknown;
  kind: unknown;
  startMs: unknown;
  endMs: unknown;
  status: unknown;
  tokensIn: unknown;
  tokensOut: unknown;
  costText: unknown;
  detail: unknown;
}`
  `LyraSpanProjection {
  spans: unknown;
  byId: unknown;
  truncated: unknown;
}`
  `normalizeLyraSpanKind(/* public names: value */): unknown`
  `normalizeLyraSpans(/* public names: values, activeSpanId */): unknown`
  `normalizeLyraSpanStatus(/* public names: value */): unknown`
