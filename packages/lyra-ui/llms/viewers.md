Viewer loading contract: `lr-archive-viewer`, `lr-calendar-viewer`, `lr-contact-viewer`,
`lr-csv-viewer`, `lr-dataset-viewer`, `lr-docx-viewer`, `lr-email-viewer`, `lr-html-viewer`,
`lr-notebook-viewer`, `lr-spreadsheet-viewer`, `lr-svg-viewer`, and `lr-xml-viewer` use one shared
visible `[part="spinner"]` treatment. Its localized label is ordinary readable text (including
without CSS), its decorative ring stops under reduced motion, and `[part="base"]` exposes explicit
`aria-busy="true"|"false"` while transition announcements remain in the shared document-level sink.

Viewer search events use `detail: { query, matchCount, matchCountExact, activeIndex }`.
`matchCountExact: false` means the retained `matchCount` is a known lower bound, never an exact
total. All model-backed viewer searches accept at most 4,096 query code units and scan/validate at
most 4,000,000 code units per pass. CSV, dataset, spreadsheet, and DOCX retain 1,000 matches; PDF,
PPTX, ebook, and XML retain 10,000. PDF additionally inspects at most 1,000 pages and 1,000,000
corpus code units, while ebook inspects at most 1,000 spine items. Any ceiling that prevents a
complete scan makes `matchCountExact` false.

Viewers built on the shared DOM-text target index at most 1,000,000 UTF-16 code units / 20,000 text
nodes per content generation, accept text-quote fields up to 4,096 code units, retain 10,000
matches, paint at most 200 live search ranges, and reuse the occurrence index across navigation and
host-highlight painting. Shared highlight admission retains at most 10,000 unique nonempty records
after inspecting at most 10,001 input records. Capped renderers select at most 1,000 candidates from
that immutable snapshot and paint at most 100 host highlights; an `activeHighlightId` anywhere in
the snapshot is placed first and preserved inside both rendering ceilings. DOCX, Markdown, PDF,
ebook, SVG, and XML use these candidate/paint semantics.

## `lr-document-preview`

A format-dispatching viewer for one document/attachment, plus the visual state machine for an async
server-side conversion a host app runs in front of it. First-party invention (no Web Awesome
equivalent).

Format dispatch is intentionally minimal: only `text/*`/`application/json` (a plain, scrollable
`<pre>` — no syntax highlighting; compose `<lr-code-block>` yourself via the `unsupported` slot for
that) and `image/*` (a contained `<img>`) render inline. Everything else — PDF, office documents,
video, audio, or any unrecognized MIME type — falls back to a generic "can't preview this" state: a
file glyph, a short message, and (when `src` is set) a native `<a download>` link. This is a
deliberate ceiling, not a gap: the component ships a dispatch _shell_, not a format registry. The
`unsupported` slot is the escape hatch for every format left out of the built-in three.

`status="converting"` is a second, independent axis from format dispatch. This component doesn't know
your backend's conversion API shape and owns none of the actual polling/fetch — a host converting a
non-natively-previewable format server-side (e.g. `.docx` → `.pdf`) polls its own backend and updates
`status`/`progress`/`src` here as that proceeds; this component only _visualizes_ that state (an
indeterminate spinner, or a determinate one once `progress` is supplied). The one piece of async work
this component _does_ own is fetching a `text/*`/`application/json` `src` itself — there's no other
way to get a `<pre>`'s text content from a URL — gated behind a generation-counter guard
(`lr-tool-result-view`'s `resolve()` uses the identical pattern) so a `src` reassigned mid-fetch
can't have a stale response clobber a newer one.

Every `src` is validated (via `internal/safe-url.ts`) against a scheme allowlist specific to the DOM/
API sink it's about to reach: `fetch(src)` (text preview) and an `<img src>` (image preview) both
allow relative URLs plus `http:`, `https:`, `blob:`, and `data:`; the download `<a href>` deliberately
excludes `data:` (following a `data:text/html` URL can create an active document, unlike using it as
inert media/fetch data). A `src` that fails its sink's check never reaches `fetch()`/`<img>`/the
anchor: the text preview renders `[part="error"]` with `"Document URL is not allowed."`, the image
preview silently falls back to the download fallback **directly** — not the generic
download-or-`unsupported`-slot one, so `<slot name="unsupported">` content is _not_ consulted on the
image path — and the generic fallback simply omits `[part="download-link"]` entirely.

**Properties:**

- `src: string = ''` — URL to fetch (for `text`/`application/json`) or display (`image`, or as the
  generic fallback's download `href`). Optional — gracefully absent while, e.g., a conversion is
  still in progress. Validated per-sink before use — see the URL-safety note above; an unsafe/
  malformed value is treated as if `src` were unusable for that sink, never passed to `fetch()`/
  `<img>`/the anchor.
- `mimeType: string = ''` (attribute `mime-type`) — drives format dispatch (see above).
- `filename: string = ''` — shown in the header and used as the download link's suggested filename.
- `alt?: string` — image description. When omitted, the filename/localized image-preview fallback
  is used; an explicit empty string keeps a decorative preview's `alt=""` intact.
- `status: 'idle' | 'converting' | 'ready' | 'error' = 'idle'` (reflected) — host-owned lifecycle
  state. `"converting"` shows the spinner regardless of `mimeType`/`src`; `"error"` shows
  `errorText` regardless of either. `"idle"`/`"ready"` both resume normal format dispatch — a host
  with no conversion step never has to explicitly set `"ready"`.
- `progress?: number` (type `Number`) — 0-100. Only consulted while `status="converting"`. Unset (the
  default) renders an indeterminate spinner instead of a determinate progress bar.
- `errorText: string = ''` (attribute `error-text`; spelled `errorMessage`/`error-message` before
  9.0.0) — shown via `[part="error"]` while `status="error"`. Caller-supplied text, not localized;
  left empty, the localized `documentPreviewGenericError` fallback shows instead.
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"24rem"`); once set,
  `[part="body"]` scrolls internally past this height instead of growing the page — same contract as
  `lr-json-viewer`'s identically-named prop. Invalid CSS `max-height` values, declaration breaks,
  and `url()` are ignored, leaving the stylesheet token in control.
- `zoomable: boolean = false` (reflected) — wraps the rendered image (image format only) in an
  internal `<lr-pan-zoom>`. `false` (the default) preserves the exact pre-`zoomable` DOM — an
  inline thumbnail (e.g. in a chat stream) must not unexpectedly grow a focusable zoom-chrome
  viewport; an inspection surface opts in.
- `suppressDownload: boolean = false` (attribute: false) — omits the generic fallback's download
  action when a composing shell already owns that action. This is property-only composition state;
  it does not suppress inline preview rendering.
- `highlights: readonly LyraHighlight[] = []` (attribute: false) — display-only `region` highlights painted
  over the image-format preview; ignored for the `text`/`generic` formats. IDs are trimmed and
  required to be nonempty, with the first record retained when IDs repeat. A rectangle renders only
  when `x`/`y`/`width`/`height` are finite numbers and both dimensions are nonnegative.
- `activeHighlightId: string | null = null` (attribute `active-highlight-id`) — the `highlights`
  entry, if any, currently treated as active (`data-active` on its `region-highlight`).
- `anchorKinds: readonly LyraAnchor['kind'][] = ['region']` (this viewer's supported
  `LyraAnchor.kind` values for the
  shared anchor-target contract).

**Methods:** `scrollToAnchor(target)` — scrolls a `region` highlight (by id, or a `LyraAnchor`
matched back to its owning `LyraHighlight` by reference) into view; resolves `false` when nothing
matches, the anchor isn't `region`, or the format isn't currently `image`.

**Events:**

- `lr-download` — `detail: { src, filename }` — fired when the generic-download fallback's link is
  activated. The browser download itself needs no JS (a plain `<a download>` handles it); this is
  purely for a host that wants to observe/log the download.
- `lr-render-error` — `detail: { error }` — fired when this component's own `text/*`/
  `application/json` `fetch(src)` fails (network error or non-2xx response). Distinct from
  `status="error"`, which is entirely host-driven.
- `lr-highlight-activate` — `detail: { highlightId }` — a region highlight was clicked or activated via
  Enter/Space (image format only).

**Slots:** `unsupported` — escape hatch: when populated, its content renders _instead of_ the generic
download fallback for any `mime-type` this component doesn't natively support. Ignored while
`mime-type` resolves to `text`/`image` dispatch, or while `status` is `"converting"`/`"error"`.

**CSS parts:** `base`, `header` (hidden entirely when `filename` is unset), `filename`, `body`,
`spinner` (ordinary non-live shadow content while indeterminate, or `role="progressbar"` once
numeric progress is known — used both for `status="converting"` and this component's own in-flight
text fetch), `error` (ordinary visible shadow text used both for `status="error"` and a failed text
fetch; error transitions use the shared document-level assertive sink), `download-link` (only
rendered when `src` is set _and_ passes the link-safe scheme allowlist — see the URL-safety note
above; excludes `data:` even though the other two sinks allow it), `highlight-layer` (wrapper around
every rendered region highlight, image format only), `region-highlight` (one region highlight,
`data-tone`, `data-active`; image format only), `region-highlight-target` (transparent activation
geometry with a minimum hit area independent of the visual rectangle), `highlight-actions`
(non-overlapping actions used when multiple minimum hit areas would overlap),
`region-highlight-action` (one action in that list), `frame-viewport`/`frame-content`/`frame-controls`/
`frame-zoom-in`/`frame-zoom-out`/`frame-reset` (forwarded from the internal `<lr-pan-zoom>`
while `zoomable`; image format only)

**Themeable custom properties:** `--lr-document-preview-max-height` (default `none`) — the
consumer-tunable scroll cap on `[part="body"]`, set from `max-height`; `none` means the preview grows
with its content until a caller opts in. `--lr-document-preview-font` (default
`var(--lr-font-mono)`, so a themed monospace stack reaches plain-text previews with no
per-component override) and `--lr-document-preview-spin-duration` (default
`var(--lr-transition-ambient)`, stopped under reduced motion). `--lr-document-preview-progress`
(default `0`) — a unitless
0–100 number the determinate spinner's `conic-gradient` fill reads; written inline on the ring by
the component itself from the clamped `progress` property, so overriding it only makes sense to
repaint the fraction. `--lr-document-preview-active-border` (default
`var(--lr-color-warning, var(--lr-color-brand))`) — the border color of the `[part='region-highlight']`
matching `activeHighlightId` (image format only), deliberately distinct from the resting highlight
border so the active region can be recolored without touching the rest. Like the library's other
state hooks it is an inline `var()` fallback at the point of use rather than a `:host` declaration,
so it can be set on the element or on any ancestor — `::part(region-highlight)[data-active]` is
invalid CSS (Shadow Parts forbids an attribute selector after `::part()`), which previously left
re-pointing the shared `--lr-color-warning`/`--lr-color-brand` tokens as the only lever, repainting
every other element that read them. The tone-specific resting border and hover tint use
`--lr-document-preview-highlight-accent-color`, `--lr-document-preview-highlight-success-color`,
`--lr-document-preview-highlight-warning-color`, `--lr-document-preview-highlight-danger-color`,
and `--lr-document-preview-highlight-neutral-color` (defaulting respectively to the matching
brand/success/warning/danger/neutral color tokens). Plus shared tokens
`--lr-color-border`, `--lr-radius`, `--lr-color-surface`, `--lr-space-s/-m/-l/-xs`,
`--lr-color-text`, `--lr-color-text-quiet`, `--lr-color-danger`, `--lr-color-brand`,
`--lr-color-on-brand`, `--lr-focus-ring-width/-color/-offset`, `--lr-transition-fast`.

**Optional peer deps:** none directly — the `unsupported` slot is commonly used to compose
`<lr-code-block>` (which has its own optional `shiki` peer dependency; see that component's own
entry) or a third-party PDF/office-doc viewer, but neither is a dependency of this component itself.

```html
<lr-document-preview
  filename="board-notes.txt"
  mime-type="text/plain"
  src="/files/board-notes.txt"
  max-height="24rem"
  @lr-render-error=${(e) => console.error(e.detail.error)}
></lr-document-preview>

<!-- A host driving its own server-side conversion -->
<lr-document-preview filename="deck.pptx" status="converting" progress="42"></lr-document-preview>

<!-- Escape hatch for an unsupported format -->
<lr-document-preview filename="deck.pptx" mime-type="application/vnd.ms-powerpoint" src="/files/deck.pptx">
  <lr-code-block slot="unsupported" language="text">Open in PowerPoint to preview.</lr-code-block>
</lr-document-preview>
```

Accessibility: after the initial silent baseline, entering `"converting"` without numeric
`progress` appends the localized "Converting document…" transition to the pre-mounted shared
document-level polite sink; the visible spinner and its visually-hidden label remain ordinary,
non-live shadow content. Once finite `progress` is available, the spinner becomes a standard
`role="progressbar"`, self-describing via `aria-valuenow`, and does not duplicate that information
through the live sink. A later finite-to-indeterminate transition is announced. `status="error"`
keeps `[part="error"]` as ordinary visible text and appends later error transitions to the shared
document-level assertive sink.

**Known gotchas:**

- `status="converting"`/`status="error"` always win over format dispatch, regardless of
  `mimeType`/`src` — a `text`/`image` source is not shown until `status` returns to `"idle"`/`"ready"`.
- The component's own text/JSON `fetch(src)` is a _different_ async operation from the host-driven
  `status="converting"` conversion. A failed fetch fires `lr-render-error` and renders
  `[part="error"]` on its own; it never sets `status="error"` itself.
- changing `src` aborts the superseded text fetch as well as ignoring any stale completion; removing
  the component aborts its active request.
- `progress` is only ever consulted for the host-driven `"converting"` state — this component's own
  in-flight text fetch always renders the indeterminate spinner, with no numeric-progress path.
- the text/JSON fetch is capped at 25 MB, enforced while streaming so it holds even when the server
  omits `Content-Length`; going over renders `[part="error"]` with the localized
  `documentPreviewResourceTooLarge` message. The cap is not overridable per component. The `image`
  preview is unaffected — it hands `src` to an `<img>` rather than reading it.
- The `unsupported` slot's initial presence is detected once, before the first render, by scanning
  light-DOM children directly (not the slot's `assignedElements()`); every later slot-content change
  is instead picked up via the slot's own `slotchange` listener. Both paths keep detection correct,
  just via two different mechanisms depending on timing.
- `download-link` (and thus `lr-download`) only renders/fires when `src` is set — a generic-fallback
  state with no `src` shows only the file glyph and message, with no download affordance at all.
- `download-link` also never renders for a `data:` or `mailto:` URL, even though `data:` is accepted
  for text/image sinks and `mailto:` is accepted for navigation anchors elsewhere in the library — a
  `src="data:..."` document renders/fetches fine but falls back to no download affordance in the
  generic state, and a `mailto:` names no retrievable bytes so it cannot be a download target at all.
- A `src` that fails its sink's URL-safety check does **not** raise `lr-render-error` — that event is
  reserved for a `fetch()` that was actually attempted and failed at the network layer; an unsafe/
  malformed `src` is silently treated as unusable instead (a rendered `[part="error"]` message for
  text, a silent fallback for image/download — and on the image path that fallback is the download
  fallback directly, so an `unsupported` slot the host supplied is bypassed).

---

## `lr-document-viewer`

A dialog-hosted, format-dispatching full viewer for one document or attachment. It uses a pluggable
renderer registry and falls back to `<lr-document-preview>` when no renderer matches the file's MIME
type. First-party invention.

A host `aria-label` names the nested dialog by attribute presence, including an explicitly empty
value, without suppressing the visible `name` heading.

**Properties:**

- `open: boolean = false` (reflected) — opens or closes the viewer dialog.
- `name: string = ''` — display name passed to the renderer and used as the dialog heading.
- `mimeType: string = ''` (attribute `mime-type`) — MIME type used for exact renderer dispatch.
- `src: string = ''` — source URL passed to the selected renderer or the fallback preview.
- `payload?: LyraDocumentRendererPayload` (attribute: false) — opt-in renderer-specific input.
  Assignment immediately clones, validates, bounds, and freezes the payload. While set,
  `payload.file` is authoritative for MIME dispatch, the dialog heading, renderer/fallback input,
  anchors/highlights, and download; the scalar `name`, `mimeType`, `src`, `anchor`, `highlights`,
  and `alt` properties resume their legacy behavior when `payload` is reset to `undefined`.
- `registry?: DocumentRendererRegistry` (attribute: false) — optional per-instance registry
  override. A native map assignment is copied behind a frozen readonly facade; definition records
  are cloned and frozen while callback identities are retained. Later source-map or definition
  mutation is not observed. When unset, the
  instance owns an immutable snapshot of the built-ins registered when it was constructed. A later
  module import/registration cannot mutate an existing viewer. A throwing consumer matcher or
  renderer is contained as the localized error state rather than escaping the update.
- `alt?: string` — media alt text forwarded to the resolved renderer, for image-like renderers.
  Unset lets the renderer derive its fallback; an explicit `''` preserves decorative media.
- `anchor: LyraAnchor | string | null = null` (attribute: false) — declarative scroll-to-anchor
  target forwarded to the resolved renderer; a string is a highlight id in `highlights`.
  `hasChanged: () => true`, so re-assigning the same value (e.g. re-clicking the same citation
  badge) still re-fires.
- `highlights: readonly LyraHighlight[] = []` (attribute: false) — highlights forwarded to the resolved
  renderer after the shared trimmed, nonempty, first-wins identity normalization.

**Events:**

- `lr-close` — `detail: DocumentViewerCloseReason`, the viewer shell dialog's dismissal reason.
  The event is emitted after the viewer sets `open` to `false`. A registered renderer may compose
  its own descendant dialog; closing that inner dialog keeps its normal `lr-dialog-close` path and
  does not close the document viewer.
- `lr-download` — `detail: { src, filename }`, emitted when the native safe download action is
  activated. The browser download itself is handled by the link.
- `lr-anchor-result` — `detail: { found }`. Emitted by this shell as `{ found: false }` once per
  applied `anchor` when a resolved renderer can't honor it (it declares no `capabilities.anchors`,
  or none matching the anchor's `kind`). When the file uses `<lr-document-preview>`—including after
  a lazy renderer fails to load—the shell delegates to that preview's `scrollToAnchor()` and emits
  its actual `found` result. A capable renderer instead emits its own `lr-anchor-result` from its
  embedded `DocumentAnchorTarget` mixin, which composes up through this element unchanged — the
  shell stays silent in that case, so the event fires exactly once either way. A string `anchor`
  (a highlight id) counts as supported by any renderer declaring at least one anchor kind.

**CSS parts:** `body` — wrapper around the active renderer, loading/error state, or fallback preview;
it renders explicit `aria-busy="true"|"false"`. Visible loading/error text is ordinary non-live
shadow content; later loading and error transitions use the pre-mounted shared document-level
polite and assertive sinks, respectively;
`download-link` — the native download action, rendered when `src` passes Lyra's safe-link policy.

**Themeable custom properties:** `--lr-document-viewer-max-height` (default `70vh`) — maximum block
size of `[part="body"]` before the dialog body scrolls internally.

**Renderer registry exports:**

- `DocumentFile` — the compatible mutable lookup input passed to `matches(file)` callbacks:
  `{ name, mimeType, src, anchor?, highlights?, alt? }`. Adapter and legacy-render boundaries
  receive an immutable file snapshot whose highlights use the shared trimmed, nonempty,
  first-wins identity projection.
- `LyraDocumentFile` — the readonly file snapshot wrapped by every discriminated payload.
- `LyraDocumentRendererPayload` — readonly `kind: 'document' | 'av'` discriminated input wrapping an
  immutable `file`. The AV branch adds readonly `cues` and `tracks`; snapshots retain at most 10,000
  cues and 64 tracks, clone and freeze every retained record, and bound every retained string.
- `LyraGenericDocumentRendererPayload` / `LyraAvDocumentRendererPayload` — the concrete
  `kind: 'document'` and `kind: 'av'` branches. `LyraDocumentRendererPayloadKind` names their kind
  union, and `LyraDocumentRendererPayloadFor<K>` extracts one branch for adapter authoring.
- `LyraDocumentRendererAdapterDefinition<K>` / `LyraDocumentRendererAdapter` — strongly typed
  authoring input and its factory-created, type-erased registry form. The callbacks adapt the legacy
  file to one payload kind, derive capabilities from that retained payload, and render it.
- `DocumentRendererDefinition` (also `LyraDocumentRendererDefinition`) — a validated direct
  `{ render, matches?, capabilities? }`, adapted `{ adapter, matches? }`, or lazy
  `{ load, matches?, capabilities? }` definition; exactly one of `render`, `adapter`, and `load` is
  required. Static capabilities are rejected on adapted definitions so their adapter remains the
  single source of truth. Adapted definitions register eagerly; a lazy definition resolves a
  legacy direct renderer, keeping the static and payload-derived capability branches distinct.
- `LyraAdaptedDocumentRendererDefinition` / `LyraResolvedDocumentRendererDefinition` — the adapted
  registry branch and the union of both immediately renderable branches. `LyraAdaptedDocumentRenderer`
  is the frozen payload/capabilities/render invocation returned by `adaptDocumentRenderer()`.
- `DocumentRendererRegistry` — `ReadonlyMap<string, DocumentRendererDefinition>`.
- `createDocumentRendererAdapter(definition)` — preserves discriminator-specific callback types
  while producing the validated adapter accepted by a registry definition.
- `adaptDocumentRenderer(definition, file, payload?)` — binds one resolved definition to an
  immutable payload and derives its frozen capabilities. It snapshots the file once and passes
  that canonical object to either the adapter or legacy renderer; caller object identity is not
  retained across this boundary.
- `snapshotLyraDocumentRendererPayload(payload)` — returns the same validated, bounded, frozen
  assignment snapshot used by `<lr-document-viewer>`.
- `createDocumentRendererRegistry(overrides?)` — returns a truly immutable built-in snapshot plus
  optional per-instance overrides. MIME keys are trimmed, lowercased, and reduced to their essence.
- `registerDocumentRenderer(key, definition)` — adds or replaces a built-in-builder entry for
  registry snapshots created later; it never mutates existing instances.
- `findDocumentRenderer(file, registry?)` — checks normalized MIME essence (case-insensitive and
  parameter-independent), then the first matching `matches()` entry in registration order.
- `loadDocumentRenderer(definition)` — resolves and identity-caches a lazy direct definition;
  rejected loads are retried on the next call.

```html
<lr-document-viewer
  open
  name="report.pdf"
  mime-type="application/pdf"
  src="/files/report.pdf"
></lr-document-viewer>
```

Construct and inject a renderer registry per application/viewer. The definition may load a heavy
optional viewer only when a matching document is opened:

```ts
import { createDocumentRendererRegistry } from "@aceshooting/lyra-ui/components/viewers/document-viewer/registry.js";

const registry = createDocumentRendererRegistry([
  ["application/x-example", { render: (file) => `Preview: ${file.name}` }],
]);

html`<lr-document-viewer .registry=${registry}></lr-document-viewer>`;
```

Supply AV metadata without widening every legacy renderer callback. The built-in AV adapter always
declares `time-range` anchors and declares search only when the retained cue snapshot contains
non-whitespace transcript or speaker text:

```ts
import type { LyraDocumentRendererPayload } from "@aceshooting/lyra-ui/components/viewers/document-viewer/registry.js";

const payload = {
  kind: "av",
  file: { name: "episode.mp4", mimeType: "video/mp4", src: "/episode.mp4" },
  cues: [{ cueId: "intro", start: 0, text: "Welcome", speaker: "Host" }],
  tracks: [
    {
      src: "/episode-en.vtt",
      kind: "captions",
      srclang: "en",
      label: "English",
    },
  ],
} satisfies LyraDocumentRendererPayload;

html`<lr-document-viewer open .payload=${payload}></lr-document-viewer>`;
```

When no renderer matches, the viewer renders `<lr-document-preview>`, which handles text and images
inline and provides a safe generic fallback for other formats.

If a consumer matcher/renderer throws while an anchor is pending, the viewer renders localized
ordinary error text, appends the transition to the shared document-level assertive sink, and emits
exactly one `lr-anchor-result` with `{ found: false }`.

## `lr-docx-viewer`

Fetches a `.docx` Word document as an `ArrayBuffer`, converts it to semantic HTML with the optional
`mammoth` peer, sanitizes that HTML through the optional `dompurify` peer, and renders the result.
Mammoth preserves document structure such as headings, paragraphs, lists, tables, and images; it is
not intended to reproduce pixel-exact Word page layout. There is no unsanitized rendering escape
hatch: if `dompurify` is unavailable, rendering is blocked even when Mammoth converted successfully.

Every rendered heading's slug (the same GitHub-slugger-style algorithm `<lr-markdown>` uses) is
stamped as its `id` and cached into `getHeadingTree()`'s document-ordered outline. Duplicate
headings receive monotonic `-1`, `-2`, … suffixes; used suffixes are never re-probed for the same
base, so one bounded heading pass performs linear aggregate dedupe work. Adopts
`DocumentAnchorTarget`: `fragment` anchors resolve against that outline, `text-quote` anchors via
the shared quote-scoping helpers; `highlights` re-resolve by quote after every render. Native
keyboard actions are exposed only for highlights whose quote resolves in the currently loaded
document; unresolved highlights and idle/loading/error states never expose an enabled no-op.

**Properties:** `src: string = ''`, `name: string = ''`, and `maxHeight: string = ''` (attribute
`max-height`). A nonempty host `aria-label` makes the host the sole named semantic owner. With an
explicitly empty host label, the shadow document keeps `role="document"` and an empty accessible
name; when the attribute is absent, `name` and the localized label are fallbacks. `maxHeight` caps the
scrollable document body; invalid CSS `max-height` values, declaration breaks, and `url()` are
ignored. The inherited anchor-target properties are `highlights: readonly LyraHighlight[] = []` (property
only; reassign after mutation), `activeHighlightId: string | null = null` (attribute
`active-highlight-id`), `anchor: LyraAnchor | string | null = null` (property only), and
`anchorKinds: readonly LyraAnchorKind[] = ['fragment', 'text-quote']` (this viewer's supported
`LyraAnchor.kind` values).

**Methods:** `getHeadingTree()` returns the document-ordered outline as `DocxHeadingItem[]` (`{ id,
label, level }`), cached on every successful load. `search(query)` resolves the match count via a
case-insensitive substring search over the rendered content's text (empty/whitespace query behaves
like `clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through matches
(wrapping, resolving `false` when there are none); `clearSearch()` clears the query, matches, and
painted marks. It indexes at most 1,000,000 code units/20,000 text nodes per content generation,
accepts at most 4,096 query code units, scans at most 4,000,000 code units, retains 1,000 matches,
and paints a 200-range search window.

**Events:** `lr-render-error` with `detail.error` only when fetching, conversion, or sanitization
fails terminally. Non-fatal Mammoth conversion messages emit `lr-viewer-diagnostic` instead;
`detail.diagnostic` is readonly `{ code: 'docx-conversion-message', severity: 'warning', fatal:
false, source: 'mammoth', cause }`. `lr-search-change` (`detail: { query, matchCount,
matchCountExact, activeIndex }`) — from search/navigation/clear, canonical source reset, and
effective-locale re-evaluation.
`lr-highlight-activate` (`detail: { highlightId }`) — a painted `text-quote` highlight was clicked or its
resolved keyboard action was activated.
`lr-text-select` (`detail: { text, anchor, rects }`) — fired on selection end inside the rendered
content. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call.

**CSS parts:** `base`, `body`, `content`, `spinner`, `error`, `highlight` (a painted `text-quote`
highlight), `highlight-actions` (keyboard-accessible actions for resolved highlights),
`highlight-action` (one native highlight activation button), `search-match` (a painted in-document
search match), and `search-match-active` (the currently active search match, also carries
`search-match`).

**Themeable custom properties:** `--lr-docx-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.
Highlight backgrounds are independently themeable with
`--lr-docx-viewer-highlight-accent-background`,
`--lr-docx-viewer-highlight-success-background`,
`--lr-docx-viewer-highlight-warning-background`,
`--lr-docx-viewer-highlight-danger-background`, and
`--lr-docx-viewer-highlight-neutral-background`, defaulting to the matching quiet color tokens --
except neutral, which defaults to `var(--lr-color-surface-raised)`: `[part='content']` paints no
background of its own and therefore shows `[part='base']`'s `--lr-color-surface`, so a neutral
highlight falling back to that same token would render as unhighlighted.
`--lr-docx-viewer-highlight-active-background` and
`--lr-docx-viewer-highlight-active-outline` style the active host highlight.
`--lr-docx-viewer-search-match-background`,
`--lr-docx-viewer-search-match-active-background`, and
`--lr-docx-viewer-search-match-active-foreground` style resting and active search matches.

**Optional peer dependencies:** install `mammoth` and `dompurify` with `pnpm add mammoth dompurify`.
The component registers an eager `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
renderer with `<lr-document-viewer>` (a plain `render`, no `load()` hook — importing this module
defines `<lr-docx-viewer>` immediately; only `mammoth`/`dompurify` themselves are loaded on demand)
and matches `.docx` filenames when the MIME type is generic.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the document.

```html
<lr-docx-viewer
  src="/files/report.docx"
  name="report.docx"
  max-height="32rem"
></lr-docx-viewer>
```

## `lr-email-viewer`

Fetches and parses `.eml` messages with the optional `postal-mime` peer. HTML message bodies are
sanitized through the existing optional `dompurify` peer before rendering; plain-text messages
remain available without DOMPurify. Attachments are listed as filename and size only (the parsed
`mimeType` never reaches the DOM) and their content is never rendered by this component. Each
attachment row is a real `<button>` that emits `lr-attachment-open` with an immutable Blob snapshot
of the decoded bytes; opening, downloading, or object-URL'ing them is the host's job (e.g.
`URL.createObjectURL(content)` → `<lr-document-viewer>` → revoke on
`lr-close`).

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the message.

**Properties:** `src: string = ''`, `name: string = ''`, and `maxHeight: string = ''` (attribute
`max-height`); invalid CSS
`max-height` values, declaration breaks, and `url()` are ignored. `foldQuotes: boolean = false`
(attribute `fold-quotes`) — collapses trailing quoted-reply text/HTML behind a
localized show/hide toggle. `false` (the default) preserves the full body rendering. A nonempty
host `aria-label` makes the host the sole named semantic owner; an explicitly empty host label
keeps the shadow `region` with an empty name, and an absent host label falls back to `name` or the
localized label. `highlights`, `activeHighlightId`, `anchor`, and
`anchorKinds` (`['text-quote', 'fragment']`) provide the shared text-viewer contract.

**Methods:** `search(query)`, `searchNext()`, `searchPrevious()`, `clearSearch()`, and
`scrollToAnchor()` operate on rendered message text and emit the shared search/anchor events.

**Events:**

- `lr-render-error` with `detail.error` when fetching or parsing fails.
- `lr-attachment-open` — recursively frozen `detail: { attachment: { filename, mimeType,
  content?: Blob } }`; call `content.arrayBuffer()` to read the immutable copied bytes. This
  replaces the mutable `Uint8Array` event field.
- `lr-search-change` — `detail: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }` — fired
  whenever rendered-message search state changes.
- `lr-anchor-result` — `detail: { found: boolean }` — fired after an `anchor` assignment or
  `scrollToAnchor()` call is applied.
- `lr-text-select` — `detail: TextSelectDetail` (`{ text: string; anchor: LyraAnchor | null; rects:
DOMRect[] }`) — fired after a selection ends inside the rendered message.

`lr-highlight-activate` is not part of this viewer's event contract: painted text highlights are
passive and cannot be activated.

The three shared text-viewer events bubble and compose and are non-cancelable.

**CSS parts:** `base`, `headers`, `from-label`, `from`, `to-label`, `to`, `subject-label`, `subject`,
`date-label`, `date`, `body`, `body-html`, `body-text`, `attachments`, `attachments-label`,
`attachment-list`, `attachment-item`, `attachment-button` (an attachment's open button, inside its
`attachment-item`), `attachment-name` (an attachment's filename, inside `attachment-button`),
`attachment-size` (an attachment's formatted file size, inside `attachment-button`), `quoted` (a
folded quoted-text block, hidden until expanded, only while `foldQuotes`), `quote-toggle` (the
show/hide-quoted-text toggle button, only while `foldQuotes`), `spinner`, and `error`.

**Themeable custom properties:** `--lr-email-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Optional peer dependencies:** install `postal-mime` and `dompurify` with
`pnpm add postal-mime dompurify`. The component registers `message/rfc822` and falls back to
matching `.eml` filenames in `<lr-document-viewer>`. Fail-closed behavior is explicit: an absent
`postal-mime` renders `[part="error"]` with the localized
`emailViewerMissingParser` message (nothing is parseable without it), and an HTML-only message
(no `text/plain` alternative) with `dompurify` absent renders the localized
`documentViewerMissingSanitizer` message rather than silently showing an empty body.

## `lr-calendar-viewer`

Fetches and parses `.ics` calendars with the optional `ical.js` peer and renders each VEVENT as
plain text, including its title, start/end time, location, and description. RFC 5545 `DATE` values
remain all-day dates rather than fabricated midnight times, and an all-day `DTEND` is displayed as
the exclusive boundary it represents (14–17 renders as 14–16). No HTML is injected.

**Properties:** `src: string = ''`, `name: string = ''`, and `maxHeight: string = ''` (attribute
`max-height`); invalid CSS
`max-height` values, declaration breaks, and `url()` are ignored. A host `aria-label` takes
precedence over `name` by attribute presence, including an explicitly empty value. `highlights`,
`activeHighlightId`, `anchor`, and
`anchorKinds` (`['text-quote', 'fragment']`) provide the shared text-viewer contract.

**Methods:** `search(query)`, `searchNext()`, `searchPrevious()`, `clearSearch()`, and
`scrollToAnchor()` operate on rendered event text and emit `lr-search-change`/`lr-anchor-result`.

**Events:**

- `lr-render-error` with `detail.error` when fetching or parsing fails.
- `lr-search-change` — `detail: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }` — fired
  whenever rendered-calendar search state changes.
- `lr-anchor-result` — `detail: { found: boolean }` — fired after an `anchor` assignment or
  `scrollToAnchor()` call is applied.
- `lr-text-select` — `detail: TextSelectDetail` (`{ text: string; anchor: LyraAnchor | null; rects:
DOMRect[] }`) — fired after a selection ends inside the rendered calendar.

`lr-highlight-activate` is not part of this viewer's event contract: painted text highlights are
passive and cannot be activated.

The three shared text-viewer events bubble and compose and are non-cancelable.

**CSS parts:** `base`, `body`, `event-list`, `event`, `event-summary`, `event-time`, `event-location`,
`event-description`, `spinner`, and `error`.

**Themeable custom properties:** `--lr-calendar-viewer-max-height` (default `none`) — maximum block
size of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Optional peer dependency:** install `ical.js` with `pnpm add ical.js`. The component registers
`text/calendar` and falls back to matching `.ics` filenames in `<lr-document-viewer>`.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the calendar. The accepted model is further
capped at 250 events and 2 MiB of rendered event text; this keeps the complete accepted document in
the DOM so search, selection and anchors remain truthful without the former 10,000-event eager tree.

## `lr-archive-viewer`

Lists entry names and human-readable declared uncompressed sizes inside a `.zip` archive. It is
listing-only: entry content is never inflated, rendered, or previewed, and the component has no
runtime archive-parser dependency. One owned central-directory parser validates local-header
bounds, supported compression methods, entry names, and the 10,000-entry/100 MB declared-expansion
ceilings, then returns the immutable metadata used directly by the listing. The list composes
`<lr-virtual-list>` for large archives.

**Properties:** `src: string = ''`, `name: string = ''`, and `maxHeight: string = ''` (attribute
`max-height`) — a host-level `aria-label` takes precedence over `name` by attribute presence,
including an explicitly empty value, when naming the `role="region"` listing. `maxHeight` caps the
scrollable archive body; invalid CSS `max-height` values, declaration breaks, and `url()` are
ignored. The viewer also exposes the shared text-viewer
contract: `highlights`, `activeHighlightId`, `anchor`, and `anchorKinds` (`['text-quote', 'fragment']`).

**Methods:** `search(query)`, `searchNext()`, `searchPrevious()`, and `clearSearch()` provide
case-insensitive text search over every loaded entry path; next/previous wrap and scroll the active
virtualized row into view. Queries are capped at 4,096 code units and each pass at 4,000,000 path
code units; `matchCountExact: false` reports a ceiling-truncated lower bound. `scrollToAnchor()` resolves text-quote and fragment anchors and emits
`lr-anchor-result`. A fragment id is the exact ZIP entry path. A text quote resolves within one
complete entry path; both forms first mount the absolute virtualized row and only then perform the
shared DOM-level anchor resolution. A jump whose archive is replaced by a concurrent `src`
reassignment mid-flight, or whose row cannot be located after the wait, reports `found: false`
rather than a phantom success.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails;
`lr-search-change` (`detail: { query, matchCount, matchCountExact, activeIndex }`) from search,
navigation, clear, canonical source reset, and effective-locale re-evaluation; `lr-text-select`
(`detail: { text, anchor, rects }`) for a selection contained within one
entry path; and `lr-anchor-result` (`detail: { found }`) after anchor resolution.
`lr-highlight-activate` is not part of this viewer's event contract: archive entry-path highlights
are passive and cannot be activated.

**CSS parts:** `base`, `body`, `entry`, `entry-icon`, `entry-name`, `entry-name-dir`, `entry-size`,
`highlight` (the `<mark>` fallback for a painted entry-path quote), `spinner`, and `error`. A
directory row's name element carries both `entry-name` and
`entry-name-dir` (a part list), so `::part(entry-name-dir)` selects only directory names while
`::part(entry-name)` still selects every name. Entry rows are rendered into the embedded
`<lr-virtual-list>`'s own shadow root and forwarded with `exportparts`, so
`lr-archive-viewer::part(entry)` (and every other row part above) reaches them from a consuming
stylesheet.

**Themeable custom properties:** `--lr-archive-viewer-max-height` (default `none`) caps the
scrollable `[part="body"]` and is also settable through `maxHeight`/`max-height`.
`--lr-archive-viewer-highlight-accent-background`,
`--lr-archive-viewer-highlight-success-background`,
`--lr-archive-viewer-highlight-warning-background`,
`--lr-archive-viewer-highlight-danger-background`, and
`--lr-archive-viewer-highlight-neutral-background` control tone backgrounds. The neutral default is
`var(--lr-color-surface-raised)`, deliberately not `--lr-color-surface`: entry rows paint no
background of their own and therefore show the viewer's `--lr-color-surface`, so a neutral highlight
falling back to that same token would render as unhighlighted.
`--lr-archive-viewer-highlight-active-background` and
`--lr-archive-viewer-highlight-active-outline` control the active quote.

**Exports:** `ArchiveEntry` — `{ name: string; dir: boolean; size: number }`.

The lazy registry registers `application/zip` and `application/x-zip-compressed`, with a `.zip`
filename fallback, and imports the viewer only when a matching archive is opened. Both registrations declare
`capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true }` — sibling to
`load`, not inside it, so feature detection can read the capabilities without paying for the lazy
import. Opening a `.zip` through `<lr-document-viewer>` forwards `anchor`/`highlights` to the mounted
viewer, so a deep link into an entry name survives the registry hop. `.tar`, `.rar`, and other
archive formats fall through to `<lr-document-preview>`'s generic download fallback.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the entry listing.

## `lr-ebook-viewer`

Renders EPUB ebooks through the optional `epubjs` peer. `src` is fetched as an `ArrayBuffer`, and
epub.js renders the reading area into its stable `mount` element, using an internal iframe for
chapter content.

**Properties:** `src: string = ''` and `name: string = ''`. A plain `aria-label` attribute on the
host overrides the reading region's accessible name — by attribute presence, so an explicitly empty
`aria-label=""` still wins over `name`. (There is no matching JS property: the `accessibleLabel`
property was removed in 9.0.0, where it had never been readable or writable to any effect — set the
attribute.) `maxHeight: string = ''`
(attribute `max-height`) caps the `mount` area epub.js renders into; invalid CSS `max-height`
values, declaration breaks, and `url()` are ignored. `location: string = ''`
(not reflected — CFIs are long) is
a CFI or spine href identifying the current reading position: set before the book finishes
loading it's recorded and applied once ready, set after it applies immediately, and epub.js's own
`relocated` event keeps it in sync with user navigation without re-triggering its own `display()`
call. A controlled `location` assignment made synchronously inside `lr-location-change` wins over
the peer-reported CFI and is displayed. `anchorKinds: readonly LyraAnchorKind[] = ['cfi',
'text-quote']` (this
viewer's supported `LyraAnchor.kind` values for the shared anchor-target contract).

**Methods:** `getToc()` resolves the EPUB's own navigation document (`book.navigation.toc`,
populated once `book.ready` resolves) flattened into document-ordered `EbookTocItem[]` (`{ id,
label, href, level }`, `level` starting at 1 for a top-level entry, `id` falling back to `href`
when a navigation entry has none), `[]` before a book has loaded. `search(query)` resolves the
match count across every spine section, in document order, via epub.js's own `item.load()`/
`item.find()`/`item.unload()` (empty/whitespace query behaves like `clearSearch()`; a newer
`search()` call or a `src` change aborts an in-flight scan; peer output is capped at 10,000
matches after at most 1,000 spine items and 4,000,000 result code units; queries are capped at 4,096
code units); `searchNext()`/`searchPrevious()`
advance/step back through matches (wrapping, resolving `false` when there are none); `clearSearch()`
clears the query, matches, and painted search annotation.

**Events:** `lr-render-error` with `detail.error` when fetching, opening, or rendering fails;
`lr-location-change` (`detail: { cfi, href }`) fired from epub.js's own `relocated` event;
`lr-search-change` (`detail: { query, matchCount, matchCountExact, activeIndex }`) from search,
navigation, clear, canonical source reset, and effective-locale re-evaluation; `lr-anchor-result`
(`detail: { found }`) after an anchor is
applied; `lr-highlight-activate` (`detail: { highlightId }`) when a painted CFI highlight is clicked; and
`lr-text-select` (`detail: { text, anchor, rects }`) after selection inside a chapter iframe.
Selection text is capped at 4,096 code units and selection rectangles at 1,000.

**CSS parts:** `base` (explicit `aria-busy="true"|"false"`; visible loading text is ordinary
non-live shadow content and later loading transitions use the shared document-level polite sink),
`toolbar`, `previous-button`, `next-button`, `previous-icon`, `next-icon`,
`mount`, and `error` (ordinary visible text; later error transitions use the shared document-level
assertive sink). Search results are appended to the shared document-level polite sink, which lives
in the host's light DOM; the empty `announcer` shadow mirror that used to carry a part of that name
was removed in 9.0.0 (it had no styling of its own and never held any text).

**Themeable custom properties:** `--lr-ebook-viewer-max-height` (default `none`) — maximum block
size of `[part="mount"]` before it scrolls internally; also settable via the `max-height` property,
which writes this token inline.

The toolbar buttons use the component-specific localized labels `ebookViewerPreviousChapter` and
`ebookViewerNextChapter` (English: “Previous chapter” / “Next chapter”), so they remain
unambiguous beside other previous/next controls and are overridable through `.strings`.

**Optional peer dependency:** install `epubjs` with `pnpm add epubjs`. The document-viewer registry
matches `application/epub+zip` and `.epub` filenames, declaring `{ anchors: ['cfi', 'text-quote'],
search: true, textSelect: true }` capabilities and forwarding `anchor`/`highlights` to the mounted
viewer. The peer loader requires the callable EPUB factory; malformed module shapes fail closed.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the ebook.

Adopts the shared anchor-target contract (`highlights`, `activeHighlightId`, `scrollToAnchor()`,
events `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`): a `cfi` anchor displays
directly via `rendition.display()`; a `text-quote` anchor resolves by scanning the spine with
epub.js's own `item.find()`, since chapter content lives inside epub.js-owned iframes rather than
this component's own shadow DOM — `lr-text-select` mirrors epub.js's own `selected` event for the
same reason. `highlights` (kind `cfi`) paint via `rendition.annotations.highlight()` and are
re-applied whenever the rendition is recreated (a `src` change, or a reconnect remount), since
epub.js doesn't persist annotations across a fresh `renderTo()`.

Rejected or synchronous failures from display, previous/next navigation, search annotation, or
anchor application enter the localized error state and emit `lr-render-error`. Anchor failures
emit one `{ found: false }`, and superseded async anchor/search work cannot mutate the current book.

## `lr-pptx-viewer`

Best-effort client-side PPTX viewer backed by the optional `@aiden0z/pptx-renderer` peer. A
localized fidelity notice is always visible because animations, equations, embedded objects,
speaker notes, and several advanced effects are not rendered.

**Properties:** `src: string = ''`, `name: string = ''`, `label: string = ''`, `page: number = 1`
(reflected, one-based current slide), and `maxHeight: string = ''` (attribute `max-height`). Assigning
`page` while ready navigates to that slide. A host
`aria-label` takes precedence over
`label` and `name`. `maxHeight` caps the scrollable `[part="container"]`; invalid CSS `max-height`
values, declaration breaks, and `url()` are ignored. `highlights`, `activeHighlightId`, `anchor`,
and `anchorKinds`
(`['text-quote', 'fragment']`) provide the shared text-viewer contract when the renderer exposes
DOM text.

**Methods:** `goToSlide(index)` returns a promise and navigates the mounted presentation using the
renderer's zero-based index. A current renderer rejection is contained, enters the localized error
state, emits `lr-render-error`, and does not escape as an unhandled promise rejection.
`renderPageThumbnailToContainer(page, container, options?)` renders a
one-based, width-bounded DOM/SVG slide preview and resolves to a caller-owned disposable handle (or
`false` when unavailable/invalid); it generation-checks asynchronous preview resources after they
settle.
`search(query)` searches the renderer's complete presentation model, not its windowed DOM, retains
at most 10,000 validated results, navigates the matching slide, and paints a renderer-owned node
overlay. Queries are capped at 4,096 code units and one result-validation pass at 4,000,000 code
units; a truncated pass reports `matchCountExact: false`. `searchNext()`, `searchPrevious()`, and `clearSearch()` navigate/dispose those model
results. `scrollToAnchor()` remains available for renderer output that exposes DOM text.

**Events:**

- `lr-load` — `detail: { slideCount }` — fired after a presentation opens.
- `lr-slide-change` — `detail: { index, count }` — fired when the active slide changes.
- `lr-page-viewer-state-change` — `detail.snapshot` is the same atomic readonly value exposed by
  `pageViewerSnapshot`: `{ identity, status, page, pageCount }`. `identity` changes at the start of
  every load so a rail can discard same-count replacement thumbnails without inferring identity
  from `src`.
- `lr-render-error` with `detail.error` when fetching/opening fails, public slide navigation rejects,
  or a post-load peer event is explicitly classified fatal.
- `lr-viewer-diagnostic` — `detail.diagnostic` is a readonly structured slide/node/search
  diagnostic with stable `code`, `severity`, `fatal`, `source`, `cause`, and correlated `page` or
  `nodeId` when valid. Recoverable events keep the mounted deck usable and do not also emit
  `lr-render-error`; fatal events enter the localized error state, destroy the adapter, and emit the
  terminal event once.
- `lr-search-change` — `detail: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }` — fired
  whenever rendered-presentation search state changes, including canonical source reset and
  effective-locale re-evaluation.
- `lr-anchor-result` — `detail: { found: boolean }` — fired after an `anchor` assignment or
  `scrollToAnchor()` call is applied.
- `lr-text-select` — `detail: TextSelectDetail` (`{ text: string; anchor: LyraAnchor | null; rects:
DOMRect[] }`) — fired after a selection ends inside the rendered presentation.

`lr-highlight-activate` is not part of this viewer's event contract: painted renderer-text
highlights are passive and cannot be activated.

The three shared text-viewer events bubble and compose and are non-cancelable.

**CSS parts:** `base` (the named region with explicit `aria-busy="true"|"false"`), `header`, `name`,
`notice`, `error`, `nav`, `previous-button`, `previous-icon`, `slide-count`, `next-button`,
`next-icon`, and `container`. While loading, the decorative skeleton is paired with an ordinary
visually-hidden localized label; later loading and error transitions use the shared document-level
polite and assertive sinks, respectively, without adding live semantics inside the viewer shadow.
The previous/next chevrons mirror under effective RTL direction, including inherited `dir` changes.

**Themeable custom properties:** `--lr-pptx-viewer-max-height` (default `none`) — maximum block
size of `[part="container"]` before it scrolls internally; also settable via the `max-height`
property, which writes this token inline.

**Optional peer dependency:** install `@aiden0z/pptx-renderer` with
`pnpm add @aiden0z/pptx-renderer`. The registry matches the official PPTX MIME type and `.pptx`
filenames, declaring `{ anchors: ['text-quote', 'fragment'], search: true, textSelect: true }`
capabilities and forwarding `anchor`/`highlights` to the mounted viewer, so a deep link opened
through `<lr-document-viewer>` survives the registry hop.

Remote resources are capped at 25 MB and measured ZIP expansion is capped at 256 MB before the
renderer opens the archive; exceeding either ceiling surfaces the localized
`documentPreviewResourceTooLarge` message instead of the presentation. The optional peer must also
expose its complete recommended ZIP-limits capability within Lyra's safety ceilings. Missing,
malformed, or more-permissive limits make the peer unavailable and the viewer fails closed.

The peer instance is immediately wrapped in a validated `PptxViewerAdapter`; the component observes
only readonly slide metadata, complete-model search/navigation/highlight/thumbnail capabilities and
normalized correlated events. Raw renderer DOM windowing and event payloads do not become component
state.
`PptxViewerAdapter`, `PptxViewerAdapterEvent`, `PptxTextSearchResult`, and
`PptxSearchHighlightHandle`/`PptxThumbnailHandle` are exported from the granular PPTX loader module.
The shared diagnostic
types are `LyraViewerDiagnostic`, `LyraViewerDiagnosticCode`, `LyraViewerDiagnosticSeverity`, and
`LyraViewerDiagnosticEventDetail`.

## `lr-svg-viewer`

Fetches an SVG document, sanitizes it with the optional `dompurify` peer, and renders it inline.
The shared `passive-svg` profile (the same post-sanitization engine used for embedded viewer markup)
removes author `<style>`/`style`, SVG animation elements, and external
resource or paint-server references before insertion, preventing fetched SVG content from escaping
the viewer's paint box or starting secondary requests. Local `url(#id)` paint servers and embedded
raster data remain available.

Adopts `DocumentAnchorTarget` (the same shared mixin `lr-pdf-viewer`/`lr-csv-viewer` use): a `region`
anchor addresses one `highlights` entry, matched by reference or by structural equality of its `rect`
(and optional `page`). Assigning `anchor` or calling `scrollToAnchor()` scrolls the matching
`[part="region-highlight"]` into view and fires `lr-anchor-result`. No other anchor kind resolves
here — a sanitized SVG document has neither pages nor extractable text to quote, which is also why
its registry entry declares `capabilities: { anchors: ['region'], search: false, textSelect: false }`.

**Properties:** `src: string = ''`, `name: string = ''`, and `maxHeight: string = ''` (attribute
`max-height`). `maxHeight` caps the scrollable body; invalid CSS `max-height` values, declaration
breaks, and `url()` are ignored.
`zoomable: boolean = false` (reflected) — wraps the rendered content in an
internal `<lr-pan-zoom>`. `false` (the default) preserves the exact pre-`zoomable` DOM — an
inline thumbnail (e.g. in a chat stream) must not unexpectedly grow a focusable zoom-chrome viewport;
an inspection surface opts in. `anchor: LyraAnchor | string | null = null` (attribute: false) —
declaratively jump to an anchor (a `LyraAnchor` object, or a `highlights` entry's `id`). Assigning it
calls `scrollToAnchor()` and fires `lr-anchor-result`; re-assigning the same value re-triggers the
scroll, it is not reference-gated. `highlights: readonly LyraHighlight[] = []` (attribute: false) —
display-only `region` highlights painted over the rendered SVG; unchanged behavior, now inherited
from `DocumentAnchorTarget` rather than declared locally. A region rectangle renders/resolves only
when `x`/`y`/`width`/`height` are finite numbers and both dimensions are nonnegative.
`activeHighlightId: string | null = null`
(attribute `active-highlight-id`) — the `highlights` entry, if any, currently treated as active
(`data-active` on its `region-highlight`). `anchorKinds: readonly LyraAnchorKind[] = ['region']`
(this viewer's supported `LyraAnchor.kind` values for the shared anchor-target contract).

**Methods:** `scrollToAnchor(target): Promise<boolean>` — scrolls the `highlights` entry matching
`target` (a `region`-kind `LyraAnchor`, matched by reference or by structural equality of
`rect`/`page`; or a `highlights[].id` string) into view, honoring `prefers-reduced-motion`. Resolves
`true` when a match was found and scrolled, `false` otherwise, and always fires `lr-anchor-result`
carrying the same boolean. Called before the SVG has finished loading it retries for up to 5s (real
timers) rather than failing immediately.

**Events:** `lr-render-error` with `detail.error` when fetching or sanitizing fails.
`lr-highlight-activate` (`detail: { highlightId }`) — a region highlight was clicked or activated via
Enter/Space. `lr-anchor-result` (`detail: { found: boolean }`) — fired after an `anchor` assignment
or a `scrollToAnchor()` call is applied, whether or not a match was found. `lr-text-select` is not
part of this viewer's event contract because sanitized SVG has no extractable text-selection
contract (`textSelect: false` in its registry capabilities).

**CSS parts:** `base`, `body`, `svg`, `spinner` (ordinary loading content; later transitions use the
shared document-level polite sink), `error` (ordinary visible text; later transitions use the shared
document-level assertive sink), `anchor-live-region` (an aria-hidden, non-live shadow mirror of the
latest anchor-jump message; the spoken copy is appended to the shared document-level polite sink
only while the viewer and its composed ancestors are exposed to the accessibility tree),
`highlight-layer` (wrapper around every
rendered region highlight), `region-highlight` (one region highlight, `data-tone`, `data-active`),
`region-highlight-target` (transparent activation geometry with an independent minimum hit area),
`highlight-actions` (non-overlapping actions for multiple highlights), `region-highlight-action`
(one action in that list),
`frame-viewport`/`frame-content`/`frame-controls`/`frame-zoom-in`/`frame-zoom-out`/`frame-reset`
(forwarded from the internal `<lr-pan-zoom>` while `zoomable`).
The passive rendered image owns `role="img"`; the body upgrades to a named `region` only when zoom
controls or interactive region highlights are present. The spinner always includes visible
localized loading text alongside its decorative ring, and the ring stops under reduced motion.

**Themeable custom properties:** `--lr-svg-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.
`--lr-svg-viewer-active-border` (default `var(--lr-color-warning, var(--lr-color-brand))`) — the
border color of the `[part='region-highlight']` matching `activeHighlightId`, distinct from the
resting highlight border so the active region can be recolored without touching the rest. It is an
inline `var()` fallback at the point of use rather than a `:host` declaration, so it can be set on
the element _or on any ancestor_: `::part(region-highlight)[data-active]` is invalid CSS — Shadow
Parts forbids an attribute selector after `::part()` — so re-pointing a shared `--lr-color-*` token,
and repainting everything else reading it, was previously the only way. Unset, it falls back to
exactly the tokens the rule used before. The tone-specific resting border and hover tint use
`--lr-svg-viewer-highlight-accent-color`, `--lr-svg-viewer-highlight-success-color`,
`--lr-svg-viewer-highlight-warning-color`, `--lr-svg-viewer-highlight-danger-color`, and
`--lr-svg-viewer-highlight-neutral-color` (defaulting respectively to the matching
brand/success/warning/danger/neutral color tokens).

**Optional peer dependency:** `dompurify`.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the graphic.

## `lr-html-viewer`

Fetches an HTML document, sanitizes it with the optional `dompurify` peer, and renders the safe markup
inside a bounded, scrollable body.

**Properties:** `src: string = ''`, `name: string = ''`, and `maxHeight: string = ''` (attribute
`max-height`); invalid CSS
`max-height` values, declaration breaks, and `url()` are ignored. A nonempty host `aria-label`
makes the host the sole named semantic owner; an explicitly empty host label keeps the shadow
`document` role with an empty name, and an absent host label falls back to `name` or the localized
label. `highlights`, `activeHighlightId`, `anchor`, and
`anchorKinds` (`['text-quote', 'fragment']`) provide the shared text-viewer contract.

**Methods:** `search(query)`, `searchNext()`, `searchPrevious()`, `clearSearch()`, and
`scrollToAnchor()` operate on sanitized HTML text and emit the shared search/anchor events.

**Events:**

- `lr-render-error` with `detail.error` when fetching or sanitizing fails.
- `lr-search-change` — `detail: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }` — fired
  whenever rendered-document search state changes.
- `lr-anchor-result` — `detail: { found: boolean }` — fired after an `anchor` assignment or
  `scrollToAnchor()` call is applied.
- `lr-text-select` — `detail: TextSelectDetail` (`{ text: string; anchor: LyraAnchor | null; rects:
DOMRect[] }`) — fired after a selection ends inside the rendered document.

`lr-highlight-activate` is not part of this viewer's event contract: painted sanitized-text
highlights are passive and cannot be activated.

The three shared text-viewer events bubble and compose and are non-cancelable.

**CSS parts:** `base`, `body`, `html`, `spinner`, and `error`.

**Themeable custom properties:** `--lr-html-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Optional peer dependency:** `dompurify`. The registry matches `text/html` and `.htm`/`.html`
filenames, declaring `{ anchors: ['text-quote', 'fragment'], search: true, textSelect: true }`
capabilities and forwarding `anchor`/`highlights` onto the created element, so a deep link opened
through `<lr-document-viewer>` survives the registry hop.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the document.

## `lr-dataset-viewer`

Fetches tab-, pipe-, or delimiter-separated text and renders a virtualized, accessible table (a
`role="table"` container with a sticky `role="row"` header, composed with `<lr-virtual-list
item-role="row">` for the body) using the optional `papaparse` peer. The document registry matches
`.tsv`, `.psv`, and `.dat` filenames.

Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses the raw file grid, 1-based, with the
header row always occupying row 1 (this component always parses with a header row, so the first row
is never part of the virtualized body); `scrollToAnchor()` scrolls the addressed row into view via
the virtualized list's `active-item-id`. `highlights` paint as a `part="cell-highlight"` cell wrapping a
focusable `part="cell-highlight-action"` native button, keeping the ARIA table tree intact. A jump
whose document is replaced by a concurrent `src` reassignment mid-flight reports `found: false`
rather than a phantom success, and a header-row target scrolls with the same
`prefers-reduced-motion`-gated smooth behavior every other row uses.

**Properties:** `src: string = ''`, `name: string = ''`, and `maxHeight: string = ''` (attribute
`max-height`); invalid CSS `max-height` values, declaration breaks, and `url()` are ignored.
Host `aria-label` names the table by attribute presence, including an explicitly empty value;
`name` and the localized row-count caption are fallbacks. The same computed name (host `aria-label`,
else `name`) also names a persistent `role="region"` landmark on `[part='base']` in _every_ fetch
state — idle, loading, empty, error, loaded — so a landmark-navigating screen-reader user reaches the
viewer before it has any rows, not only after a successful non-empty load. With neither set,
`[part='base']` stays a plain wrapper rather than an unnamed region. The outer region carries the
plain display name while the inner `[part='table']` keeps the richer row-count caption; the two are
complementary, matching `lr-csv-viewer`/`lr-archive-viewer`'s base-vs-content split.
`anchorKinds: readonly LyraAnchorKind[] = ['cell-range']` (this viewer's supported `LyraAnchor.kind`
values for the shared anchor-target contract).

**Methods:** `search(query)` resolves the match count via a case-insensitive substring search over
every body cell's raw string value, ordered row then column (empty/whitespace query behaves like
`clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through matches (wrapping,
resolving `false` when there are none); `clearSearch()` clears the query, matches, and cursor.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails. Up to 100
PapaParse diagnostics also emit this event when the recoverable partial table remains rendered, so
malformed or extra cells are never silently presented as a clean parse; exceeding that diagnostic
budget is a resource-limit error instead.
`lr-highlight-activate` (`detail: { highlightId }`) — a `highlights` cell was clicked or activated via
Enter/Space. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call. `lr-search-change` (`detail: { query, matchCount, matchCountExact, activeIndex }`) — from
search/navigation/clear, canonical source reset, and effective-locale re-evaluation. `lr-text-select` is not part of this
grid viewer's event contract; its registry capabilities advertise `textSelect: false`.

**CSS parts:** `base` (a persistent `role="region"` named by the host `aria-label` or `name`, in
every fetch state), `body`, `table`, `header-row`, `header-cell`, `data-row`, `cell`,
`cell-highlight` (a `role="cell"` covered by a `highlights` entry; wraps the action button),
`cell-highlight-action` (the native button filling a highlighted cell — focusable, emits
`lr-highlight-activate` on click or Enter/Space; its complete accessible name uses the localized
`cellHighlightWithLabel` message with independent `{value}` and `{label}` placeholders), `spinner`,
and `error`. `data-row`, `cell`,
`cell-highlight` and `cell-highlight-action` render inside the internal `<lr-virtual-list>` and are
forwarded via `exportparts`, so `lr-dataset-viewer::part(cell)` reaches them from a consumer
stylesheet.

**Exports:** `DatasetTable` is `{ fields: string[]; rows: Record<string, string>[] }`.

**Themeable custom properties:** `--lr-dataset-viewer-max-height` (default `none`) — maximum block
size of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.
`--lr-dataset-viewer-highlight-color` (default `var(--lr-color-brand)`) — the outline color of a
`cell-highlight` cell. The cell matching `activeHighlightId` receives a private warning-color
default because a `[data-active]` selector can't be chained onto the `::part(cell-highlight)` the
cell reaches this component's stylesheet through. An inherited or direct public value remains
authoritative across that boundary.

**Optional peer dependency:** `papaparse`.

Remote resources are capped at 25 MB. A quote-aware scan stops before PapaParse at 10,000 data rows,
1,000 fields in any row, 1,000,000 aggregate cells (including the header), or more than 100 parser
diagnostics; streaming record callbacks enforce the same ceilings again. Exceeding any ceiling
surfaces the localized `documentPreviewResourceTooLarge` message instead of a partial table.

## `lr-contact-viewer`

Fetches a vCard document and renders one accessible card per contact. The document registry matches
`.vcf` filenames and the `FN`, `ORG`, `TEL`, `EMAIL`, and `ADR` fields are displayed. `N` is parsed
but never rendered — the card's heading uses `FN` (falling back to a localized "unnamed contact"
label when `FN` is absent).

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the contacts. Parsing retains at most 250
contacts and 2 MiB of rendered contact text, keeping the complete accepted model searchable and
anchorable without a 10,000-card eager DOM tree.

**Properties:** `src: string = ''`, `name: string = ''`,
`headingLevel: LyraHeadingLevel = '3'` (attribute `heading-level`, reflected) — `1`–`6` expose every
rendered contact name at that semantic level, invalid untyped values retain level 3, and `none`
keeps the names visual-only — and `maxHeight: string = ''` (attribute `max-height`); invalid CSS
`max-height` values, declaration breaks, and `url()` are ignored. A host `aria-label` takes
precedence over `name` by attribute presence, including an explicitly empty value. `highlights`,
`activeHighlightId`, `anchor`, and
`anchorKinds` (`['text-quote', 'fragment']`) provide the shared text-viewer contract.

**Methods:** `search(query)`, `searchNext()`, `searchPrevious()`, `clearSearch()`, and
`scrollToAnchor()` operate on rendered contact text and emit the shared search/anchor events.

**Events:**

- `lr-render-error` with `detail.error` when fetching or parsing fails.
- `lr-search-change` — `detail: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }` — fired
  whenever rendered-contact search state changes.
- `lr-anchor-result` — `detail: { found: boolean }` — fired after an `anchor` assignment or
  `scrollToAnchor()` call is applied.
- `lr-text-select` — `detail: TextSelectDetail` (`{ text: string; anchor: LyraAnchor | null; rects:
DOMRect[] }`) — fired after a selection ends inside the rendered contacts.

`lr-highlight-activate` is not part of this viewer's event contract: painted contact-text
highlights are passive and cannot be activated.

The three shared text-viewer events bubble and compose and are non-cancelable.

**CSS parts:** `base`, `body`, `contact`, `contact-name`, `contact-org`, `contact-tel`,
`contact-email`, `contact-adr`, `spinner`, and `error`.

**Themeable custom properties:** `--lr-contact-viewer-max-height` (default `none`) — maximum block
size of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Exports:** `parseVCards(text, maxContactsOrOptions?)` and the `ParseVCardsOptions`, `VCardName`,
`VCardTypedValue`, `VCardAddress`, and `VCardContact` types. The parser accepts vCard 2.1/3.0/4.0,
line folding, 2.1 bare types, quoted parameters and quoted-printable charset values. Its numeric
limit is floored and clamped to `0…250`; malformed framing/profiles/parameters fail closed, while an
actually empty document returns no contacts.

## `lr-pdf-viewer`

Fetches a PDF and renders its pages with the optional `pdfjs-dist` peer. Pages are virtualized through
`lr-virtual-list`, and PDF.js's selectable text layer is positioned over each rendered canvas.

Adopts `DocumentAnchorTarget`: `page`, `text-quote`, and `region` anchors resolve, and `highlights`
paint through one `<lr-highlight-layer>` per page, stacked between the canvas and the text layer
(canvas → highlights → text layer) so starting a text selection over a cited passage keeps working.
Pointer activation is hit-tested at the page-wrapper level (the text layer on top intercepts most
direct pointer events); keyboard activation reaches the highlight layer's own roving-tabindex rects
directly, since z-stacking doesn't affect tab order. Residual: a click that _ends a text-selection
drag_ over a highlighted passage never activates it — the selection-in-progress check exists exactly
to tell that apart from a genuine activation click.

**Properties:** `src: string = ''` and `name: string = ''`. `page: number = 1` is the one-based
current page and
`zoom: number = 1` is clamped to `0.25`–`4`. `maxHeight: string = ''` (attribute `max-height`) is a
CSS length that, once set, overrides `--lr-pdf-viewer-height` — the block size of the virtualized
page list — declaratively, writing it inline on `[part="base"]`; invalid CSS `max-height` values,
declaration breaks, and `url()` are ignored. `anchorKinds: readonly LyraAnchorKind[] = ['page',
'text-quote', 'region']` (this viewer's supported `LyraAnchor.kind` values for the shared
anchor-target contract). The other inherited anchor-target properties are `highlights:
LyraHighlight[] = []` (property only; reassign after mutation), `activeHighlightId: string | null =
null` (attribute `active-highlight-id`), and `anchor: LyraAnchor | string | null = null` (property
only). Page and page-addressed region anchors require an in-range integer page
and are rejected rather than clamped; region rectangles also require finite coordinates and
nonnegative dimensions.

**Events:**

- `lr-render-error` — `detail: { error }` — fetching, parsing, or rendering (page canvas or text
  layer) failed. Both synchronous and rejected text-layer failures are contained and reported
  without an unhandled promise rejection.
- `lr-load` — `detail: { pageCount }` — the document reached `ready`. `page` is reset to `1` first.
- `lr-page-change` — `detail: { page, pageCount }` — fired for scroll-driven page crossings as well
  as `page` assignments and `nextPage()`/`previousPage()`/`goToPage()`.
- `lr-zoom-change` — `detail: { zoom }`.
- `lr-search-change` — `detail: { query, matchCount, matchCountExact, activeIndex }` — from `search()`/`searchNext()`/
  `searchPrevious()`/`clearSearch()` and effective-locale re-evaluation. A `src` change invalidates document-relative matches and emits
  the canonical reset `{ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 }`.
- `lr-highlight-activate` — `detail: { highlightId }` — a painted highlight was clicked or activated via
  Enter/Space. On a pointer hit-test, the last entry of `highlights` covering the point wins.
- `lr-text-select` — `detail: { text, anchor, rects }` — a selection ended inside a page's text
  layer. `anchor` is the computed anchor (`null` when none resolves), carrying the resolved `page`
  when it is a `text-quote`.
- `lr-anchor-result` — `detail: { found }` — fired after an `anchor` assignment or a
  `scrollToAnchor()` call.
- `lr-page-viewer-state-change` — `detail.snapshot` is the same immutable atomic state exposed by
  `pageViewerSnapshot` (`identity`, `status`, `page`, `pageCount`). `identity` changes for every load,
  including same-count replacements.

**Methods:** `nextPage()`, `previousPage()`, `zoomIn()`, and `zoomOut()` update the corresponding
controlled state within its supported range. `getPageText(page)` resolves the raw reading-order text
of one page (per-page LRU-cached, 64 pages), rejecting on no loaded document or an out-of-range page.
`pageViewerSnapshot` is a synchronously readable readonly lifecycle/page/count snapshot for page
rails and other late subscribers. `renderPageThumbnail(page, canvas, options?)` renders `page` into a caller-owned `canvas` at
`options.width` CSS px (default 96), devicePixelRatio-aware, resolving `false` when not ready or out
of range. `goToPage(page)` scrolls the virtualized list to `page`, resolving `true` once mounted (or
`false` for an out-of-range value, without changing `page`). `getOutline()` resolves the document's
table of contents as `PdfOutlineItem[]` (`{ title, page?, children? }`), `[]` when there is none;
peer output is capped at 10,000 unique items and 100 levels, with cycles ignored.
`search(query)` resolves the match count across all pages (empty/whitespace query behaves like
`clearSearch()`), accepting at most 4,096 query code units and scanning at most 1,000 pages,
1,000,000 corpus code units, and 4,000,000 search code units while retaining 10,000 matches;
`searchNext()` and `searchPrevious()` advance/step back through matches (wrapping,
resolving `false` when there are none); `clearSearch()` clears the query, matches, and painted marks.

**CSS parts:** `base` (the named region with explicit `aria-busy="true"|"false"`), `toolbar`,
`previous-button`, `next-button`, `zoom-out-button`,
`zoom-in-button` (the four toolbar controls — previously reachable only through `::part(toolbar)
button`, which is invalid: a descendant combinator after `::part()` never matches, so each button now
carries its own part name), `page-indicator`, `zoom-indicator`, `pages`, `page`, `page-canvas`
(the canvas one page's content is painted onto), `text-layer`, `text-span` (one generated text run
inside a page's text layer — PDF.js creates these imperatively, and they carry the part so a rule can
reach them without a descendant combinator), `search-match` (a `<mark>` painted into a mounted page's
text layer around one search match), `search-match-active` (the currently active match, also carries
`search-match`), `page-error`, `page-error-visible`, `spinner`, and `error`. Search painting is best-effort: a page outside the
virtualized render window is skipped and repainted once its text layer mounts, and a match spanning a
text-layer span boundary that `Range.surroundContents()` can't wrap stays unpainted (still reachable
via `searchNext()`). The loading skeleton is decorative and paired with an ordinary visually-hidden
localized label; later loading and error transitions use the shared document-level polite and
assertive sinks, respectively, without adding live semantics inside the viewer shadow.

`page`, `page-canvas`, `text-layer`, `text-span`, `search-match` and `search-match-active` are
rendered inside the virtualizing `lr-virtual-list`'s own shadow root and forwarded out through
`exportparts`, so `lr-pdf-viewer::part(page)` (and each of the others) works from a consumer
stylesheet exactly like the parts in this viewer's own shadow root. The selection tint over a page's
text is styled on `text-span` rather than on `text-layer`, because a highlight pseudo-element is
matched against the element the selected text originates in:
`lr-pdf-viewer::part(text-span)::selection { background: … }`.

**Themeable custom properties:** `--lr-pdf-viewer-height` (default `var(--lr-size-24rem)`) — block
size of the virtualized page list (`[part="pages"]`); also settable via the `maxHeight` property,
which writes this token inline on `[part="base"]`. `--lr-pdf-viewer-toolbar-button-hover-bg`
(default `var(--lr-color-surface)`) — hover fill of the toolbar buttons; it defaults to the surface
fill rather than the toolbar's own `--lr-color-brand-quiet` tint precisely so the hover state is
visible against the toolbar behind it. `--lr-pdf-viewer-search-match-bg` (default
`var(--lr-color-warning-quiet)`) and `--lr-pdf-viewer-search-match-active-bg` (default
`var(--lr-color-warning)`) retint the painted `search-match`/`search-match-active` marks without
overriding the shared warning tokens directly. Everything else below the page list is retuned
through the exported parts above rather than through dedicated custom properties.

**Optional peer dependency:** install `pdfjs-dist` with `pnpm add pdfjs-dist`. The component registers
a lazy `application/pdf` renderer with `<lr-document-viewer>` so the PDF library is loaded only when
a PDF is opened. An absent `pdfjs-dist` fails closed and renders
`[part="error"]` with the localized `pdfViewerMissingLibrary` message — there is no partial PDF
rendering without it.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the PDF.

Anchor navigation is generation-guarded: a newer anchor, document replacement, or disconnect
prevents stale page/text/region work from scrolling or reporting success.

## `lr-spreadsheet-viewer`

Fetches and renders `.xlsx` and `.xls` workbooks with the optional `xlsx` (SheetJS) peer. Multiple
worksheets render through a `<lr-tab-group>` switcher, and body rows use `<lr-virtual-list>`.

Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses one sheet's raw grid, 1-based, with
its header row included, resolving the target sheet from the anchor's own `sheet` field (falling
back to a `Sheet!`-prefixed `range`, then the active sheet); `scrollToAnchor()` switches
`<lr-tab-group>`'s active tab first when needed, then scrolls the addressed row/column into view.
`highlights` paint as a focusable `part="cell-highlight"`. A jump whose workbook is replaced by a
concurrent `src` reassignment mid-flight reports `found: false` rather than a phantom success —
matching `lr-csv-viewer`/`lr-dataset-viewer` (it wrongly reported `found: true` before 9.0.0).

**Properties:** `src: string = ''` and `name: string = ''`. `maxHeight: string = ''` (attribute
`max-height`) is a CSS length that caps the scrollable body — setting it writes
`--lr-spreadsheet-viewer-max-height` inline on `[part="base"]`; invalid CSS `max-height` values are
ignored. `anchorKinds: readonly LyraAnchorKind[] = ['cell-range']` (this viewer's supported
`LyraAnchor.kind` values for the shared anchor-target contract).

**Methods:** `search(query)` resolves the match count across every sheet's stringified cell values,
ordered sheet then row then column, switching tabs as navigation crosses sheets (empty/whitespace
query behaves like `clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through
matches (wrapping, resolving `false` when there are none); `clearSearch()` clears the query,
matches, and painted marks.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails.
`lr-highlight-activate` (`detail: { highlightId }`) — a `highlights` cell was clicked or activated via
Enter/Space. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call. `lr-search-change` (`detail: { query, matchCount, matchCountExact, activeIndex }`) — from
search/navigation/clear, canonical source reset, and effective-locale re-evaluation. `lr-text-select` is not part of this
grid viewer's event contract; its registry capabilities advertise `textSelect: false`.

**CSS parts:** `base`, `body` (the scrollable wrapper around the fetched-state content, capped by
`max-height`), `tabs`, `sheet`, `header-row`, `data-row`, `cell`, `cell-highlight` (a
structural cell covered by a `highlights` entry), `cell-highlight-action` (the native button
filling a highlighted cell; focusable and emits `lr-highlight-activate`; its complete accessible
name uses the localized `cellHighlightWithLabel` message with independent `{value}` and `{label}`
placeholders), `rows`, `spinner`, and
`error`. `data-row`, `cell`, `cell-highlight`, and `cell-highlight-action` are rendered inside the
internal `<lr-virtual-list>` and forwarded via
`exportparts`, so `lr-spreadsheet-viewer::part(cell)` reaches them from a consumer stylesheet.
The spinner always includes visible localized loading text alongside its decorative ring; the text
remains understandable without CSS or animation and the ring stops under reduced motion.

**Themeable custom properties:** `--lr-spreadsheet-viewer-highlight-color` (default
`var(--lr-color-brand)`) — the outline color of a `cell-highlight` cell. The cell matching
`activeHighlightId` receives a private warning-color default because a `[data-active]` selector
can't be chained onto the `::part(cell-highlight)` the cell reaches this component's stylesheet
through. An inherited or direct public value remains authoritative across that boundary.
`--lr-spreadsheet-viewer-highlight-outline-offset` (default
`calc(-1 * var(--lr-border-width-medium))`) — the outline offset of a highlighted cell.
`--lr-spreadsheet-viewer-max-height` (default `none`) — maximum block size of `[part="body"]`
before it scrolls internally; also settable via the `maxHeight` property, which writes this token
inline on `[part="base"]`.

**Optional peer dependency:** install `xlsx` with `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. The official CDN matches the
`.xlsx` and `.xls` MIME types and filename extensions.

Remote resources are capped at 25 MB, and each parsed sheet at 10,000 rows and 1,000 columns;
exceeding any of these surfaces the localized `documentPreviewResourceTooLarge` message instead of
the workbook.

## `lr-csv-viewer`

Fetches CSV text, parses quoted fields with the optional `papaparse` peer, and virtualizes body rows.

Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses the raw file grid, 1-based, with the
header row included whenever `has-header-row` is set; `scrollToAnchor()` scrolls the addressed
row/column into view via the virtualized list's `active-item-id`. `highlights` paint as a focusable
`part="cell-highlight"`. A jump whose document is replaced by a concurrent `src` reassignment
mid-flight reports `found: false` rather than a phantom success.

**Properties:** `src: string = ''` and `name: string = ''`. `hasHeaderRow: boolean = true` (attribute
`has-header-row`) controls whether the first parsed row is rendered as a sticky header.
Host `aria-label` names both the viewer region and loaded table by attribute presence, including an
explicitly empty value; `name` and the localized label are fallbacks.
`maxHeight: string = ''` (attribute `max-height`) is a CSS length that caps the scrollable body —
setting it writes `--lr-csv-viewer-max-height` inline on `[part="base"]`; invalid CSS `max-height`
values, declaration breaks, and `url()` are ignored. `anchorKinds: readonly LyraAnchorKind[] =
['cell-range']` (this viewer's supported `LyraAnchor.kind` values for the shared anchor-target
contract).

**Methods:** `search(query)` resolves the match count via a case-insensitive substring match over
the same stringified cell values `cell()` renders, ordered row then column (empty/whitespace query
behaves like `clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through matches
(wrapping, resolving `false` when there are none); `clearSearch()` clears the query, matches, and
painted marks.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing reports an error. Up to
100 recoverable PapaParse diagnostics may accompany the rendered grid; exceeding that budget is a
resource-limit error instead.
`lr-highlight-activate` (`detail: { highlightId }`) — a `highlights` cell was clicked or activated via
Enter/Space. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call. `lr-search-change` (`detail: { query, matchCount, matchCountExact, activeIndex }`) — from
search/navigation/clear, canonical source reset, and effective-locale re-evaluation. `lr-text-select` is not part of this
grid viewer's event contract; its registry capabilities advertise `textSelect: false`.

**CSS parts:** `base`, `body` (the capped scroll surface), `sheet`, `header-row`, `data-row`, `cell`, `cell-highlight` (a structural
cell covered by a `highlights` entry), `cell-highlight-action` (the native button filling a
highlighted cell; emits `lr-highlight-activate`; its complete accessible name uses the localized
`cellHighlightWithLabel` message with independent `{value}` and `{label}` placeholders), `rows`,
`spinner`, and `error`. `data-row`,
`cell`, `cell-highlight`, and `cell-highlight-action` are rendered inside the internal
`<lr-virtual-list>` and forwarded via `exportparts`, so
`lr-csv-viewer::part(cell)` reaches them from a consumer stylesheet.

**Themeable custom properties:** `--lr-csv-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]` before it scrolls internally; also settable via the `maxHeight` property, which
writes this token inline on `[part="base"]`. `--lr-csv-viewer-highlight-color` (default
`var(--lr-color-brand)`) — the outline color of a `cell-highlight` cell. The cell matching
`activeHighlightId` receives a private warning-color default because a `[data-active]` selector
can't be chained onto the `::part(cell-highlight)` the cell reaches this component's stylesheet
through. An inherited or direct public value remains authoritative across that boundary.

**Optional peer dependency:** install `papaparse` with `pnpm add papaparse`. The registry matches
`text/csv` and `.csv` filenames.

Remote resources are capped at 25 MB. A quote-aware scan stops before PapaParse at 10,000 raw rows
(the first row consumes the same budget whether or not `has-header-row` displays it as a header),
1,000 columns in any row, 1,000,000 aggregate cells, or more than 100 parser diagnostics; streaming
row callbacks enforce the same ceilings again. Exceeding any ceiling surfaces the localized
`documentPreviewResourceTooLarge` message instead of a partial grid.

---

## `lr-include`

Loads an HTML fragment from `src` and transcludes it as sanitized **light-DOM** content, so the
fragment participates in the surrounding page's CSS cascade like a native server-side include —
unlike `<lr-html-viewer>`, which renders a foreign document inside an isolated preview card. The
markup always passes through the shared DOMPurify-backed sanitizer before it reaches `innerHTML`;
there is deliberately no `allow-scripts`-style escape hatch (the Web Awesome/Shoelace equivalents'
raw injection option is omitted, not shipped as a no-op).

A bare primitive: no label/hint/error chrome, no implicit role, no computed accessible name, and no
`aria-live` wrapper (the fragment can carry its own landmarks; wrapping the host would re-announce
all of it on every load). The host always carries explicit `aria-busy="true"|"false"`: true while
the source is loading and being sanitized. Build error UI from `lr-include-error`.

**Properties:**

- `src: string = ''` (reflected) — source of the fragment. `#id` clones the matching same-page
  template content or element children without fetching or moving the source nodes.
  `/partial.html#id` fetches `/partial.html` without its hash, sanitizes the complete response, then
  clones the target's children; a URL without a hash transcludes the complete sanitized document.
  Remote URLs pass the shared `safeFetchUrl()` allowlist (`http:`, `https:`, `blob:`, `data:`).
  Empty/falsy is a no-op: no fetch, no events, existing content untouched.
- `mode: 'cors' | 'no-cors' | 'same-origin' = 'same-origin'` (reflected) — forwarded to
  `fetch(url, { mode })`. Defaults to `same-origin` (not the upstream components' `cors`) so
  cross-origin fetching is opt-in; an invalid value is normalized back to `same-origin` rather than
  letting `fetch()` throw. `no-cors` is accepted for enum completeness but always yields an opaque
  response (`status` `0`, unreadable body) — a Fetch API limitation, not a bug here.
- `cache: boolean = true` (attribute is not reflected) — shares matching in-flight work and retains
  successful sanitized remote documents in a bounded cache. `cache="false"` (including that exact
  HTML attribute syntax) opts this instance out of both deduplication and retention. Fragment ids
  are deliberately not part of the key: `/partial.html#one` and `/partial.html#two` share only the
  fragmentless fetch/sanitize work, then select and clone independently. Request mode, byte cap,
  and sanitizer profile are part of the key.

**Methods:** `reload(): Promise<void>` invalidates the retained remote document for this URL and
mode, then loads it again. A same-page source is simply re-cloned from its current DOM.

The shared text-viewer contract is also available for the sanitized light-DOM fragment:
`highlights`, `activeHighlightId`, `anchor`, and `anchorKinds` (`['text-quote', 'fragment']`).
`search(query)`, `searchNext()`, `searchPrevious()`, `clearSearch()`, and `scrollToAnchor()`
operate on the included text. A successful replacement explicitly recomputes any active search
against the new fragment rather than leaving results from the previous content.

**Events:**

- `lr-load` — `detail: { src }` — the fragment was sanitized and written into the light DOM.
- `lr-include-error` — `detail: { status, reason, error? }`. `reason` is a `LyraIncludeErrorReason`:
  `'blocked-url'` (`src` failed the allowlist; `fetch()` never ran), `'network'` (`fetch()` rejected),
  `'http'` (response not `ok`; `status` carries the code), `'missing-sanitizer'` (the optional
  `dompurify` peer failed to load), `'resource-too-large'` (the body exceeded the 2 MiB Include
  cap), or `'missing-fragment'` (the requested id was absent after sanitization). Non-HTTP reasons
  use status `0`; `'http'` normally carries the response code, but an opaque `mode="no-cors"`
  response is also classified as `'http'` with status `0`.
- `lr-error` — the same failure under a second name, carrying the **identical detail object** and
  always fired alongside `lr-include-error`, never instead of it. The two upstreams disagree on the
  spelling — Web Awesome's is `wa-include-error`, Shoelace's is `sl-error` — so both are supported
  and **neither is deprecated**; listen to whichever one your migration produced. `lr-error` is
  also the name every other Lyra component uses for a load failure, so a generic page-level
  listener catches this one too. Listening to both names on the same element runs your handler
  twice for one failure.
- `lr-search-change` — `detail: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }` — fired
  whenever included-content search state changes.
- `lr-anchor-result` — `detail: { found: boolean }` — fired after an `anchor` assignment or
  `scrollToAnchor()` call is applied.
- `lr-text-select` — `detail: TextSelectDetail` (`{ text: string; anchor: LyraAnchor | null; rects:
DOMRect[] }`) — fired after a selection ends inside the included content.

`lr-highlight-activate` is not part of this component's event contract: included-text highlights
are passive and cannot be activated.

The three shared text-viewer events bubble and compose and are non-cancelable.

**Slots:** default — fallback content shown until (or unless) a fetch succeeds. It is overwritten by
the sanitized fragment on success, and left untouched on failure (as is any previously successful
include).

**CSS parts:** `base` — the `display: contents` wrapper around the default slot.

An absent `dompurify` fails closed: it fires `lr-include-error` with
`reason: 'missing-sanitizer'` and leaves the existing content in place — unsanitized markup is
never transcluded.

Every inserted subtree is a clone. Its ids are rebased per Include instance, including references
from labels, ARIA idrefs, fragment links, and `url(#id)` attributes, so repeating one source does
not add duplicate document ids. Concurrent consumers lease shared work: disconnecting one aborts
the request only when no other subscriber still needs it. Rejected work is evicted and can be
retried; a stale response never paints over a newer `src`.

```html
<lr-include id="navigation" src="/partials/navigation.html#primary">
  Loading navigation…
</lr-include>
<script type="module">
  import "@aceshooting/lyra-ui/components/viewers/include/include.js";

  const include = document.querySelector("#navigation");
  include.addEventListener("lr-include-error", (event) => {
    console.error(event.detail.reason, event.detail.status);
  });
  await include.reload();
</script>
```

## `lr-highlight-layer`

A presentational overlay that paints highlight rectangles (percent-of-box coordinates) over
positioned content and owns their activation, active/flash styling, and keyboard access. `items`
order is the caller's own reading order; the layer does not re-sort geometrically. Fills its nearest
positioned ancestor.

**Properties:** `items: HighlightLayerItem[] = []` (attribute: false), with IDs trimmed and required
to be nonempty and the first item retained when IDs repeat; `activeHighlightId: string | null = null`
(attribute `active-highlight-id`), and `interactive: boolean = true` (reflected) — gates click/keyboard
activation. A rectangle is eligible only when `x`/`y`/`width`/`height` are finite numbers and both
dimensions are nonnegative; invalid rectangles are omitted from paint, focus, and activation. When
`interactive=false`, the base is `aria-hidden` pure paint with no group role, accessible name, or
controls. If every rectangle is invalid, no shadow subtree is rendered.

**Methods:** `flash(id)` briefly re-triggers the flash styling for an already-rendered rect (e.g. a
re-click of the same source citation).

**Events:** `lr-highlight-activate` — a rect was activated (click, or Enter/Space while focused).
`detail: { highlightId }`.

**CSS parts:** `base` (the absolutely-positioned overlay, inset 0), `rect` (one visual highlight
rectangle; carries `data-tone`/`data-active`/`data-flash` state attributes), and `rect-target`
(transparent activation geometry with a minimum pointer/focus area independent of the visual
rectangle). When more than one logical highlight would create overlapping minimum hit areas, the
individual targets are replaced by `highlight-actions` (a non-overlapping action list) containing
one `highlight-action` button per rendered highlight.

**Themeable custom properties:**
`--lr-highlight-layer-accent-background`, `--lr-highlight-layer-accent-outline`,
`--lr-highlight-layer-success-background`, `--lr-highlight-layer-success-outline`,
`--lr-highlight-layer-warning-background`, `--lr-highlight-layer-warning-outline`,
`--lr-highlight-layer-danger-background`, `--lr-highlight-layer-danger-outline`,
`--lr-highlight-layer-neutral-background`, and `--lr-highlight-layer-neutral-outline` control each
tone independently, defaulting to the corresponding Lyra quiet background and foreground tokens.
`--lr-highlight-layer-flash-background` controls the temporary flash state (default
`--lr-color-brand`).

## `lr-page-rail`

A virtualized vertical thumbnail rail for page-addressed documents, with per-page highlight heat
markers. Two modes: **wired** (`viewer`/`for` supply a live page source, e.g. `<lr-pdf-viewer>` or
`<lr-pptx-viewer>` —
thumbnails render lazily as rows materialize, and the rail tracks page/count from the viewer's own
events) and **mediated** (`page-count`/`page` are host-bound directly, rows render a placeholder
glyph — still a fully functional pager). In wired mode the viewer's `page` is the single source of
truth.

**Properties:** `viewer: PageThumbnailSource | null = null` (attribute: false) — the wired viewer.
`for: string = ''` — an id selector alternative to setting `viewer` directly. `pageCount: number = 0`
(attribute `page-count`) and `page: number = 1` (reflected) — mediated-mode page state.
`highlights: readonly LyraHighlight[] = []` (attribute: false) — drives the per-page heat markers;
IDs are trimmed and required to be nonempty, with the first record retained when IDs repeat.
`thumbWidth: number = 96` (attribute `thumb-width`) and `label: string = ''`. A wired
`PageThumbnailSource` provides its one-based `page`, optionally exposes the atomic
`pageViewerSnapshot`/`lr-page-viewer-state-change` protocol, and supplies at least one lazy preview
method: the original `renderPageThumbnail(page, canvas, options?)` for bitmap/canvas sources, or
`renderPageThumbnailToContainer(page, container, options?)` for renderer-owned DOM/SVG previews.
The latter resolves to a `PageThumbnailRenderHandle`; the rail disposes it whenever its row,
viewer, allocation width, status, or document identity changes.

**Events:** `lr-page-select` — a page row was activated (click, or Enter/Space on a focused row).
`detail: { page }`. In wired mode the rail also sets `viewer.page` itself.

If `pageCount` shrinks past the currently focused row, focus moves to the absolute last remaining
page instead of using the rendered window's local index or being lost with the virtualized row.
Rapid consecutive shrinks supersede an in-flight repair, so focus lands on the latest count. The
numeric type-ahead buffer is cleared on detach.

**CSS parts:** `base` (the rail), `pages` (the embedded `<lr-virtual-list>`), `page` (one page
button), `page-current` (the button for the current `page`), `thumbnail` (the thumbnail canvas/DOM
preview wrapper), `thumbnail-target` (the canvas or renderer-owned DOM preview target), `page-number`
(the visible page number), `heat` (the heat-marker cluster), `heat-dot` (one
heat marker), `heat-dot-accent`, `heat-dot-success`, `heat-dot-warning`, `heat-dot-danger` and
`heat-dot-neutral` (the tone-specific name on each marker), and `heat-dot-overflow` (the `+n`
marker).

Page rows are rendered into the embedded `<lr-virtual-list>`'s own shadow root and forwarded with
`exportparts`, so `lr-page-rail::part(page)` and the rest reach them from a consuming stylesheet.
State variants each carry a second name in the element's part list rather than a state attribute,
because `::part()` cannot be followed by an attribute selector: the current row is
`part="page page-current"` and a danger marker is `part="heat-dot heat-dot-danger"`, and `::part()`
matches with `part~=` semantics, so both names select the same element.

Loading thumbnail skeletons are aria-hidden and non-announcing. Each page button already carries
the localized page name, so thumbnail work does not create one live region per virtualized row.

**Themeable custom properties:** `--lr-page-rail-height` (default `var(--lr-size-24rem)`) — block
size of the virtualized rail. `--lr-page-rail-current-bg` (default `var(--lr-color-brand-quiet)`) —
background of the `page-current` button, kept while the row is hovered so the current page stays
identifiable under the pointer. Each heat-dot tone has its own matching cssprop, all defaulting to
the same shared tone token the marker used before: `--lr-page-rail-heat-accent-color` (default
`var(--lr-color-brand)`, the base `heat-dot` rule shared by the default "accent" tone),
`--lr-page-rail-heat-success-color` (default `var(--lr-color-success)`),
`--lr-page-rail-heat-warning-color` (default `var(--lr-color-warning)`),
`--lr-page-rail-heat-danger-color` (default `var(--lr-color-danger)`), and
`--lr-page-rail-heat-neutral-color` (default `var(--lr-color-text-quiet)`).

## `lr-notebook-viewer`

Read-only Jupyter notebook (nbformat 4.x) renderer, composing existing components per cell.
Execution is a hard non-goal. Markdown cells render through `lr-markdown`, code cells through
`lr-code-block` (using the notebook's kernel language for syntax highlighting), and raw cells as
plain preformatted text. A code cell's `execute_result`/`display_data` outputs prefer, in order,
`image/png`, `image/jpeg`, `image/svg+xml` (sanitized), `text/html` (sanitized), `application/json`
(via `lr-json-viewer`), then `text/plain`. Stream/error outputs render as preformatted text (tinted
`danger` for stderr/tracebacks) with embedded ANSI SGR color/style escapes interpreted through the
same shared `internal/ansi.ts` parser `lr-terminal` uses — a traceback keeps its coloring instead of
showing raw `ESC[` sequences. Sanitizing raw HTML/SVG output markup lazy-loads the
optional peer `dompurify`; without it, the output renders a localized notice instead of raw markup.
Cells are virtualized through `lr-virtual-list`. `node-path` anchors resolve `path[0]` as a cell
index; `fragment` anchors resolve a cell's own `id`. No execution, no kernels, no editing, no
ipywidgets.

**Properties:** `src: string = ''` — URL to fetch and parse as a notebook; ignored while `notebook`
is present. `notebook?: Readonly<NotebookDoc> | string` (property only) — an already-parsed
notebook document, or its raw JSON text; presence wins over `src` (including an empty string) and
is parsed synchronously. Parsed document assignments are synchronously clone-owned and recursively
frozen; mutate a copy and reassign it to update the viewer, because later source-object mutation is
not observed.
Assigning `undefined` clears inline authority and immediately reloads the already configured `src`,
or exposes the idle state when no URL exists. `source: LyraNotebookViewerSource` is a readonly
discriminated snapshot (`{ kind: 'inline', value }`, `{ kind: 'url', url }`, or `null`).
`name: string = ''` —
accessible label, and matched against a `fragment` anchor's cell id. `outputCollapseLines: number =
40` (attribute `output-collapse-lines`) — a plain-text output longer than this many lines renders
collapsed behind a toggle; `0` disables collapsing. `maxHeight: string = ''` (attribute
`max-height`) — once set, the notebook scrolls internally past this height; invalid CSS
`max-height` values, declaration breaks, and `url()` are ignored. `anchorKinds: readonly
LyraAnchorKind[] = ['node-path', 'fragment']` (this viewer's supported `LyraAnchor.kind` values for
the shared anchor-target contract). The inherited carrier fields `highlights: readonly LyraHighlight[] = []`
(property only) and `activeHighlightId: string | null = null` (attribute `active-highlight-id`) are
available for structural anchor-target compatibility, but this viewer does not paint them; use
`anchor: LyraAnchor | string | null = null` or `scrollToAnchor()` for notebook-cell navigation.

**Methods:** `search(query)` resolves the match count over cell sources and text outputs — a
matching cell counts as one match (empty/whitespace query behaves like `clearSearch()`);
queries are capped at 4,096 code units and one pass at 4,000,000 source/output code units, with
`matchCountExact: false` reporting a truncated lower bound;
`searchNext()`/`searchPrevious()` advance/step back through matches, scrolling to and marking the
target cell with the persistent active-cell paint, and each resolves `true` once the active match
moved or `false` when there are none — the same `Promise<boolean>` every other searchable viewer
resolves, so one find-in-page host can drive them all; `clearSearch()` clears the query and
matches.

**Events:** `lr-load` — `detail: { cellCount, language }`, fired once a notebook has been parsed
and validated (`language` from `metadata.language_info.name`/`kernelspec.language`, else `''`).
`lr-search-change` — `detail: { query, matchCount, matchCountExact, activeIndex }`, including
canonical source reset and effective-locale re-evaluation. `lr-render-error` —
`detail: { error }`, fetching, parsing, or validating the notebook failed. `lr-anchor-result` —
non-cancelable; `detail: { found: boolean }`, fired after an `anchor` assignment or a
`scrollToAnchor()` call is applied.

Neither `lr-highlight-activate` nor `lr-text-select` is part of `lr-notebook-viewer`'s event
contract: notebook host highlights are not painted and no selection binding is installed. Use
`anchor` plus `lr-anchor-result` for notebook cell navigation outcomes.

**CSS parts:** `base` (the root scroll container), `cell` (`data-cell-type="code|markdown|raw"`,
`data-active`), `cell-active` (added alongside `cell` on the cell currently targeted by an anchor
or the active search match),
`cell-gutter` (the `In [n]`/`Out [n]` label column), `cell-source`, `raw-source` (the horizontally
scrollable preformatted surface for a raw cell), `outputs`, `output`
(`data-output-type`, `data-stream`), `output-error` (added alongside `output` on a stderr stream or
an error output), `error-output-label` (the label introducing an error output's traceback),
`output-toggle`, `error`, `spinner`.
The document-level spinner always includes visible localized loading text alongside its decorative
ring; the text remains understandable without CSS or animation and the ring stops under reduced
motion.

Every cell-level part above is rendered into the embedded `<lr-virtual-list>`'s own shadow root and
forwarded back out through `exportparts`, so `lr-notebook-viewer::part(cell)` and friends work from
a consumer stylesheet. The three state variants are separate part _names_ rather than attribute
selectors, because Shadow Parts forbids an attribute selector after `::part()` —
`::part(cell)[data-active]` is invalid CSS, so use `::part(cell-active)`. The `data-*` attributes
remain on the elements for scripting.

**Themeable custom properties:** `--lr-notebook-viewer-max-height` (default `none`).

`--lr-notebook-viewer-active-bg` (default `var(--lr-color-brand-quiet)`) is the background of the
cell currently targeted by an anchor or the active search match — the `cell-active` part. It is an
inline `var()` fallback at the point of use rather than a `:host` declaration, so it can be set on
the element or on any ancestor.

**Optional peer deps:** `marked`+`dompurify` (markdown cells, falls back to plain text per cell),
`shiki` (code cells, falls back to unhighlighted), `dompurify` (HTML/SVG outputs, falls back to
`text/plain`).

```html
<lr-notebook-viewer .notebook=${result} max-height="30rem"
  @lr-load=${(e) => console.log(e.detail.cellCount, 'cells')}
></lr-notebook-viewer>
```

A notebook major version outside 4.0–4.5, an invalid shape, or more than 2,000 cells renders a
localized error and fires `lr-render-error` instead of the notebook.

PNG/JPEG outputs use their `text/plain` representation as alt text, falling back to a localized
code-cell name. Sanitized SVG output is wrapped in a named `role="img"` with the same fallback.

## `lr-xml-viewer`

Collapsible, copyable, `DOMParser`-based tree view for XML documents, mirroring `lr-json-viewer`'s
UX (`collapsed-depth`, `copyable`, structural-path-keyed expand state that survives a same-shape
`xml` reassignment) adapted for XML's own node kinds: elements with attributes, text, comments, CDATA
sections, and processing instructions, preserved in their original mixed-child source order.
Namespace-literal: qualified names render exactly as authored, with no namespace-URI-aware
matching. Every document type declaration is rejected before `DOMParser`, preventing external
entity access and browser-specific internal-entity expansion. Not `lr-json-viewer` (JS values); not `lr-html-viewer`
(sanitized _rendered_ HTML). No XPath/XSLT evaluation, no editing, no schema validation.

**Properties:** `src: string = ''` — URL to fetch and parse; ignored once `xml` is set. `xml?:
string` (property only) — raw XML text to parse and render; wins over `src`, and setting it parses
synchronously. Assigning `undefined` relinquishes inline authority and immediately resumes an
already configured `src`, or exposes idle when none exists. `source: LyraXmlViewerSource` is the
readonly discriminated effective authority (`{ kind: 'inline', value }`, `{ kind: 'url', url }`, or
`null`). `name: string = ''` — accessible label. `collapsedDepth?: number` (attribute
`collapsed-depth`) — elements at or beyond this nesting depth (root = 0) start collapsed. `copyable:
boolean = false` (reflected) — shows copy-to-clipboard affordances, one for the whole document plus
one per element. `maxHeight: string = ''` (attribute `max-height`). `anchorKinds: readonly
LyraAnchorKind[] = ['node-path']` (this viewer's supported `LyraAnchor.kind` values for the shared anchor-target
contract) — each numeric path segment is the 0-based index within the parent's _element_ children,
and an optional trailing string segment `'@attrName'` addresses one existing, nonempty-named
attribute. Invalid CSS `max-height` values, declaration breaks, and `url()` are ignored.

**Methods:** `search(query)` resolves the match count via a case-insensitive substring search over
every element's tag name, attribute names/values, and own text (empty/whitespace query behaves like
`clearSearch()`), accepting at most 4,096 query code units and scanning at most 4,000,000 code
units while retaining 10,000 matches; `searchNext()`/`searchPrevious()` advance/step back through matches (wrapping);
`clearSearch()` clears the query and matches. All three resolve only after the newly active match's
row has been scrolled into view (`block: 'center'`, `behavior: 'auto'` under
`prefers-reduced-motion`) — before 9.0.0 they moved `data-active-match` without ever scrolling, so
on a document taller than the viewport the reader never saw the match they had stepped to. Replacing
the XML source clears document-relative matches and emits the canonical empty `lr-search-change`;
changing the effective locale re-evaluates and emits the retained query.

**Highlights:** host-supplied `highlights` are first-class here, not carried and ignored. Every entry
whose anchor is a `node-path` this document resolves tints its element row — `[part='node']` gains
`data-highlight` carrying the entry's `tone` (`accent` when omitted) — and adds a focusable
`[part='highlight-action']` button that emits `lr-highlight-activate`. The button's accessible name
is the entry's own `label` when supplied, otherwise a localized "Highlight n of m". `activeHighlightId`
adds `data-active-highlight` to the matching row. Entries are deduplicated by `id`; an entry whose
anchor kind or path this document cannot resolve is dropped whole rather than painted at some
coarser granularity, and an entry inside a collapsed subtree paints once that subtree is expanded.
Painting retains at most 100 resolved entries from a 1,000-entry candidate window; an active entry
anywhere in the bounded 10,000-record host snapshot is placed first inside both ceilings.

**Events:** `lr-copy` — emitted only after the owning realm's clipboard write fulfills, with
`detail: { ok: true, text }`. Clipboard absence, synchronous throws, and rejected writes instead
show the localized `copyFailed` label and emit generic `lr-error` plus `lr-copy-error` with
`detail: { ok: false, text, reason, error }`; `reason` is `'unsupported'`, `'denied'`, or `'failed'`.
`lr-search-change` — `detail: { query, matchCount, matchCountExact, activeIndex }`.
`lr-render-error` — `detail: { error }`, fetching or parsing failed, including a
parse error or exceeding the node cap. `lr-anchor-result` — non-cancelable; `detail: { found:
boolean }`, fired after an `anchor` assignment or a `scrollToAnchor()` call is applied.
`lr-highlight-activate` — non-cancelable; `detail: { highlightId }`, fired when a highlight's
`[part='highlight-action']` button is activated by click or Enter/Space. `lr-text-select` is not
part of this structural tree viewer's event contract because it installs no selection binding.

**CSS parts:** `base`, `toolbar` (the whole-document copy button row, only when `copyable`),
`copy-button` (the whole-document one, or a per-node one), `tree`, `node` (`data-active` while it's
the resolved anchor target, `data-match`, `data-active-match`, `data-highlight` carrying a resolved
highlight's tone, `data-active-highlight`), `tag` (`data-match`), `attribute` (`data-active` while a
`node-path` anchor's trailing `'@attrName'` segment addresses that specific attribute — so a citation
pointing at one attribute value of a multi-attribute element stays identifiable in the rendered
tree, rather than resolving indistinguishably from the bare element path),
`attribute-name`, `attribute-value` (`data-match`), `text` (`data-match`), `comment`, `cdata`, `pi`,
`toggle` (an element's expand/collapse button on nodes with renderable children; its collapsed
chevron mirrors under effective RTL direction), `highlight-action` (the focusable button a resolved
`highlights` entry adds to its element row), `toggle-placeholder` (the empty toggle-column spacer on
leaf rows), `error`, `spinner`.
The spinner always includes visible localized loading text alongside its decorative ring; the text
remains understandable without CSS or animation and the ring stops under reduced motion.

**Themeable custom properties:** `--lr-xml-viewer-max-height` (default `none`) — maximum block size
of the scrollable body; also settable via the `max-height` property.
`--lr-xml-viewer-active-match-color` (default `var(--lr-color-warning)`) — the solid outline on the
`[part='node']` holding the _current_ search match, leaving every other match on its dashed
`--lr-xml-viewer-match-color` outline. It is an inline `var()` fallback at the point of use rather
than a `:host` declaration, so it can be set on the element _or on any ancestor_:
`::part(node)[data-active-match]` is invalid CSS — Shadow Parts forbids an attribute selector after
`::part()` — so distinguishing the active match previously meant re-pointing the shared
`--lr-color-warning` token, which recolored every other match (and every other warning surface)
along with it. Unset, it falls back to that token, so rendering is unchanged.

`--lr-xml-viewer-match-color` (default `var(--lr-color-warning)`) — outline color of a non-active
`[part='node']` search match, and (via `color-mix`) the tint source for a matching `[part='text']`'s
background — kept distinct from `--lr-xml-viewer-active-match-color` so the non-active matches can
be recolored without touching the active one. `--lr-xml-viewer-match-bg` (default
`var(--lr-color-warning-quiet)`) — background of a matching `[part='tag']`/`[part='attribute-value']`.
Both are inline `var()` fallbacks at the point of use, so either can be set on the element or any
ancestor; unset, they fall back to the same shared tokens the rules used before.

`--lr-xml-viewer-highlight-accent-background` (default `var(--lr-color-brand-quiet)`),
`--lr-xml-viewer-highlight-success-background` (default `var(--lr-color-success-quiet)`),
`--lr-xml-viewer-highlight-warning-background` (default `var(--lr-color-warning-quiet)`),
`--lr-xml-viewer-highlight-danger-background` (default `var(--lr-color-danger-quiet)`) and
`--lr-xml-viewer-highlight-neutral-background` (default `var(--lr-color-surface-raised)`) are the row
backgrounds of a resolved `highlights` entry per tone. The neutral default is deliberately
`--lr-color-surface-raised` and not `--lr-color-surface`: the viewer paints its own surface with the
latter, so a neutral highlight tinted with it would render as unhighlighted.
`--lr-xml-viewer-highlight-active-outline` (default `var(--lr-color-brand)`) outlines the entry named
by `activeHighlightId`, and `--lr-xml-viewer-active-attribute-color` (default `var(--lr-color-brand)`)
outlines the `[part='attribute']` an attribute-addressing `node-path` anchor resolved to.

`[part='toggle']`'s glyph box stays compact (`1.25rem`) while its _interactive_ box takes the shared
minimum target size as a floor via `--lr-icon-button-size`. That token is a floor, not a fixed size,
so lowering it never squashes the chevron below its own box — the visible glyph keeps its size while
the hit target follows the token, and it can never fall under the accessible minimum from this
component's own rules. A collapsed chevron mirrors when effective direction is RTL (including an
inherited `dir` change); an expanded chevron points down in either direction.

```ts
const viewer = document.querySelector("lr-xml-viewer");
viewer.xml = payload;
viewer.collapsedDepth = 2;
viewer.copyable = true;
await viewer.search(query);
```

Node cap: 50,000 — exceeding it renders the localized `xmlViewerTooManyNodes` error instead of the
tree. A collapsed element's child count includes element, text, comment, CDATA, and processing-
instruction children rather than only element descendants.

## `lr-document-compare`

Comparison surface for two document versions, using `lr-diff-view` for textual diffs and
`lr-document-preview` for side-by-side rendered content.

A nonempty host `aria-label` makes the host the sole named semantic owner. With an explicitly empty
host label, the shadow comparison group keeps `role="group"` and an empty name; when the attribute
is absent, it uses the localized comparison label. Dynamic host-label changes update that ownership.

**Properties:**

- `oldVersion?: DocumentCompareVersion`, `newVersion?: DocumentCompareVersion` (attribute: false) —
  the before/after inputs. `DocumentCompareVersion` extends `DocumentRef`
  (`id`, `name`, `mimeType?`, `uri?`, `version?`) with `text?: string` for diff mode and
  `highlights?: LyraHighlight[]` for its own preview pane.
- `view: 'diff' | 'side-by-side' = 'diff'` (reflected) — one inline text diff or two rendered
  preview panes. Invalid property or attribute values normalize to `diff` and repair the reflected
  attribute.
- `diffLayout: 'unified' | 'split' = 'unified'` (attribute `diff-layout`, reflected) — forwarded
  to `lr-diff-view` in diff mode. Invalid property or attribute values normalize to `unified` and
  repair the reflected attribute.
- `copyable: boolean = false` — forwards the diff copy action.
- `language: string = ''`, `languages?: Record<string, ShikiLanguageInput>` (the latter
  attribute: false) — optional syntax highlighting forwarded to the diff.
- `syncScroll: boolean = true` (attribute `sync-scroll`) — proportionally mirrors either
  side-by-side pane's scroll fraction to the other. The true-default converter accepts the literal
  `sync-scroll="false"`.
- `anchor: LyraAnchor | string | null = null` (attribute: false) — sends the same target to both
  preview panes; repeated assignment of the same value still re-runs.

**Exported types:** `DocumentCompareVersion`; `LyraDocumentCompareView = 'diff' |
'side-by-side'`; `DocumentComparePaneSide = 'old' | 'new'`.

**Synchronized anchors:** activating a region highlight whose normalized id exists in the opposite
preview's trimmed, nonempty, first-wins highlight projection scrolls that pane to its corresponding
highlight, while the original `lr-highlight-activate`
continues bubbling unchanged. The shared `anchor` property drives both panes. In diff mode, split
columns already share one scroll container.

**Events:** `lr-copy` fires only after clipboard fulfillment (`detail: { ok: true, text }`). A
clipboard failure bubbles `lr-error` plus `lr-copy-error`
(`detail: { ok: false, text, reason, error }`) unchanged from `lr-diff-view`. Also emits
`lr-download` (`detail: { src, filename }`), `lr-highlight-activate` (`detail: { highlightId }`), and
`lr-render-error` (`detail: { error }`).

**Slots:** none.

**CSS parts:** `base`, `diff`, `panes`, `pane-old`, `pane-new`, `pane-header`, `pane-empty`.

**Themeable custom properties:** `--lr-document-compare-pane-max-height` (default
`var(--lr-size-24rem)`) — maximum block size of a `side-by-side` pane before it scrolls internally.

## `lr-geojson-viewer` / `lr-geojson-view`

Document-registry bridge that fetches, validates, and renders a GeoJSON file through `<lr-map>`'s
`dataLayers`. The canonical class is `LyraGeoJsonViewer`; the pre-v9 `lr-geojson-view` tag and
`LyraGeojsonView` class name remain compatibility aliases. The document registry renders the
canonical tag and matches `application/geo+json` and `.geojson` filenames.

Validates the parsed JSON is a `Feature`/`FeatureCollection`/bare geometry (one of `Point`,
`LineString`, `Polygon`, `MultiPoint`, `MultiLineString`, `MultiPolygon`, `GeometryCollection`) before
rendering; anything else renders the localized `geojsonViewInvalid` error. On success, it walks every
value and object key first, rejecting more than 50,000 graph units, nesting beyond 64 levels, more
than 2 Mi UTF-16 units of aggregate keys/string values, or more than 4 Mi UTF-16 units of formatted
metadata before serialization or peer handoff. It then walks every coordinate under a separate
10,000-position ceiling to compute a bounding box and fits a `center`/`zoom` to it (a Web-Mercator-fit
approximation weighting latitude span ~2x, with 40% padding), then hands the parsed value to
`<lr-map>` as a single `dataLayers` entry (`sourceId: 'lr-geojson'`). When the optional
`maplibre-gl` peer isn't installed, it falls back to a status line plus a `<lr-json-viewer
collapsed-depth="2">` of the raw value instead of the map.

The root owns the named `region` landmark while loading, in fallback/error/idle states, and while a
lazy map initializes. After `lr-map-load`, landmark ownership transfers to the map canvas so there
is exactly one named region. Serialized metadata is locally inline-scrollable, preventing long
unbroken values from widening a 320px allocation.

**Properties:** `src: string = ''` — URL to fetch and parse. `name: string = ''` — accessible label,
used as `<lr-map>`'s `label` and the root's `aria-label` (falling back to the localized
`geojsonViewLabel` when unset). A host `aria-label` takes precedence over `name`. The shared
text-viewer contract adds `highlights`, `activeHighlightId`, `anchor`, and
`anchorKinds` (`['text-quote', 'fragment']`), plus `search()`, `searchNext()`, `searchPrevious()`,
`clearSearch()`, and `scrollToAnchor()` for the ordinary-DOM serialized feature metadata and status
text, independent of whether the optional map peer is available.

**Events:**

- `lr-render-error` — `detail: { error }` — fetch, parse, or shape-validation failure.
- `lr-search-change` — `detail: { query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }` — fired
  whenever serialized-metadata search state changes.
- `lr-anchor-result` — `detail: { found: boolean }` — fired after an `anchor` assignment or
  `scrollToAnchor()` call is applied.
- `lr-text-select` — `detail: TextSelectDetail` (`{ text: string; anchor: LyraAnchor | null; rects:
DOMRect[] }`) — fired after a selection ends inside the serialized metadata.

`lr-highlight-activate` is not part of this registry bridge's event contract: serialized-metadata
highlights are passive and cannot be activated.

The three shared text-viewer events bubble and compose and are non-cancelable.

**CSS parts:** `base` (the root container with explicit `aria-busy="true"|"false"`), `status` (the
ordinary feature-count line, shown only in the `<lr-map>` path; a successful transition uses the
shared document-level polite sink), `metadata` (selectable/searchable serialized GeoJSON `<pre>`,
rendered in both map and fallback paths), `missing-library` (the missing-`maplibre-gl` callout shown
alongside the `lr-json-viewer` fallback; its transition uses the shared document-level assertive
sink), `error` (ordinary visible error text; later transitions use the same assertive sink),
`spinner` (a decorative skeleton plus an ordinary visually-hidden localized label; later loading
transitions use the shared document-level polite sink). No active live semantics are rendered in
the viewer's shadow tree.

Those states carry the same visual tones the rest of this family uses rather than plain inherited
body text: `error` is `--lr-color-danger` (matching `lr-docx-viewer`/`lr-email-viewer`/
`lr-html-viewer`), `missing-library` is `--lr-color-warning` -- a missing optional peer is a degraded
but working state, since the `lr-json-viewer` fallback below it still renders the data, not a failure
-- and `status` is the quiet `--lr-color-text-quiet` metadata tone.

The canonical tag is registered by importing `geojson-viewer/geojson-viewer.js`; the permanent
compatibility tag and old deep route remain available through `geojson-view/geojson-view.js`.
Remote
resources are capped at 25 MB; exceeding it surfaces the localized `documentPreviewResourceTooLarge`
message instead of the map. Lyra supports MapLibre v5 and v6; consumers must import its CSS.
MapLibre v5's standard build includes its worker, while v6 is ESM-only, requires WebGL2, and needs
its module-worker URL configured for the bundler before this viewer constructs the nested map. See
`llms/components/lr-map.md` for the Vite v6 example and the other bundler variants.

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-viewers-archive-viewer-archive-viewer-contracts`** — Supporting data types and helpers for this component family.
  `ArchiveEntry {
  name: unknown;
  dir: unknown;
  size: unknown;
}`

- **`components-viewers-calendar-viewer-calendar-loader-contracts`** — Supporting data types and helpers for this component family.
  `clearIcalCache(): unknown`
  `IcalApi {
  parse: unknown;
  source: unknown;
  Component: unknown;
  Event: unknown;
}`
  `IcalComponentApi {
  getAllSubcomponents: unknown;
  name: unknown;
}`
  `IcalEventApi {
  uid: unknown;
  summary: unknown;
  startDate: unknown;
  endDate: unknown;
  location: unknown;
  description: unknown;
}`
  `IcalTimeApi {
  toJSDate: unknown;
  isDate: unknown;
  year: unknown;
  month: unknown;
  day: unknown;
}`
  `loadIcalDeps(/* public names: importIcal */): unknown`
  `loadIcal(): unknown`

- **`components-viewers-calendar-viewer-calendar-viewer-contracts`** — Supporting data types and helpers for this component family.
  `ParsedCalendarEvent {
  uid: unknown;
  summary: unknown;
  start: unknown;
  end: unknown;
  startKind: unknown;
  endKind: unknown;
  location: unknown;
  description: unknown;
}`

- **`components-viewers-contact-viewer-vcard-contracts`** — Supporting data types and helpers for this component family.
  `parseVCards(/* public names: text, options */): unknown`
  `ParseVCardsOptions {
  maxContacts: unknown;
}`
  `VCardAddress {
  poBox: unknown;
  extendedAddress: unknown;
  streetAddress: unknown;
  locality: unknown;
  region: unknown;
  postalCode: unknown;
  country: unknown;
  types: unknown;
}`
  `VCardContact {
  fn: unknown;
  n: unknown;
  org: unknown;
  tel: unknown;
  email: unknown;
  adr: unknown;
}`
  `VCardName {
  familyNames: unknown;
  givenNames: unknown;
  additionalNames: unknown;
  honorificPrefixes: unknown;
  honorificSuffixes: unknown;
}`
  `VCardTypedValue {
  value: unknown;
  types: unknown;
}`

- **`components-viewers-dataset-viewer-dataset-viewer-contracts`** — Supporting data types and helpers for this component family.
  `DatasetTable {
  fields: unknown;
  rows: unknown;
}`

- **`components-viewers-document-compare-document-compare-contracts`** — Supporting data types and helpers for this component family.
  `DocumentCompareVersion {
  text: unknown;
  highlights: unknown;
  id: unknown;
  name: unknown;
  mimeType: unknown;
  uri: unknown;
  version: unknown;
}`

- **`components-viewers-document-viewer-anchors-contracts`** — Supporting data types and helpers for this component family.
  `AnchorResultDetail {
  found: unknown;
}`
  `AnchorTargetCapabilities {
  anchors: unknown;
  search: unknown;
  textSelect: unknown;
}`
  `HighlightActivateDetail {
  highlightId: unknown;
}`
  `LyraHighlight {
  id: unknown;
  anchor: unknown;
  label: unknown;
  note: unknown;
  tone: unknown;
}`
  `TextSelectDetail {
  text: unknown;
  anchor: unknown;
  rects: unknown;
}`
  `TextSelectRect {
  x: unknown;
  y: unknown;
  width: unknown;
  height: unknown;
  top: unknown;
  right: unknown;
  bottom: unknown;
  left: unknown;
}`

- **`components-viewers-document-viewer-registry-contracts`** — Supporting data types and helpers for this component family.
  `adaptDocumentRenderer(/* public names: candidate, file, supplied */): unknown`
  `clearDocumentRenderers(): unknown`
  `createDocumentRendererAdapter(/* public names: definition */): unknown`
  `createDocumentRendererRegistry(/* public names: overrides */): unknown`
  `DirectDocumentRendererDefinition {
  render: unknown;
  file: unknown;
  capabilities: unknown;
  adapter: unknown;
  load: unknown;
  matches: unknown;
}`
  `DocumentFile {
  name: unknown;
  mimeType: unknown;
  src: unknown;
  anchor: unknown;
  highlights: unknown;
  alt: unknown;
}`
  `findDocumentRenderer(/* public names: file, registry */): unknown`
  `getDefaultDocumentRendererRegistry(): unknown`
  `LazyDocumentRendererDefinition {
  render: unknown;
  adapter: unknown;
  capabilities: unknown;
  load: unknown;
  default: unknown;
  matches: unknown;
  file: unknown;
}`
  `loadDocumentRenderer(/* public names: candidate */): unknown`
  `LyraAdaptedDocumentRendererDefinition {
  adapter: unknown;
  render: unknown;
  capabilities: unknown;
  load: unknown;
  matches: unknown;
  file: unknown;
}`
  `LyraAdaptedDocumentRenderer {
  payload: unknown;
  capabilities: unknown;
  render: unknown;
}`
  `LyraAvDocumentRendererPayload {
  kind: unknown;
  file: unknown;
  cues: unknown;
  tracks: unknown;
}`
  `LyraDocumentFile {
  name: unknown;
  mimeType: unknown;
  src: unknown;
  anchor: unknown;
  highlights: unknown;
  alt: unknown;
}`
  `LyraDocumentRendererAdapterDefinition {
  kind: unknown;
  adapt: unknown;
  file: unknown;
  supplied: unknown;
  capabilities: unknown;
  payload: unknown;
  render: unknown;
}`
  `LyraDocumentRendererAdapter {
  kind: unknown;
  adapt: unknown;
  file: unknown;
  supplied: unknown;
  capabilities: unknown;
  payload: unknown;
  render: unknown;
}`
  `LyraGenericDocumentRendererPayload {
  kind: unknown;
  file: unknown;
}`
  `registerDocumentRenderer(/* public names: key, definition */): unknown`
  `snapshotLyraDocumentRendererPayload(/* public names: value */): unknown`

- **`components-viewers-docx-viewer-docx-loader-contracts`** — Supporting data types and helpers for this component family.
  `clearDocxDepsCache(): unknown`
  `DocxDeps {
  mammoth: unknown;
  DOMPurify: unknown;
}`
  `getDocxDepsIfLoaded(): unknown`
  `loadDocxDeps(): unknown`
  `loadMammothAndSanitizer(/* public names: importMammoth, importDompurify */): unknown`
  `MammothApi {
  convertToHtml: unknown;
  input: unknown;
  arrayBuffer: unknown;
  value: unknown;
  messages: unknown;
}`

- **`components-viewers-docx-viewer-docx-viewer-contracts`** — Supporting data types and helpers for this component family.
  `DocxHeadingItem {
  id: unknown;
  label: unknown;
  level: unknown;
}`

- **`components-viewers-ebook-viewer-ebook-viewer-contracts`** — Supporting data types and helpers for this component family.
  `EbookTocItem {
  id: unknown;
  label: unknown;
  href: unknown;
  level: unknown;
}`

- **`components-viewers-email-viewer-email-loader-contracts`** — Supporting data types and helpers for this component family.
  `clearEmailDepsCache(): unknown`
  `EmailDeps {
  PostalMime: unknown;
  DOMPurify: unknown;
}`
  `getEmailDepsIfLoaded(): unknown`
  `loadEmailAndSanitizer(/* public names: importPostalMime, importDompurify */): unknown`
  `loadEmailDeps(): unknown`
  `PostalAddressApi {
  name: unknown;
  address: unknown;
  group: unknown;
}`
  `PostalAttachmentApi {
  filename: unknown;
  mimeType: unknown;
  content: unknown;
}`
  `PostalMessageApi {
  html: unknown;
  text: unknown;
  from: unknown;
  to: unknown;
  subject: unknown;
  date: unknown;
  attachments: unknown;
}`
  `PostalMimeApi {
  parse: unknown;
  input: unknown;
}`

- **`components-viewers-email-viewer-email-viewer-contracts`** — Supporting data types and helpers for this component family.
  `LyraEmailAttachmentOpenDetail {
  attachment: unknown;
  filename: unknown;
  mimeType: unknown;
  content: unknown;
}`
  `ParsedEmailAttachment {
  filename: unknown;
  mimeType: unknown;
  size: unknown;
  content: unknown;
}`
  `ParsedEmail {
  from: unknown;
  to: unknown;
  subject: unknown;
  date: unknown;
  bodyHtml: unknown;
  bodyText: unknown;
  attachments: unknown;
}`

- **`components-viewers-highlight-layer-highlight-layer-contracts`** — Supporting data types and helpers for this component family.
  `HighlightLayerItem {
  id: unknown;
  rects: unknown;
  x: unknown;
  y: unknown;
  width: unknown;
  height: unknown;
  label: unknown;
  tone: unknown;
}`

- **`components-viewers-include-include-contracts`** — Supporting data types and helpers for this component family.
  `LyraIncludeErrorDetail {
  status: unknown;
  reason: unknown;
  error: unknown;
}`

- **`components-viewers-page-rail-page-rail-contracts`** — Supporting data types and helpers for this component family.
  `LyraPageViewerSnapshot {
  identity: unknown;
  status: unknown;
  page: unknown;
  pageCount: unknown;
}`
  `LyraPageViewerStateChangeDetail {
  snapshot: unknown;
}`
  `PageThumbnailRenderHandle {
  dispose: unknown;
}`
  `PageThumbnailSource {
  page: unknown;
  pageViewerSnapshot: unknown;
  renderPageThumbnail: unknown;
  canvas: unknown;
  options: unknown;
  width: unknown;
  renderPageThumbnailToContainer: unknown;
  container: unknown;
}`

- **`components-viewers-pdf-viewer-pdf-viewer-contracts`** — Supporting data types and helpers for this component family.
  `PdfOutlineItem {
  title: unknown;
  page: unknown;
  children: unknown;
}`

- **`components-viewers-spreadsheet-viewer-spreadsheet-loader-contracts`** — Supporting data types and helpers for this component family.
  `clearSheetJsCache(): unknown`
  `loadSheetJsCached(): unknown`
  `loadSheetJs(/* public names: importXlsx */): unknown`
  `SheetJsApi {
  read: unknown;
  input: unknown;
  options: unknown;
  utils: unknown;
  sheet_to_json: unknown;
  sheet: unknown;
}`
  `SheetJsWorkbook {
  SheetNames: unknown;
  Sheets: unknown;
}`

- **`components-viewers-viewer-diagnostics-contracts`** — Supporting data types and helpers for this component family.
  `LyraViewerDiagnosticEventDetail {
  diagnostic: unknown;
}`
  `LyraViewerDiagnostic {
  code: unknown;
  severity: unknown;
  fatal: unknown;
  source: unknown;
  cause: unknown;
  page: unknown;
  nodeId: unknown;
}`
