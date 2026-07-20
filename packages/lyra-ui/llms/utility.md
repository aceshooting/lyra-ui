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

**Methods:** `focus(options?)` and `blur()` forward to the native trigger button.

**Events:** `lr-export` (`detail: { format: string }`, **cancelable** — call `preventDefault()` to
substitute your own server-generated download instead of the built-in client-side one),
`lr-export-complete` (`detail: { format: 'csv' | 'json' }`, fires only after a non-cancelled
built-in download completes), `lr-show`, `lr-hide` (format-menu visibility transitions)

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
  exp.columns = [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }];
  exp.formats = ['csv', 'json']; // shows a format-choice menu instead of exporting immediately
  exp.addEventListener('lr-export', (e) => console.log('exporting', e.detail.format));

  // Custom formats supply menu copy but remain application-handled.
  exp.formats = [
    'csv',
    { id: 'xlsx', label: 'Excel workbook', description: 'Preserves spreadsheet data types', extension: 'xlsx' },
  ];
  exp.addEventListener('lr-export', async (e) => {
    if (e.detail.format !== 'xlsx') return;
    e.preventDefault();
    exp.loading = true;
    try { await exportWorkbook(exp.rows); }
    finally { exp.loading = false; }
  });
</script>
```

Package-level CSV utilities (used internally, also exported for standalone use — `import {
escapeCsvField, buildCsv, downloadBlob } from '@aceshooting/lyra-ui'`):
```ts
escapeCsvField(value: unknown): string   // quotes/escapes; neutralizes formula-injection (=,+,@,tab,CR) with a leading apostrophe — a bare leading '-' is deliberately left alone (OWASP guidance: it's not itself formula syntax, and guarding it would mangle ordinary negative numbers)
buildCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string  // CRLF-joined, header row included
downloadBlob(content: string, filename: string, mime: string): void      // triggers a browser download
```

**Known gotchas:**
- CSV and JSON are the only built-in encoders. To offer XLSX/PDF/etc., pass an
  `ExportFormatDescriptor` and handle its id from `lr-export`; custom formats never trigger a
  download or `lr-export-complete` on their own. A descriptor's optional `extension` is metadata
  for that handler, not automatic filename handling.
- CSV formula-injection guarding and the deferred (5s) `URL.revokeObjectURL` (works around Safari
  cancelling in-flight downloads on immediate revoke) are genuine, safe-to-rely-on strengths.
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

A standalone icon-only copy-to-clipboard button for a plain text `value` — swaps its icon to a
checkmark for ~1.5s on activation. Takes no positioning opinion of its own; a consumer
wraps/positions the host element (e.g. absolutely positioned in the corner of a `wa-textarea` or a
read-only output field). Unlike `lr-code-block`'s or `lr-json-viewer`'s own built-in copy
buttons, this has no code/JSON content model to adopt just to reuse the copy affordance.

**Properties:**
- `value: string = ''` — the plain text to copy.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the localized
  Copy/Copied accessible name without changing the icon
- `disabled: boolean = false` (reflected)
- `feedbackDuration: number = 1500` (attribute `feedback-duration`) — milliseconds before the
  copied checkmark returns to the copy icon; finite values are clamped at zero

**Methods:** `focus(options?)` and `blur()` forward to the native button.

**Events:** `lr-copy` (`detail: { text: string }`) — fires on activation, always with the current
`value`, regardless of whether the OS clipboard write actually succeeded (same convention as
`lr-code-block`'s/`lr-json-viewer`'s own copy buttons).

**Slots:** none.

**CSS parts:** `base` — the button itself.

**Themeable custom properties:** shared tokens only.

**Optional peer deps:** none.

```html
<lr-copy-button value="npm install @aceshooting/lyra-ui"></lr-copy-button>
```

**Known gotchas:**
- best-effort clipboard write: `navigator.clipboard` is absent in insecure contexts/older browsers,
  and some engines throw synchronously rather than rejecting — either way `lr-copy` still fires
  with the intended text so a consumer can always show its own confirmation/fallback UI.

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
`root-margin`), `threshold: number | number[] = 0`, and `root: Element | null = null`.

**Events:** `lr-intersection` with `{ entries: IntersectionObserverEntry[] }` in `detail`.

**Slots:** default observed elements. **CSS parts:** `base`.

---

## `lr-mutation-observer`

Lifecycle-managed wrapper around the native `MutationObserver`. All element children in the default
slot are observed and their mutation records are emitted as a composed event; the wrapper itself
adds no layout.

**Properties:** `disabled: boolean = false` (reflected), `childList: boolean = true` (attribute
`child-list`), `observeAttributes: boolean = false` (attribute `attributes`), `characterData: boolean = false` (attribute
`character-data`), `subtree: boolean = true`, and `attributeFilter: string[] = []`.

**Events:** `lr-mutation` with `{ records: MutationRecord[] }` in `detail`.

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
  viewer scrolls internally past this height instead of growing the page
- `copyable: boolean = false` (reflected) — shows copy-to-clipboard affordances: one for the whole
  value, plus one per node
- `search: string = ''` — case-insensitive substring match against keys/values; matches are
  highlighted and their ancestors auto-expanded

**Methods:** `runSearch(query)` sets the declarative `search` property and awaits the recompute,
resolving the match count — named distinctly from `search` because a class member can't share a name
with a reactive property. `searchNext()`/`searchPrevious()` advance/step back a match cursor
(wrapping) and scroll the active match into view, resolving `false` when there are no matches.
`clearSearch()` resets `search` to `''`, clearing all matches and the cursor.

**Events:** `lr-copy` (`detail: { text: string }`) — fired by the top-level copy button or a
per-node one. Fires even when `navigator.clipboard` is unavailable or the write silently failed
(a rejected `writeText()` is swallowed), so a consumer can still observe copy *intent* — the event
is not a confirmation that the OS clipboard was actually reached. Copying a circular `data` value
serializes safely, substituting the same `Circular reference` marker the tree view renders, instead
of throwing. `lr-search-change` (`detail: { query, matchCount, activeIndex }`) — fired whenever the
search query, match count, or active-match cursor changes, from `runSearch()`/`searchNext()`/
`searchPrevious()`/`clearSearch()`, or a direct `search`/`data` property write.

**Slots:** none — the tree is rendered entirely from `data`.

**CSS parts:** `base` (root scroll container, respects `max-height`), `toolbar` (wrapper around the
top-level copy button, only rendered when `copyable`), `tree` (wrapper around the rendered node
tree), `key` (an object property key or array index label, `data-match` while it matches `search`,
`data-active` while it is the current `searchNext()`/`searchPrevious()` cursor position),
`value` (a primitive value's text — carries `data-type` of
`string`/`number`/`boolean`/`null`/`undefined`/`circular` for per-type coloring, `data-match`
while it matches `search`, and `data-active` while it is the current cursor position), `bracket` (a
`{`, `}`, `[`, or `]` delimiter), `toggle` (a container node's expand/collapse button; hidden but
present for row alignment on leaf/empty nodes),
`copy-button` (a copy-to-clipboard button — the top-level one in `toolbar` (aria-label "Copy JSON to
clipboard") or a per-node one (aria-label `Copy ${key/type}`, e.g. "Copy age"); only rendered when
`copyable`)

**Themeable custom properties:** `--lr-json-viewer-max-height` (default `none` — grows with content
until `max-height` is set), `--lr-json-viewer-font` (default `ui-monospace, SFMono-Regular, Menlo,
Consolas, monospace` — component-specific since no shared monospace token exists), plus shared tokens
`--lr-color-border/-surface/-text/-text-quiet/-brand/-brand-quiet/-success/-warning/-warning-quiet`,
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
  document.querySelector('lr-json-viewer').data = { hello: 'world', items: [1, 2, 3] };
</script>
```

**Known gotchas:**
- `data` is property-only (`attribute: false`) — it must be set via `.data = ...` or a lit-html `.data=${...}`
  binding, never as a plain HTML attribute.
- Search highlighting auto-expands only the *ancestors* of a match, not the whole tree — a
  non-matching sibling subtree elsewhere stays collapsed (or expanded) exactly as it already was.
- An explicit per-node expand/collapse (from clicking a node's `toggle` button) permanently overrides
  both `collapsedDepth` and any search-driven auto-expand for that path, until `data` is reassigned
  with a different shape.
- Per-node copy buttons call `stopPropagation()` on click so clicking one doesn't also toggle the
  row's expand/collapse state.

---

## `lr-live-region` (+ internal `Announcer`)

A throttled screen-reader announcement helper, split into a DOM-free coalescing engine
(`internal/announcer.ts`'s `Announcer` class) and a real custom element that wraps it.

### Internal: `Announcer` (`internal/announcer.ts`)

Not a custom element — pure timing/coalescing logic with no DOM dependency, composed by
`<lr-live-region>` (below) and intended for reuse by any other component that needs throttled
announcements (a stream-status indicator, a tool-call chip's status transitions, a chat message's
streaming state).

Streaming UIs (token-by-token chat responses, progress ticks, etc.) naturally produce far more
candidate announcements than a screen-reader user can usefully absorb — reading every incremental
chunk aloud is spam, not information. `Announcer` collapses a burst of `announce()` calls arriving
within `throttleMs` of the *first* call in that burst down to a single trailing-edge flush of the
latest text: superseded intermediate text is dropped outright, never queued or concatenated.

- `new Announcer(options: AnnouncerOptions)` where
  `AnnouncerOptions = { throttleMs?: number /* = 500 */; onFlush: (text: string) => void }`.
- `announce(text: string, options?: AnnounceOptions)` where `AnnounceOptions = { force?: boolean }` —
  queues `text`, overwriting whatever an earlier call in the same burst queued. Only the *first*
  call of a burst schedules the flush timer, so the deadline stays anchored to that first call
  rather than being pushed back by every subsequent call. `{ force: true }` bypasses any
  in-progress window and flushes immediately, so a terminal message (e.g. "response complete") is
  never swallowed mid-burst.
- `cancel()` — drops any pending (not yet flushed) text without invoking `onFlush`.
- `pendingText: string | undefined` — the latest text awaiting flush, if a burst is in progress.
- `isPending: boolean` — whether a flush is currently scheduled.
- `throttleMs` — a plain public field, safe to change between bursts; a flush already scheduled
  keeps the deadline it was scheduled with.

### `lr-live-region`

A visually-hidden ARIA live region that throttles and coalesces announcements instead of relaying
every call verbatim, by composing an internal `Announcer`. A consumer typically mounts one
`<lr-live-region>` per page/surface (much like `<lr-toast>` is one region per placement) and
keeps a reference to call `announce()` from application code or a parent component.

**Properties:**
- `mode: 'polite' | 'assertive' = 'polite'` (reflected) — `'polite'` renders `role="status"` +
  `aria-live="polite"` (waits for the user to be idle); `'assertive'` renders `role="alert"` +
  `aria-live="assertive"` (interrupts)
- `throttleMs: number = 500` (attribute `throttle-ms`) — the coalescing window; see `Announcer`
  above

**Methods:** `announce(text: string, options?: AnnounceOptions): void` — queues `text` for
announcement through the internal `Announcer`; `{ force: true }` bypasses the current throttle
window and flushes immediately.

**Events:** none.

**Slots:** none.

**CSS parts:** `region` — the visually-hidden element carrying `role`/`aria-live`/`aria-atomic="true"`.

**Themeable custom properties:** none component-specific — the region is hidden via the shared
`.sr-only` helper class (`internal/a11y.ts`), not tokenized CSS.

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
- Re-announcing text identical to what was last written is special-cased: screen readers announce a
  live region only on text-content *change*, so the component clears `textContent` first and
  re-sets it on the next animation frame (not the same tick, which can coalesce into nothing ever
  appearing to change) to give assistive tech a real empty-to-populated transition to observe. The
  frame is scheduled and canceled through the region's own document window, including after the
  element is adopted into an iframe.
- The region's DOM is tracked outside Lit's own template bindings (`write()` mutates
  `regionEl.textContent` directly) — an `announce()`/flush landing before `firstUpdated()` has run
  (e.g. a consumer creates, appends, and calls `announce()` synchronously) is buffered and applied
  on the next `firstUpdated()` rather than dropped.
- `disconnectedCallback()` cancels any pending (unflushed) announcement, any before-first-render
  buffered write, and any in-flight re-announce animation-frame callback — an element removed before
  a deferred write lands silently drops it, including across a later reconnect.
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

**Slots:** none.

**CSS parts:** `base`, `indicator` (the pulsing status dot), `countdown` (the `M:SS`, or
"Refreshing…", text), `pause-button` (the built-in pause/resume toggle).

**Themeable custom properties:** shared tokens only — `--lr-space-xs`, `--lr-font-size-sm`,
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
and timers were throttled. Reassigning `nextInMs` at any time restarts the countdown from that new
value; pausing/resuming, or toggling `active`, starts or stops the ticker without discarding the
current remaining time. Phase transitions ("Paused.", "Resumed.", "Refreshing now.") are announced
via an internal `<lr-live-region>` in polite mode.

**Known gotchas:**
- there's no built-in "reset" or "extend" method beyond reassigning `nextInMs` — a host that wants to
  push the deadline back out on user activity re-sets `nextInMs` itself.
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
equivalent). It never takes DOM focus itself — the host's own input keeps focus, and this
component conveys the active row via `activeDescendantId` for the host to apply as its own
input's `aria-activedescendant`, the same pattern `<lr-select>`/`<lr-combobox>` use for their
own listbox.

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
  row, or `null` while closed or when `filteredItems` is empty.
- `listboxId: string` — read-only getter; the `id` of the `role="listbox"` element, for a host that
  also wants to wire `aria-controls`.

**Methods:** `handleKeyDown(e: KeyboardEvent): boolean` — the host's own text-control `keydown`
handler calls this while the popover is open. Handles `ArrowDown`/`ArrowUp` (moves the highlight) and
`Enter`/`Tab` (commits the highlighted row) — both pairs return `false` with no `preventDefault()`
when `filteredItems` is empty, letting the keystroke fall through to the host's own control unchanged
(e.g. the textarea's caret still moves to the next line on ArrowDown when there's nothing to
navigate); `Escape` always closes with no selection and returns `true`. Returns `true` whenever the
key was intercepted (`preventDefault()` already called) and the host should not also act on it,
`false` otherwise (including for any key this method doesn't recognize).

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

**Themeable custom properties:** shared tokens only — `--lr-space-xs`/`-s`/`-m` (popup padding,
row padding/gap), `--lr-color-surface`/`-border` (popup background/border), `--lr-radius`
(popup and row corners), `--lr-shadow` (popup elevation), `--lr-transition-fast` (open/close
transition), `--lr-color-brand-quiet` (active-row background), `--lr-color-brand` (selected-row
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
    if (popover.open && popover.handleKeyDown(e)) return; // consumed
  });
  textarea.addEventListener('input', () => {
    popover.anchor = textarea;
    popover.items = [
      { id: 'ada', label: 'Ada Lovelace', description: 'Engineering', icon: '👩‍💻' },
      { id: 'grace', label: 'Grace Hopper', description: 'Engineering' },
    ];
    popover.query = 'a'; // detected since the trigger character
    popover.open = true;
  });

  popover.addEventListener('lr-mention-select', (e) => {
    // splice `${e.detail.label}` into the textarea at the trigger offset
  });
</script>
```

Integration is entirely the host's responsibility: detect a mention/command trigger in the host's
own `input` handling, set `anchor`/`items`/`query` and flip `open = true`, forward every `keydown`
through `handleKeyDown()` while open, and keep the host's own input's `aria-activedescendant` (and
optionally `aria-controls`, via `listboxId`) in sync with `activeDescendantId`. Setting `open =
false` whenever the query stops looking like an active mention context (a space typed, the trigger
deleted, the input blurred, …) is also the host's job — `lr-mention-close` fires automatically
from that, there is no separate "tell it to close" call needed.

Positioning measures exactly where the caret currently paints via a hidden-mirror-element technique
(`caretClientRect()`) and positions against that single point with `internal/positioner.js`'s
`place()`, so the popup tracks the caret rather than sitting under the whole textarea. Re-measures
automatically only on an `anchor` or `query` change while open (a keystroke moves the caret, so a
fresh `query` is the proxy for "the caret may have moved").

**Known gotchas:**
- a host-level `aria-label` attribute on `<lr-mention-popover>` now takes priority over `label`
  (and its localized default) when resolving `[part="listbox"]`'s accessible name — previously it
  was silently ignored. Matches the same fallback on `<lr-combobox>`/`<lr-table>`.
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
- `activeIndex` resets to `0` whenever `query` or `items` changes, but not when only `anchor`
  changes — reassigning `anchor` alone preserves whatever row was last highlighted.
- There's no persisted "selection" the way `<lr-combobox>`'s own listbox has one — a mention is
  either committed (closing the popover) or dismissed with nothing chosen. `aria-selected="true"`
  here marks whichever row is currently *active* (what Enter/Tab would commit right now, per the
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

**Events:** `lr-copy` (`detail: { text: string }` — the full unified-diff text, fired on
copy-button activation regardless of whether the clipboard write actually succeeded).

**Slots:** none.

**CSS parts:** `base` (the root wrapper), `line` (a single line; carries
`data-type="equal"|"add"|"remove"|"empty"|"fold"` — `"empty"` is an unbalanced-replace placeholder cell in
`layout="split"` and never carries a `+`/`-` prefix; `"fold"` is the localized unchanged-lines
marker), `copy-button` (the copy affordance, only
rendered while `copyable`), `side` (one column in `layout="split"`, `data-side="old"|"new"`).

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
</script>
```

The package root also exports the pure `computeLineDiff(oldLines: string[], newLines: string[]):
DiffOp[]` helper (plus the `DiffOp` type, `{ type: 'equal' | 'add' | 'remove'; text: string }`) — the
same line-diff function this component's own `render()`/copy handler call, exposed standalone so a
consumer can compute or unit-test the same alignment without instantiating the element at all.

**Known gotchas:**
- the alignment is a genuine O(n·m) longest-common-subsequence dynamic program over lines (split on
  `\n`), not a naive "every removed line then every added line" — fine for a typical
  tool-call/transcript-sized diff, but a very large pair of texts costs quadratic time/memory;
  there's no line-count guard or chunking of its own.
- `oldText`/`newText` are recomputed into the diff on every render — this component keeps no separate
  cached diff state, so binding either property to something that changes on every keystroke
  recomputes the whole alignment each time.

---

## `lr-icon`

Dependency-free SVG path icon: no icon font, no sprite sheet, no network fetch. Pairs with
`lr-icon-button` (see `llms/components/lr-icon-button.md`).

**Properties:**
- `name: string = ''` — a built-in glyph: `add`, `check`, `close`, `search`, `menu`,
  `chevron-left`, `chevron-right`, `chevron-down`, `calendar`, `command`, `trash`. An unknown name
  renders nothing (no error, no fallback glyph).
- `path: string = ''` — raw SVG path data for a glyph the built-in set doesn't cover. Takes
  precedence over `name`.
- `label: string = ''` — accessible name. Left empty (the default) the SVG is `aria-hidden="true"`,
  which is what you want whenever adjacent text already names the control.

**Slots:** (default) — custom SVG geometry, rendered only when neither `path` nor a known `name`
resolves. Slotted nodes are cloned into the component-owned `<svg>` (Chromium does not paint SVG
geometry distributed through a slot that sits inside an SVG), so pass plain `<path>`/`<circle>`/
`<g>` elements, not a whole `<svg>`.

**CSS parts:** `svg`

**Themeable custom properties:** `--lr-icon-size` (default `--lr-size-1-25rem`) sets both
dimensions. Stroke color is `currentColor` and the host is `color: inherit`, so color comes from
the surrounding text with no configuration.

## `lr-divider`

A semantic separator: renders `<hr part="base" role="separator" aria-orientation="…">`.

**Properties:** `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected).

**Events:** none. **Slots:** none. **CSS parts:** `base`.

**Themeable custom properties:** shared tokens only — `--lr-color-border` (rule color),
`--lr-border-width-thin` (thickness).

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

**Properties:**
- `value: number = 0`
- `currency: string = ''` — an ISO 4217 code (`'EUR'`, `'JPY'`). Non-empty switches the formatter to
  `style: 'currency'`; empty leaves it at `Intl`'s default decimal style
- `notation: 'standard' | 'compact' | 'scientific' | 'engineering' = 'standard'`
- `minimumFractionDigits?: number` (attribute `minimum-fraction-digits`)
- `maximumFractionDigits?: number` (attribute `maximum-fraction-digits`)

**Slots:** default — fallback content, rendered only when `value` is not finite (`NaN`/`Infinity`,
e.g. a malformed attribute) or the formatted string is empty.

Both fraction-digit properties are normalized to finite integers clamped to `Intl`'s own accepted
`[0, 100]`, and swapped if clamping left `minimum > maximum` — either would otherwise throw a
`RangeError` and crash the render. Leaving one `undefined` passes nothing for it, so `Intl`'s own
notation-driven defaults still apply; there is no forced default pair. No `percent`/`unit` style and
no `signDisplay`/`currencyDisplay`/grouping knob — compose `Intl.NumberFormat` directly for those.

## `lr-format-date`

`Intl.DateTimeFormat` output. Text-only host — no CSS parts, events, or own tokens; locale
resolution and `Intl`-instance caching are as described under `lr-format-number` above.

**Properties:**
- `date: string | number | Date = ''` — a `Date`, or anything the `Date` constructor accepts
- `year: Intl.DateTimeFormatOptions['year'] = 'numeric'`, `month: … = 'long'`, `day: … = 'numeric'`
  — the granular option set
- `dateStyle?: 'full'|'long'|'medium'|'short'` (attribute `date-style`), `timeStyle?: …`
  (attribute `time-style`) — the preset-style set
- `timeZone?: string` (attribute `time-zone`) — an IANA zone name, forwarded through **both** option
  sets

Setting either `dateStyle` or `timeStyle` switches the component to the preset-style set and the
granular `year`/`month`/`day` are then ignored entirely (`Intl` throws when the two are mixed); leave
both unset to use the granular set. An unparseable `date` renders the default slot. An invalid
`timeZone` throws a `RangeError` inside `Intl`, which is caught and retried once without the zone —
so the output falls back to the browser's local zone instead of failing to render.

**Slots:** default — fallback content for an invalid/unparseable `date`.

## `lr-format-bytes`

Byte-size output via `Intl.NumberFormat`'s `style: 'unit'` (`unitDisplay: 'short'`), so the unit
name is localized too. Text-only host — no CSS parts, events, or own tokens; locale resolution and
`Intl`-instance caching are as described under `lr-format-number` above.

**Properties:**
- `value: number = 0` — a byte count
- `unitStep: number = 1024` (attribute `unit-step`) — set `1000` for SI (kB/MB) instead of binary
- `decimals: number = 1` — maximum fraction digits on the scaled amount

**Slots:** default — fallback content, rendered only when `value` is not finite.

The unit ladder is fixed at `byte`, `kilobyte`, `megabyte`, `gigabyte`, `terabyte`, `petabyte` and
saturates at the top; the index is `floor(log|value| / log(unitStep))`, and `0` always formats as
bytes. `unitStep` is normalized to a finite number `> 1` (a step of exactly `1` would divide by
`log(1) === 0`) falling back to `1024`; `decimals` is clamped to `[0, 10]` — an out-of-range value
would otherwise throw a `RangeError` from `maximumFractionDigits`. Note that `unitStep: 1024` still
prints the SI-named `kB`/`MB` units, not `KiB`/`MiB` — `Intl` has no binary unit names.

## `lr-relative-time`

`Intl.RelativeTimeFormat` output ("3 hours ago", "in 2 days"), relative to `Date.now()` at render.
Text-only host — no CSS parts, events, or own tokens; locale resolution and `Intl`-instance caching
are as described under `lr-format-number` above.

**Properties:**
- `date: string | number | Date = ''` — the target instant; past values format as "ago"
- `unit: 'second'|'minute'|'hour'|'day'|'week'|'month'|'quarter'|'year'|'auto' = 'auto'` — `'auto'`
  picks the largest unit whose own length fits inside the elapsed time, then rounds; naming a unit
  forces it (so a 90-minute delta with `unit="day"` rounds to "today"/0 days)
- `numeric: 'always' | 'auto' = 'auto'` — `Intl`'s own option: `'auto'` allows "yesterday"/"tomorrow"
  in place of "1 day ago"/"in 1 day"; `'always'` keeps the numeric phrasing
- `sync: boolean = false` — re-renders on a fixed 30-second interval so the text stays current. The
  interval is cleared on disconnect and restarted whenever `date`/`unit`/`numeric`/`locale` changes.
  Not adaptive: a "3 seconds ago" readout still only updates every 30 s

**Slots:** none — an unparseable `date` renders the empty string, with no fallback-content hook
(unlike the three `lr-format-*` components above).

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
- `min: string = ''`, `max: string = ''` — inclusive `YYYY-MM-DD` bounds, surfaced as
  `rangeUnderflow`/`rangeOverflow`
- `readonly: boolean = false` (reflected) — also suspends all validity flags
- `size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected)
- `label: string = ''`, `hint: string = ''`, `errorText: string = ''` (attribute `error-text`)
- `locale: string = ''` — BCP-47 override for field order and per-field label sampling only
  (redeclared non-reflecting over the base `locale`, like `lr-date-input`)
- `autocomplete: string = ''` — the special value `'bday'` expands to
  `bday-day`/`bday-month`/`bday-year` across the three fields; any other non-empty value is
  forwarded verbatim to all three
- `dayLabel: string = 'Day'` (`day-label`), `monthLabel: string = 'Month'` (`month-label`),
  `yearLabel: string = 'Year'` (`year-label`) — visible **and** accessible per-field labels; each
  routes through `localize()` only while left at its literal default
- `accessibleLabel: string | null = null` (attribute `aria-label`) — applied to `[part="fieldset"]`,
  which owns the group role, overriding the `<legend>`-derived name

**Methods:** `focus(options?)` focuses the first field in locale order; `blur()` blurs whichever
field currently has focus.

**Events:** `input` (every keystroke), `change` (a field blur where the composite value newly
transitioned), plus re-dispatched bubbling/composed `focus` and `blur` (`blur` fires once when focus
leaves all three fields, not per field-to-field Tab). `input`/`change` detail is
`{ value, day, month, year, field }` — `value` is the canonical ISO date or `''`, `day`/`month`/`year`
are the live raw typed text, and `field` is `'day' | 'month' | 'year'`, whichever was last edited.

**Slots:** `label`, `hint`, `error` (each rendered alongside its matching property).

**CSS parts:** `form-control` (outer wrapper), `fieldset` (the `<fieldset>` grouping the fields —
carries `aria-label` when `accessibleLabel` is set), `legend` (the `<legend>`; hidden when there is
no label, and grows a `*` suffix while `required`), `fields` (the flex row), `field` (one field
block, repeated three times, `data-field="day"|"month"|"year"`), `field-input` (the native
`<input type="text" inputmode="numeric">` inside it, same `data-field` marker), `field-label` (the
small per-field text label), `hint`, `error` (`role="alert"`).

**Themeable custom properties:** `--lr-known-date-field-padding-block`,
`--lr-known-date-field-padding-inline`, `--lr-known-date-field-font-size`,
`--lr-known-date-field-min-height` (all four rewritten by
each `:host([size])` rule; `m` defaults `--lr-space-s`/`--lr-space-s`/`--lr-font-size-md-sm`/
`--lr-size-2rem`), `--lr-known-date-field-height`,
`--lr-known-date-field-gap` (default `--lr-space-s` — gap between the three field blocks),
`--lr-known-date-day-field-width` / `--lr-known-date-month-field-width` (default `--lr-size-3-5em`)
and `--lr-known-date-year-field-width` (default `--lr-size-5em`) — the per-field input widths, not
size-scaled.

The two height knobs work as a pair on `[part='field-input']`, the same way
`lr-input`/`lr-select`/`lr-combobox`/`lr-date-input` expose theirs:

- `--lr-known-date-field-min-height` is a **floor**, re-assigned per `size` tier. Every tier's
  default sits below the field's own padding/font-driven height, so raising it is what makes it
  visible; lowering it changes nothing.
- `--lr-known-date-field-height` pins an **exact** height (both floors and caps), so the three
  inputs can line up with a neighbouring control of a known height. It is **undeclared by
  default** — the field grows to fit its content. Never set it to `auto`: `auto` is a valid
  declared value that wins over the `var()` fallback arm, which would make the per-tier floor
  dead code. To go back to the default behavior, remove the declaration rather than neutralizing
  it. Because the component never declares it, it can be set inline, from an ancestor, or from an
  outer-tree rule.

**Known gotchas:**
- Field *order* is derived from the locale by formatting a probe date (Jan 2 2026) with
  `Intl.DateTimeFormat` and reading back the part order — not from `Date.parse()`'s mm/dd/yyyy bias.
  It falls back to `month, day, year` only when that sampling fails.
- Auto-advance (typing a field's last digit moves to the next) and backspace-into-the-previous-field
  are this library's own additions, not Web Awesome parity. Auto-advance is purely digit-count
  based, never value based.
- Each `<input>` shows exactly what was typed and is never reformatted or reverted; only the
  composite `value` is zero-padded.
- Non-digit keystrokes are rejected before reaching field state — locale-specific numerals
  (e.g. Arabic-Indic digits) are not accepted as input.
- ArrowLeft/ArrowRight cross fields at a field's text boundary, and the *physical* key meaning
  "next field" flips under an inherited `dir="rtl"`; the locale-derived field order itself does not.
- A blank composite is `valueMissing` only when **all three** fields are blank; a partially typed
  required date reports `badInput` instead.
- The host carries a `:state(blank)` custom state whenever `value === ''`, and `data-invalid` only
  once touched (first blur out of the whole control) and actually invalid.

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
- `autoplayInterval: number = 3000` (attribute `autoplay-interval`) — clamped to a 1000 ms floor

**Methods:** `randomize(): HTMLElement[]` — re-selects using the current `mode`, applies
`hidden`/`aria-hidden`, emits `lr-content-change`, and returns the elements now shown. Does **not**
reset or restart the autoplay timer.

**Events:** `lr-content-change` (`detail: { items: HTMLElement[] }` — the exact elements now shown,
in display order). Fires on first render, on `randomize()`, on a real slot-content change, and on
each autoplay tick; never when the eligible pool is empty.

**Slots:** default — the candidate pool. Only direct **element** children are eligible.

**CSS parts:** `base` — the wrapper around the default slot; carries `role="status"`,
`aria-atomic="true"`, and `aria-live="polite"`, downgraded to `aria-live="off"` while `autoplay` is
on (a self-rotating region announcing on every tick would be spam). A host `aria-label` attribute is
forwarded onto it.

**Themeable custom properties:** `--lr-random-content-animation-duration` (default `300ms`),
`--lr-random-content-animation-easing` (default `ease`),
`--lr-random-content-animation-translate` (default `--lr-size-0-5em` — travel distance for the four
directional `fade-*` effects).

**Known gotchas:**
- There is no built-in trigger UI (no next/previous/shuffle button) and therefore no keyboard
  interaction: selection changes only via `autoplay` or `randomize()`.
- Autoplay is suppressed entirely under `prefers-reduced-motion: reduce`, and whenever the eligible
  pool has fewer than 2 children. The preference is re-observed live, not just read once.
- `fade-left`/`fade-right` are physical-direction transforms (upstream naming), deliberately **not**
  mirrored under `:dir(rtl)` — they are not previous/next navigational semantics.
- The entrance animation targets `::slotted(*)`, which the library-wide reduced-motion rule cannot
  reach (it only covers the shadow tree), so this component guards it with its own media query.
- The host is `display: block`. For an inline text-fragment swap inside a sentence, override
  `lr-random-content { display: inline; }` from outside; `display: contents` is deliberately not
  used (a11y-tree inconsistencies across engines).

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
  `[0, steps.length - 1]`, including for a direct property/attribute write that bypasses
  `goToStep()`
- `placement: Placement = 'bottom'` (reflected) — tour-level Floating UI default, overridable per
  step; resolved through `rtlAwarePlacement()`
- `distance: number = 12` — px offset between target and popover. Tour-level only (no per-step
  override); may be negative for overlap
- `spotlightPadding: number = 4` (attribute `spotlight-padding`) — extra px between the target's box
  and the cutout/ring; overridable per step
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — a deliberate inversion of
  `lr-dialog`'s `noLightDismiss`: a backdrop click does **nothing** by default so a stray click
  can't discard onboarding progress. Set it to make a backdrop click `end('skip')`
- `showProgress: boolean = true` (attribute `show-progress`) — renders the "Step X of Y" text + dots
- `aria-label` (a plain host attribute, not a public JS property) — names **every** step's popover,
  overriding each step's own `heading` as the `aria-labelledby` source

**Exported types:** `TourStep { id: string; target: TourTarget; heading: string; content?: string;
placement?: Placement; spotlightPadding?: number; interactiveTarget?: boolean; hidePrevious?: boolean }`;
`TourTarget = string | HTMLElement | (() => HTMLElement | null)` — a string resolves via
`ownerDocument.querySelector` (top-level light DOM only), and every form is re-resolved on each step
activation, never cached, so a target mounted later still resolves. `heading` is required and
becomes the panel's accessible name; `content` renders as plain text (no HTML/markdown parsing).
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
`popover` (the step panel, `role="dialog" aria-modal="true"`, `data-unanchored` when the target
didn't resolve), `heading` (the `aria-labelledby` target), `body` (slot or `step.content`),
`progress` (wrapper), `progress-text` (the "Step X of Y" text — an `aria-describedby` target),
`progress-dot` (one decorative dot per step, `data-current` on the active one, `aria-hidden`),
`footer` (the control row), `previous-button`, `skip-button`, `next-button` (the Next control's
label switches to Done on the last step).

**Themeable custom properties:** `--lr-tour-backdrop-color` (default `--lr-color-overlay`),
`--lr-tour-spotlight-radius` (default `--lr-radius` — shared by the cutout and the ring),
`--lr-tour-spotlight-ring-color` (default `--lr-color-brand`), `--lr-tour-spotlight-ring-width`
(default `--lr-border-width-medium`), `--lr-tour-popover-max-width` (default `--lr-size-22rem`,
further capped by `--lr-popover-viewport-clamp` and the positioner's available space).

`--lr-popover-viewport-clamp` (default `92vw`, from `--lr-theme-popover-viewport-clamp`) is the
shared ceiling that keeps any floating surface inside a narrow viewport. `lr-tour`,
`lr-mention-popover`, and `lr-export-button` all `min()` their own max-inline-size against it, so
retuning `--lr-theme-popover-viewport-clamp` once at `:root` narrows or widens all three together
rather than per component.

**Known gotchas:**
- By default the spotlighted target is **non-interactive**: it stays visible and announceable (not
  `inert`, not `aria-hidden`) but every pointer event over the viewport is captured by the backdrop.
  Set `step.interactiveTarget` to clip the backdrop around the target so clicks fall through — that
  restores pointer reachability only. The focus trap still confines Tab to the popover regardless,
  so for a keyboard-reachable demonstrated interaction have the app's own listener call `next()`.
- Uses the overlay manager with `modal: false` deliberately: `modal: true` would mark the whole page
  (including the target, which lives outside this element) `inert`. `role="dialog"` +
  `aria-modal="true"` are still rendered on the panel so screen readers confine their virtual cursor.
- Each step transition mounts a genuinely new popover node (keyed on `step.id`) so focus reliably
  re-enters the panel — don't cache a reference to `[part="popover"]` across steps.
- No `Home`/`End` shortcut and no click-to-jump progress dots (unlike `lr-stepper`): later steps may
  depend on an earlier step's side effect having run. `goToStep()` is available for a caller that
  knows better. ArrowRight/ArrowLeft do move between steps (swapped under RTL), except while focus
  is in an `input`/`textarea`/`contenteditable` inside slotted content.
- A direct `HTMLElement` target is re-checked for `isConnected` on every activation and treated as
  missing if it was remounted — prefer a selector string or resolver function for targets that can
  be replaced mid-tour.
- The active step's target is `scrollIntoView({ block: 'center' })`'d on activation, smoothly unless
  `prefers-reduced-motion: reduce`.
