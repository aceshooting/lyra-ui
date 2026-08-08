## `lr-export-button`

CSV/JSON download button with extensible event-driven formats — either single-format (click exports
immediately) or multi-format (click opens a small menu).

**Properties:**

- `rows: Record<string, unknown>[] = []` (attribute: false)
- `columns: CsvColumn[] = []` (attribute: false) — `{ key, label }`; acts as a field allow-list **and**
  CSV header-label source for **both** export formats when non-empty. Left empty, **both** CSV and
  JSON fall back to the union of the rows' own keys (`key`/`label` both set to the key name) instead
  of CSV degrading to a header-less/blank file while only JSON had a fallback — so an unconfigured
  export still produces a proper header + data file in either format
- `filename: string = 'export'`
- `formats: ExportFormatOption[] = ['csv']` (attribute: false), where `ExportFormatOption` is the
  built-in `ExportFormat = 'csv' | 'json'` or an `ExportFormatDescriptor = { id: string; label:
string; description?: string; extension?: string }`. Descriptor labels/descriptions are
  consumer-supplied, already-localized copy. Custom ids are event-only; no custom encoder is bundled
- `disabled: boolean = false` (reflected) — also disables every `[part="menu-item"]` button, not just
  the trigger
- `loading: boolean = false` (reflected) — controlled busy state for an async or server-generated
  export; sets host/trigger `aria-busy` and disables the trigger and menu items. The component does
  not toggle it automatically
- `label: string = 'Export'` — trigger button text; also feeds the format-choice menu's `aria-label`
  as `` `${label} format` `` so assistive tech gets an accessible name for the menu
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides the trigger's accessible
  name and feeds the localized format-menu name without changing the visible label
- `open: boolean = false` (reflected)

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the native trigger button.

**Events:** `lr-export` (`detail: { format: string }`, **cancelable** — call `preventDefault()` to
substitute your own server-generated download instead of the built-in client-side one),
`lr-export-complete` (`detail: { format: 'csv' | 'json' }`, fires only after a non-cancelled
built-in download completes), `lr-export-error` (`detail: { format: 'csv' | 'json', error:
unknown }`, fires when a built-in export cannot be serialized or downloaded; activation does not
throw into consumer code), `lr-show`, `lr-hide` (cancelable format-menu visibility transitions;
self-imposed closes caused by disablement, loading, or an unusable format list emit neither event)

**Slots:** none.

**CSS parts:** `trigger`, `menu`, `menu-item`, `format-label`, `format-description`

**Themeable custom properties:** shared tokens only, including `--lr-popover-viewport-clamp`
(default `92vw`) — the shared narrow-viewport ceiling the `menu`'s max-inline-size is `min()`ed
against, alongside its own `20rem` cap and the positioner's available space. See `lr-tour` for the
shared-clamp note.

**Optional peer deps:** none.

```html
<lr-export-button id="exp" filename="report" label="Export"></lr-export-button>
<script type="module">
  const exp = document.getElementById('exp');
  exp.rows = [{ name: 'Alpha', value: 1 }];
  exp.columns = [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value' },
  ];
  exp.formats = ['csv', 'json']; // shows a format-choice menu instead of exporting immediately
  exp.addEventListener('lr-export', (e) => console.log('exporting', e.detail.format));

  // Custom formats supply menu copy but remain application-handled.
  exp.formats = [
    'csv',
    {
      id: 'xlsx',
      label: 'Excel workbook',
      description: 'Preserves spreadsheet data types',
      extension: 'xlsx',
    },
  ];
  exp.addEventListener('lr-export', async (e) => {
    if (e.detail.format !== 'xlsx') return;
    e.preventDefault();
    exp.loading = true;
    try {
      await exportWorkbook(exp.rows);
    } finally {
      exp.loading = false;
    }
  });
</script>
```

Package-level CSV utilities (used internally, also exported for standalone use — `import {
escapeCsvField, buildCsv, downloadBlob } from
'@aceshooting/lyra-ui/components/utility/export-button/csv.js'`):

```ts
escapeCsvField(value: unknown): string   // quotes/escapes; neutralizes leading ASCII/fullwidth =,+,-,@ and tab/CR/LF formula prefixes with an apostrophe
buildCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string  // CRLF-joined, header row included
downloadBlob(content: string, filename: string, mime: string, ownerDocument?: Document): void // triggers a browser download in the supplied document realm
```

**Known gotchas:**

- CSV and JSON are the only built-in encoders. To offer XLSX/PDF/etc., pass an
  `ExportFormatDescriptor` and handle its id from `lr-export`; custom formats never trigger a
  download or `lr-export-complete` on their own. A descriptor's optional `extension` is metadata
  for that handler, not automatic filename handling.
- CSV formula-injection guarding and the deferred (5s) `URL.revokeObjectURL` (works around Safari
  cancelling in-flight downloads on immediate revoke) are genuine, safe-to-rely-on strengths.
- `open` is valid only when `formats` contains more than one choice. An invalid open request is
  normalized closed without a false `lr-show`/`lr-hide` pair; shrinking an open menu to one format,
  or becoming `disabled`/`loading`, closes it and repairs focus. JSON projection safely preserves
  an own enumerable column literally named `__proto__`.
- the multi-format menu (`role="menu"`) supports full arrow-key navigation — ArrowUp/ArrowDown move
  between items (opening the menu and seeding the right one focused, if it was closed), Home/End
  jump to the first/last item once open, Escape closes it and returns focus to the trigger button,
  and a completed export also returns focus to the trigger — not just Escape/click-outside as
  before.
- the positioned menu is constrained to the inline/block space reported by the positioner, wraps
  long localized format labels/descriptions, scrolls when necessary, and disables its transition
  under reduced motion.

---

## `lr-copy-button`

A standalone copy-to-clipboard affordance for a plain text `value` or a source element selected by
`from`. Its built-in icon button swaps to a confirmation or failure glyph once the Clipboard API
settles; a consumer-provided default-slot trigger can replace that button. The component takes no
positioning opinion of its own.

**Properties:**

- `value: string = ''` — the plain text to copy.
- `from: string = ''` — source expression that takes precedence over `value`. `id` copies the
  element's `textContent`, `id[attribute]` copies an attribute, and `id.property` copies a property.
- `copyLabel: string = ''` (attribute `copy-label`) — built-in button accessible name and resting
  tooltip text; empty uses localized `copy`.
- `successLabel: string = ''` (attribute `success-label`) — confirmation name/tooltip text; empty
  uses localized `copied`.
- `errorLabel: string = ''` (attribute `error-label`) — failure name/tooltip text; empty uses
  localized `copyFailed`.
- `tooltip: 'full' | 'copy' | 'none' = 'full'` (reflected) — `full` shows the resting tooltip on
  hover/focus and feedback after activation, `copy` shows feedback only, and `none` disables it.
- `tooltipPlacement: 'top' | 'right' | 'bottom' | 'left' = 'top'` (attribute
  `tooltip-placement`, reflected).
- `hoist: boolean = false` (reflected) — uses fixed tooltip positioning to escape clipped
  containers.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the localized
  built-in button name while leaving tooltip/feedback labels unchanged; retained Lyra alias.
- `disabled: boolean = false` (reflected)
- `feedbackDuration: number = 1000` (attribute `feedback-duration`) — milliseconds before the
  confirmation **or** the failure state returns to the copy icon. A non-finite value falls back to
  `1000` rather than leaving the state stuck; a negative one clamps to `0`.

**Methods:** `focus(options?)`, `blur()` and `click()` forward to the active built-in or custom
trigger.

**Events:**

- `lr-copy` (`detail: { text: string }`) — fires on every activation with the resolved source text,
  before the clipboard write and regardless of its outcome. On a source-resolution failure,
  `text` is empty. This preserves the existing Lyra activation convention.
- `lr-error` (no detail) — bubbling, composed, non-cancelable notification that source resolution
  or clipboard writing failed.
- `lr-copy-error` (`detail: { text: string; reason: LyraCopyErrorReason; error: unknown }`) — the
  retained detailed Lyra alias. `reason` is `'unsupported'` (no Clipboard API), `'denied'`
  (`NotAllowedError`/`SecurityError`) or `'failed'` (including a missing/empty source and other
  platform failures); the error field contains the original platform or component-created error.

**Slots:** default custom trigger, plus `copy-icon`, `success-icon`, and `error-icon` overrides for
the built-in button. Exactly one named icon is rendered at a time.

**CSS parts:**

- `base`, `button` — aliases on the built-in button in every state.
- `base-success` — added to the button's part list while the confirmation shows
  (`part="base button base-success"`).
- `base-error` — the same while the failure state shows (`part="base button base-error"`).
- `copy-icon`, `success-icon`, `error-icon` — the resting, confirmation and failure glyphs. Exactly
  one is rendered at a time; all three are `aria-hidden`.
- `feedback` — the visually hidden, `aria-hidden` mirror of the outcome text. Empty at rest, so
  nothing is announced before a real outcome. It carries no live-region role of its own: the
  announcement goes to the library's shared **light-DOM** polite region, appended to the consumer's
  `<body>` and marked `data-lr-live-region="polite"`, because a live region inside a shadow root is
  not reliably announced (JAWS with Firefox ignores one outright). Assert against that
  document-level region rather than `::part(feedback)`; the part is a styling and inspection
  surface, and still tells you what the button last announced.
- `tooltip__base`, `tooltip__base__popup`, `tooltip__base__arrow`, `tooltip__body` — exported nested
  tooltip parts.

**CSS custom states:** `success` and `error`. The retained `base-success`/`base-error` part names
remain available for shadow-part styling.

**Themeable custom properties:** `--success-color` (default `var(--lr-color-success)`) and
`--error-color` (default `var(--lr-color-danger)`), plus shared hit-area, text, focus, transition,
and disabled-opacity tokens.

**Optional peer deps:** none.

```html
<code id="install-command">npm install @aceshooting/lyra-ui</code>
<lr-copy-button
  from="install-command"
  copy-label="Copy install command"
  success-label="Install command copied"
  tooltip-placement="right"
  hoist
></lr-copy-button>
```

Handling the failure path — the button already shows and announces it, so a listener is only needed
for an application-level fallback:

```html
<lr-copy-button id="copy" value="npm install @aceshooting/lyra-ui"></lr-copy-button>
<script type="module">
  import '@aceshooting/lyra-ui/components/utility/copy-button/copy-button.js';

  const button = document.getElementById('copy');
  button.addEventListener('lr-copy', () => trackCopyAttempt()); // your own instrumentation
  button.addEventListener('lr-error', () => showCopyFallback());
  button.addEventListener('lr-copy-error', (event) => {
    // event.detail.reason is 'unsupported' | 'denied' | 'failed'
    if (event.detail.reason === 'unsupported') selectTextForManualCopy(event.detail.text);
  });
</script>
```

The closed-set and error-reason types are exported alongside the class:

```ts
import type {
  LyraCopyButtonTooltip,
  LyraCopyButtonTooltipPlacement,
  LyraCopyErrorReason,
} from '@aceshooting/lyra-ui/components/utility/copy-button/copy-button.class.js';
```

**Known gotchas:**

- **Changed in 8.0.0:** the button used to enter the "Copied" confirmation on activation whether or
  not the clipboard write succeeded. It now waits for `navigator.clipboard.writeText()` to settle: a
  rejection renders the failure glyph instead, announces the localized failure text through the
  shared polite region mirrored by `[part="feedback"]`, and emits `lr-error` plus `lr-copy-error`.
  `lr-copy` still fires for every
  activation, so code that treated it as proof the text reached the clipboard must pair it with an
  error event.
- An empty `value`, missing `from` target/member, or empty resolved source is an error; no clipboard
  write is attempted. `from` always wins over `value`, including when it is invalid.
- `navigator.clipboard` is absent in insecure contexts/older browsers, and some engines throw
  synchronously rather than rejecting. Both arrive at the same failure path (`unsupported` for the
  missing API, `denied`/`failed` for a real rejection) — there is no silent success left.
- Changing `value`/`from`, or disconnecting, clears any in-progress confirmation/failure
  immediately. A write that settles after that change is discarded.
- A custom default-slot trigger supplies its own semantics and accessible name; built-in icon
  slots, `button`/`base` parts, and `aria-label` forwarding apply only to the built-in button.
- The failure is signalled on four channels — a different glyph, a different accessible name, the
  live-region announcement, and only then colour — so it survives a monochrome or high-contrast
  rendering.
- Copy affordance strings are localizable: `copy` (`'Copy'`), `copied` (`'Copied!'`) and
  `copyFailed` (`'Copy failed'`), overridable per instance through `.strings` or app-wide through
  `registerLyraLocale()` (see `llms/shared.md`). Explicit `*-label` properties take precedence.
- Native `dir`/`lang` remain inherited global attributes. The component is not form-associated.

---

## `lr-resize-observer`

Lifecycle-managed wrapper around the native `ResizeObserver`. It observes all element children in
the default slot and emits a composed event, while adding no layout of its own.

**Properties:** `disabled: boolean = false` (reflected) and `box: 'content-box' | 'border-box' |
'device-pixel-content-box' = 'content-box'` (reflected).

**Events:** `lr-resize` with `{ entries: ResizeObserverEntry[] }` in `detail`.

**Slots:** default observed elements. **CSS parts:** `base`.

---

## `lr-intersection-observer`

Lifecycle-managed wrapper around the native `IntersectionObserver`. It observes all element children
in the default slot and emits a composed event, while adding no layout of its own.

**Properties:** `disabled: boolean = false` (reflected), `rootMargin: string = '0px'` (attribute
`root-margin`), `threshold: number | number[] | string = '0'` (the mapped attribute form accepts
space-separated values), `root: Element | string | null = null` (an element or mapped element ID),
`intersectClass: string = ''` (attribute `intersect-class`, toggled on each target), and `once:
boolean = false` (reflected; unobserves a target after its first intersection).

**Events:** mapped `lr-intersect` once per entry with `{ entry }`, plus the existing batch alias
`lr-intersection` with `{ entries: IntersectionObserverEntry[] }`.

**Slots:** default observed elements. **CSS parts:** `base`.

---

## `lr-mutation-observer`

Lifecycle-managed wrapper around the native `MutationObserver`. All element children in the default
slot are observed and their mutation records are emitted as a composed event; the wrapper itself
adds no layout.

**Properties:** `disabled: boolean = false` (reflected), `childList: boolean = false` (attribute
`child-list`; **changed in 8.0.0** from Lyra's former `true` default, so opt in explicitly when
needed; reflected), `attr: string | null = null` (reflected; `*` observes every attribute; otherwise a
space-separated filter), `attrOldValue: boolean = false` (`attr-old-value`), `charData: boolean =
false` (`char-data`), and `charDataOldValue: boolean = false` (`char-data-old-value`); all four
mapped attributes reflect. Lyra's
existing aliases remain: `observeAttributes` (`attributes`), `characterData` (`character-data`),
`subtree: boolean = true`, and programmatic `attributeFilter: string[] = []`.

**Events:** `lr-mutation`; `detail.records` and mapped `detail.mutationList` reference the same
`MutationRecord[]` batch.

**Slots:** default observed elements. **CSS parts:** `base`.

---

## `lr-json-viewer`

A collapsible, copyable tree view for an arbitrary JSON-serializable value (object, array, string,
number, boolean, null, or `undefined`). Serves as a fallback renderer wherever a raw payload needs
inspecting without a bespoke view. Expand/collapse state is keyed by structural path (not object
identity), so it survives a `data` reassignment that keeps the same shape — e.g. a streaming result
being patched in place. A container value that self-references (directly or through a longer cycle)
renders as a leaf `Circular reference` marker (`data-type="circular"`) instead of recursing — no
stack overflow on cyclic `data`.

**Properties:**

- `data: unknown` (attribute `false` — property-only, not settable via an HTML attribute)
- `collapsedDepth?: number` (attribute `collapsed-depth`) — nodes at or beyond this nesting depth
  (root = `0`) start collapsed; omitted/`undefined` means nothing auto-collapses
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"20rem"`); once set, the
  viewer scrolls internally past this height instead of growing the page. Values that do not parse
  as CSS `max-height`, contain declaration breaks, or contain `url()` are ignored, leaving
  `--lr-json-viewer-max-height` in control
- `copyable: boolean = false` (reflected) — shows copy-to-clipboard affordances: one for the whole
  value, plus one per node
- `search: string = ''` — case-insensitive substring match against keys/values; matches are
  highlighted and their ancestors auto-expanded

**Methods:** `runSearch(query)` sets the declarative `search` property and awaits the recompute,
resolving the match count — named distinctly from `search` because a class member can't share a name
with a reactive property. `searchNext()`/`searchPrevious()` advance/step back a match cursor
(wrapping), reveal that selected match even when one of its ancestors was explicitly collapsed,
mark it as the active `aria-current` result, announce its position, and scroll it into view;
they resolve `false` when there are no matches. `clearSearch()` resets `search` to `''`, clearing all
matches and the cursor.

**Events:** `lr-copy` (`detail: { text: string }`) — fired by the top-level copy button or a
per-node one. Fires even when `navigator.clipboard` is unavailable or the write silently failed
(a rejected `writeText()` is swallowed), so a consumer can still observe copy _intent_ — the event
is not a confirmation that the OS clipboard was actually reached. Copying a circular `data` value
serializes safely, substituting the same `Circular reference` marker the tree view renders, instead
of throwing. `lr-search-change` (`detail: { query, matchCount, activeIndex }`) — fired whenever the
search query, match count, or active-match cursor changes, from `runSearch()`/`searchNext()`/
`searchPrevious()`/`clearSearch()`, or a direct `search`/`data` property write.

**Slots:** none — the tree is rendered entirely from `data`.

**CSS parts:** `base` (root scroll container, respects `max-height`), `toolbar` (wrapper around the
top-level copy button, only rendered when `copyable`), `tree` (wrapper around the rendered node
tree; a host `aria-label` is forwarded here), `row` (every structural opening/value and
closing-delimiter row), `key` (an object property key or array index label, `data-match` while it matches `search`,
`data-active` while it is the current `searchNext()`/`searchPrevious()` cursor position),
`value` (a primitive value's text — carries `data-type` of
`string`/`number`/`boolean`/`null`/`undefined`/`circular` for per-type coloring, `data-match`
while it matches `search`, and `data-active` while it is the current cursor position), `bracket` (a
`{`, `}`, `[`, or `]` delimiter), `toggle` (a container node's expand/collapse button; hidden but
present for row alignment on leaf/empty nodes),
`copy-button` (a copy-to-clipboard button — the top-level one in `toolbar` (aria-label "Copy JSON to
clipboard") or a per-node one (aria-label `Copy ${key/type}`, e.g. "Copy age"); only rendered when
`copyable`), `limit` (the localized notice rendered below the tree when the depth/node traversal
budget truncates rendering or search — absent entirely for any document within budget)

Active-match position changes are appended to Lyra's shared light-DOM polite announcement sink.
The shadow tree keeps only an `aria-hidden` text mirror, so the same result is not announced twice;
initial connection and reconnection—including a detached cursor update whose render settles during
reattachment—do not replay the current cursor. Search navigation while the viewer or a composed
ancestor is accessibility-hidden also stays silent. After cross-document adoption, smooth-scroll
motion preferences and best-effort clipboard writes use the viewer's current owner window.

**Themeable custom properties:** `--lr-json-viewer-max-height` (default `none` — grows with content
until `max-height` is set), `--lr-json-viewer-font` (default `var(--lr-font-mono)`),
`--lr-json-viewer-match-bg` (default `var(--lr-color-warning-quiet)`) — background, and surrounding
box-shadow, of a key/value that currently matches `search`. Component-scoped indirection over the
shared `--lr-color-warning-quiet` token, so a consumer can retheme just this search-match highlight
without repainting every other warning-toned surface that reads the same shared token;
`--lr-json-viewer-row-hover-bg` (default `var(--lr-color-brand-quiet)`) — structural-row hover
background;
`--lr-json-viewer-active-outline` (default `var(--lr-focus-ring-color)`) — outline color for the
current imperative search match; `--lr-json-viewer-string-color` (default
`var(--lr-color-success)`), `--lr-json-viewer-number-color` (default `var(--lr-color-brand)`),
`--lr-json-viewer-boolean-color` (default `var(--lr-color-warning)`), and
`--lr-json-viewer-null-color` (default `var(--lr-color-text-quiet)`) — per-value-type color hooks.
Plus shared
tokens `--lr-color-border/-surface/-text/-text-quiet/-brand/-brand-quiet/-success/-warning/-warning-quiet`,
`--lr-radius`, `--lr-space-xs/-s/-l`, `--lr-focus-ring-width/-color/-offset`,
`--lr-transition-fast`.

**Optional peer deps:** none.

```ts
import { html } from 'lit';
import '@aceshooting/lyra-ui/components/utility/json-viewer/json-viewer.js';

html`<lr-json-viewer .data=${apiResponse} copyable max-height="24rem" search=${query}></lr-json-viewer>`;
```

```html
<lr-json-viewer copyable max-height="24rem"></lr-json-viewer>
<script type="module">
  document.querySelector('lr-json-viewer').data = {
    hello: 'world',
    items: [1, 2, 3],
  };
</script>
```

**Known gotchas:**

- `data` is property-only (`attribute: false`) — it must be set via `.data = ...` or a lit-html `.data=${...}`
  binding, never as a plain HTML attribute.
- Search highlighting auto-expands only the _ancestors_ of a match, not the whole tree — a
  non-matching sibling subtree elsewhere stays collapsed (or expanded) exactly as it already was.
- An explicit per-node expand/collapse (from clicking a node's `toggle` button) overrides
  `collapsedDepth` and declarative search-driven auto-expansion for that path. Imperative
  `searchNext()`/`searchPrevious()` navigation may reopen the ancestors of the selected result so
  the active match is never hidden; otherwise the override persists until `data` is reassigned with
  a different shape.
- Per-node copy buttons call `stopPropagation()` on click so clicking one doesn't also toggle the
  row's expand/collapse state.
- Whole-value copy always produces text, including for a root `undefined`, `Symbol`, or function
  that native `JSON.stringify()` would otherwise return as no value.

---

## `lr-live-region` (+ the `Announcer` helper)

A throttled screen-reader announcement helper, split into a DOM-free coalescing engine (the
`Announcer` class), the shared light-DOM region a flush writes into (`acquireAnnouncementSink()`),
and a real custom element that composes both. The two helpers are public — part of the curated,
semver-covered `utilities/` surface documented in `llms/shared.md`, not internals:

```ts
import {
  Announcer,
  acquireAnnouncementSink,
} from '@aceshooting/lyra-ui/utilities/announcer.js';
```

The `.js` is required (`./utilities/*` maps straight onto `./dist/utilities/*`). Both symbols are
also re-exported from the extensionless `@aceshooting/lyra-ui/utilities` barrel and from the package
root, but the single-helper subpath above is the form to copy — it reaches nothing else.

### `Announcer` — `@aceshooting/lyra-ui/utilities/announcer.js`

Not a custom element — the `Announcer` class itself is pure timing/coalescing logic with no DOM
dependency, composed by `<lr-live-region>` (below) and intended for reuse by any other component
that needs throttled announcements (a stream-status indicator, a tool-call chip's status
transitions, a chat message's streaming state). The same module also exports the DOM half a flush
writes into — `acquireAnnouncementSink()`, documented after `Announcer` below.

Streaming UIs (token-by-token chat responses, progress ticks, etc.) naturally produce far more
candidate announcements than a screen-reader user can usefully absorb — reading every incremental
chunk aloud is spam, not information. `Announcer` collapses a burst of `announce()` calls arriving
within `throttleMs` of the _first_ call in that burst down to a single trailing-edge flush of the
latest text: superseded intermediate text is dropped outright, never queued or concatenated.

- `new Announcer(options: AnnouncerOptions)` where
  `AnnouncerOptions = { throttleMs?: number /* = 500 */; onFlush: (text: string) => void;
  timerHost?: AnnouncerTimerHost }`. `AnnouncerTimerHost` is the minimal numeric-handle
  `setTimeout`/`clearTimeout` surface implemented by a browser `Window`; omit it to use ambient
  timers.
- `announce(text: string, options?: AnnounceOptions)` where `AnnounceOptions = { force?: boolean }` —
  queues `text`, overwriting whatever an earlier call in the same burst queued. Only the _first_
  call of a burst schedules the flush timer, so the deadline stays anchored to that first call
  rather than being pushed back by every subsequent call. `{ force: true }` bypasses any
  in-progress window and flushes immediately, so a terminal message (e.g. "response complete") is
  never swallowed mid-burst.
- `cancel()` — drops any pending (not yet flushed) text without invoking `onFlush`.
- `setTimerHost(timerHost: AnnouncerTimerHost)` — rebinds scheduling and cancellation, for example
  after a component is adopted into another document. A pending burst is canceled on the previous
  host and rescheduled on the new one without losing its latest text.
- `pendingText: string | undefined` — the latest text awaiting flush, if a burst is in progress.
- `isPending: boolean` — whether a flush is currently scheduled.
- `throttleMs` — a plain public field, safe to change between bursts; a flush already scheduled
  keeps the deadline it was scheduled with.

### `acquireAnnouncementSink()` — `@aceshooting/lyra-ui/utilities/announcer.js`

The shared live region announcements actually land in. A live region rendered **inside a shadow
root is not reliably announced** — JAWS with Firefox ignores one entirely — so every announcement
this library makes goes into a visually hidden element in the *host document's* light DOM instead.

- `acquireAnnouncementSink(politeness: AnnouncementPoliteness, options?: AnnouncementSinkOptions)`
  where `AnnouncementPoliteness = 'polite' | 'assertive'` and
  `AnnouncementSinkOptions = { document?: Document /* = the ambient document */; source?: Element;
  messageTtlMs?: number /* = 5000 */ }`. Library components pass their host as `source`, which
  prevents a document-level region from speaking while that source or a composed ancestor is
  `hidden`, `inert`, `aria-hidden`, CSS-hidden, or in a closed `<details>` content branch;
  standalone consumers can do the same. A box-generating source also stays silent while skipped by
  `content-visibility:auto`. Browsers report every `display:contents` source as false from
  `checkVisibility()` whether its semantics are exposed or not, so the helper uses the explicit
  authored/CSS/closed-details gates for that boxless case and cannot distinguish an auto-skipped
  subtree; bind `source` to a semantic box when that exact distinction matters. A source adopted
  away from the acquired `document` also fails closed until its owner reacquires a sink.
  Returns an `AnnouncementSink` handle: `element`, `politeness`, a writable `messageTtlMs`,
  `announce(text: string): void` and `release(): void`.
- One region per `(document, politeness)` pair, shared by every consumer and **ref-counted**: it is
  mounted on the first `acquire()` and removed from the DOM when the last handle `release()`s.
  Mounting happens at acquire time, ahead of any text, because assistive tech has to have been
  observing a region *before* content arrives for the change to be announced at all.
- `announce()` **appends a child node** (`aria-relevant="additions"`, `aria-atomic="false"`) rather
  than rewriting one text node. That is what makes an identical repeat announce a second time — no
  clear-then-restore-across-a-frame dance is needed — and each appended node is swept after
  `messageTtlMs`, so returning focus to the page never finds stale text to re-read. Empty text is
  ignored. Sweep and release cancellation use the selected document's `defaultView` timer realm,
  so an iframe-owned sink does not leave parent-window timers retaining its messages. `announce()`
  after `release()` is a no-op; `release()` is idempotent and removes that
  handle's own not-yet-swept nodes.
- The region carries `data-lr-live-region="<politeness>"` (exported as
  `ANNOUNCEMENT_SINK_ATTRIBUTE`) so a consumer's DOM diffing, snapshot testing or `MutationObserver`
  can recognize and ignore library-owned nodes appearing at the end of `<body>`.
- Under SSR (no `document`) the call returns an inert handle instead of throwing, so callers need
  no environment check.

### `lr-live-region`

A visually-hidden ARIA live region that throttles and coalesces announcements instead of relaying
every call verbatim, by composing an internal `Announcer` with the shared light-DOM sink above. A
consumer typically mounts one `<lr-live-region>` per page/surface (much like `<lr-toast>` is one
region per placement) and keeps a reference to call `announce()` from application code or a parent
component. The announced copy does **not** live in this element's shadow root: it is appended to
the shared, ref-counted region in the host document, while the shadow `part="region"` element stays
behind as an `aria-hidden` mirror of the latest text.

**Properties:**

- `mode: 'polite' | 'assertive' = 'polite'` (reflected) — selects which shared region announcements
  land in: `'polite'` uses the `role="status"` + `aria-live="polite"` one (waits for the user to be
  idle), `'assertive'` the `role="alert"` + `aria-live="assertive"` one (interrupts)
- `throttleMs: number = 500` (attribute `throttle-ms`) — the coalescing window; see `Announcer`
  above

**Methods:** `announce(text: string, options?: AnnounceOptions): void` — queues `text` for
announcement through the internal `Announcer`; `{ force: true }` bypasses the current throttle
window and flushes immediately.

**Events:** none.

**Slots:** none.

**CSS parts:** `region` — the visually-hidden, `aria-hidden` mirror of the latest announced text.
It carries no `role`/`aria-live` of its own: a second live region holding the same text would make
browsers that *do* announce shadow live regions read every message twice.

**Themeable custom properties:** none component-specific — the shadow mirror is hidden via the
shared `.sr-only` helper class (`internal/a11y.ts`) and the light-DOM region via the same
visually-hidden algorithm inline (no stylesheet of this package reaches the consumer's light DOM),
neither of them tokenized CSS.

**Optional peer deps:** none.

```html
<!-- once, near the root of a page/surface -->
<lr-live-region id="live" mode="polite"></lr-live-region>
<script type="module">
  const live = document.getElementById('live');
  // streaming tokens: fine to call on every chunk, only the trailing state lands
  live.announce(`${partialText} …`);
  // stream finished: always announced, even mid-throttle-window
  live.announce('Response complete', { force: true });
</script>
```

A parent Lit component would instead hold the reference via `@query('lr-live-region')`.

**Known gotchas:**

- The element mounts (and shares) a region in `document.body` for as long as it is connected — an
  expected side effect, not a leak: it is ref-counted and removed once the last `<lr-live-region>`
  of that politeness disconnects. Announcements are appended nodes, so re-announcing identical text
  is read again with no special-casing, and each node is swept a few seconds later.
- The announcement never waits on a render: it is appended as soon as the flush happens, including
  when a consumer creates, appends and `announce()`s synchronously. Only the shadow mirror waits —
  a write landing before `firstUpdated()` is buffered and applied on the next `firstUpdated()`.
- Changing `mode` re-targets the shared region synchronously at announce time, so setting `mode`
  and force-announcing in the same turn lands with the new urgency instead of racing Lit's
  re-render. Adopting the element into an iframe likewise re-targets to that document's own region.
- `disconnectedCallback()` cancels any pending (unflushed) announcement and any before-first-render
  buffered write, and releases the shared region — an element removed before a deferred write lands
  silently drops it, including across a later reconnect.
- Changing `throttle-ms` updates the live `Announcer`'s window immediately, but a flush already
  scheduled under the old window keeps the deadline it was scheduled with.

---

## `lr-poll-status`

A "next scheduled refresh" countdown with a built-in pause control: a ticking `M:SS` display counting
down to the next scheduled action, a "Refreshing…" state at zero, and a pause/resume toggle.
First-party invention (no Web Awesome equivalent); the closest existing component,
`<lr-stream-status>`, is scoped to transport/connection-health phases, a different concern from a
scheduled-interval countdown — this mirrors its internal `<lr-live-region>` composition for
accessible phase-transition announcements.

**Properties:**

- `nextInMs?: number` (attribute `next-in-ms`) — milliseconds until the next scheduled action, as of
  whenever this was last set; setting it (re)starts the countdown from "now." Unset (the default)
  shows no countdown.
- `active: boolean = true` (reflected) — whether the poll cycle is running at all.
- `paused: boolean = false` (reflected) — user-toggled pause; while `true`, the countdown display
  freezes and `lr-poll-due` never fires.

**Events:** `lr-poll-due` (no detail — fired once when the countdown reaches zero, not fired while
`paused`), `lr-pause-change` (`detail: boolean` — fired when `paused` changes via the built-in
button).

**Methods:** `restart(): void` — restarts the currently configured `nextInMs` delay from now,
including after its previous deadline fired. With `nextInMs` unset it simply clears the due state.

**Slots:** none.

**CSS parts:** `base`, `indicator` (the pulsing status dot), `countdown` (the `M:SS`, or
"Refreshing…", text), `pause-button` (the built-in pause/resume toggle).

**Themeable custom properties:** `--lr-poll-status-due-bg` (default `var(--lr-color-success)`) —
background of `indicator` while `data-due` is set. Component-scoped indirection over the shared
`--lr-color-success` token, so a consumer can retheme just this due-state indicator without
repainting every other component that reuses the same shared success token. Plus shared tokens —
`--lr-space-xs`, `--lr-font-size-sm`,
`--lr-color-text-quiet`, `--lr-color-brand`, `--lr-color-success`, `--lr-radius`/`-pill`,
`--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-poll-status next-in-ms="30000"></lr-poll-status>
<script type="module">
  const status = document.querySelector('lr-poll-status');
  status.addEventListener('lr-poll-due', () => refreshData());
  status.addEventListener('lr-pause-change', (e) => console.log('paused:', e.detail));
</script>
```

Internally, a 1-second ticker re-derives the remaining time from a captured target timestamp (rather
than a naive per-tick decrement), so the countdown stays accurate even if the tab was backgrounded
and timers were throttled. Assigning a _changed_ `nextInMs` value starts a fresh deadline; assigning
the same value is a normal Lit no-op, so use `restart()` for a new cycle with the same delay.
Pausing/resuming, toggling `active`, disconnecting/reconnecting, or toggling either after the due
event stops/starts only an unconsumed ticker: a consumed deadline never replays until `nextInMs`
changes or `restart()` is called. Phase transitions ("Paused.", "Resumed.", "Refreshing now.") are
announced via an internal `<lr-live-region>` in polite mode.

**Known gotchas:**

- `restart()` is the explicit reset/extend path when the configured delay value itself has not
  changed.
- `active="false"` and `paused` both stop the ticker independently, but only `paused` fires
  `lr-pause-change` — that event is scoped to the built-in pause button's own toggle, not to
  `active`.
- the countdown rounds up to the nearest whole second, so it never shows a literal "0:00" — the
  display jumps straight from a small count (e.g. "0:01") to "Refreshing…" once the deadline is
  actually reached.

---

## `lr-mention-popover`

A caret-anchored, keyboard-navigable popover for `@`-mention and `/`-slash-command autocomplete
inside a plain-text `<textarea>`/`<input>` the host owns. First-party invention (no Web Awesome
equivalent). On platforms accepting cross-root ARIA element reflection, the host's own input keeps
focus and `syncActiveDescendant()` points it at the active option. Where that reference is rejected,
`focusActiveOption()` moves real focus into this component's shadow listbox so the focus owner and
option share one tree scope. A string `aria-activedescendant` cannot resolve from a host input in
the document into an option in this component's shadow root.

**Properties:**

- `anchor?: HTMLElement` (attribute: false) — the element to position the popup relative to. A
  plain `<textarea>` or single-line text `<input type="text"|"search">` gets caret-precise
  positioning; any other element anchors the whole popup under that element's own box.
- `items: MentionItem[] = []` (attribute: false) — the full candidate set, pre-`query`-filtering.
- `query: string = ''` — the text typed since the trigger character; drives the built-in filtering
  (see `filter`).
- `open: boolean = false` (reflected)
- `filter: MentionFilter | null = null` (attribute: false) — overrides the built-in
  case-insensitive `label`/`description` substring match entirely.
- `emptyText: string = 'No matches'` (attribute `empty-text`)
- `label: string = 'Suggestions'` — accessible name for the `role="listbox"` popup. A host-level
  plain `aria-label` attribute on `<lr-mention-popover>` itself takes priority over this property
  when present (checked via a plain `getAttribute()` read, not a reactive property) — matches the
  same fallback on `<lr-combobox>`/`<lr-table>`.
- `filteredItems: MentionItem[]` — read-only getter; `items` filtered by `query` via `filter` (or
  the built-in default). Empty `query` returns `items` unfiltered.
- `activeDescendantId: string | null` — read-only getter; the `id` of the currently-highlighted
  internal row, or `null` while closed or when `filteredItems` is empty. Useful for diagnostics and
  same-tree consumers; do not copy it to an external control as a string IDREF.
- `activeDescendantElement: HTMLElement | null` — read-only getter; the highlighted shadow option
  for the platform's element-reference ARIA API.
- `listboxId: string` — read-only getter; the internal `id` of the `role="listbox"` element. Like
  `activeDescendantId`, it cannot form a cross-shadow string IDREF from a host input.

**Methods:**

- `handleKeyDown(e: KeyboardEvent): boolean` — the host's own text-control `keydown` handler calls
  this while the popover is open. Handles `ArrowDown`/`ArrowUp` (moves the highlight) and
  `Enter`/`Tab` (commits the highlighted row) — both pairs return `false` with no
  `preventDefault()` when `filteredItems` is empty, letting the keystroke fall through to the
  host's own control unchanged. `Escape` closes with no selection. Returns `true` whenever the key
  was intercepted and `false` for keys the method does not recognize.
- `syncActiveDescendant(control: HTMLElement): boolean` — clears any string
  `aria-activedescendant`, then applies `ariaActiveDescendantElement` when the platform accepts the
  cross-root reference. Returns whether that reference was accepted.
- `focusActiveOption(): Promise<boolean>` — same-tree fallback after a consumed navigation key
  when `syncActiveDescendant()` returns `false`. Focuses the active option, lets the popover handle
  subsequent navigation, and restores focus to `anchor` when the popover closes.

**Exported types:** `MentionItem { id: string; label: string; description?: string; icon?: string
}`; `MentionFilter = (item: MentionItem, query: string) => boolean`; `MentionSelectDetail { id:
string; label: string }`.

**Events:** `lr-mention-select` (`detail: MentionSelectDetail`, `{ id, label }` of the row that
was committed via Enter/Tab/click), `lr-mention-close` (no detail payload —
`this.emit('lr-mention-close')` is called with no second argument, so `event.detail` is `null`,
not `undefined`; fires on Escape or any other `open: true -> false` transition, but never for the
close that immediately follows a `lr-mention-select` commit, and never for markup that simply
renders `open="false"` on first paint)

**Slots:** none.

**CSS parts:** `listbox`, `option`, `option-icon` (when `icon` is set), `option-label`,
`option-description` (when `description` is set), `empty`

**Themeable custom properties:** `--lr-mention-popover-option-active-bg` (default
`var(--lr-color-brand-quiet)`) — background of the hovered or `[data-active]`
(keyboard-highlighted) suggestion row. Component-scoped indirection over the shared
`--lr-color-brand-quiet` token, so a consumer can retheme just this highlighted/active row without
repainting every other component that reuses the same shared token. Plus shared tokens —
`--lr-space-xs`/`-s`/`-m` (popup padding,
row padding/gap), `--lr-color-surface`/`-border` (popup background/border), `--lr-radius`
(popup and row corners), `--lr-shadow` (popup elevation), `--lr-transition-fast` (open/close
transition), `--lr-color-brand` (selected-row
text), `--lr-color-text-quiet`/`--lr-color-text` (description text, full-contrast on the active
row), and `--lr-popover-viewport-clamp` (default `92vw`) — the shared narrow-viewport ceiling the
popup's max-inline-size is `min()`ed against, alongside its own `24rem` cap and the positioner's
available space. See `lr-tour` for the shared-clamp note.

**Optional peer deps:** none.

```html
<textarea id="composer"></textarea>
<lr-mention-popover id="mentions" label="People" empty-text="No matches"></lr-mention-popover>
<script type="module">
  const textarea = document.getElementById('composer');
  const popover = document.getElementById('mentions');

  textarea.addEventListener('keydown', (e) => {
    if (popover.open && popover.handleKeyDown(e)) {
      if (!popover.syncActiveDescendant(textarea) && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        void popover.focusActiveOption();
      }
      return;
    }
  });
  textarea.addEventListener('input', () => {
    popover.anchor = textarea;
    popover.items = [
      {
        id: 'ada',
        label: 'Ada Lovelace',
        description: 'Engineering',
        icon: '👩‍💻',
      },
      { id: 'grace', label: 'Grace Hopper', description: 'Engineering' },
    ];
    popover.query = 'a'; // detected since the trigger character
    popover.open = true;
    popover.updateComplete.then(() => popover.syncActiveDescendant(textarea));
  });

  popover.addEventListener('lr-mention-select', (e) => {
    // splice `${e.detail.label}` into the textarea at the trigger offset
  });
</script>
```

Integration is entirely the host's responsibility: detect a mention/command trigger in the host's
own `input` handling, set `anchor`/`items`/`query` and flip `open = true`, forward every `keydown`
through `handleKeyDown()` while open, and call `syncActiveDescendant()` after opening and after each
consumed navigation key. If it returns `false`, call `focusActiveOption()` after the first consumed
ArrowUp/ArrowDown so the fallback owns navigation from then on. Setting `open = false` whenever the
query stops looking like an active mention context (a space typed, the trigger deleted, the input
blurred, …) is also the host's job — `lr-mention-close` fires automatically from that.

Positioning measures exactly where the caret currently paints via a hidden-mirror-element technique
(`caretClientRect()`) and positions against that single point with `internal/positioner.js`'s
`place()`, so the popup tracks the caret rather than sitting under the whole textarea. Re-measures
automatically only on an `anchor` or `query` change while open (a keystroke moves the caret, so a
fresh `query` is the proxy for "the caret may have moved").

**Known gotchas:**

- a host-level `aria-label` attribute on `<lr-mention-popover>` now takes priority over `label`
  (and its localized default) when resolving `[part="listbox"]`'s accessible name — previously it
  was silently ignored. Matches the same fallback on `<lr-combobox>`/`<lr-table>`.
- Never copy `activeDescendantId` or `listboxId` onto a document-owned control as a string ARIA
  IDREF; shadow-root IDs are outside that control's tree scope. Use `syncActiveDescendant()` and its
  `focusActiveOption()` fallback.
- The popover opens pre-highlighted on the top match (index 0), unlike `<lr-combobox>`'s own
  listbox which opens with nothing highlighted (`-1`) — a bare Enter right after opening commits
  immediately.
- Caret-precise positioning only applies to a plain `<textarea>` or single-line text
  `<input type="text"|"search">`; any other `anchor` element, or a text control whose caret rect
  can't be measured (e.g. `display: none`), silently falls back to whole-element anchoring against
  `anchor` itself.
- A caret that moves for a reason other than typing (e.g. a mouse click elsewhere in the text while
  the popover happens to still be open) is not separately tracked — force a re-measure by toggling
  `open` or reassigning `anchor`.
- `activeIndex` resets to `0` whenever `query`, `items`, or `filter` changes, but not when only
  `anchor` changes — reassigning `anchor` alone preserves whatever row was last highlighted. If
  fallback focus currently lives in the listbox and filtering removes every option, closing,
  emptying, or disconnecting the popover returns focus to the connected anchor before removing the
  active option.
- There's no persisted "selection" the way `<lr-combobox>`'s own listbox has one — a mention is
  either committed (closing the popover) or dismissed with nothing chosen. `aria-selected="true"`
  here marks whichever row is currently _active_ (what Enter/Tab would commit right now, per the
  WAI-ARIA combobox-with-list-autocomplete pattern), not a separate persisted value.

---

## `lr-diff-view`

A real two-string line diff (a classic longest-common-subsequence dynamic program, not a Myers
implementation), rendered as interleaved unified-diff output — not diff-flavored syntax highlighting
over an already-formatted string (`<lr-code-block>`'s `language="diff"` only lexically colors a
string the consumer already unified-diffed; it has no two-string-compare entry point of its own).
First-party invention (no Web Awesome equivalent).

**Properties:**

- `oldText: string = ''` (attribute: false) — the "before" text. Default `''` renders an
  all-additions diff of `newText`.
- `newText: string = ''` (attribute: false) — the "after" text. Default `''` renders an
  all-removals diff of `oldText`.
- `copyable: boolean = false` — shows a copy-to-clipboard button for the full unified-diff text.
  `false` (the default) renders no button.
- `layout: 'unified' | 'split' = 'unified'` (reflected) — `'unified'` (the default) renders today's
  single interleaved `<pre>`; `'split'` renders two side-by-side `[part="side"]` columns derived from
  the same diff alignment.
- `language: string = ''` — a shiki-recognized language id. Highlighting activates only when this
  has a matching entry in `languages` — there is deliberately no default full-table
  `lr-code-block`-style fallback, so this component never reaches shiki's ~200-language
  dynamic-import table.
- `languages?: Record<string, ShikiLanguageInput>` (attribute: false) — grammar definitions this
  instance can highlight, same shape as `lr-code-block-core`'s own `languages`.
- `contextLines: number | undefined` (attribute: `context-lines`) — keeps this many unchanged
  lines around each change and collapses longer unchanged runs into a localized fold marker. The
  default `undefined` shows every line; negative and non-finite values also disable folding.
- `maxLines: number = 5000` (attribute `max-lines`) — maximum logical lines accepted on either
  side. Larger input renders the localized `diffViewTooLarge` fallback without computing or
  highlighting the diff. Set the property to `Infinity` explicitly to opt into unbounded diffing.

**Events:**

- `lr-copy` (`detail: { text: string }`) — the full unified-diff text, fired on every copy-button
  activation, including an attempt whose clipboard write later fails.
- `lr-error` (no detail) — the Clipboard API was unavailable or the write failed.
- `lr-copy-error` (detail contains the text, a `LyraCopyErrorReason`, and the original error) — the
  detailed failure alias. The reason is `'unsupported' | 'denied' | 'failed'`; its error field
  preserves the original platform error for diagnostics.

The copy button stays in its resting state until `writeText()` resolves. Success renders and
announces localized `copied`; failure renders and announces localized `copyFailed`. A newer
activation, source-text change, disconnect, or document adoption retires an older pending outcome,
so stale writes cannot confirm or fail the current diff.

**Slots:** none.

**CSS parts:** `base` (the root wrapper), `line` (a single line; carries
`data-type="equal"|"add"|"remove"|"empty"|"fold"` — `"empty"` is an unbalanced-replace placeholder cell in
`layout="split"` and never carries a `+`/`-` prefix; `"fold"` is the localized unchanged-lines
marker), `copy-button` (the copy affordance, only
rendered while `copyable`), `limit` (the localized over-`maxLines` fallback), `side` (one column in
`layout="split"`, `data-side="old"|"new"`).

**Themeable custom properties:** `--lr-diff-view-font` (default `var(--lr-font-mono)`), plus
shared tokens `--lr-color-border`/`-surface`/`-success`/`-success-quiet`/`-danger`/
`-danger-quiet`/`-text`, `--lr-radius`, `--lr-space-xs`/`-s`, `--lr-font-size-sm`,
`--lr-line-height-snug`, `--lr-focus-ring-*`.

**Optional peer deps:** `shiki` (the same fine-grained `shiki/core`/`shiki/engine/oniguruma`/
`shiki/wasm` subset `lr-code-block-core` uses, never `shiki`'s full ~200-language main entry point)
— only loaded once both `language` and a matching `languages` entry are set; unset/unmatched leaves
the plain unhighlighted diff text untouched.

```html
<lr-diff-view copyable></lr-diff-view>
<script type="module">
  const diff = document.querySelector('lr-diff-view');
  diff.oldText = 'line one\nline two\nline three';
  diff.newText = 'line one\nline TWO\nline three\nline four';
  diff.addEventListener('lr-copy', (e) => console.log(e.detail.text));
  diff.addEventListener('lr-copy-error', (e) => {
    console.error(`Copy ${e.detail.reason}`, e.detail.error);
  });
</script>
```

The package root also exports the pure `computeLineDiff(oldLines: string[], newLines: string[]):
DiffOp[]` helper (plus the `DiffOp` type, `{ type: 'equal' | 'add' | 'remove'; text: string }`) — the
same line-diff function this component's own `render()`/copy handler call, exposed standalone so a
consumer can compute or unit-test the same alignment without instantiating the element at all.

**Known gotchas:**

- line splitting normalizes LF, CRLF, and lone CR endings before alignment and syntax-token indexing,
  so files that differ only by line-ending convention do not appear wholly changed.
- alignment uses Hirschberg longest-common-subsequence matching: O(n·m) time with linear working
  memory. The 5,000-line per-side default ceiling bounds pathological inputs; `Infinity` is an
  explicit performance-risk opt-out.
- the computed `diffOps` state is cached and recomputed only when `oldText`, `newText`, or
  `maxLines` changes. Copy-confirmation and other unrelated renders reuse the cached alignment.
- Changing either `oldText` or `newText` clears any in-progress "Copied" feedback immediately.

**Additional API surface:**

- `--lr-diff-view-add-background` — Added-line background.
- `--lr-diff-view-add-color` — Added-line text color.
- `--lr-diff-view-remove-background` — Removed-line background.
- `--lr-diff-view-remove-color` — Removed-line text color.
- `--lr-diff-view-fold-color` — Fold-marker text color.
- `--lr-diff-view-fold-background` — Fold-marker background.

---

## `lr-icon`

SVG icon primitive. Left alone it is dependency-free and offline: a built-in path, no icon font, no
sprite sheet, no network access at all. **New in 8.0.0**, it can also resolve a name through a
registered icon library, or fetch a single SVG document from `src` — those paths do hit the network,
and every byte they return is capped, sanitized, and rendered only if the whole pipeline succeeds.
Pairs with `lr-icon-button` (see `llms/components/lr-icon-button.md`).

**Properties:**

- `name: string = ''` (reflected once set) — a built-in glyph: `add`, `check`, `close`, `search`, `menu`,
  `chevron-left`, `chevron-right`, `chevron-down`, `calendar`, `command`, `trash`. An unknown name
  renders nothing (no error, no fallback glyph). With a registered `library`, this is instead the
  name handed to that library's resolver. The setter accepts `undefined` to clear the name; reads
  remain the canonical non-nullable `''`.
- `path: string = ''` — raw SVG path data for a glyph the built-in set doesn't cover. Takes
  precedence over `name`.
- `label: string = ''` — accessible name. Left empty (the default) the SVG is `aria-hidden="true"`,
  which is what you want whenever adjacent text already names the control. A host `aria-label` wins
  over it, and either one is applied to a fetched icon too.
- `library: string = 'default'` (reflected) — name of a library registered with `registerIconLibrary()`.
  `default` means the built-in glyph set. An **unregistered** name also falls back to the
  built-in set instead of erroring, which is what lets registration happen after first render.
- `family: string = ''` and `variant: string = ''` (reflected once set) — forwarded with `name` to
  a registered library resolver. Their vocabulary belongs to that library; for example, an icon
  host might distinguish `classic`/`sharp` families and `regular`/`solid` variants.
- `src: string = ''` — URL of a single SVG document to fetch. It applies only when no registered
  library owns the icon: no `library` set, an unregistered one, or an empty `name`. Once a
  registered library does own the name it decides alone — a resolver that returns `''` or throws
  does **not** fall back to `src`. Assigning `undefined` aborts and clears any pending remote load,
  removes the source, and reads back as `''`.
- `rotate: number = 0` (reflected once changed) — clockwise rotation in degrees, applied to the icon box. At zero
  there is no `transform` at all, so an ordinary icon never becomes a containing block; a
  non-finite value leaves the icon unrotated.
- `flip?: 'x' | 'y' | 'both' | 'horizontal' | 'vertical'` (reflected, type `LyraIconFlip`) — mirrors
  the icon about the vertical, horizontal, or both axes. `horizontal`/`vertical` are retained Lyra
  aliases for the mirrored `x`/`y` vocabulary. Unset by default.
- `canvas?: 'fixed' | 'auto' | 'square' | 'roomy'` (reflected, type `LyraIconCanvas`) — sizes the
  layout box. Unset behaves as `fixed` (1.25em × 1em); `auto` follows the SVG's intrinsic width at
  1em high; `square` is 1.25em × 1.25em; `roomy` is 1.5em × 1.5em. All scale with `font-size`.
- `autoWidth: boolean = false` (attribute `auto-width`, reflected, deprecated) — compatibility
  alias for `canvas="auto"`; an explicit `canvas` wins.
- `swapOpacity: boolean = false` (attribute `swap-opacity`, reflected) — swaps the primary and
  secondary opacity hooks on SVGs that carry `.fa-primary`/`.fa-secondary` duotone layers.
- `animation?: LyraIconAnimation` (reflected) — one of `beat`, `fade`, `beat-fade`, `bounce`,
  `flip`, `flip-360`, `shake`, `spin`, `spin-pulse`, `spin-reverse`, `spin-snap`, `spin-snap-4`,
  `spin-snap-8`, `buzz`, `wag`, `float`, `swing`, or `jello`. Every treatment stops under
  `prefers-reduced-motion: reduce`.
- `fixedWidth: boolean = false` (attribute `fixed-width`, reflected) — widens the icon _box_ to
  `--lr-icon-fixed-width` while the glyph keeps `--lr-icon-size` and centres inside it, so a column
  of differently-shaped icons lines its labels up.

**Events:**

- `lr-load` (`detail: { src: string }`) — a remote icon finished loading and is in the DOM. Also
  fires for a valid-but-empty document, which is not a failure. Never fires for a built-in glyph.
- `lr-error` (`detail: { src: string; error: unknown }`) — a remote icon could not be resolved,
  fetched, size-capped, sanitized, or parsed as an SVG document. `src` is the URL that was attempted
  (or the icon name, when a library resolver itself threw).

**Slots:** (default) — custom SVG geometry, rendered only when neither `path` nor a known `name`
resolves **and** no remote source is configured; a fetched document is never merged with slotted
nodes. Slotted nodes are cloned into the component-owned `<svg>` (Chromium does not paint SVG
geometry distributed through a slot that sits inside an SVG), so pass plain `<path>`/`<circle>`/
`<g>` elements, not a whole `<svg>`. Attribute and descendant mutations to assigned geometry are
mirrored live while connected; observation stops on detach and a reconnect synchronizes the latest
source tree.

**CSS parts:**

- `svg` — the rendered SVG, whether built-in or fetched.
- `use` — every `<use>` in the rendered SVG.
- `error` — the visually hidden, `aria-hidden` shadow mirror shown when a remote icon fails. The
  localized message (`iconLoadError`, `iconTooLarge`, or `iconSanitizerMissing`), never the raw
  platform error, is appended to Lyra's shared assertive light-DOM announcement sink. The sink
  stays silent while the icon or a composed ancestor is hidden, inert, `aria-hidden`, or hidden by
  rendered CSS.
- `empty` — the `aria-hidden` marker rendered when a remote icon resolved to an empty but valid
  document.

**Themeable custom properties:**

- `--lr-icon-size` (unset by default) — when supplied, overrides both canvas dimensions. Without
  it, the selected `canvas` uses the font-relative sizes above. Stroke color is `currentColor` and
  the host is `color: inherit`, so color comes from surrounding text with no configuration.
- `--lr-icon-fixed-width` (default `--lr-size-1-5em`) — inline size of the box while `fixed-width`
  is set.
- `--lr-icon-rotate` (default `0deg`), `--lr-icon-flip-x` and `--lr-icon-flip-y` (default `1` each) —
  the transform inputs. `--lr-icon-rotate` is written inline from the `rotate` property and the flip
  factors are set to `-1` by `flip`, so set those properties rather than these tokens.
- Shared animation controls: `--animation-delay` (default `0s`), `--animation-direction` (default
  `normal`), `--animation-duration` (default `--lr-duration-icon`, 1s),
  `--animation-iteration-count` (default `infinite`), and `--animation-timing` (default
  `--lr-easing-emphasized`).
- Animation-specific controls: `--beat-scale`; `--fade-opacity`; `--beat-fade-opacity` and
  `--beat-fade-scale`; `--bounce-height`, `--bounce-jump-scale-x`, `--bounce-jump-scale-y`,
  `--bounce-land-scale-x`, `--bounce-land-scale-y`, `--bounce-rebound`,
  `--bounce-start-scale-x`, `--bounce-start-scale-y`, and `--bounce-anticipation`; `--flip-angle`,
  `--flip-x`, `--flip-y`, `--flip-z`, `--flip-anticipation-scale`, and `--flip-overshoot`;
  `--buzz-distance`; `--wag-angle`; `--swing-angle`; `--jello-scale-x` and `--jello-scale-y`; and
  `--float-height`, `--float-drift`, `--float-tilt`, `--float-squash-x`, `--float-squash-y`,
  `--float-stretch-x`, and `--float-stretch-y`.
- Duotone controls: `--primary-color`/`--secondary-color` (default `currentColor`) and
  `--primary-opacity`/`--secondary-opacity` (defaults `1`/`0.4`). `swap-opacity` exchanges which
  opacity each layer receives without exchanging its color.

**Optional peer deps:** `dompurify` — needed **only** for `library`/`src` fetching, never for the
built-in glyphs. It is imported lazily on the first remote load; if it can't be loaded the icon
fails closed (nothing rendered, localized alert, `lr-error`) rather than injecting unsanitized
markup.

### Registering an icon library

A library is a pure name-to-URL function plus an optional mutator, registered once at application
start. The component keeps every security-relevant step: the resolved URL still goes through the
fetch allowlist, the response is still byte-capped, and the markup is still sanitized — a resolver
cannot widen what an icon is allowed to render.

```ts
import '@aceshooting/lyra-ui/components/utility/icon/icon.js'; // registers <lr-icon>
import {
  registerIconLibrary,
  unregisterIconLibrary,
  getIconLibrary,
} from '@aceshooting/lyra-ui/components/utility/icon/icon-library.js';

registerIconLibrary('material', {
  // May return a URL directly or resolve one asynchronously. All three reflected lookup fields
  // are provided, so a library decides their vocabulary and URL layout.
  resolver: async (name, family, variant) => `https://cdn.example.com/material/${family}/${variant}/${name}.svg`,
  // Optional. Runs on the already-sanitized, component-owned <svg> before it is rendered —
  // recolouring, adding a viewBox, stripping a hardcoded width/height. It must not reintroduce
  // markup from an untrusted source, and a throwing mutator fails the load.
  mutator: (svg) => {
    svg.setAttribute('fill', 'currentColor');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  },
});

await getIconLibrary('material')?.resolver('star', 'classic', 'solid');
unregisterIconLibrary('material'); // icons using it revert to the built-in glyph set
```

```html
<lr-icon library="material" family="classic" variant="solid" name="star" label="Favourite"></lr-icon>
<lr-icon library="material" name="delete" fixed-width></lr-icon>
<lr-icon name="search" canvas="square" animation="beat"></lr-icon>
```

Types: `LyraIconLibraryResolver = (name: string, family: string, variant: string) => string |
Promise<string>`, `LyraIconLibraryMutator = (svg: SVGElement) => void`, and
`LyraIconLibraryOptions = { resolver; mutator? }` are exported from the same module.

**Known gotchas:**

- Registration order doesn't matter. `registerIconLibrary()` re-resolves every currently rendered
  `<lr-icon>` using that name, so icons can be on the page first; re-registering the same name with
  a different resolver re-resolves them again, and `unregisterIconLibrary()` reverts them to the
  built-in glyph. While a remote icon resolves, nothing is drawn — the box already holds its size,
  and a placeholder glyph would be a flash of the wrong icon.
- A resolver returning an empty string (an unknown name) restores the built-in render and fetches
  nothing. A resolver that throws or rejects is a failure: localized alert plus `lr-error`.
  Resolver promises are generation-guarded: if `name`, `family`, `variant`, or `library` changes
  while one is pending, its stale URL is never fetched.
- Remote loading is fail-closed by construction: the URL must pass the shared fetch allowlist
  (`http:`, `https:`, `blob:`, `data:`, and relative URLs — a `javascript:` URL is never fetched),
  the response is capped at 1 MiB before any parser sees it, and DOMPurify's SVG profile runs
  unconditionally, sanitizing straight to DOM nodes rather than to a re-parsed string. A response
  that isn't an SVG document is rejected, and its text never reaches the DOM.
- Matching requests share a bounded cache of canonical sanitized SVG nodes. Concurrent icons issue
  one fetch, a disconnected subscriber does not abort work another icon still needs, and retryable
  failures are evicted. The canonical node is never rendered or mutated: each icon deep-clones it,
  then invokes that library's trusted mutator on the private clone. This keeps one library's
  recoloring from poisoning another library, a direct `src`, or a later cache hit.
- A superseded load can never paint over a newer one, and a detached icon holds no half-finished
  remote state. Reconnecting re-resolves the library and can reuse a retained sanitized resource.
- `rotate`/`flip` are physical, not direction-relative: `flip="x"` produces the same
  mirrored artwork in LTR and RTL. A glyph that must follow reading direction is mirrored by the
  wrapping part of the component that owns it; a second, direction-driven flip here would silently
  cancel that one out.

## `lr-visually-hidden`

Hides its slotted content from sight while leaving it in the accessibility tree, so a screen reader
still announces it. Uses the clip-rect technique (`position: absolute` in a 1px box with
`clip-path: inset(50%)`), never `display: none` or `visibility: hidden` — either of those would
remove the content from the accessibility tree along with the viewport, which is the whole failure
mode this element exists to avoid.

`:host(:focus-within)` restores the element to normal flow, so anything focusable inside becomes
visible the moment a keyboard user reaches it. That is what makes it usable for a skip link.

**Properties:** none. **Events:** none. **Slots:** default (the content to hide).
**CSS parts:** none — the host itself is the box. **Themeable custom properties:** none.

```html
<lr-visually-hidden><a href="#main">Skip to main content</a></lr-visually-hidden>
```

Every declaration is `!important`, deliberately: the element's contract is that the content is
hidden, and a consumer stylesheet that accidentally set `position: static` on it would silently
expose the text. Use the `:focus-within` escape hatch rather than overriding the base rules.

---

## `lr-divider`

A semantic separator: renders `<hr part="base" role="separator" aria-orientation="…">`. A host
`aria-label` is forwarded to that inner semantic owner.

**Properties:** `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) and
`vertical: boolean = false` (reflected Shoelace-compatible shorthand).

**Events:** none. **Slots:** none. **CSS parts:** `base`.

**Themeable custom properties:** `--color` (falls back to `--lr-color-border`), `--width` (falls
back to `--lr-border-width-thin`), and `--spacing` (default `0`, applied on the cross axis).

The host is `display: block` when horizontal and `display: inline-block; block-size: 100%` when
vertical, so a vertical divider fills its flex/grid row's height with no extra CSS — but it needs a
parent that actually has a resolved height.

---

## `lr-format-number`

`Intl.NumberFormat` output.

Shared by all four formatters (`lr-format-number`, `lr-format-date`, `lr-format-bytes`,
`lr-relative-time`): each is text-only — a `display: inline` host with **no CSS parts, no events, and
no themeable custom properties of its own** — rendering one formatted string into its shadow root.
Locale comes from the shared `effectiveLocale` (this element's own `locale`, else the nearest
inherited `lang`; see `llms/shared.md`) and is passed to `Intl` as `undefined` when it resolves
empty, which means "the runtime's default locale". Every `Intl` instance is pulled from the shared
memoized `internal/intl-cache.ts` (one instance per locale + options pair, LRU-capped), so these are
cheap to use per row in a large table or feed.

Malformed runtime options fall back to a safe option set without discarding an otherwise-valid
effective locale. Only a malformed locale itself falls back to the runtime default.

**Properties:**

- `value: number = 0`
- `type: 'currency' | 'decimal' | 'percent' = 'decimal'`
- `currency: string = 'USD'` and `currencyDisplay: 'symbol' | 'narrowSymbol' | 'code' | 'name' =
'symbol'` (`currency-display`); used only by currency formatting
- `withoutGrouping: boolean = false` (`without-grouping`) and `noGrouping: boolean = false`
  (`no-grouping`) — Web Awesome/Shoelace aliases; either disables grouping separators
- `notation: 'standard' | 'compact' | 'scientific' | 'engineering' = 'standard'`
- `minimumIntegerDigits?: number` (attribute `minimum-integer-digits`)
- `minimumFractionDigits?: number` (attribute `minimum-fraction-digits`)
- `maximumFractionDigits?: number` (attribute `maximum-fraction-digits`)
- `minimumSignificantDigits?: number` / `maximumSignificantDigits?: number` (matching kebab-case
  attributes)

**Slots:** default — fallback content, rendered only when `value` is not finite (`NaN`/`Infinity`,
e.g. a malformed attribute) or the formatted string is empty.

All digit properties are finite-integer guarded before `Intl` construction: integer/significant
digits clamp to `[1, 21]`, fractions to `[0, 100]`, and crossed minimum/maximum pairs are ordered.
Leaving one `undefined` preserves `Intl`'s own defaults. Closed-set values assigned through untyped
JavaScript fall back to their documented defaults.

## `lr-format-date`

`Intl.DateTimeFormat` output. Text-only host — no CSS parts, events, or own tokens; locale
resolution and `Intl`-instance caching are as described under `lr-format-number` above.

**Properties:**

- `date: string | number | Date = new Date()` — unset means the construction-time current instant.
  **Changed in 8.0.0:** the former empty-string default rendered fallback content
- optional granular fields: `weekday`, `era`, `year`, `month`, `day`, `hour`, `minute`, `second`,
  and `timeZoneName` (attribute `time-zone-name`), each restricted to its corresponding published
  `Intl.DateTimeFormat` literal set
- `dateStyle?: 'full'|'long'|'medium'|'short'` (attribute `date-style`), `timeStyle?: …`
  (attribute `time-style`) — the preset-style set
- `timeZone?: string` (attribute `time-zone`) — an IANA zone name, forwarded through **both** option
  sets
- `hourFormat: 'auto' | '12' | '24' = 'auto'` (`hour-format`) — maps to `hour12` when explicit

Setting either `dateStyle` or `timeStyle` switches the component to the preset-style set and the
granular fields are then ignored entirely (`Intl` throws when the two are mixed); leave both unset
to use the granular set. An unparseable `date` renders the default slot. An invalid
`timeZone` throws a `RangeError` inside `Intl`, which is caught and retried once without the zone —
so the output falls back to the browser's local zone instead of failing to render. Valid output is
wrapped in semantic `<time datetime="…">`.

**Slots:** default — fallback content for an invalid/unparseable `date`.

## `lr-format-bytes`

Byte/bit output via `Intl.NumberFormat`'s `style: 'unit'`, so the unit name is localized too.
Text-only host — no CSS parts, events, or own tokens; locale resolution and
`Intl`-instance caching are as described under `lr-format-number` above.

**Properties:**

- `value: number = 0`
- `unit: 'byte' | 'bit' = 'byte'`
- `display: 'long' | 'short' | 'narrow' = 'short'` — forwarded as `unitDisplay`
- `unitStep: number = 1000` (attribute `unit-step`) — mapped decimal scaling. **Changed in 8.0.0:**
  the former Lyra default was `1024`; it remains an opt-in extension
- `decimals: number = 1` — maximum fraction digits on the scaled amount

**Slots:** default — fallback content, rendered only when `value` is not finite.

The selected ladder is `byte`/`kilobyte`… or `bit`/`kilobit`… through peta and saturates at the
top; the index is `floor(log|value| / log(unitStep))`, and zero stays in the base unit. Magnitudes
below one remain at index zero. `unitStep` is normalized to a finite number `> 1`, falling back to
`1000`; `decimals` clamps to `[0, 10]`. Setting `unitStep="1024"` still prints SI-named `kB`/`MB`
units, not `KiB`/`MiB`, because `Intl` exposes no binary unit names.

## `lr-relative-time`

`Intl.RelativeTimeFormat` output ("3 hours ago", "in 2 days"), relative to `Date.now()` at render.
Text-only host — no CSS parts, events, or own tokens; locale resolution and `Intl`-instance caching
are as described under `lr-format-number` above.

**Properties:**

- `date: string | number | Date = new Date()` — the target instant; unset means now. **Changed in
  8.0.0:** the former empty-string default rendered no content
- `unit: 'second'|'minute'|'hour'|'day'|'week'|'month'|'quarter'|'year'|'auto' = 'auto'` — `'auto'`
  picks the largest unit whose own length fits inside the elapsed time, then rounds; naming a unit
  forces it (so a 90-minute delta with `unit="day"` rounds to "today"/0 days)
- `numeric: 'always' | 'auto' = 'auto'` — `Intl`'s own option: `'auto'` allows "yesterday"/"tomorrow"
  in place of "1 day ago"/"in 1 day"; `'always'` keeps the numeric phrasing
- `format: 'long' | 'short' | 'narrow' = 'long'` — forwarded as relative-time `style`
- `sync: boolean = false` — schedules one timeout at the next rounded-value or auto-unit boundary,
  rather than fixed polling; it is cleared on disconnect and recalculated when inputs change

Valid output is semantic `<time datetime="…">`. **Slots:** none — an unparseable `date` renders the
empty string, with no fallback-content hook (unlike the three `lr-format-*` components above).

## `lr-known-date`

A form-associated control for a date the user already knows (a birthdate, a passport expiry),
collected as three plain day/month/year number fields in the locale's natural order rather than a
calendar popup. Uses the shared `FormAssociated` mixin; the submitted value is always canonical ISO
8601 (`YYYY-MM-DD`), or `''` while any field is blank or the combination isn't a real calendar date.

**Properties:**

- `value: string` — canonical `YYYY-MM-DD` or `''`. Assignment goes through a strict-ISO gate:
  a non-zero-padded (`"2007-3-27"`) or calendar-invalid (`"2007-02-30"`) literal sanitizes to `''`
  and clears all three fields. Programmatic assignment never emits `input`/`change`
- `valueAsDate: Date | null` — the same value as a local-midnight `Date`; settable (assigning
  `null` clears)
- `parts: DateParts` — the live raw `{ day, month, year }` strings. Assigning a complete valid set
  synchronizes the canonical `value`; assigning an incomplete or impossible set clears `value`
- `valueInput: HTMLInputElement` — hidden native `type="date"` mirror kept synchronized with
  `value`, `min`, `max`, `required`, `disabled`, and `readonly` for integrations that inspect native
  date constraints
- `min: string = ''`, `max: string = ''` — inclusive `YYYY-MM-DD` bounds, surfaced as
  `rangeUnderflow`/`rangeOverflow`
- `readonly: boolean = false` (reflected) — also suspends all validity flags
- `appearance: 'filled' | 'outlined' | 'filled-outlined' = 'outlined'` (reflected) — field fill and
  border treatment; `pill: boolean = false` (reflected) rounds every field fully
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — control density on the library's
  shared six-step ladder, scaling each field's height floor, padding, font size and corner radius
  together so a birthdate field lines up with the `lr-input`/`lr-date-input` beside it at the same
  declared size. `'small'`/`'medium'`/`'large'` are accepted as exact synonyms of `'s'`/`'m'`/`'l'`,
  so migrating from an upstream that spells them that way needs no attribute rewrite. Every tier
  resolves to at least the 24px pointer-target floor, so even `'2xs'` stays usable
- `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute `error-text`)
- `locale: string = ''` — BCP-47 override for field order and per-field label sampling only
  (redeclared non-reflecting over the base `locale`, like `lr-date-input`)
- `autocomplete: string = ''` — the special value `'bday'` expands to
  `bday-day`/`bday-month`/`bday-year` across the three fields; `'on'` and `'off'` apply to all three,
  while any other non-empty field-specific token is forwarded only to the year field
- `withLabel: boolean = false` (`with-label`) and `withHint: boolean = false` (`with-hint`) — SSR
  slot-presence hints. Normal client rendering detects slotted label/hint content automatically
- `dayLabel: string = 'Day'` (`day-label`), `monthLabel: string = 'Month'` (`month-label`),
  `yearLabel: string = 'Year'` (`year-label`) — visible **and** accessible per-field labels; each
  routes through `localize()` only while left at its literal default
- `accessibleLabel: string | null = null` (attribute `aria-label`) — applied to `[part="fieldset"]`,
  which owns the group role, overriding the `<legend>`-derived name
- The shared form surface adds `defaultValue`, `customError` (`custom-error`), `getForm()`,
  `checkValidity()`, `reportValidity()`, and `setCustomValidity(message)`.

For mapped JavaScript/TypeScript compatibility, assigning `null` to `name` clears it to the
canonical `''` read value and removes the `name` attribute. The getter remains non-nullable.

**Methods:** `focus(options?)` focuses the first empty field in locale order (or the first field when
all are filled); `blur()` blurs whichever field currently has focus; `resetValidity()` clears a
consumer-supplied custom error and republishes intrinsic constraints;
`formStateRestoreCallback(state)` restores a string state and clears for other shapes.

**Events:** native bubbling/composed `InputEvent` `input` (every keystroke) and native
bubbling/composed `Event` `change` (a field blur where the composite value newly transitioned),
plus re-dispatched bubbling/composed `focus` and `blur` (`blur` fires once when focus
leaves all three fields, not per field-to-field Tab; each entry into the control likewise produces
exactly one public `focus`, with the private trusted focus suppressed). `input`/`change` detail is
`{ value, day, month, year, field }` — `value` is the canonical ISO date or `''`, `day`/`month`/`year`
are the live raw typed text, and `field` is `'day' | 'month' | 'year'`, whichever was last edited.
`lr-invalid` (no detail) is emitted once as a bubbling/composed alias when native validity fails.

**Slots:** `label`, `hint`, `error` (each rendered alongside its matching property).

**CSS parts:** `base`, `known-date`, and `form-control` are aliases on the same outer wrapper;
`fieldset` (the `<fieldset>` grouping the fields —
carries `aria-label` when `accessibleLabel` is set), `legend` (the `<legend>`; hidden when there is
no label, and grows a `*` suffix while `required`), `form-control-label` (`label` is its deprecated
compatibility alias), `fields` / `form-control-input` (aliases on the flex row), `field` (one field
block, repeated three times, `data-field="day"|"month"|"year"`) plus its matching `field-day`,
`field-month`, or `field-year` token, `field-input` (the native
`<input type="text" inputmode="numeric">` inside it, same `data-field` marker), `field-label` (the
small per-field text label), `hint`, `error` (visible non-live validation text and the fields'
`aria-describedby` target).

Once initial rendering and slot distribution settle, a newly visible or changed validation error
is appended exactly once to Lyra's shared assertive light-DOM announcement sink. Identical renders
are deduplicated, while clearing and later re-showing the same error announces it again. Initial
connection and reconnection do not replay an existing error. Hidden, inert, CSS-hidden, and
`aria-hidden` slotted error content is excluded; revealing meaningful error text is the change that
announces it. Within that error content, `display:none` and `content-visibility:hidden` prune a
branch; a `visibility:hidden|collapse` wrapper suppresses its own text while a descendant that
restores `visibility:visible` remains exposed. Updates also stay silent while the control or a
composed ancestor is hidden, then the current error announces if it becomes newly visible. This
tracking follows nested forwarding slots as well: mutations and reassignment of their flattened
assigned nodes update the announcement without requiring the wrapper component to re-render.

The `label` part alias was deprecated in 8.0.0 in favor of the shared form vocabulary
`form-control-label`. Both names remain on the same node during the compatibility window; use
`::part(form-control-label)` in new CSS. The alias will not be removed before 10.0.0.

**The required marker.** The `*` the legend grows while `required` is the library's shared
required-field marker, and it takes the same three consumer-settable properties every other
labelled control in the library does: `--lr-form-control-required-content` (the glyph, as a quoted
CSS `content` string; `''` suppresses it), `--lr-form-control-required-color` (default
`var(--lr-color-danger)`) and `--lr-form-control-required-offset` (default `0`). One declaration on
an ancestor — `:root` included — retunes this marker along with every other one in the page. The
one detail specific to this component: the glyph hangs off `[part="legend"]` rather than
`[part="form-control-label"]`, because the label part here is a `<span>` *inside* the legend and
the marker belongs after the whole label. With no label the legend is hidden and nothing is
painted. Full description in `llms/shared.md` → "The required-field marker".

**CSS states:** `:state(blank)` while the composite value is empty/incomplete;
`:state(disabled)` for direct or fieldset-cascaded disablement.

**Themeable custom properties:** `--lr-known-date-field-padding-block`,
`--lr-known-date-field-padding-inline`, `--lr-known-date-field-font-size` and
`--lr-known-date-field-min-height` all read the shared control ladder rather than a hand-kept copy
of the scale — respectively `--lr-form-control-padding-block`, `--lr-form-control-padding-inline`,
`--lr-form-control-font-size`, and `max(var(--lr-form-control-height), var(--lr-size-24px))`, each
of which the ladder re-points per `size` tier. That is what keeps the three fields the same height
as an `<lr-input>`/`<lr-date-input>` in the same form row at every tier; the
`--lr-known-date-field-*` names are unchanged and are still the documented override point. The
min-height resolves to 24px at `2xs`/`xs` (WCAG 2.2 SC 2.5.8's pointer-target floor, above the
ladder's own 1.25rem/1.5rem there), 1.875rem at `s`, 2.5rem at `m`, 3rem at `l`, 3.5rem at `xl`.
Also `--lr-known-date-field-height`,
`--lr-known-date-field-gap` (default `--lr-space-s` — gap between the three field blocks),
`--lr-known-date-day-field-width` / `--lr-known-date-month-field-width` (default `--lr-size-3-5em`)
and `--lr-known-date-year-field-width` (default `--lr-size-5em`) — the per-field input widths, not
size-scaled. `--lr-known-date-invalid-border-color` (default `var(--lr-color-danger)`) — border
color of each `field-input` while `:host([data-invalid])` is set. Component-scoped indirection over
the shared `--lr-color-danger` token, so a consumer can retheme just this invalid-field border
without repainting every other component that reads the same shared danger token.

The two height knobs work as a pair on `[part='field-input']`, the same way
`lr-input`/`lr-select`/`lr-combobox`/`lr-date-input` expose theirs:

- `--lr-known-date-field-min-height` is a **floor**, re-pointed per `size` tier through the shared
  ladder. At the small tiers it exceeds the field's own padding/font-driven height and is what
  actually pins the rendered box — that is how `2xs`/`xs` keep a 24px pointer target; at `l`/`xl`
  the content height already clears it, so it is inert there and only raising it changes anything.
- `--lr-known-date-field-height` pins an **exact** height (both floors and caps), so the three
  inputs can line up with a neighbouring control of a known height. It is **undeclared by
  default** — the field grows to fit its content. Never set it to `auto`: `auto` is a valid
  declared value that wins over the `var()` fallback arm, which would make the per-tier floor
  dead code. To go back to the default behavior, remove the declaration rather than neutralizing
  it. Because the component never declares it, it can be set inline, from an ancestor, or from an
  outer-tree rule.

**Known gotchas:**

- Field _order_ is derived from the locale by formatting a probe date (Jan 2 2026) with
  `Intl.DateTimeFormat` and reading back the part order — not from `Date.parse()`'s mm/dd/yyyy bias.
  It falls back to `month, day, year` only when that sampling fails.
- Auto-advance (typing a field's last digit moves to the next) and backspace-into-the-previous-field
  are this library's own additions, not Web Awesome parity. Auto-advance is purely digit-count
  based, never value based.
- Each `<input>` keeps exactly the digits that were typed — never zero-padded, range-clamped, or
  reverted to a previous value; only the composite `value` is normalized to zero-padded ISO.
- Non-digit characters are stripped in the `input` handler before they reach field state (the
  native `<input>`'s own value is rewritten in the same tick). Locale-specific numerals _are_
  accepted and transliterated to ASCII, not rejected: Arabic-Indic (`٠`–`٩`) and Extended
  Arabic-Indic/Persian (`۰`–`۹`) digits are mapped unconditionally, and the digits of
  `effectiveLocale`'s own numbering system are added on top via `Intl.NumberFormat`, so typing
  `٢٠٢٦` into the year field commits `2026`.
- ArrowLeft/ArrowRight cross fields at a field's text boundary, and the _physical_ key meaning
  "next field" flips under an inherited `dir="rtl"`; the locale-derived field order itself does not.
- A blank composite is `valueMissing` only when **all three** fields are blank; a partially typed
  required date reports `badInput` instead.
- The host carries a `:state(blank)` custom state whenever `value === ''`, and `data-invalid` only
  once touched (first blur out of the whole control) and actually invalid.

**Additional API surface:**

- `click()` — Activates the first native field in locale order.

## `lr-random-content`

Shows a chosen subset of its slotted children and hides the rest — A/B copy testing, testimonial
rotation, varying marketing copy per render or interval — with no custom JS beyond slotting the
candidates. Selection is applied by setting `hidden` + `aria-hidden` directly on the light-DOM
children; nothing is moved or cloned.

**Properties:**

- `items: number = 1` — how many children are shown **simultaneously**; a count, not the pool.
  Normalized to a finite integer clamped to `[1, poolSize]`
- `mode: 'unique' | 'random' | 'sequence' = 'unique'` — `'random'` re-rolls freely (repeats
  possible); `'unique'` retries up to 10 times to avoid re-picking the previous selection (only
  when the pool is larger than `items`); `'sequence'` walks the pool in order with a wrapping cursor
- `animation: 'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' = 'none'`
  (reflected) — entrance effect applied to a child the instant it becomes shown
- `autoplay: boolean = false` (reflected)
- `paused: boolean = false` (reflected) — suppresses autoplay. The built-in pause/resume action
  toggles this state; a programmatic assignment remains silent.
- `autoplayInterval: number = 3000` (attribute `autoplay-interval`) — clamped to a 1000 ms floor

**Methods:** `randomize(): Element[]` — re-selects using the current `mode`, applies
`hidden`/`aria-hidden`, emits `lr-content-change`, appends the exposed selection text to the shared
polite announcement sink (even when `autoplay` is enabled), and returns the elements now shown.
Does **not** reset or restart the autoplay timer.

**Events:** `lr-content-change` (`detail: { items: HTMLElement[] }` — the exact elements now shown,
in display order). Fires on first render, on `randomize()`, on a real slot-content change, and on
each autoplay tick; never when the eligible pool is empty.

**Slots:** default — the candidate pool. Direct **element** children are eligible. When a wrapper
places a forwarding `<slot>` directly in the pool, its flattened projected elements become the
candidates; an arbitrary nested custom-element subtree remains one opaque direct candidate.

**CSS parts:** `base` — the ordinary wrapper around the default slot; a host `aria-label` gives it
a non-live `role="group"` and is included as announcement context. Selection changes after mount
are appended to Lyra's shared light-DOM polite announcement sink; nested `hidden`, `inert`,
`aria-hidden="true"`, `display:none`, and `content-visibility:hidden` branches are omitted. A
`visibility:hidden|collapse` wrapper suppresses its own text but not a descendant that restores
`visibility:visible`. Timer-driven autoplay ticks stay silent to avoid spam,
but a direct `randomize()` call still announces while `autoplay` is enabled. Initial connection and
reconnection are also silent, including a detached reactive selection change whose update settles
during reattachment; changes while the component or a composed ancestor is accessibility-hidden
stay silent too. A nested forwarding slot contributes flattened assigned content rather than its
fallback; later assignment and assigned-node text/style/visibility changes announce only when they
change the currently exposed selection, while initial distribution remains silent. `pause-button`
— the localized autoplay pause/resume action, rendered
only while `autoplay` is enabled and exposed as a toggle with `aria-pressed`.

**Themeable custom properties:** Web Awesome aliases `--animation-duration` (default `300ms`),
`--animation-easing` (default `ease`), and `--animation-translate` (default
`--lr-size-0-5em` — travel distance for the four directional `fade-*` effects) feed the mapped
`--lr-animation-duration`, `--lr-animation-easing`, and `--lr-animation-translate` names. Existing
`--lr-random-content-animation-duration`, `--lr-random-content-animation-easing`, and
`--lr-random-content-animation-translate` names remain fallbacks.

**Web Awesome migration note:** this mapping requires manual review rather than a mechanical tag
rename. Candidate eligibility and selection semantics differ, and Lyra additionally suppresses
autoplay under `prefers-reduced-motion: reduce` and renders a visible localized pause/resume
control. Review all four behaviors before replacing `<wa-random-content>`.

**Known gotchas:**

- There is no next/previous/shuffle action; the only built-in control is the autoplay pause/resume
  button. Selection changes via autoplay or `randomize()`.
- Autoplay is suppressed entirely under `prefers-reduced-motion: reduce`, and whenever the eligible
  pool has fewer than 2 children. The preference is re-observed live, not just read once.
- `fade-left`/`fade-right` are physical-direction transforms (upstream naming), deliberately **not**
  mirrored under `:dir(rtl)` — they are not previous/next navigational semantics.
- The entrance animation targets `::slotted(*)`, which the library-wide reduced-motion rule cannot
  reach (it only covers the shadow tree), so this component guards it with its own media query.
- The host is `display: block`. For an inline text-fragment swap inside a sentence, override
  `lr-random-content { display: inline; }` from outside; `display: contents` is deliberately not
  used (a11y-tree inconsistencies across engines).
- Slot/focus microtasks and autoplay never queue new selection work while detached; reconnecting
  starts again from current state rather than replaying stale work.

## `lr-tour`

A spotlight-and-step guided walkthrough for first-run onboarding: each step anchors a popover to a
target element elsewhere in the page via the shared Floating UI positioner, over a dimmed
full-viewport backdrop with a cutout/ring around the current target, with Next/Previous/Skip
controls and a step-progress indicator. Controlled component — `steps` is never mutated; only
`activeIndex` and `open` are self-managed.

**Properties:**

- `open: boolean = false` (reflected) — no separate `show()`/`hide()`; set this or call
  `start()`/`end()`
- `steps: TourStep[] = []` (attribute: false) — empty renders nothing
- `activeIndex: number = 0` (attribute `active-index`, reflected) — clamped to
  `[0, steps.length - 1]` as a finite integer, including for a direct property/attribute write that
  bypasses `goToStep()`; fractions floor and non-finite values fall back to `0`
- `placement: Placement = 'bottom'` (reflected) — tour-level Floating UI default, overridable per
  step; resolved through `rtlAwarePlacement()`
- `distance: number = 12` — px offset between target and popover. Tour-level only (no per-step
  override); may be negative for overlap
- `spotlightPadding: number = 4` (attribute `spotlight-padding`) — extra px between the target's box
  and the cutout/ring; overridable per step
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — a deliberate inversion of
  `lr-dialog`'s `lightDismiss`: a backdrop click does **nothing** by default so a stray click
  can't discard onboarding progress. Set it to make a backdrop click `end('skip')`
- `showProgress: boolean = true` (attribute `show-progress`) — renders the "Step X of Y" text + dots
- `aria-label` (a plain host attribute, not a public JS property) — names **every** step's popover,
  overriding each step's own `heading` as the `aria-labelledby` source

**Exported types:** `TourStep { id: string; target: TourTarget; heading: string; content?: string;
placement?: Placement; spotlightPadding?: number; interactiveTarget?: boolean; hidePrevious?: boolean }`;
`TourTarget = string | HTMLElement | (() => HTMLElement | null)` — a string resolves via
`ownerDocument.querySelector` (top-level light DOM only). Every form resolves exactly once when the
step becomes active and is kept as one connected snapshot for that activation, then resolves again
on a later activation/reconnect. Invalid selectors, throwing resolvers, non-`HTMLElement` results,
and detached elements use the normal missing-target path instead of throwing. `heading` is required
and becomes the panel's accessible name; `content` renders as plain text (no HTML/markdown parsing).
`TourEndReason = 'completed' | 'skip' | 'escape' | 'api' | 'unmount' | (string & {})`.

**Methods:** `start(index = 0)` (clamps, opens, emits `lr-tour-start`), `next()` (on the last step
ends with `'completed'` instead), `back()` (no-op on the first step), `goToStep(index)` (clamped),
`skip()` (sugar for `end('skip')`), `end(reason: TourEndReason = 'api')`.

**Events:** `lr-tour-start` (`detail: { index }`, not cancelable); `lr-tour-step-change`
(`detail: { index, previousIndex, step, via: 'next'|'back'|'goto' }`, **cancelable** — fires before
`activeIndex` changes, so `preventDefault()` gates advancement on a real action; a deliberate
departure from `lr-carousel`'s non-cancelable `lr-slide-change`); `lr-tour-end`
(`detail: TourEndReason`, cancelable except in practice for `'unmount'`, which is emitted when the
element is removed while still open by something other than its own `end()`);
`lr-tour-target-missing` (`detail: { index, step }`, informational — the tour does **not** auto-end,
it renders that step viewport-centered with no spotlight).

**Slots:** default — rich content replacing the active step's plain-text `content`. Not scoped per
step: a consumer needing different rich content per step swaps the slotted children itself (e.g. on
`lr-tour-step-change`).

**CSS parts:** `backdrop` (the full-viewport `<svg>` scrim with the cutout, `aria-hidden`),
`spotlight` (the decorative ring around the padded target rect, `pointer-events: none`),
`popover` (the step panel, `role="dialog"`, `aria-modal="true"` for default steps and `"false"` for
an `interactiveTarget` step, `data-unanchored` when the target didn't resolve), `heading` (the
`aria-labelledby` target), `body` (slot or `step.content`),
`progress` (wrapper), `progress-text` (the "Step X of Y" text — an `aria-describedby` target),
`progress-dot` (one decorative dot per step, `data-current` on the active one, `aria-hidden`),
`footer` (the control row), `previous-button`, `skip-button`, `next-button` (the Next control's
label switches to Done on the last step).

**Themeable custom properties:** `--lr-tour-backdrop-color` (default `--lr-color-overlay`),
`--lr-tour-spotlight-radius` (default `--lr-radius` — shared by the cutout and the ring),
`--lr-tour-spotlight-ring-color` (default `--lr-color-brand`), `--lr-tour-spotlight-ring-width`
(default `--lr-border-width-medium`), `--lr-tour-popover-max-width` (default `--lr-size-22rem`,
further capped by `--lr-popover-viewport-clamp` and the positioner's available space),
`--lr-tour-progress-dot-current-bg` (default `var(--lr-color-brand)`) — background of
`progress-dot` for the current step. Component-scoped indirection over the shared `--lr-color-brand`
token, so a consumer can retheme just the current-step dot without repainting every other component
that reuses the same shared brand token.

`--lr-popover-viewport-clamp` (default `92vw`, from `--lr-theme-popover-viewport-clamp`) is the
shared ceiling that keeps any floating surface inside a narrow viewport. `lr-tour`,
`lr-mention-popover`, and `lr-export-button` all `min()` their own max-inline-size against it, so
retuning `--lr-theme-popover-viewport-clamp` once at `:root` narrows or widens all three together
rather than per component.

**Known gotchas:**

- By default the spotlighted target is **non-interactive**: it stays visible and announceable (not
  `inert`, not `aria-hidden`) but every pointer event over the viewport is captured by the backdrop.
  A default step uses a modal overlay and traps focus in the panel. Set `step.interactiveTarget` to
  clip the backdrop around the target, switch the panel to nonmodal semantics, and install an
  explicit two-way Tab route between the panel and the live target, so both pointer and keyboard
  interaction remain reachable.
- Each step transition mounts a genuinely new popover node (keyed on `step.id`) so focus reliably
  re-enters the panel — don't cache a reference to `[part="popover"]` across steps.
- No `Home`/`End` shortcut and no click-to-jump progress dots (unlike `lr-stepper`): later steps may
  depend on an earlier step's side effect having run. `goToStep()` is available for a caller that
  knows better. ArrowRight/ArrowLeft do move between steps (swapped under RTL), except while focus
  is in an `input`/`textarea`/`contenteditable` inside slotted content.
- A direct `HTMLElement` target must be connected at activation and is treated as missing after a
  remount; prefer a selector string or resolver function for targets that can be replaced between
  activations.
- The active step's target is `scrollIntoView({ block: 'center' })`'d on activation, smoothly unless
  `prefers-reduced-motion: reduce`.
- Changing `placement`, `distance`, or tour-level `spotlightPadding` while open repositions/repaints
  the current step live without scrolling again or emitting a duplicate `lr-tour-target-missing`.
