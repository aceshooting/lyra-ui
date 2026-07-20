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
click or Enter/Space activation of the pill. The deprecated `lr-tool-chip-select` alias is fired
alongside it for one minor compatibility cycle.

**Slots:** default (rich tooltip/detail content — e.g. the tool's raw arguments or a short preview —
shown in a floating tooltip on hover/focus; nothing renders at all, no hover affordance, when this
slot is empty), `icon` (overrides the built-in per-status glyph entirely via native slot-fallback
content — assigned content wins; otherwise the `icon` prop is rendered as a literal hint; otherwise
the built-in glyph for the current `status` is used)

**CSS parts:** `base` (the clickable `<button>`), `icon`, `label` (wrapper around `category`, `name`,
`summary`), `category`, `name`, `summary`, `meta` (wrapper around `status-text` and `duration`),
`status-text`, `duration`, `tooltip` (the floating detail popup, only meaningful while open)

**Themeable custom properties:** `--lr-tool-call-chip-spin` (default `1s linear` — running-icon
animation duration/timing) and `--lr-transition-ambient` (default `1.8s ease-in-out` — pending-icon
pulse duration/timing). `--lr-tool-call-chip-accent`, `--lr-tool-call-chip-bg`, and
`--lr-tool-call-chip-border` are internal per-status variables reassigned by this component's own
`:host([status="…"])` rules (e.g. `pending` → `--lr-color-text-quiet`/`--lr-color-surface`/
`--lr-color-border`; `running` → brand; `success` → success; `error` → danger; `denied` → warning),
so a page-level override loses to them for every non-default status — they are not a practical
public theming hook. Shared tokens
referenced: `--lr-color-text-quiet`, `--lr-color-surface`, `--lr-color-border`,
`--lr-color-brand`/`-brand-quiet`, `--lr-color-success`/`-success-quiet`,
`--lr-color-danger`/`-danger-quiet`, `--lr-color-warning`/`-warning-quiet`, `--lr-color-text`,
`--lr-space-xs/-s/-m`, `--lr-radius`, `--lr-shadow`, `--lr-focus-ring-*`,
`--lr-transition-fast`.

**Optional peer deps:** none.

```html
<lr-tool-call-chip
  name="web_search"
  category="research"
  status="running"
  summary="Searching web…"
  duration-ms="820"
  call-id="call_123"
  @lr-tool-call-chip-select=${(e) => openDetail(e.detail.callId)}
>
  <pre slot="icon" style="display:none"></pre>
  <code>{"query": "lyra ui components"}</code>
</lr-tool-call-chip>
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
  once on first update, then kept in sync via `slotchange` — only *element* children count (a bare
  text node assigned to the default slot won't trigger the tooltip)
- `aria-label` on the host element (if you set one) wins over the component's own generated
  accessible label (`"name — summary — Status — duration"`); otherwise that generated string is
  what's announced
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
- `registry?: ToolRendererRegistry` (property only, no attribute) — a custom `Map<string,
  ToolRendererDefinition>` to dispatch against instead of the module-level default registry (see
  `registry.ts` below)
- `toolName: string = ''` (attribute `tool-name`) — the tool's name; the primary dispatch key
- `result: unknown` (property only, no attribute) — the tool call's result payload, handed to the
  matched renderer's `render()` (and to `matches()` for shape-based dispatch, and to the
  `<lr-json-viewer>` fallback)
- `args: unknown` (property only, no attribute) — the tool call's original arguments, if available,
  handed to the matched renderer's `render()` alongside `result`
- `fallback: string = 'json'` (reflected) — fallback-kind selector. `"json"` (the default) is
  an unconditional `<lr-json-viewer>`. `"text"` renders a *string* `result` as preformatted text
  instead — falling back to the `"json"` behavior when `result` isn't a string, so setting
  `fallback="text"` defensively against an unpredictable result shape never renders broken output.
  Any other value also uses the `"json"` behavior, forward-compatible plumbing only.
- `copyable: boolean = false` (reflected) — shows a copy-to-clipboard affordance alongside the
  fallback view, for either `fallback` kind: forwarded to `<lr-json-viewer>`'s own `copyable` for
  `"json"`, or a `<lr-copy-button>` rendered next to the text for `"text"`.

**Events:** `lr-render-error` (`detail: { toolName: string; error: unknown }`) — fired immediately
before falling back to `<lr-json-viewer>`, whether because no renderer matched, a candidate
renderer's `matches()` predicate threw during dispatch, a renderer's `load()` rejected, or its
`render()` threw.

**Slots:** none.

**CSS parts:** `base` — the root wrapper around the resolved renderer's output (or the loading/
fallback view). `fallback-text` — the `<pre>` element for the `fallback="text"` kind's preformatted
result text (only present in that mode). `fallback-copy` — the `<lr-copy-button>` shown when
`copyable` is set alongside the `fallback="text"` kind (only present when both are set).

**Themeable custom properties:** `--lr-tool-result-view-font` (default `ui-monospace,
SFMono-Regular, Menlo, Consolas, monospace` — component-specific since no shared monospace token
exists, matching `<lr-json-viewer>`'s own `--lr-json-viewer-font` convention) — only used by the
`fallback="text"` kind's `[part='fallback-text']`. Otherwise none — the component's own styling is
deliberately minimal; all visible styling comes from whatever renderer/`<lr-skeleton>`/
`<lr-json-viewer>`/`<lr-copy-button>` child is currently mounted.

**Optional peer deps:** none required by the component itself — individual registered renderers may
of course pull in whatever they need (a charting library, a markdown renderer), which is exactly what
the lazy `load()` path in the registry exists for.

```html
<lr-tool-result-view
  tool-name="get_weather"
  .result=${{ tempC: 21, condition: 'cloudy' }}
  .args=${{ city: 'Brussels' }}
  @lr-render-error=${(e) => console.warn('renderer failed', e.detail)}
></lr-tool-result-view>
```

### `registerToolRenderer()` and the tool-renderer registry (`registry.ts`)

A type-keyed dispatch registry — a tiny plugin system so a host app can teach
`<lr-tool-result-view>` how to draw the result of e.g. a `get_weather` or `run_query` tool call
without this library knowing anything about either. Every registered instance dispatches against
this same module-level registry unless a given `<lr-tool-result-view>`'s `registry` property is
set to a different `Map` instance.

**`ToolRendererDefinition`** — the shape of one registered renderer:
- `render?: (result: unknown, args: unknown) => unknown` — renders the result (and the args that
  produced it) as UI. Typed as `unknown` rather than Lit's `TemplateResult` so any lit-html-renderable
  value works (a plain string, a DOM node, an array of templates) — consumers already own their own
  Lit import and don't need this module to add one
- `matches?: (payload: unknown) => boolean` — facade/shape-based dispatch predicate, consulted only
  when no exact `toolName` key matches (see dispatch order below); only ever consulted *before*
  `load` resolves when supplied inline at registration time — a definition that needs shape-based
  dispatch and also wants to lazy-load its `render` should register a lightweight synchronous
  `matches` up front alongside `load`
- `load?: () => Promise<ToolRendererDefinition | { default: ToolRendererDefinition }>` — lazy loader
  for a code-split renderer, so a host app can defer the cost of a rarely-used or heavy renderer
  (e.g. one pulling in a charting library) instead of paying for it on every page that merely
  registers it. Resolves to either a definition directly, or a `{ default }`-shaped module namespace
  object, so `load: () => import('./my-renderer.js')` works unmodified when that module's default
  export is itself a `ToolRendererDefinition`

**Exports:**
- `registerToolRenderer(name: string, def: ToolRendererDefinition): void` — registers (or
  overwrites) the renderer for `name` in the module-level default registry
- `getDefaultToolRendererRegistry(): ToolRendererRegistry` — returns the default `Map` that
  `registerToolRenderer()` writes to and every `<lr-tool-result-view>` reads from unless its own
  `registry` prop is set
- `findToolRenderer(toolName: string, payload: unknown, registry?: ToolRendererRegistry):
  ToolRendererDefinition | undefined` — the dispatch function `<lr-tool-result-view>` calls
  internally on every resolve; exposed for direct use/testing too
- `loadToolRenderer(def: ToolRendererDefinition): Promise<ToolRendererDefinition>` — resolves `def`
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
`<lr-skeleton variant="rect" height="4rem">` while `loadToolRenderer()` resolves it. The resolved
`load()` promise is cached keyed by *definition object identity* (a `WeakMap`, not by tool-name
string) — two different registries that happen to reuse the same tool-name string get independently
cached loads, and any given lazy definition's `load()` runs at most once no matter how many times
it's dispatched to, across every `<lr-tool-result-view>` instance that resolves to it. A **rejected**
`load()` is *not* cached — the definition stays registered, so a later resolution attempt (e.g. after
a transient network failure) gets a fresh `load()` call rather than being stuck replaying one failed
promise forever.

```ts
import { registerToolRenderer } from '@aceshooting/lyra-ui/components/agent-tools/tool-result-view/registry.js';

registerToolRenderer('get_weather', {
  render: (result, args) => html`<weather-card .data=${result} .city=${args?.city}></weather-card>`,
});

// Lazily loaded, shape-based fallback for every *_search tool:
registerToolRenderer('web_search', {
  matches: (payload) => typeof payload === 'object' && payload !== null && 'results' in payload,
  load: () => import('./search-result-renderer.js'), // default export is a ToolRendererDefinition
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
- `fallback` implements exactly two kinds, `"json"` and `"text"`; any *other* value silently behaves
  as `"json"`, as does `"text"` whenever `result` isn't a string. Only `"text"` renders
  `[part="fallback-text"]`/`[part="fallback-copy"]`

---

## `lr-tool-result-dialog`

A full tool-call detail overlay: a status/duration header plus a `body` slot where a consumer
typically places a `<lr-tabs>` with Input/Preview/JSON/Raw panels. First-party invention (no Web
Awesome equivalent). This component knows nothing about what's inside that slot — it only supplies
the modal chrome around it. It keeps its own shadow template rather than nesting a `<lr-dialog>`,
so slot-forwarding does not put a forwarding `<slot>` where a slotted `<lr-tabs>`'s own light-DOM
child scan expects real projected content, while its modal behavior participates in the shared
overlay stack.

**Properties:**
- `open: boolean = false` (reflected) — whether the dialog is open; set this (or call `close()`) —
  there is no separate `show()`/`hide()` pair
- `accessibleLabel: string | null = null` (attribute `aria-label`) — directly names the internal
  dialog panel; otherwise the tool-name title supplies `aria-labelledby`
- `toolName: string = ''` (attribute `tool-name`) — the tool's name, rendered prominently in the
  header
- `status: 'pending'|'running'|'success'|'error'|'denied' = 'pending'` (reflected) — drives the
  header's status badge; same status vocabulary as `<lr-tool-call-chip>`
- `durationMs?: number` (attribute `duration-ms`) — how long the call took, in milliseconds; omitted
  from the header entirely when unset
- `maximized: boolean = false` (reflected) — near-fullscreen presentation of the same open dialog

**Methods:** `close(reason: ToolResultDialogCloseReason = 'api'): void` — closes the dialog (no-op if
already closed), emits `lr-close` with `reason`, and returns focus to whatever had it before
the dialog opened. Built-in triggers call this with `'escape'`/`'backdrop'`/`'close-button'`; a
consumer's own close affordance (e.g. a footer action button) should call it directly with its own
reason string so every dismissal path funnels through the same event.

**Events:** `lr-close` (`detail: ToolResultDialogCloseReason` — `'escape'|'backdrop'|
'close-button'|'api'|string`) fired exactly once per dismissal; `lr-maximize-change` (`detail:
boolean`, the new `maximized` state) fired when the header's maximize/restore toggle is clicked.

**Slots:** `body` (the dialog's main content — typically a `<lr-tabs>` with Input/Preview/JSON/Raw
panels, entirely consumer-assembled), `footer` (optional action buttons, rendered in a bottom row —
the footer row itself is hidden via `[hidden]` when nothing is slotted)

**CSS parts:** `backdrop`, `panel` (`role="dialog"` while open), `header`, `title` (wrapper around
tool name/status/duration), `tool-name`, `status`, `duration`, `header-actions`, `maximize-button`,
`close-button`, `body`, `footer`

**Themeable custom properties:** `--lr-tool-result-dialog-overlay-color` (default `rgb(0 0 0 /
0.5)` — the backdrop scrim color; component-specific since no shared overlay token exists),
`--lr-tool-result-dialog-maximized-inset` (default `var(--lr-space-l)` — inset applied to the
panel while `[maximized]`, overridable e.g. to leave a persistent app rail visible), and
`--lr-tool-result-dialog-spin` (default `1s linear`, stopped under reduced motion), plus shared
tokens `--lr-color-surface/-border/-text-quiet/-brand/-brand-quiet/-success/-success-quiet/
-danger/-danger-quiet/-warning/-warning-quiet`, `--lr-space-*`, `--lr-radius`, `--lr-shadow`,
`--lr-icon-button-size`, `--lr-focus-ring-*`, `--lr-transition-base`.

**Optional peer deps:** none.

```html
<lr-tool-result-dialog
  tool-name="run_query"
  status="success"
  duration-ms="1240"
  ?open=${dialogOpen}
  @lr-close=${(e) => (dialogOpen = false)}
  @lr-maximize-change=${(e) => console.log('maximized:', e.detail)}
>
  <lr-tabs slot="body">
    <div slot="preview" label="Preview">…</div>
    <div slot="json" label="JSON"><lr-json-viewer .data=${result}></lr-json-viewer></div>
  </lr-tabs>
  <button slot="footer">Rerun</button>
</lr-tool-result-dialog>
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

**Known gotchas:**
- a reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if `open` was still `true` across the
  move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no intervening update, so
  `willUpdate` never reruns to notice `open` did not change
- this component deliberately does **not** compose `<lr-dialog>` internally; it keeps its own
  panel template so a slotted `<lr-tabs>` (or any other light-DOM-scanning child) sees real
  projected content rather than a forwarding `<slot>`, while still sharing the overlay stack
- `close()` is a no-op when `open` is already `false` — calling it twice in a row only fires
  `lr-close` once
- the `maximize`/`close` buttons are always the first elements in the Tab order while open,
  regardless of visual position, followed by `body` then `footer` content

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
  trailing "Other" bucket. `icon` is a literal glyph (e.g. an emoji) rendered next to `name` — an opaque
  string, not a registry lookup, the same convention `<lr-tool-call-chip>`'s `icon` uses. `disabled`
  individually gates a tool regardless of `useDefaults`/`selected` (e.g. a tool requiring admin
  approval); `disabledReason` is supporting text shown under a disabled row, ignored when `disabled` is
  falsy.
- `ToolSelectFilter = (tool: ToolSelectDialogTool, query: string) => boolean` — a predicate deciding
  whether `tool` matches an already-trimmed, already-lowercased `query`. Assign `filter` to replace the
  built-in case-insensitive name/description substring match entirely (mirrors `<lr-combobox>`'s
  `OptionFilter` convention).
- `ToolSelectionChangeDetail { selected: string[]; useDefaults: boolean }` — the `lr-change` detail
  shape.
- `ToolSelectDialogCloseReason = 'escape' | 'backdrop' | 'api' | string` — the `lr-close` detail;
  `'escape'`/`'backdrop'` come from the dialog's own built-in dismiss triggers, any other string is
  whatever a caller passes to `close()` directly.

**Properties:**
- `open: boolean = false` (reflected) — set this (or call `close()`) to dismiss; there is no separate
  `show()`/`hide()` pair.
- `tools: ToolSelectDialogTool[] = []` (attribute: false) — the full set of tools a consumer offers,
  across all categories.
- `selected: string[] = []` (attribute: false) — the currently-enabled tool ids.
- `useDefaults: boolean = false` (attribute `use-defaults`, reflected) — whether the conversation is
  using the default tool set (`true`) or a custom selection (`false`).
- `label: string = 'Select tools'` — the dialog's visible heading and accessible name.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the dialog panel's
  accessible name, taking precedence over the visible `label` heading; mirrors `<lr-dialog>`'s
  own host-`aria-label` override pattern.
- `searchPlaceholder: string = 'Search tools…'` (attribute `search-placeholder`)
- `filter: ToolSelectFilter | null = null` (attribute: false) — overrides the built-in
  case-insensitive name/description substring match.
- `autocomplete: string = ''`, `spellcheck: boolean = true`, `autocapitalize: string = ''`,
  `autoCorrect: string = ''` (`autocorrect`), `inputMode: string = ''` (`inputmode`), and
  `enterKeyHint: string = ''` (`enterkeyhint`) — forwarded to the search `<input>`.

**Methods:** `close(reason: ToolSelectDialogCloseReason = 'api'): void` — closes the dialog, emits
`lr-close` with `reason`, and returns focus to whatever had it before the dialog opened.

**Events:** `lr-change` (`detail: ToolSelectionChangeDetail` — the enabled-tool selection or the
`useDefaults` toggle changed), `lr-close` (`detail: ToolSelectDialogCloseReason` — fired exactly once
per dismissal, via Escape, a backdrop click, or a `close()` call)

**Slots:** `footer` — optional action buttons (e.g. a "Done" button), rendered in a bottom row. Changes
already apply live via `lr-change`, so this slot is purely optional; only visually shown once it has
assigned elements.

**CSS parts:** `backdrop`, `panel`, `header`, `title`, `subtitle`, `search-row`, `search-input`,
`defaults-row`, `defaults-toggle`, `defaults-hint`, `body`, `empty`, `category`, `category-heading`,
`category-count`, `category-list`, `tool-row`, `tool-checkbox`, `tool-name`, `tool-icon`,
`tool-description`, `tool-disabled-reason`, `footer`

**Themeable custom properties:** `--lr-tool-select-dialog-overlay-color` (default `rgb(0 0 0 / 0.5)` —
the backdrop scrim color; component-specific since no shared overlay token exists, mirrors
`<lr-dialog>`'s/`<lr-tool-result-dialog>`'s identical pattern), plus shared `--lr-space-*`,
`--lr-color-surface/-border/-text/-text-quiet/-warning`, `--lr-radius`, `--lr-shadow`,
`--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none — internally renders `<lr-checkbox>` and `<lr-switch>`, both bundled
dependencies of this package imported directly, not optional peers.

```html
<lr-tool-select-dialog
  label="Select tools"
  .tools=${[
    { id: 'search', name: 'Web search', category: 'Research' },
    { id: 'python', name: 'Python', category: 'Code', description: 'Run sandboxed Python' },
    { id: 'admin', name: 'Admin console', disabled: true, disabledReason: 'Requires admin approval' },
  ]}
  .selected=${enabledToolIds}
  ?use-defaults=${usingDefaults}
  ?open=${dialogOpen}
  @lr-change=${(e) => updateTools(e.detail.selected, e.detail.useDefaults)}
  @lr-close=${() => (dialogOpen = false)}
>
  <button slot="footer" @click=${(e) => e.target.closest('lr-tool-select-dialog').close('done')}>
    Done
  </button>
</lr-tool-select-dialog>
```

`useDefaults` is a single top-level switch: while `true`, every per-tool checkbox renders disabled
(still reflecting whatever `selected` holds — populate that with the actual default tool set whenever
`useDefaults` is true) alongside a hint explaining that turning the switch off is how to customize.
Turning it off is the only control that both flips `useDefaults` to `false` *and* unlocks the per-tool
checkboxes for editing.

**Known gotchas:**
- No built-in footer/close button — dismissal happens via Escape, a backdrop click, or a consumer's own
  `footer`-slotted action calling `close()` directly.
- A row is effectively disabled whenever *either* its own `tool.disabled` is true *or* the top-level
  `useDefaults` switch is on — a tool without `disabled` set can still render as a locked checkbox while
  `useDefaults` is true.
- `disabledReason` text only renders when both `tool.disabled` and `tool.disabledReason` are set.
- Categories are grouped in first-seen order across `tools`; an empty/whitespace-only `category` folds
  into a trailing "Other" bucket that's always rendered last. A category left with zero matches after
  filtering is dropped entirely, not rendered as an empty heading.
- Reconnecting the element while still `open` (e.g. a drag-and-drop reparent that keeps the same
  instance) resumes its shared overlay registration and re-acquires the scroll lock dropped in
  `disconnectedCallback`.
- The search input is the first focusable element in the panel and receives focus automatically on open.

---

## `lr-thinking-panel`

A collapsible panel for an AI agent's intermediate reasoning/"thinking" transcript, kept visually
and semantically distinct from its final response. First-party invention (no Web Awesome
equivalent). Same collapsible header-button-plus-region shape as `<lr-source-list>`; the default
slot is entirely free-form (a consumer-composed `<lr-streaming-text>`, `<lr-markdown>`, or
plain text) — this component has no dependency on either.

**Properties:**
- `label: string = 'Thinking'`
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

**Events:** `lr-toggle` (`detail: { expanded: boolean }`, same event name and shape as
`<lr-source-list>`'s own `lr-toggle`) — fired whenever the header button is activated.

**Slots:** default (the reasoning/thinking content; entirely free-form)

**CSS parts:** `base`, `header`, `label`, `duration`, `toggle`, `body`

**Themeable custom properties:** `--lr-thinking-panel-max-block-size` (default `16rem` —
consumer-overridable cap on how tall `[part="body"]` grows before it scrolls internally; not
exposed as a component property since it's a pure layout knob, not something a template branches
on), plus shared `--lr-color-border`/`-surface`/`-text`/`-text-quiet`/`-brand`/`-brand-quiet`,
`--lr-space-xs`/`-s`/`-m`, `--lr-radius`, `--lr-focus-ring-width`/`-color`/`-offset`,
`--lr-transition-fast`/`-base`.

**Optional peer deps:** none.

```html
<lr-thinking-panel label="Reasoning" mode="live" expanded>
  <lr-streaming-text content="Considering the user's constraints…" streaming></lr-streaming-text>
</lr-thinking-panel>

<lr-thinking-panel label="Reasoning" mode="post-hoc" duration-ms="4200">
  <p>Finished reasoning, collapsed by default.</p>
</lr-thinking-panel>
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
  *other* half already holds: an `expanded` transition to `true` while `mode` is already `'live'`,
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
behind a count-labeled toggle. Falls back to verbatim raw text when nothing parses. First-party
invention (no Web Awesome equivalent).

**Properties:**
- `trace: string = ''` — the raw stack trace text to parse and render.
- `collapseInternal: boolean = true` (attribute: `collapse-internal`) — folds runs of internal
  frames behind a toggle.
- `internalPatterns: (string | RegExp)[] = DEFAULT_INTERNAL_PATTERNS` (attribute: false) —
  file-path substrings/`RegExp`s that mark a frame as internal.
- `copyable: boolean = true` — shows a copy-to-clipboard button for the raw trace text.
- `maxHeight: string = ''` (attribute: `max-height`) — caps the rendered block size and enables an
  internal scrollbar once content exceeds it (any valid CSS length). Empty string (the default)
  grows with content.
- `appearance: 'card' | 'plain' = 'card'` (reflected) — visual chrome, mirroring `lr-card`'s
  `appearance` vocabulary. `'card'` keeps the bordered, filled, padded box. `'plain'` removes the
  border, background, padding and corner radius, so a trace nested inside an
  `lr-result-card`/`lr-agent-run` — which already draws a border — doesn't double the frame. The
  `max-height` scroll cap and the copy/frame affordances are unaffected either way.

**Events:**
- `lr-frame-select` (`detail: { file?: string; line?: number; column?: number; raw: string }`) —
  a frame was activated. `column` is always undefined for Python frames, which carry no column
  information.
- `lr-copy` (`detail: { text: string }`) — the raw, unparsed trace text, fired on copy-button
  activation regardless of whether the clipboard write actually succeeded.

**Slots:** none.

**CSS parts:** `base` (the root wrapper; respects `max-height`, and drops its card chrome under
`appearance="plain"`), `message` (the leading error
message text for a group), `group` (one chained-error group of frames), `frame` (a single frame
button; carries `data-internal` for internal frames), `frame-function` (the frame's function
name), `frame-location` (the frame's `file:line:col` text), `internal-toggle` (the collapse/expand
toggle for a run of internal frames), `raw` (the verbatim fallback when zero structured frames
parsed), `copy-button` (only rendered while `copyable`).

**Themeable custom properties:** `--lr-stack-trace-max-height` (default `none`),
`--lr-stack-trace-font` (default `var(--lr-font-mono)`), plus shared tokens
`--lr-color-border`/`-surface`/`-text`/`-text-quiet`/`-brand`, `--lr-radius`,
`--lr-border-width-thin`, `--lr-space-xs`/`-s`/`-2xs`, `--lr-font-size-sm`/`-xs`,
`--lr-font-weight-bold`/`-semibold`, `--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-stack-trace></lr-stack-trace>
<script type="module">
  const stackTrace = document.querySelector('lr-stack-trace');
  stackTrace.trace = 'TypeError: boom\n    at doThing (/app/src/util.js:10:5)';
  stackTrace.addEventListener('lr-frame-select', (e) => console.log(e.detail.file, e.detail.line));
</script>
```

The package root also exports the pure `parseStackTrace(trace: string, internalPatterns: (string |
RegExp)[]): StackGroup[]` helper (plus `DEFAULT_INTERNAL_PATTERNS`, and the `StackFrame`/
`StackGroup` types) — the same parsing function this component's own `willUpdate()` calls, exposed
standalone so a consumer can parse or unit-test traces without instantiating the element at all.

**Known gotchas:**
- an internal-frame run only collapses behind the `internal-toggle` when it is two or more
  consecutive internal frames; a single isolated internal frame renders as a normal `frame` button
  (there is nothing useful to fold).
- when `trace` doesn't match any of the supported formats, `parseStackTrace()` returns `[]` and the
  component renders the text verbatim in a `raw` part instead of silently dropping content.

---

## `lr-tool-approval-dialog`

A human-in-the-loop gate: presents one proposed tool/function call (`toolName` + `args`) and blocks an
agent from executing it until a person explicitly approves or denies it, with an optional inline
"edit the arguments before approving" step. First-party invention (no Web Awesome equivalent). It
keeps its own panel template rather than nesting `<lr-dialog>`, so it has no dependency on the
general-purpose dialog component, while its modal behavior participates in the shared overlay stack.

Approve/Deny/Edit are built-in chrome, not a `footer` slot a consumer must assemble — there is exactly
one correct action set for "approve this call". The `footer` slot is offered only for *supplementary*
content alongside those buttons (e.g. a "remember this choice for this tool" checkbox); its content
renders at the start of the action row, before Deny/Edit/Approve.

**Exported types:**
- `ToolApprovalDialogCloseReason = 'escape' | 'backdrop' | 'approve' | 'deny' | 'api' | string` — the
  `lr-close` detail; `'escape'`/`'backdrop'`/`'approve'`/`'deny'` come from the dialog's own built-in
  dismiss triggers, any other string is whatever a caller passes to `close()` directly.

**Properties:**
- `open: boolean = false` (reflected) — set this (or call `close()`) to dismiss; there is no separate
  `show()`/`hide()` pair
- `accessibleLabel: string | null = null` (attribute `aria-label`) — directly names the internal
  dialog panel; otherwise the tool-name heading supplies `aria-labelledby`. Mirrors
  `<lr-tool-result-dialog>`'s/`<lr-tool-select-dialog>`'s own host-`aria-label` override pattern; fed
  only by a host `aria-label`
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
  `<textarea>` while editing; the defaults keep browser editing assistance from changing JSON text

**Methods:** `close(reason: ToolApprovalDialogCloseReason = 'api'): void` — closes the dialog, emits
`lr-close` with `reason`, and returns focus to whatever had it before the dialog opened; a no-op if
already closed.

**Events:** `lr-approve` (`detail: { args: unknown }` — the current, already-parsed arguments: the
original `args` prop, or the user's edited-and-validated version if an edit was in progress; always
followed by `lr-close` with reason `'approve'`), `lr-deny` (no detail — `this.emit('lr-deny')` is
called with no second argument, so per the DOM spec's `CustomEventInit` default, `event.detail` is
`null`, not `undefined`; always followed by `lr-close` with reason `'deny'`), `lr-close`
(`detail: ToolApprovalDialogCloseReason` — fired exactly once per dismissal, via Escape, a backdrop
click, the Approve/Deny buttons, or a `close()` call)

**Slots:** `footer` — optional supplementary content (e.g. a "remember this choice" checkbox),
rendered before the built-in Deny/Edit/Approve buttons.

**CSS parts:** `backdrop`, `panel`, `header`, `tool-name`, `body`, `args-view`, `args-editor`, `error`,
`footer`, `deny-button`, `edit-button`, `approve-button`

**Themeable custom properties:** `--lr-tool-approval-dialog-overlay-color` (default
`rgb(0 0 0 / 0.5)` — the backdrop scrim color; component-specific since no shared overlay token
exists), `--lr-tool-approval-dialog-mono-font` (default `ui-monospace, SFMono-Regular, Menlo,
Consolas, monospace` — used by both `tool-name` and the raw-JSON editor), plus shared tokens
`--lr-space-xs/-s/-m/-l`, `--lr-color-surface`, `--lr-color-border`, `--lr-radius`,
`--lr-shadow`, `--lr-color-brand`, `--lr-color-on-brand`, `--lr-color-danger`,
`--lr-color-text`, `--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none — internally renders `<lr-json-viewer>`, a bundled dependency of this
package, not an optional peer.

```html
<lr-tool-approval-dialog
  tool-name="send_email"
  .args=${{ to: 'ops@example.com', subject: 'Deploy finished' }}
  @lr-approve=${(e) => runTool(e.detail.args)}
  @lr-deny=${() => console.log('denied')}
  @lr-close=${(e) => console.log('closed:', e.detail)}
></lr-tool-approval-dialog>
<script type="module">
  document.querySelector('lr-tool-approval-dialog').open = true;
</script>
```

While `editable`, an Edit button swaps the read-only `<lr-json-viewer>` for a plain `<textarea>`
pre-filled with `JSON.stringify(args, null, 2)`. Every keystroke re-validates with `JSON.parse` — the
Approve button is `disabled` for as long as the current textarea content fails to parse, so a
malformed edit can never be silently approved as either the broken text or a stale copy of the
original args. The same button relabels to "Cancel" while editing; clicking it discards the draft
entirely and returns to the read-only view of the *original* `args` — there is no separate "save"
step independent of Approve itself. Both `editing` and any in-progress draft reset back to the
read-only view every time the dialog transitions from closed to open, so a reused instance never
leaks one proposal's half-finished edit into the next.

Initial focus deliberately does *not* land on Approve: approving a tool call is a consequential,
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
- the raw-JSON `args-editor` textarea always hardcodes `spellcheck="false"`, `autocapitalize="off"`,
  and `autocorrect="off"` — not exposed as configurable properties, unlike `<lr-textarea>`'s/
  `<lr-chat-composer>`'s passthrough props — since its content is always JSON, never prose; without
  this a mobile browser (notably iOS Safari, which defaults textarea `autocapitalize` to
  `'sentences'`) could auto-capitalize or auto-correct key/value text as the user edits, silently
  corrupting the JSON.

---

## `lr-tool-param-form`

Renders one form control per top-level property of a JSON Schema object, for ad hoc tool invocation or
approval-editing UIs (e.g. "the agent wants to call `create_event(title, attendees, allDay)` — let the
user tweak the arguments before running it"). First-party invention (no Web Awesome equivalent).

**Supported schema subset:** a *flat* object whose properties use one primitive `type`
(`'string'`, `'number'`, `'integer'`, or `'boolean'`), `required` property presence, string `enum`,
primitive `const`, and the `title`/`description`/`default` annotations. Nested objects, arrays, type
unions, `oneOf`/`anyOf`/`allOf`, `$ref`, string/numeric constraints, and schema-valued
`additionalProperties` are not interpreted. An unsupported property type renders a visible fallback
and makes the form invalid instead of being silently accepted.

**Exported types:**
- `ToolParamFormPropertyType = 'string' | 'number' | 'integer' | 'boolean'` — the four leaf property
  types this renderer understands
- `ToolParamFormPrimitive = string | number | boolean` — values accepted by the supported `const`
- `ToolParamFormProperty { type: ToolParamFormPropertyType; enum?: string[]; description?: string;
  title?: string; default?: unknown; const?: ToolParamFormPrimitive }` — one `schema.properties`
  entry. `enum` is only meaningful when `type` is `'string'` (rendered as a `<lr-select>`); `const`
  enforces one exact primitive value; `title` is the display label; `description` is helper text;
  `default` pre-fills a field whenever `value` doesn't already have that key.
- `ToolParamFormSchema { type: 'object'; properties: Record<string, ToolParamFormProperty>; required?:
  string[] }` — the (intentionally flat) schema shape this component can render.

**Properties:**
- `schema: ToolParamFormSchema = { type: 'object', properties: {} }` (attribute: false)
- `value: Record<string, unknown> = {}` (attribute: false) — exactly what the consumer last set it to.
  A field with no entry in `value` but a schema `default` *displays* (and is *emitted*, via
  `lr-input`) as that default, but the `value` property itself is left alone until the user actually
  edits that field. JSON Schema ordinarily treats `default` as an annotation; this renderer
  deliberately materializes it before validation/submission, so a valid default can satisfy
  `required`.
- `name: string = ''` — submission key for optional native `<form>` participation
- `disabled: boolean = false` (reflected)

**Getters:**
- `effectiveValue: Record<string, unknown>` — `value` with every property missing from it filled in
  from `schema`'s own `default`; this is what actually renders and what `lr-input`'s detail carries.
  A key the user has explicitly cleared (a real own property set to `undefined`) stays cleared rather
  than snapping back to its default — only a key genuinely absent from `value` falls back.
- `errors: Record<string, string>` — the current per-field validation errors (`{ [propertyKey]:
  message }`) for required presence, primitive type, finite number/integer, enum, const, and
  unsupported type; independent of which fields have been visited.
- `formError: string` — a schema-wide/JSON-serialization error that has no honest field key; empty
  when the current effective value is safe to submit.

**Methods:**
- `checkValidity(): boolean` — synchronously re-snapshots even an in-place-mutated value/schema,
  updates `ElementInternals`, and returns validity without revealing inline errors.
- `reportValidity(): boolean` — performs the same resynchronization, reveals all current field/root
  errors, focuses the first invalid generated field when one exists, and delegates to native
  `ElementInternals.reportValidity()`.

**Events:** `lr-input` (`detail: { value: Record<string, unknown> }` — the full current value
object, every property with defaults resolved, not just the field that changed), `lr-validity-change`
(`detail: { valid: boolean; errors: Record<string, string> }` — fired whenever overall validity or
the field-error set changes, including once up front at connect time; serialization-only failures
set `valid: false` while `formError`, rather than a fabricated field key, carries the root message)

**Slots:** none.

**CSS parts:** `base`, `field`, `label`, `description`, `error`, `unsupported`, `empty`

**Themeable custom properties:** no component-specific custom properties; shared tokens only —
`--lr-space-l/-xs/-s`, `--lr-color-border`, `--lr-radius`, `--lr-color-surface`,
`--lr-color-danger`, `--lr-color-text-quiet`, `--lr-focus-ring-width/-color/-offset`,
`--lr-opacity-disabled`.

**Optional peer deps:** none — internally renders `<lr-select>`, `<lr-option>`, and
`<lr-checkbox>`, all bundled dependencies of this package imported directly, not optional peers.

```html
<lr-tool-param-form
  .schema=${{
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Title' },
      attendees: { type: 'string', enum: ['team', 'everyone'], default: 'team' },
      allDay: { type: 'boolean', title: 'All day' },
    },
    required: ['title'],
  }}
  .value=${draftArgs}
  @lr-input=${(e) => (draftArgs = e.detail.value)}
  @lr-validity-change=${(e) => (formIsValid = e.detail.valid)}
></lr-tool-param-form>
```

This component owns no Submit/Cancel/Approve chrome — a consumer composes it inside their own dialog
(e.g. `<lr-tool-approval-dialog>`) and reads `.value`/`.errors`/`checkValidity()` (or calls
`reportValidity()` right before acting). Fields render in `Object.keys(schema.properties)` order
(insertion order). A `'string'` property with a non-empty `enum` renders as a `<lr-select>` of
`<lr-option>`s; a plain `'string'` renders a text `<input>`; `'number'`/`'integer'` render a numeric
`<input type="number">` (`step="1"` for integer, `step="any"` for number); `'boolean'` renders a
`<lr-checkbox>` with the field's label projected into its default slot — real slotted content, since
that's `<lr-checkbox>`'s documented way to give itself an accessible name, unlike `aria-describedby`
(neither `<lr-select>` nor `<lr-checkbox>` forward a host-level `aria-describedby` to their
internal focusable element, so for the enum-select case the error message is folded into `aria-label`
instead, alongside the always-visible adjacent `[part="description"]` text). The outer component owns
schema validity rather than forwarding HTML `required` constraints: JSON Schema `required` means an
own property is present, so `''`, `0`, and `false` are valid present values. Use
`{ type: 'boolean', const: true }` together with `required` for a must-confirm checkbox.

Optional native `<form>` participation is implemented via `ElementInternals` attached directly in the
constructor (`static formAssociated = true`) rather than a string-value mixin, since this component's
value is a whole object: `formResetCallback()` clears `value`/touched state back to `{}`, and
`formDisabledCallback(disabled)` tracks inherited fieldset state separately from the author-owned
`disabled` property. JSON serialization is guarded: circular values, `BigInt`, throwing getters/`toJSON`, and
non-finite numbers cannot escape from an assignment or leave stale form data; the form entry is
temporarily removed and `formError`/custom validity are set until a serializable value replaces it.
This is layered on top of the primary `value` + `lr-input`/`lr-validity-change` contract.
The same safe serialized object is used as session-history/autofill state. Restoration accepts only
a JSON object, falls back to `{}` for malformed/non-object state, and does not emit `lr-input`.

**Known gotchas:**
- a schema property whose `type` isn't `'string'`/`'number'`/`'integer'`/`'boolean'` renders an inline
  "Unsupported field type" message (a plain `.unsupported`-classed element, not one of the documented
  CSS parts) and fails closed with custom validity instead of throwing or being silently dropped.
- inline per-field errors only render once a field has been visited (`focusout`) at least once, or
  after an explicit `reportValidity()` call — `checkValidity()` alone never reveals them, matching
  every other form control in this library (`<lr-select>`/`<lr-combobox>`/`<lr-model-select>`
  all avoid flashing red before the user has touched anything).
- `effectiveValue` distinguishes "key absent from `value`" (falls back to `default`) from "key present
  but `undefined`" (stays cleared and counts as absent for `required`) via `hasOwnProperty`, not an
  `=== undefined` fallback check.
- additional value keys are retained and submitted (matching JSON Schema's default open-object
  behavior), but schema-valued/false `additionalProperties` is outside this renderer's subset.
- reassign `value`/`schema` after changing them. Direct in-place mutation is resnapshotted by the
  component's own `checkValidity()`/`reportValidity()`, but native `form.checkValidity()` and
  submission use the last synchronized snapshot because the browser cannot observe arbitrary object
  mutation.
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
- `title: string = ''` — small heading for the card. Leave unset for an untitled card (e.g. a bare
  block of `lr-result-field` rows with no natural heading).
- `compact: boolean = false` (reflected) — tighter header/body padding for dense contexts (a card
  rendered as a row in a transcript or result list), same convention as `<lr-agent-run>`'s own
  `compact`. Purely a density knob: the border and background stay, so use `appearance="plain"`
  instead to drop the chrome entirely.
- `appearance: 'card' | 'plain' = 'card'` (reflected) — mirrors `lr-card`'s/`<lr-agent-run>`'s
  `appearance` vocabulary. `'card'` (the default) keeps the bordered, filled box. `'plain'` removes
  the border, background, and corner radius, so a card nested inside a host frame that already draws
  a border (e.g. `<lr-tool-result-view>`'s own chrome) doesn't double it. `plain` wins over `compact`
  when both are set (nothing left to tighten).

**Events:** none.

**Slots:** default (the card body — typically one or more `lr-result-field` rows, though any
content is accepted), `actions` (small header controls, e.g. a copy button, rendered alongside the
title).

**CSS parts:** `base` (outer bordered container), `header` (present in the DOM at all times so a
later `slotchange` on `actions` is still observed, but `hidden` whenever there's no `title` and no
`actions` content), `title` (truncates with an ellipsis when it overflows; carries its own native
`title` attribute — the full string — so hovering the truncated text reveals it via the browser's
default tooltip, scoped to just this element rather than the whole card), `actions` (`hidden`
whenever the slot has no assigned content), `body`.

**Themeable custom properties:** `--lr-result-card-compact-header-padding` (default
`var(--lr-space-xs)`) — `[part="header"]` block/inline padding while `compact`;
`--lr-result-card-compact-body-padding` (default `var(--lr-space-xs)`) — `[part="body"]` padding
while `compact`; plus shared tokens — `--lr-space-xs`/`-s`, `--lr-color-border`/`-surface`/`-text`,
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
assigned *element* (even one with no text of its own, like an attribute-driven status badge) or any
non-whitespace text node — both a rich slotted badge and a plain-text override are caught.

**CSS parts:** `base` (row container), `label` (including its trailing colon), `value` (wrapper
around either the slotted content or the plain `value` text).

**Themeable custom properties:** shared tokens only — `--lr-space-xs`, `--lr-color-text`/
`-text-quiet`, `--lr-font`.

**Optional peer deps:** none (either component).

```html
<lr-result-card title="Weather">
  <lr-result-field label="Status" value="200 OK"></lr-result-field>
  <lr-result-field label="Duration" value="340ms"></lr-result-field>
  <lr-result-field label="Provider">
    <lr-chip tone="success">OpenWeather</lr-chip>
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
(attribute `item-id`) — an opaque id round-tripped through `lr-vote`. `hideTie: boolean = false`
(attribute `hide-tie`) and `hideBothBad: boolean = false` (attribute `hide-both-bad`) hide the
corresponding vote button. `syncScroll: boolean = false` (attribute `sync-scroll`) links both panes'
scroll position.

**Slots:** `a` (the first output — any content, a chat message, markdown, a viewer), `b` (the second
output), and `prompt` (optional shared-input header above both panes).

**Events:** `lr-vote` — `detail: { choice: 'a' | 'b' | 'tie' | 'both-bad'; itemId: string }`.

**CSS parts:** `base` (the outer wrapper), `prompt` (the optional prompt header, hidden when the
`prompt` slot is empty), `panes` (the row, or under 640px column, wrapping both panes), `pane-a`,
`pane-b` (each pane's labeled scroll region), `pane-header` (a pane's visible heading), `vote-bar`
(the `role="group"` row of vote buttons), `vote-button` (one vote button), and `live-region` (the
internal vote-announcement live region).

**Themeable custom properties:** `--lr-compare-panel-max-height` (default `var(--lr-size-24rem)`) —
cap on each pane's scroll region before it scrolls internally.

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
projection via `parentId`) — never two shapes. `activeSpanId: string | null = null`
(attribute `active-span-id`), `viewStartMs: number | null = null` (attribute `view-start-ms`) and
`viewEndMs: number | null = null` (attribute `view-end-ms`) — override the auto-computed time
window, `hideAxis: boolean = false` (attribute `hide-axis`), and `label: string = ''`.

**Events:** `lr-span-select` — `detail: { id: string }`, a bar/row was activated (click, Enter,
Space).

**CSS parts:** `base`, `axis` (the time-ruler row, hidden when `hideAxis`), `tick`, `tick-label`,
`row`, `name` (the row's name gutter), `bar-track`, `bar` (the interactive, focusable status-toned
bar), `meta` (secondary row info, shown inline under 480px), `status-text`, `duration`, `empty` (shown
when `spans` is empty), and `live-region`.

**Themeable custom properties:** `--lr-span-waterfall-name-width` (default `8rem`),
`--lr-span-waterfall-stripe-speed` (a `running` span's striped-bar animation duration; defaults to
`--lr-transition-ambient`), and `--lr-span-waterfall-row-active-bg` (default
`var(--lr-color-brand-quiet)`) — the background of the active (`activeSpanId`) row.

That last one follows the convention every **state-scoped** custom property in this family uses, and
it is worth reading once: it is an inline `var()` fallback at its point of use and is deliberately
**not** declared on `:host`, so it can be set on the element *or on any ancestor* and still reach the
rule that consumes it. It exists because Shadow Parts forbids an attribute selector after `::part()`
— `::part(row)[data-active]` and every selector like it is invalid CSS — so before it, the only way
to restyle a state-dependent surface was to override a library-wide `--lr-color-*` token, which repaints
every other surface reading that token. Every `*-active-*`, `*-selected-*` and per-state color
property below works the same way.

## `lr-task-list`

A live, collapsible tracker for an agent's plan: ordered steps with per-step lifecycle status and one
level of nested sub-steps, embedded in the transcript. `items` is controlled and never mutated by this
component. Unlike `<lr-stepper>`'s single-`current` navigation, task-list is a read-only status
report: several steps may be `running` at once, there is no selection, and status changes are
announced through an internal `<lr-live-region>`.

**Properties:** `items: TaskItem[] = []` (attribute: false) — `TaskItem { id: string; label: string;
status: TaskStatus; detail?: string; children?: TaskItem[] }` with `TaskStatus = 'pending' |
'running' | 'success' | 'error'` (both exported here). `detail` is an optional secondary plain-text
line; `children` is exactly **one** level of sub-steps — a child's own `children` is ignored with a
`console.warn`. `label: string = 'Tasks'`, `expanded: boolean = true` (reflected), and
`collapsible: boolean = true`. `compact: boolean = false` (reflected) — tighter header/body padding
and item gap for dense contexts (a plan tracker nested in an already-padded transcript row), same
convention as `<lr-agent-run>`'s/`<lr-source-card>`'s `compact`; purely a density knob, the border
and background stay. `appearance: 'card' | 'plain' = 'card'` (reflected) — mirrors `lr-card`'s
`appearance` vocabulary; `'plain'` removes `[part="base"]`'s border, background, and corner radius so
a list embedded in a frame that already draws a border (an agent-run panel, a message bubble) doesn't
double it.

**Slots:** `detail-<id>` — dynamic, one per item id (e.g. `slot="detail-step-3"`); rich detail under
that item's label, typically a `<lr-tool-call-chip>` or file `<lr-chip>`.

**Events:** `lr-toggle` — the header was activated, expanding or collapsing the panel. `detail: {
expanded }`.

**CSS parts:** `base`, `header` (a `<button>` when `collapsible`, a plain heading otherwise), `label`,
`summary` (the visible "N of M completed" summary, top-level items only), `toggle` (the chevron
indicator, only rendered when `collapsible`), `body` (the list of items, `hidden` while collapsed),
`item` (`role="listitem"`; carries `data-status`/`data-id`/`data-depth`), `status-icon`, `item-label`,
`item-detail`, and `item-children` (the nested `role="list"` wrapper around a top-level item's
children).

**Themeable custom properties:** `--lr-task-list-spin` (default `1s linear`) — running-status icon
spin animation duration/timing; `--lr-task-list-compact-header-padding` (default
`var(--lr-space-2xs) var(--lr-space-s)`) — `[part="header"]` padding while `compact`;
`--lr-task-list-compact-gap` (default `var(--lr-space-2xs)`) — gap between `[part="body"]`'s item
rows while `compact`; `--lr-task-list-compact-body-padding` (default `var(--lr-space-2xs)
var(--lr-space-s) var(--lr-space-s)`) — `[part="body"]` padding while `compact`.

## `lr-terminal`

A read-only ANSI console for streamed agent/tool output. Not a PTY: no stdin/keystroke handling, no
cursor-addressed full-screen apps.

**Properties:** `content: string = ''` — initial/replaceable buffer content, parsed for ANSI/SGR
codes. `maxScrollback: number = 5000` (attribute `max-scrollback`), `follow: boolean = true`
(reflected) — stick-to-bottom, `wrap: boolean = true` (reflected), `copyable: boolean = true`
(reflected) and `downloadable: boolean = false` (reflected) toggle the toolbar buttons, `filename:
string = 'terminal.log'`, `announceOutput: boolean = false` (attribute `announce-output`),
`accessibleLabel: string = ''` (attribute `aria-label`), `highlights: LyraHighlight[] = []` (attribute:
false), and `activeHighlightId: string | null = null` (attribute: false). `anchorKinds` is a readonly
`['page', 'text-quote', 'region']` for the shared anchor-target contract.

**Methods:** `write(text)` appends ANSI-parsed text to the buffer. `clear()` empties the buffer.
`scrollToBottom()` and `scrollToAnchor(anchor)` control scroll position. `search(query)`,
`searchNext()`, `searchPrevious()`, and `clearSearch()` drive in-buffer text search. `getPlainText()`
returns the SGR-stripped plain text of the whole buffer.

**Events:** `lr-copy` (`detail: { text }`), `lr-download` (`detail: { filename }`),
`lr-follow-change` (`detail: { following }`), `lr-search-change` (`detail: { query, matchCount,
activeIndex }`), `lr-highlight-activate` (`detail: { id }`), and `lr-text-select` (`detail: {
text, anchor, rects }`).

**CSS parts:** `base`, `toolbar` (only rendered when copy/download are enabled), `copy-button`,
`download-button`, `viewport` (the `role="log"` scrollable region), `line` (one rendered line; carries
`data-line-number`/`data-match`/`data-highlight-tone`, and is forwarded via `exportparts` so
`lr-terminal::part(line)` reaches the rendered lines from a consumer stylesheet despite them living
in the internal `<lr-virtual-list>`'s shadow root), `jump-to-latest` (shown while `follow` is
disengaged and new output has arrived), and `announcer` (the visually-hidden `role="status"` region
used when `announce-output` is set).

**Themeable custom properties:** `--lr-terminal-height` (default `var(--lr-size-20rem)`) — the
viewport's block size; not declared on `:host`, so it is inherited from the host or any ancestor.
`--lr-terminal-highlight-accent-bg` (default `var(--lr-color-brand-quiet)`),
`--lr-terminal-highlight-success-bg` (default `var(--lr-color-success-quiet)`),
`--lr-terminal-highlight-warning-bg` (default `var(--lr-color-warning-quiet)`),
`--lr-terminal-highlight-danger-bg` (default `var(--lr-color-danger-quiet)`), and
`--lr-terminal-highlight-neutral-bg` (default `var(--lr-color-surface)`) — the background of a
`highlights[]` entry of the matching `tone`. Each is decoupled from the identical shared token it
falls back to (e.g. `accent`'s `--lr-color-brand-quiet` is also the copy/download-button hover tint)
so retinting one tone doesn't repaint the other surface reading that token, and from any
`::part('line')` stylesheet override — the background is applied inline, so a stylesheet rule can't
beat it without `!important`.

## `lr-trace-tree`

A collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith run-tree style): kind icon,
name, status, an inline duration bar on the shared trace time scale, and optional tokens/cost
columns. Consumes the same `LyraSpan[]` as `<lr-span-waterfall>`.

**Properties:** `spans: LyraSpan[] = []` (attribute: false) — the same `LyraSpan` shape documented
under `lr-span-waterfall` above (exported from `trace-tree/span.ts`); hierarchy comes from
`parentId`, and a span whose `parentId` is missing or doesn't resolve within the same array renders
as a root rather than being dropped. `activeSpanId: string | null = null`
(attribute `active-span-id`), `label: string = ''`, `showTokens: boolean = false` (attribute
`show-tokens`) — surfaces `tokensIn`/`tokensOut`, `showCost: boolean = false` (attribute
`show-cost`) — surfaces `costText`, and `hideBars: boolean = false` (attribute `hide-bars`).

**Methods:** `expandAll()` and `collapseAll()` set every row's expanded state at once.

**Events:** `lr-span-select` (`detail: { id: string }`, a row was activated) and `lr-span-toggle`
(`detail: { id: string; expanded: boolean }`, a row was expanded or collapsed).

**CSS parts:** `base` (`role="tree"`), `header` (the column-header row, only when
`showTokens`/`showCost`), `row` (`role="treeitem"`), `toggle`, `icon`, `name`, `detail`, `status-text`,
`duration`, `tokens-in`, `tokens-out` (when `showTokens`), `cost` (when `showCost`), `bar-track`,
`bar`, `empty` (shown when `spans` is empty), and `live-region`.

**Themeable custom properties:** `--lr-trace-tree-row-active-bg` (default
`var(--lr-color-brand-quiet)`) — the background of the active (`activeSpanId`) row — and
`--lr-trace-tree-row-active-color` (default `var(--lr-color-text)`) — the color of that row's
secondary text (`detail`, `duration`, `tokens-in`, `tokens-out`, `cost`, and the `pending`
`status-text` label). Same state-scoped-property convention described under `lr-span-waterfall`
above: an inline `var()` fallback rather than a `:host` declaration, so either can be set on the
element or any ancestor, and they exist because `::part(row)[data-active]` is invalid CSS.

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

## `lr-activity-feed`

An append-only streaming log of granular agent actions ("Searching the web…", "Read
src/index.ts"), collapsing to a localized "Completed N steps" summary once the run is over. Entries
never change state once added — a step whose status mutates in place belongs to `<lr-task-list>`
instead. Implements the shared follow (stick-to-bottom) contract. At/above `virtualizeThreshold`
entries, the body renders through an internal `<lr-virtual-list>` instead of a plain keyed list.

**Properties:** `entries: ActivityEntry[] = []` (attribute: false) — `ActivityEntry { id: string;
text: string; icon?: string; timestamp?: Date | string; tone?: ActivityEntryTone }` (exported here).
`icon` is a literal glyph hint (e.g. an emoji), the same convention `lr-tool-call-chip.icon` uses; a
small tone dot renders in its place when omitted. `ActivityEntryTone = 'neutral' | 'brand' |
'success' | 'warning' | 'danger'` (the same vocabulary as `ContextMeterTone`). An invalid
`timestamp` string is treated as unset. `mode: 'live' | 'post-hoc' =
'live'` (reflected), `follow: boolean = true` (reflected), `expanded: boolean = false` (reflected),
`label: string = 'Activity'`, `showTimestamps: boolean = false` (attribute `show-timestamps`),
`formatTimestamp?: (date: Date) => string` (attribute: false), `renderText?: (entry: ActivityEntry)
=> TemplateResult` (attribute: false) — overrides the default plain-text `entry-text` rendering with
arbitrary rich content (e.g. rendered markdown, or markdown plus a trailing tool-call chip list),
identically whether or not the feed is currently virtualized; fully replaces `[part="entry-text"]`
rather than augmenting it, and `virtualizeThreshold: number = 200` (attribute
`virtualize-threshold`).

**Events:** `lr-toggle` (`detail: { expanded }`, the header was activated) and
`lr-follow-change` (`detail: { following }`, `follow` released or re-engaged).

**CSS parts:** `base`, `header` (a `<button>`), `status-dot` (pulses while `mode="live"`),
`summary`, `toggle`, `body` (the scrollable region, or the internal virtual-list), `entry` (carries
`data-tone`), `entry-icon`, `tone-dot` (the dot rendered inside `entry-icon` when the entry sets no
literal `icon`), `tone-dot-neutral`/`tone-dot-brand`/`tone-dot-success`/`tone-dot-warning`/
`tone-dot-danger` (each also carries `tone-dot`), `entry-text`, and `entry-timestamp` (only while
`showTimestamps` and a valid `timestamp` is set). Every entry-level part is reachable in both
rendering paths, virtualized or not.

**Themeable custom properties:** `--lr-activity-feed-max-height` (default `16rem`) — cap on how
tall the expanded body grows before it scrolls internally.

**Known gotchas:**
- The tone dot's color is selected by its *part name*, not by `[data-tone]`: `::part()` cannot be
  followed by an attribute selector, so `lr-activity-feed::part(tone-dot)[data-tone='success']`
  never matches. Target `lr-activity-feed::part(tone-dot-success)` instead. `data-tone` remains on
  both the entry and the dot for DOM queries.

## `lr-commit-card`

A compact commit summary (subject, author/time, diffstat, per-file changes) that links file rows out
to a diff view.

**Properties:** `hash: string = ''`, `message: string = ''`, `author: string = ''`, `timestamp?:
number` (attribute: false, epoch milliseconds), `files: CommitFileChange[] = []` (attribute: false) —
`CommitFileChange { path: string; additions: number; deletions: number; status?: GitStatus }`
(exported here), where `GitStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' |
'conflicted' | 'ignored'` (shared with `lr-file-tree`); the diffstat is summed from `additions`/
`deletions` across `files`. `filesCollapsed:
boolean = true` (attribute `files-collapsed`, reflected), and `copyable: boolean = true` (reflected).
`compact: boolean = false` (reflected) — tighter `[part="base"]` padding for a commit rendered as a
row in a list or PR timeline, same convention as `<lr-agent-run>`'s own `compact`; the border stays,
so pair it with `appearance="plain"` to drop the chrome entirely. `appearance: 'card' | 'plain' =
'card'` (reflected) — mirrors `lr-card`'s/`<lr-agent-run>`'s `appearance` vocabulary: `'card'` keeps
the bordered, padded box, `'plain'` removes the border, padding, and corner radius so a commit nested
in a host list that already draws its own row chrome doesn't double it; `plain` wins over `compact`
when both are set.

**Slots:** `actions` — trailing header controls (e.g. an "open PR" button).

**Events:** `lr-file-select` (`detail: { path: string }`), `lr-toggle` (`detail: { collapsed: boolean
}`), and `lr-copy` (`detail: { text: string }`, the full hash was copied).

**CSS parts:** `base`, `subject`, `body`, `hash`, `meta`, `author`, `time`, `diffstat`, `additions`,
`deletions`, `files-toggle`, `file` (carries `data-status`), `file-path`, `file-additions`,
`file-deletions`, `copy-button`, and `actions`.

**Themeable custom properties:** `--lr-commit-card-compact-padding` (default `var(--lr-space-s)`) —
`[part="base"]` padding while `compact`.

## `lr-test-results`

A pass/fail suite summary with per-status counts, status filter toggles, and per-test rows whose
failures auto-expand by default and can host rich slotted detail (e.g. a diff or code block)
alongside the plain failure message.

**Properties:** `suites: TestSuiteResult[] = []` (attribute: false) — `TestSuiteResult { id: string;
name: string; tests: TestCaseResult[] }` and `TestCaseResult { id: string; name: string; status:
TestStatus; durationMs?: number; message?: string }`, with `TestStatus = 'passed' | 'failed' |
'skipped' | 'running'` (all three exported here). `statusFilter: TestStatus[] =
[]` (attribute: false) — empty shows every status; and `autoExpandFailures: boolean = true`
(attribute `auto-expand-failures`).

**Slots:** `detail-{testId}` — rich failure detail for that test, rendered after its plain `message`
text once the row is expanded.

**Events:** `lr-test-select` (`detail: { suiteId: string; testId: string }`, a test row's name was
activated), `lr-filter-change` (`detail: { statuses: TestStatus[] }` — the complete next filter set; the
component updates its own `statusFilter` first, then emits),
and `lr-toggle` (`detail: { id: string; expanded: boolean }`, a row's failure detail was
expanded/collapsed).

**CSS parts:** `base`, `summary` (the status-count strip), `count` (carries `data-status`), `filter`,
`filter-toggle` (carries `data-status`/`aria-pressed`), `suite`, `suite-header`, `test` (carries
`data-status`), `test-status`, `test-name`, `test-duration`, `test-expand-toggle`, `failure`
(hidden while collapsed), and `failure-message`.

**Themeable custom properties:** `--lr-test-results-filter-active-bg` (default
`var(--lr-color-brand-quiet)`), `--lr-test-results-filter-active-border` (default
`var(--lr-color-brand)`) and `--lr-test-results-filter-active-color` (default
`var(--lr-color-brand)`) — the background, border color and text color of a pressed (active) status
filter toggle. All three follow the state-scoped-property convention described under
`lr-span-waterfall`: inline `var()` fallbacks rather than `:host` declarations, so each can be set on
the element or on any ancestor. They exist because
`::part(filter-toggle)[aria-pressed='true']` is invalid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so restyling the pressed state otherwise meant overriding the
library-wide brand tokens.

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
emits nothing). `tone: 'neutral' | 'danger' = 'neutral'` (reflected). `compact: boolean = false`
(reflected) — collapses the bar from a full card (bordered, padded, `display: block` surface) to a
single inline row with no chrome of its own, for a confirmation that has to live inside an existing
container: a table cell, a card's action row, a toolbar. The host becomes `inline-flex`, and the
narrow-allocation `@container` treatment is switched off — a compact bar is *expected* to be narrow,
so stretching the buttons to fill would be exactly wrong. Re-chrome it through the
`--lr-confirm-bar-compact-*` properties below. Everything else is unchanged: the event shapes, the
focus-to-`[part="status"]`-before-unmount contract, and `role="group"` with its heading label.

**Slots:** default — supplementary body content between the heading and the actions (e.g. a
`lr-diff-view`). `footer` — extra content at the start of the action row.

**Events:** `lr-approve` (`detail: { args }` — the `args` prop as-is, identical shape to
`lr-tool-approval-dialog`), `lr-deny` (no detail, identical to the dialog).

**CSS parts:** `base` (`role="group"`), `heading`/`tool-name`, `body`, `args` (the
details/json-viewer wrapper, only rendered when `args` is defined), `footer`, `deny-button`,
`approve-button` (named identically to the dialog's parts), `status` (the decided-state text, always
present in the DOM as a focus landing spot).

**Themeable custom properties:** the `compact` presentation is deliberately chrome-less by default
and re-chromed entirely through five properties, all scoped to `[part="base"]` while `compact`:
`--lr-confirm-bar-compact-padding` (default `0`, any padding shorthand),
`--lr-confirm-bar-compact-gap` (default `var(--lr-space-s)`, the gap between the row's items),
`--lr-confirm-bar-compact-border` (default `none`, any `border` shorthand),
`--lr-confirm-bar-compact-background` (default `transparent`) and
`--lr-confirm-bar-compact-radius` (default `0` — only visible once the border or background is set).
They are inline `var()` fallbacks at their point of use rather than `:host` declarations, so any of
them can be set on the element *or on any ancestor*, which is what makes "give every compact confirm
bar in this panel a hairline border" a one-rule change on the panel.

**Known gotchas:**
- `[part="status"]` is always rendered and must never be given `display: none`. Deciding moves focus
  to it synchronously, before the Deny/Approve buttons unmount, so hiding it would drop focus to
  `<body>`. The shipped `:empty` rule on it has never matched, and that is load-bearing.
- `[part="deny-button"]` and `[part="approve-button"]` are raw `<button>` elements, not composed
  `lr-button`s, so `--lr-button-*` theming does not reach them. Style them through their parts.

```html
<lr-tool-call-chip status="pending"></lr-tool-call-chip>
<lr-confirm-bar tool-name="run_shell" .args=${args}
  @lr-approve=${(e) => run(e.detail.args)} @lr-deny=${() => cancel()}
></lr-confirm-bar>
```

## `lr-browser-frame`

Presentational "agent computer" viewport: a screenshot/frame stream (or slotted live media), a
read-only URL display, action-ping overlays, and take-over/stop affordances. No automation transport
(no CDP/WebRTC/WebSocket) and no input relay — take-over is an event; the host swaps in its own
interactive element (e.g. an iframe). No replay scrubber (compose `lr-playback` driving `frame-src`
from a screenshot array); no console/network drawers (compose `lr-terminal`/`lr-json-viewer`); no
pan/zoom of the frame content (slot the image/video inside a `lr-zoomable-frame` instead, though
the pings overlay assumes the unzoomed content box in that composition).

**Properties:** `frameSrc: string = ''` (attribute `frame-src`) — image/MJPEG stream URL rendered as
an `<img>` (safe-URL-gated via `safeMediaSrc`); ignored once the default slot has content. `url:
string = ''` — address shown read-only in the toolbar (`dir="ltr"`, truncating, full value in
`title`). `status: 'idle' | 'connecting' | 'streaming' | 'stalled' = 'idle'` (reflected). `controller:
'agent' | 'user' = 'agent'` (reflected) — who is driving; switches the take-over button's label.
`pings: BrowserPing[] = []` (attribute: false, each `{ id, x, y, kind: 'click' | 'type' | 'scroll' |
'move' }` — `x`/`y` are percent (0–100) of the frame's `object-fit: contain` content box,
letterboxing-aware). `controls: boolean = true` — render the built-in take-over/stop buttons.

**Slots:** default — host-owned live element (e.g. `<video>` or an interactive `<iframe>`), replacing
the `frame-src` image. `actions` — extra toolbar controls.

**Events:** `lr-take-over` — `detail: { controller }`, the *requested* controller (`'user'` when
"Take over" is pressed, `'agent'` when "Hand back" is). `lr-stop` — stop the agent's browser
session, no detail.

**CSS parts:** `base` (`role="group"`), `toolbar`, `url`, `status` (`role="status"`),
`controller-badge`, `actions`, `take-over-button`, `stop-button`, `viewport`, `frame` (the
`frame-src` `<img>`, absent once the default slot is populated), `ping` (one action-ping marker,
carries `data-kind`).

**Themeable custom properties:** `--lr-browser-frame-aspect-ratio` (default `16 / 9`) — the
viewport's aspect ratio.

```html
<lr-browser-frame status="streaming" url="https://example.com" .pings=${pings}
  @lr-take-over=${(e) => setController(e.detail.controller)} @lr-stop=${() => stopSession()}
></lr-browser-frame>
```

## `lr-artifact-panel`

Shell around one agent-generated artifact: a title/kind header, a preview↔code toggle, version
navigation with restore, a streaming indicator, and built-in copy/download actions. Renders none of
the artifact itself — content is slotted. No content rendering of its own (slots own it), no
dialog/dock chrome (compose `lr-dialog`/`lr-dock-panel`/`lr-split`), no version storage or
diffing (host state; diffs via `lr-diff-view`), no code editing (`lr-code-editor`).

**Properties:** `label: string = ''` — the artifact's title, shown in the header. `kind: string = ''`
— a short kind label (e.g. `document`, `code`), shown as a badge next to `label`. `view: 'preview' |
'code' = 'preview'` (reflected) — which slot is currently visible. `versions: ArtifactVersion[] = []`
(attribute: false, each `{ id, label? }`) — the artifact's version history, oldest first; the last
entry is the latest version. `activeVersionId: string | null = null` (attribute
`active-version-id`) — the currently viewed version's id, or `null` for "the latest version."
`streaming: boolean = false` (reflected) — whether the artifact is still being generated; sets
`aria-busy` on the body and shows a text indicator (not animated, so it stays legible under reduced
motion). `copyText: string = ''` (attribute `copy-text`) — the text copied to the clipboard by the
copy button; empty hides the button. `downloadSrc: string = ''` (attribute `download-src`) — the
download URL, sanitized through `safeMediaSrc()`; empty hides the button. `downloadName: string =
''` (attribute `download-name`) — the suggested filename reported in the `lr-download` event
detail.

**Slots:** default — preview-view content (markdown/html-viewer/browser-frame/image). `code` —
code-view content (typically a `lr-code-block`); the preview/code toggle only renders once this
slot has assigned content. `actions` — extra header controls, rendered between the version
navigation and the built-in copy/download buttons.

**Events:** `lr-view-change` (`detail: { view }`), `lr-version-change` (`detail: { versionId }`,
fired when the previous/next navigation moves to a different version), `lr-restore` (`detail: {
versionId }`, fired by the restore-this-version button; mutates nothing itself), `lr-copy`
(`detail: { text }`, after a best-effort clipboard write), `lr-download` (`detail: { filename,
src? }`, with the sanitized download URL).

**CSS parts:** `base`, `header`, `label`, `kind`, `view-toggle` (rendered only once the `code` slot
has content), `view-button` (carries `data-view="preview"` or `data-view="code"`), `version-nav`
(rendered only once `versions` is non-empty), `version-previous`, `version-previous-glyph` (the `‹`
chevron inside `version-previous`, mirrored via `scaleX(-1)` under `:dir(rtl)`), `version-next`,
`version-next-glyph` (the `›` chevron inside `version-next`, mirrored the same way), `version-position`
(the "Version N of M" text), `restore-button` (rendered only while the active version isn't the
latest), `actions`, `copy-button` (rendered only while `copyText` is non-empty), `download-button`
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
<lr-artifact-panel label="report.md" kind="document" .versions=${versions}
  @lr-restore=${(e) => restoreVersion(e.detail.versionId)}>
  <lr-markdown .content=${markdown}></lr-markdown>
  <lr-code-block slot="code" language="markdown" .code=${markdown}></lr-code-block>
</lr-artifact-panel>
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
  number; endedAt?: number; model?: string; costEstimate?: number; steps: AgentStep[] }`, where
  `AgentStatus { kind: AgentStatusKind; message?: string }` and `AgentStep { id: string; kind:
  string; label: string; status: AgentStatus; startedAt?: number; endedAt?: number }`. All timestamps
  are epoch milliseconds; `AgentStep.kind` is deliberately free-form (an agent's own step taxonomy is
  application-defined) — unlike `LyraSpan['kind']`'s closed union. Controlled and never mutated —
  pass a new object to update it. `null` renders the shared `lr-empty` `noData` state
- `metrics: AgentRunMetric[] = []` (attribute: false) — `AgentRunMetric { id: string; label: string;
  value: string | number; variant?: BadgeVariant }` (exported here), e.g. prompt/completion token
  counts; `variant` tones `[part="metric-value"]` via `data-variant`
- `formatCost?: (cost: number) => string` (attribute: false) — overrides the default plain
  `Intl.NumberFormat` rendering of `run.costEstimate` fed to the composed `lr-usage-badge`'s
  `cost-text`; use it to add a currency symbol, which this library never assumes on a host's behalf
- `statusLabels: Record<string, string> = {}` (attribute: false) — labels for *application-defined*
  `AgentStatusKind` values; the nine built-in kinds stay localized by Lyra
- `statusVariants: Record<string, BadgeVariant> = {}` (attribute: false) — badge variants for
  application-defined kinds; unknown kinds default to `neutral`
- `showCancel: boolean = true` (attribute `show-cancel`) / `showRetry: boolean = true` (attribute
  `show-retry`) — whether the built-in buttons may render at all, still gated by the run's own
  status. Both use a `true`-defaulting string converter, so plain-HTML `show-cancel="false"` works; a
  `?show-cancel=${false}` boolean-attribute binding starting from absent markup does not
- `compact: boolean = false` (reflected) — tighter root padding and header/body gap for dense
  contexts (a run rendered as a row in a list, or in a side panel); same convention as `lr-empty`'s
  `compact`. Purely a density knob: the border and background stay, so reach for
  `appearance="plain"` instead when the goal is to drop the chrome entirely
- `appearance: 'card' | 'plain' = 'card'` (reflected) — visual chrome, mirroring `lr-card`'s
  `appearance` vocabulary. `'card'` keeps the bordered, filled, padded box; `'plain'` removes the
  border, background, padding and corner radius, so a run nested inside a host frame that already
  draws a border doesn't double it. `plain` wins over `compact` when both are set — there is no
  padding left to tighten. The built-in Cancel/Retry buttons draw their own border and background
  and stay visibly interactive either way

**Events:** `lr-cancel` (`detail: CancelEventDetail` = `{ reason?: string }`, from
`@aceshooting/lyra-ui/ai`; `reason` is `undefined` from the built-in button), `lr-retry`
(`detail: RetryEventDetail` = `{ attempt: number; messageId?: string }`, same module — `attempt` is
this component's own retry counter, reset when `run.id` changes).

**Slots:** `header` and `summary` replace the corresponding built-in chrome; `tasks`, `tools`,
`reasoning`, `output`, and `actions` are host-controlled composition regions.

**CSS parts:** `base`, `header`, `status`, `status-badge`, `status-message`,
`elapsed` (the live ticker), `elapsed-static` (a terminal run's frozen duration), `summary`, `model`,
`usage`, `current-step`, `current-step-icon`, `current-step-label`, `body`, `tasks`, `tools`,
`reasoning`, `output`, `actions`, `cancel-button`, `retry-button`, `metric-label`, `metric-value`
(carries `data-variant`), `empty`.

**Themeable custom properties:** `--lr-agent-run-spin` (default `1s linear`) — the running-status
spinner icon's rotation duration/timing. `--lr-agent-run-compact-padding` (default
`var(--lr-space-s)`) and `--lr-agent-run-compact-gap` (default `var(--lr-space-s)`) — `[part="base"]`'s
padding, and the gap between its header and body, while `compact`; both are ignored while `compact`
is unset. Like the other density/state properties in this family they are inline `var()` fallbacks at
their point of use rather than `:host` declarations, so either can be set on the element *or on any
ancestor* — one rule on a run list retunes every compact run inside it.

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
  `lr-visibility-change`
- `label: string = ''` — forwarded to the composed `lr-trace-tree`
- `showTokens: boolean = false` (attribute `show-tokens`), `showCost: boolean = false` (attribute
  `show-cost`), `hideBars: boolean = false` (attribute `hide-bars`) — all forwarded verbatim

**Events:** `lr-span-select` (`detail: { id: string }`), `lr-span-toggle` (`detail: { id: string;
expanded: boolean }`), `lr-visibility-change` (`detail: { hiddenTypes: LyraSpan['kind'][] }` — bubbles composed from the
internal `lr-graph-legend`, so the detail key is `hiddenTypes` despite holding span *kinds*, not
graph node-type ids).

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
- `segments: ContextInspectorSegment[] = []` (attribute: false) — `ContextInspectorSegment { id:
  string; label: string; text: string; tokens: number; tone?: ContextMeterTone; citation?: Citation;
  truncated?: boolean; omittedTokens?: number; redactions?: ContextInspectorRedaction[] }` (exported
  here). One entry per piece of the assembled final prompt (system prompt, retrieved chunk, one
  history turn, …). `text` is the segment's **final** text, exactly as sent to the model
  (post-redaction/post-truncation). `tokens` is the estimated count, fed straight to
  `lr-context-meter`'s segment `value`; `label` feeds both the segment heading and the meter's
  segment label. `citation` is **`Citation` from `@aceshooting/lyra-ui/ai`** and renders an
  `lr-citation-badge` carrying its `sourceId`/`label`. `omittedTokens` is shown in the
  truncation-boundary marker when `truncated` is set. `ContextInspectorRedaction { start: number;
  end: number; reason?: string }` marks character ranges within `text` that are redaction
  placeholders; `reason` becomes the marker's `title`/accessible reason, falling back to a localized
  "Redacted"
- `total: number = 0` — the full token budget `segments` are measured against; passed straight to
  `lr-context-meter.total`
- `label: string = ''` — accessible group name, and the embedded meter's visible caption (e.g.
  "128K context window")
- `formats: ExportFormatOption[] = ['json']` (attribute: false) — forwarded to the embedded
  `lr-export-button`; one id renders a plain button, more than one a format-choice menu
- `filename: string = 'context'` — download filename (no extension) passed to `lr-export-button`

**Events:** `lr-citation-activate` (`detail: { sourceId: string; index: number }`, surfaced by a
segment's embedded `lr-citation-badge`), `lr-citation-open` (`detail: { sourceId: string; index:
number; href?: string }`, the "full preview" signal), `lr-copy` (`detail: { text: string }`, from the
embedded `lr-copy-button`), `lr-export` (`detail: { format: string }`, from the embedded
`lr-export-button`), `lr-export-complete` (`detail: { format: string }`, after a non-cancelled export
finishes).

**CSS parts:** `base`, `toolbar`,
`segments`, `segment`, `segment-header`, `segment-label`, `segment-text`, `segment-tokens`,
`meter` (the embedded `lr-context-meter`), `citation`, `redaction` (one redaction placeholder
marker), `truncation-boundary`, `copy-button`, `export-button`, `empty`.

## `lr-eval-dataset`

Filterable and taggable evaluation-example list with add, remove, import, and export affordances.

**Properties:**
- `examples: EvalExample[] = []` (attribute: false) — `EvalExample { id: string; input: string;
  expectedOutput?: string; tags?: string[]; metadata?: Record<string, unknown> }` (exported here).
  Deliberately its own small shape rather than reusing anything from `src/ai/types.ts` — none of that
  module's interfaces models "one row of a labeled eval dataset". `input`/`expectedOutput` are plain
  strings (not structured payloads) to match `lr-data-grid`'s stringifying cell rendering. Fully
  controlled: add/remove/import/export are all *requests*; the host mutates and passes the array back
- `searchable: boolean = false` (reflected) — built-in free-text search over `input`,
  `expectedOutput`, and `tags` (case-insensitive substring)
- `accept: string = ''` — forwarded to the internal `lr-file-input`'s `accept` (e.g. `'.json,.csv'`);
  empty accepts any type
- `exportFormats: ExportFormatOption[] = ['csv', 'json']` (attribute: false) — forwarded to the
  internal `lr-export-button`
- `disabled: boolean = false` (reflected) — disables every add/remove/import/export affordance, e.g.
  while a host-side mutation is still in flight
- `label: string = ''` — accessible name for the grid region; defaults to the localized
  `evalDatasetLabel`

**Events:** `lr-example-select` (`detail: { id: string | null }`), `lr-example-add-request`
(`detail: undefined`), `lr-example-remove-request` (`detail: { id: string }`), `lr-import-request`
(`detail: { files: File[] }`), `lr-export-request` (`detail: { format: string }`). `focus`/`blur` —
re-dispatched (no detail) when the internal search field (only rendered while `searchable`) gains or
loses focus, since native focus neither bubbles nor crosses the shadow boundary.

**CSS parts:** `base`, `toolbar`, `search`, `search-input`, `tag-filter`, `grid`,
`add-button`, `remove-button`, `import`, `export`.

**Known gotchas:**
- Shrinking `examples` out from under live UI state is handled: a `selectedId` that no longer matches
  any row resets to `null`, and an active tag filter that no longer matches any row's `tags` is
  dropped rather than silently matching zero rows forever.

## `lr-eval-result`

Rubric scoring and human-review surface for comparing the runs of one evaluation example.

Composes `lr-data-grid` (the comparison table), `lr-rubric-form` (the review surface), and
`lr-diff-view` (baseline↔selected output diff) rather than re-deriving any of their behavior.

**Properties:**
- `runs: EvalRunResult[] = []` (attribute: false) — `EvalRunResult { id: string; label: string;
  model?: string; promptVersion?: string; output: string; scores?: RubricValue; review?: RubricValue }`
  (exported here). One entry per model or prompt version being compared for a single evaluation
  example. `scores`/`review` use the same `RubricValue` shape `lr-rubric-form` itself reads and
  writes, so a `DataGridColumn`'s `value()` accessor and the rubric form's own `value` binding read a
  run's fields with no conversion
- `columns: DataGridColumn<EvalRunResult>[] = []` (attribute: false) — plain pass-through to
  `lr-data-grid.columns`, not re-derived here
- `rubricKeys: RubricKey[] = []` (attribute: false) — plain pass-through to `lr-rubric-form.keys`
- `selectedRunId: string = ''` (attribute `selected-run-id`) — the run open for review and the diff's
  **new** side; falls back to `runs[0]?.id` when empty
- `baselineRunId: string = ''` (attribute `baseline-run-id`) — the run compared against and the
  diff's **old** side; falls back to `runs[0]?.id` when empty
- `reviewSkippable: boolean = false` (attribute `review-skippable`) — shows a Skip control on the
  review form (forwarded to `lr-rubric-form.skippable`)
- `disabled: boolean = false` (reflected) — disables the review form's controls only; the comparison
  grid stays interactive (selecting a run to inspect is not a mutation)

**Events:** `lr-run-select` (`detail: { runId: string }`), `lr-review-input` (`detail: { runId:
string; value: RubricValue }`), `lr-review-validity-change` (`detail: { runId: string; valid:
boolean; errors: Record<string, string> }`), `lr-review-submit` (`detail: { runId: string; value:
RubricValue }`), `lr-review-skip` (`detail: { runId: string }`).

**CSS parts:** `base`, `empty`, `grid`, `diff`, `diff-view`,
`diff-labels`, `diff-label-old`, `diff-label-new`, `review`.

## `lr-evaluation-run`

Evaluation-batch progress view with overall progress and one disclosure per example. Inputs and
outputs may render as Markdown or code, with optional grounding and tool-trace sections.

**Properties:**
- `examples: EvaluationExampleResult[] = []` (attribute: false) — `EvaluationExampleResult { id:
  string; label?: string; status: AgentStatus; input: string; inputFormat?: EvaluationContentFormat;
  inputLanguage?: string; output: string; outputFormat?: EvaluationContentFormat; outputLanguage?:
  string; grounding?: GroundingAssessment; citations?: Citation[]; toolTrace?: ToolTimelineEntry[] }`
  (exported here). `status` reuses **`AgentStatus` from `@aceshooting/lyra-ui/ai`** (`{ kind:
  AgentStatusKind; message? }`) — the same run-lifecycle vocabulary an agent step uses — rather than a
  parallel pass/fail enum; rubric scoring is `lr-eval-result`'s job, not this one's.
  `EvaluationContentFormat = 'markdown' | 'code'` — `'markdown'` (the default when unset) renders via
  `lr-markdown`, `'code'` via `lr-code-block` consulting the matching `*Language` field for shiki.
  `grounding`/`citations` (both from `@aceshooting/lyra-ui/ai`) compose directly into
  `lr-grounding-summary`'s `assessment`/`citations`, and `toolTrace` directly into
  `lr-tool-timeline.entries` — no adapters. `citations` is consulted only while `grounding` is also
  set; an omitted `grounding` or empty `toolTrace` renders no such section for that example. `label`
  falls back to a localized "Example {index}" (1-based, array order). Controlled and never mutated
- `total: number | null = null` — the batch's expected total example count. `null` derives it from
  `examples.length`; set it explicitly while a batch is still streaming and the eventual total is
  already known
- `label: string = ''` — header label and accessible-name source; falls back to a localized
  "Evaluation run"

**Events:** `lr-example-toggle` (`detail: EvaluationExampleToggleDetail` = `{ id: string; expanded:
boolean }`), `lr-example-citation-select` (`detail: EvaluationCitationSelectDetail` = `{ exampleId:
string; citation: Citation }` — the nested `lr-grounding-summary`'s own `{ citation }` correlated
with the example it came from, so a host needn't walk the DOM), `lr-example-tool-approval-decide`
(`detail: EvaluationToolApprovalDetail` = `ToolTimelineApprovalDetail & { exampleId: string }` =
`{ invocationId: string; approved: boolean; args?: unknown; exampleId: string }`).

**CSS parts:** `base`, `header`,
`header-label`, `progress`, `summary`, `counts`, `count`, `examples`, `example`, `example-summary`,
`example-label`, `example-status`, `input-section`, `input`, `output-section`, `output`,
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
color alone; it tones the badge and callout as `allow` → success, `deny` → danger, `needs-review` →
warning. `detail` is optional richer evidence (matched rule text, policy id) revealed through
progressive disclosure. Controlled and never mutated — pass a new array to update it.

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
- `entries: ToolTimelineEntry[] = []` (attribute: false) — `ToolTimelineEntry` **extends
  `ToolInvocation` from `@aceshooting/lyra-ui/ai`** (`{ id: string; name: string; args:
  Record<string, unknown>; status: ToolCallStatus; result?: unknown; error?: string }`, where
  `ToolCallStatus = 'pending' | 'running' | 'success' | 'error' | 'denied'`) with `{ startedAt?:
  number; endedAt?: number; retryCount?: number; redactedFields?: string[]; needsApproval?: boolean;
  approved?: boolean }`. Timestamps are epoch milliseconds; entries sort ascending by `startedAt`,
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

**Events:** `lr-tool-approval-decide` (`detail: ToolTimelineApprovalDetail` =
`ToolApprovalEventDetail & { args?: unknown }` = `{ invocationId: string; approved: boolean; args?:
unknown }`, extending the shared detail from `@aceshooting/lyra-ui/ai`). `args` is present only when
`approved` is `true`, and may differ from what the entry originally proposed — the dialog's inline
edit step can hand back different arguments. A listener that only needs `{ invocationId, approved }`
can ignore it; one actually executing the tool needs it.

**CSS parts:** `base`,
`entry`, `entry-marker`, `entry-header`, `entry-timestamp`, `entry-body`, `entry-details`,
`entry-result`, `entry-error`, `entry-retries`, `entry-retries-count`, `entry-retries-label`,
`entry-redacted-indicator`, `entry-approval-status`, `approval-dialog`.

**Themeable custom properties:** `--lr-tool-timeline-gap` (default `var(--lr-space-l)`) — vertical
gap between entries; `--lr-tool-timeline-marker-size` (default `var(--lr-size-0-625rem)`) — the
per-entry timeline marker dot's size, which also sets the entry grid's leading column width;
`--lr-tool-timeline-denied-marker-color` (default `var(--lr-color-warning)`) — rail-dot color for a
`status="denied"` entry, decoupled from the pending-approval border color below so either can be
retinted independently; `--lr-tool-timeline-pending-approval-border-color` (default
`var(--lr-color-warning)`) — color of the entry body's leading border while that entry's
`data-pending-approval` is `"true"`.
