## `lr-document-preview`

A format-dispatching viewer for one document/attachment, plus the visual state machine for an async
server-side conversion a host app runs in front of it. First-party invention (no Web Awesome
equivalent).

Format dispatch is intentionally minimal: only `text/*`/`application/json` (a plain, scrollable
`<pre>` — no syntax highlighting; compose `<lr-code-block>` yourself via the `unsupported` slot for
that) and `image/*` (a contained `<img>`) render inline. Everything else — PDF, office documents,
video, audio, or any unrecognized MIME type — falls back to a generic "can't preview this" state: a
file glyph, a short message, and (when `src` is set) a native `<a download>` link. This is a
deliberate ceiling, not a gap: the component ships a dispatch *shell*, not a format registry. The
`unsupported` slot is the escape hatch for every format left out of the built-in three.

`status="converting"` is a second, independent axis from format dispatch. This component doesn't know
your backend's conversion API shape and owns none of the actual polling/fetch — a host converting a
non-natively-previewable format server-side (e.g. `.docx` → `.pdf`) polls its own backend and updates
`status`/`progress`/`src` here as that proceeds; this component only *visualizes* that state (an
indeterminate spinner, or a determinate one once `progress` is supplied). The one piece of async work
this component *does* own is fetching a `text/*`/`application/json` `src` itself — there's no other
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
download-or-`unsupported`-slot one, so `<slot name="unsupported">` content is *not* consulted on the
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
  `errorMessage` regardless of either. `"idle"`/`"ready"` both resume normal format dispatch — a host
  with no conversion step never has to explicitly set `"ready"`.
- `progress?: number` (type `Number`) — 0-100. Only consulted while `status="converting"`. Unset (the
  default) renders an indeterminate spinner instead of a determinate progress bar.
- `errorMessage: string = ''` (attribute `error-message`) — shown via `[part="error"]` while
  `status="error"`.
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"24rem"`); once set,
  `[part="body"]` scrolls internally past this height instead of growing the page — same contract as
  `lr-json-viewer`'s identically-named prop.
- `zoomable: boolean = false` (reflected) — wraps the rendered image (image format only) in an
  internal `<lr-zoomable-frame>`. `false` (the default) preserves the exact pre-`zoomable` DOM — an
  inline thumbnail (e.g. in a chat stream) must not unexpectedly grow a focusable zoom-chrome
  viewport; an inspection surface opts in.
- `highlights: LyraHighlight[] = []` (attribute: false) — display-only `region` highlights painted
  over the image-format preview; ignored for the `text`/`generic` formats.
- `activeHighlightId: string | null = null` (attribute `active-highlight-id`) — the `highlights`
  entry, if any, currently treated as active (`data-active` on its `region-highlight`).
- `anchorKinds` is a readonly `['region']` (this viewer's supported `LyraAnchor.kind` values for the
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
- `lr-highlight-activate` — `detail: { id }` — a region highlight was clicked or activated via
  Enter/Space (image format only).

**Slots:** `unsupported` — escape hatch: when populated, its content renders *instead of* the generic
download fallback for any `mime-type` this component doesn't natively support. Ignored while
`mime-type` resolves to `text`/`image` dispatch, or while `status` is `"converting"`/`"error"`.

**CSS parts:** `base`, `header` (hidden entirely when `filename` is unset), `filename`, `body`,
`spinner` (indeterminate `role="status"`, or `role="progressbar"` once numeric progress is known —
used both for `status="converting"` and this component's own in-flight text fetch), `error`
(`role="alert"` — used both for `status="error"` and a failed text fetch), `download-link` (only
rendered when `src` is set *and* passes the link-safe scheme allowlist — see the URL-safety note
above; excludes `data:` even though the other two sinks allow it), `highlight-layer` (wrapper around
every rendered region highlight, image format only), `region-highlight` (one region highlight,
`data-tone`, `data-active`; image format only), `frame-viewport`/`frame-content`/`frame-controls`/
`frame-zoom-in`/`frame-zoom-out`/`frame-reset` (forwarded from the internal `<lr-zoomable-frame>`
while `zoomable`; image format only)

**Themeable custom properties:** `--lr-document-preview-max-height` (default `none`) — the
consumer-tunable scroll cap on `[part="body"]`, set from `max-height`; `none` means the preview grows
with its content until a caller opts in. `--lr-document-preview-font` (default `ui-monospace,
SFMono-Regular, Menlo, Consolas, monospace`) and `--lr-document-preview-spin-duration` (default
`0.8s`, stopped under reduced motion). `--lr-document-preview-progress` (default `0`) — a unitless
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
every other element that read them. Plus shared tokens
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

Accessibility: the `"converting"` state without numeric `progress` is a `role="status"` region
wrapping a visually-hidden "Converting document…" string — a *plain* static region, not routed
through `<lr-live-region>`/`Announcer`, since (like `<lr-typing-indicator>`) it only ever has one
thing to announce (entering the state), not a rapidly-repeating stream. Once real `progress` is
available, the region becomes a standard `role="progressbar"` instead, self-describing via
`aria-valuenow` with no extra live-region wiring. `status="error"` renders `[part="error"]` as
`role="alert"` — a one-shot assertive notice, without needing the announcer machinery either.

**Known gotchas:**
- `status="converting"`/`status="error"` always win over format dispatch, regardless of
  `mimeType`/`src` — a `text`/`image` source is not shown until `status` returns to `"idle"`/`"ready"`.
- The component's own text/JSON `fetch(src)` is a *different* async operation from the host-driven
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
- `download-link` also never renders for a `data:` URL, even though `data:` is accepted for text/image
  sinks — a `src="data:..."` document renders/fetches fine but falls back to no download affordance
  in the generic state.
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

**Properties:**
- `open: boolean = false` (reflected) — opens or closes the viewer dialog.
- `name: string = ''` — display name passed to the renderer and used as the dialog heading.
- `mimeType: string = ''` (attribute `mime-type`) — MIME type used for exact renderer dispatch.
- `src: string = ''` — source URL passed to the selected renderer or the fallback preview.
- `registry?: DocumentRendererRegistry` (attribute: false) — optional per-instance registry override;
  the module-level registry is used when unset.
- `alt: string = ''` — media alt text forwarded to the resolved renderer, for image-like renderers.
- `anchor: LyraAnchor | string | null = null` (attribute: false) — declarative scroll-to-anchor
  target forwarded to the resolved renderer; a string is a highlight id in `highlights`.
  `hasChanged: () => true`, so re-assigning the same value (e.g. re-clicking the same citation
  badge) still re-fires.
- `highlights: LyraHighlight[] = []` (attribute: false) — highlights forwarded to the resolved
  renderer.

**Events:**
- `lr-close` — `detail: DocumentViewerCloseReason`, the nested dialog's dismissal reason. The
  event is emitted after the viewer sets `open` to `false`.
- `lr-download` — `detail: { src, filename }`, emitted when the native safe download action is
  activated. The browser download itself is handled by the link.
- `lr-anchor-result` — `detail: { found }`. Emitted by this shell as `{ found: false }` once per
  applied `anchor` when the resolved renderer can't honor it (it declares no `capabilities.anchors`,
  or none matching the anchor's `kind`), when the lazy renderer failed to load, or when the file fell
  back to `<lr-document-preview>`. A capable renderer instead emits its own `lr-anchor-result` from
  its embedded `DocumentAnchorTarget` mixin, which composes up through this element unchanged — the
  shell stays silent in that case, so the event fires exactly once either way. A string `anchor`
  (a highlight id) counts as supported by any renderer declaring at least one anchor kind.

**CSS parts:** `body` — wrapper around the active renderer, loading/error state, or fallback preview;
`download-link` — the native download action, rendered when `src` passes Lyra's safe-link policy.

**Themeable custom properties:** `--lr-document-viewer-max-height` (default `70vh`) — maximum block
size of `[part="body"]` before the dialog body scrolls internally.

**Renderer registry exports:**
- `DocumentFile` — `{ name: string; mimeType: string; src: string }`, the value passed to renderers.
- `DocumentRendererDefinition` — optional `render(file)`, `matches(file)`, and lazy `load()` hooks.
- `DocumentRendererRegistry` — `Map<string, DocumentRendererDefinition>`.
- `registerDocumentRenderer(key, definition)` — adds or replaces a default-registry entry.
- `findDocumentRenderer(file, registry?)` — checks an exact MIME-type key, then the first matching
  `matches()` entry in registration order.
- `loadDocumentRenderer(definition)` — resolves and identity-caches a lazy definition; rejected loads
  are retried on the next call.

```html
<lr-document-viewer
  open
  name="report.pdf"
  mime-type="application/pdf"
  src="/files/report.pdf"
></lr-document-viewer>
```

Register a renderer once during application setup. The definition may load a heavy optional viewer
only when a matching document is opened:

```ts
import { registerDocumentRenderer } from '@aceshooting/lyra-ui';

registerDocumentRenderer('application/x-example', {
  render: (file) => `Preview: ${file.name}`,
});
```

When no renderer matches, the viewer renders `<lr-document-preview>`, which handles text and images
inline and provides a safe generic fallback for other formats.

## `lr-docx-viewer`

Fetches a `.docx` Word document as an `ArrayBuffer`, converts it to semantic HTML with the optional
`mammoth` peer, sanitizes that HTML through the optional `dompurify` peer, and renders the result.
Mammoth preserves document structure such as headings, paragraphs, lists, tables, and images; it is
not intended to reproduce pixel-exact Word page layout. There is no unsanitized rendering escape
hatch: if `dompurify` is unavailable, rendering is blocked even when Mammoth converted successfully.

Every rendered heading's slug (the same GitHub-slugger-style algorithm `<lr-markdown>` uses) is
stamped as its `id` and cached into `getHeadingTree()`'s document-ordered outline. Adopts
`DocumentAnchorTarget`: `fragment` anchors resolve against that outline, `text-quote` anchors via
the shared quote-scoping helpers; `highlights` re-resolve by quote after every render.

**Properties:** `src`, `name`, and `maxHeight` (attribute `max-height`) are strings. `maxHeight` caps
the scrollable document body. `anchorKinds` is a readonly `['fragment', 'text-quote']` (this
viewer's supported `LyraAnchor.kind` values for the shared anchor-target contract).

**Methods:** `getHeadingTree()` returns the document-ordered outline as `DocxHeadingItem[]` (`{ id,
label, level }`), cached on every successful load. `search(query)` resolves the match count via a
case-insensitive substring search over the rendered content's text (empty/whitespace query behaves
like `clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through matches
(wrapping, resolving `false` when there are none); `clearSearch()` clears the query, matches, and
painted marks.

**Events:** `lr-render-error` with `detail.error` when fetching, conversion, sanitization, or a
non-fatal Mammoth conversion message occurs. `lr-search-change` (`detail: { query, matchCount,
activeIndex }`) — from `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`.
`lr-highlight-activate` (`detail: { id }`) — a painted `text-quote` highlight was clicked.
`lr-text-select` (`detail: { text, anchor, rects }`) — fired on selection end inside the rendered
content. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call.

**CSS parts:** `base`, `body`, `content`, `spinner`, `error`, `highlight` (a painted `text-quote`
highlight), `search-match` (a painted in-document search match), and `search-match-active` (the
currently active search match, also carries `search-match`).

**Themeable custom properties:** `--lr-docx-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Optional peer dependencies:** install `mammoth` and `dompurify` with `pnpm add mammoth dompurify`.
The component registers an eager `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
renderer with `<lr-document-viewer>` (a plain `render`, no `load()` hook — importing this module
defines `<lr-docx-viewer>` immediately; only `mammoth`/`dompurify` themselves are loaded on demand)
and matches `.docx` filenames when the MIME type is generic.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the document.

```html
<lr-docx-viewer src="/files/report.docx" name="report.docx" max-height="32rem"></lr-docx-viewer>
```

## `lr-email-viewer`

Fetches and parses `.eml` messages with the optional `postal-mime` peer. HTML message bodies are
sanitized through the existing optional `dompurify` peer before rendering; plain-text messages
remain available without DOMPurify. Attachments are listed as filename and size only (the parsed
`mimeType` never reaches the DOM) and their content is never rendered by this component. Each
attachment row is a real `<button>` that emits `lr-attachment-open` with the decoded bytes; opening,
downloading, or object-URL'ing them is the host's job (e.g.
`URL.createObjectURL(new Blob([content], { type: mimeType }))` → `<lr-document-viewer>` → revoke on
`lr-close`).

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the message.

**Properties:** `src`, `name`, and `maxHeight` (attribute `max-height`) are strings. `foldQuotes:
boolean = false` (attribute `fold-quotes`) — collapses trailing quoted-reply text/HTML behind a
localized show/hide toggle. `false` (the default) preserves the full body rendering.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails.
`lr-attachment-open` — `detail: { attachment: { filename, mimeType, content? } }`, `content` a
`Uint8Array` of the decoded attachment — an attachment button was activated.

**CSS parts:** `base`, `headers`, `from-label`, `from`, `to-label`, `to`, `subject-label`, `subject`,
`date-label`, `date`, `body`, `body-html`, `body-text`, `attachments`, `attachments-label`,
`attachment-list`, `attachment-item`, `attachment-button` (an attachment's open button, inside its
`attachment-item`), `quoted` (a folded quoted-text block, hidden until expanded, only
while `foldQuotes`), `quote-toggle` (the show/hide-quoted-text toggle button, only while `foldQuotes`),
`spinner`, and `error`.

**Themeable custom properties:** `--lr-email-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Optional peer dependencies:** install `postal-mime` and `dompurify` with
`pnpm add postal-mime dompurify`. The component registers `message/rfc822` and falls back to
matching `.eml` filenames in `<lr-document-viewer>`. Deviates from the shared degraded-render
contract: an absent `postal-mime` renders `[part="error"]` with the localized
`emailViewerMissingParser` message (nothing is parseable without it), and an HTML-only message
(no `text/plain` alternative) with `dompurify` absent renders the localized
`documentViewerMissingSanitizer` message rather than silently showing an empty body.

## `lr-calendar-viewer`

Fetches and parses `.ics` calendars with the optional `ical.js` peer and renders each VEVENT as
plain text, including its title, start/end time, location, and description. No HTML is injected.

**Properties:** `src`, `name`, and `maxHeight` (attribute `max-height`) are strings.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails.

**CSS parts:** `base`, `body`, `event-list`, `event`, `event-summary`, `event-time`, `event-location`,
`event-description`, `spinner`, and `error`.

**Themeable custom properties:** `--lr-calendar-viewer-max-height` (default `none`) — maximum block
size of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Optional peer dependency:** install `ical.js` with `pnpm add ical.js`. The component registers
`text/calendar` and falls back to matching `.ics` filenames in `<lr-document-viewer>`.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the calendar.

## `lr-archive-viewer`

Lists entry names and human-readable uncompressed sizes inside a `.zip` archive using the optional
`jszip` peer. It is listing-only: entry content is never rendered or previewed. Each entry's size is
read straight from JSZip's local file header (`uncompressedSize`) when available, falling back to
fully decompressing only the rare entry missing that header field. The list composes
`<lr-virtual-list>` for large archives.

**Properties:** `src` and `name` are strings — `name` (or a host-level `aria-label`) names the
listing region as `role="region"`; with neither set, the region is unnamed.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails.

**CSS parts:** `base`, `entry`, `entry-icon`, `entry-name`, `entry-name-dir`, `entry-size`,
`spinner`, and `error`. A directory row's name element carries both `entry-name` and
`entry-name-dir` (a part list), so `::part(entry-name-dir)` selects only directory names while
`::part(entry-name)` still selects every name. Entry rows are rendered into the embedded
`<lr-virtual-list>`'s own shadow root and forwarded with `exportparts`, so
`lr-archive-viewer::part(entry)` (and every other row part above) reaches them from a consuming
stylesheet.

**Exports:** `ArchiveEntry` — `{ name: string; dir: boolean; size: number }`.

**Optional peer dependency:** install `jszip` with `pnpm add jszip`. The lazy registry registers
`application/zip` and `application/x-zip-compressed`, with a `.zip` filename fallback, and imports
the viewer only when a matching archive is opened. `.tar`, `.rar`, and other archive formats fall
through to `<lr-document-preview>`'s generic download fallback.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the entry listing.

## `lr-ebook-viewer`

Renders EPUB ebooks through the optional `epubjs` peer. `src` is fetched as an `ArrayBuffer`, and
epub.js renders the reading area into its stable `mount` element, using an internal iframe for
chapter content.

**Properties:** `src` and `name` are strings. `accessibleLabel` (attribute `aria-label`) overrides
the reading region's accessible name. `location: string = ''` (not reflected — CFIs are long) is
a CFI or spine href identifying the current reading position: set before the book finishes
loading it's recorded and applied once ready, set after it applies immediately, and epub.js's own
`relocated` event keeps it in sync with user navigation without re-triggering its own `display()`
call. `anchorKinds` is a readonly `['cfi', 'text-quote']` (this viewer's supported `LyraAnchor.kind`
values for the shared anchor-target contract).

**Methods:** `getToc()` resolves the EPUB's own navigation document (`book.navigation.toc`,
populated once `book.ready` resolves) flattened into document-ordered `EbookTocItem[]` (`{ id,
label, href, level }`, `level` starting at 1 for a top-level entry, `id` falling back to `href`
when a navigation entry has none), `[]` before a book has loaded. `search(query)` resolves the
match count across every spine section, in document order, via epub.js's own `item.load()`/
`item.find()`/`item.unload()` (empty/whitespace query behaves like `clearSearch()`; a newer
`search()` call or a `src` change aborts an in-flight scan); `searchNext()`/`searchPrevious()`
advance/step back through matches (wrapping, resolving `false` when there are none); `clearSearch()`
clears the query, matches, and painted search annotation.

**Events:** `lr-render-error` with `detail.error` when fetching, opening, or rendering fails;
`lr-location-change` (`detail: { cfi, href }`) fired from epub.js's own `relocated` event;
`lr-search-change` (`detail: { query, matchCount, activeIndex }`) from `search()`/`searchNext()`/
`searchPrevious()`/`clearSearch()`.

**CSS parts:** `base`, `toolbar`, `previous-button`, `next-button`, `previous-icon`, `next-icon`,
`mount`, `error`, and `announcer` (the visually-hidden `role="status"` region search results
announce through).

**Optional peer dependency:** install `epubjs` with `pnpm add epubjs`. The document-viewer registry
matches `application/epub+zip` and `.epub` filenames, declaring `{ anchors: ['cfi', 'text-quote'],
search: true, textSelect: true }` capabilities.

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

## `lr-pptx-viewer`

Best-effort client-side PPTX viewer backed by the optional `@aiden0z/pptx-renderer` peer. A
localized fidelity notice is always visible because animations, equations, embedded objects,
speaker notes, and several advanced effects are not rendered.

**Properties:** `src`, `name`, and `label` are strings. A host `aria-label` also names the viewer
region when `label` is unset.

**Methods:** `goToSlide(index)` returns a promise and navigates the mounted presentation.

**Events:** `lr-load` (`detail: { slideCount }`), `lr-slide-change` (`detail: { index, count }`),
and `lr-render-error` with `detail.error`.

**CSS parts:** `base`, `header`, `name`, `notice`, `error`, `nav`, `previous-button`,
`previous-icon`, `slide-count`, `next-button`, `next-icon`, and `container`.

**Optional peer dependency:** install `@aiden0z/pptx-renderer` with
`pnpm add @aiden0z/pptx-renderer`. The registry matches the official PPTX MIME type and `.pptx`
filenames.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the presentation.

## `lr-svg-viewer`

Fetches an SVG document, sanitizes it with the optional `dompurify` peer, and renders it inline.

**Properties:** `src`, `name`, and `maxHeight` (attribute `max-height`) are strings. `maxHeight` caps
the scrollable body. `zoomable: boolean = false` (reflected) — wraps the rendered content in an
internal `<lr-zoomable-frame>`. `false` (the default) preserves the exact pre-`zoomable` DOM — an
inline thumbnail (e.g. in a chat stream) must not unexpectedly grow a focusable zoom-chrome viewport;
an inspection surface opts in. `highlights: LyraHighlight[] = []` (attribute: false) — display-only
`region` highlights painted over the rendered SVG. `activeHighlightId: string | null = null`
(attribute `active-highlight-id`) — the `highlights` entry, if any, currently treated as active
(`data-active` on its `region-highlight`). `anchorKinds` is a readonly `['region']` (this viewer's
supported `LyraAnchor.kind` values for the shared anchor-target contract).

**Methods:** `scrollToAnchor(target)` — scrolls a `region` highlight (by id, or a `LyraAnchor` matched
back to its owning `LyraHighlight` by reference) into view; resolves `false` when nothing matches, the
anchor isn't `region`, or the document isn't loaded yet (no retry loop — a caller invoking this before
`src` resolves simply gets `false`).

**Events:** `lr-render-error` with `detail.error` when fetching or sanitizing fails.
`lr-highlight-activate` (`detail: { id }`) — a region highlight was clicked or activated via
Enter/Space.

**CSS parts:** `base`, `body`, `svg`, `spinner`, `error`, `highlight-layer` (wrapper around every
rendered region highlight), `region-highlight` (one region highlight, `data-tone`, `data-active`),
`frame-viewport`/`frame-content`/`frame-controls`/`frame-zoom-in`/`frame-zoom-out`/`frame-reset`
(forwarded from the internal `<lr-zoomable-frame>` while `zoomable`).

**Themeable custom properties:** `--lr-svg-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.
`--lr-svg-viewer-active-border` (default `var(--lr-color-warning, var(--lr-color-brand))`) — the
border color of the `[part='region-highlight']` matching `activeHighlightId`, distinct from the
resting highlight border so the active region can be recolored without touching the rest. It is an
inline `var()` fallback at the point of use rather than a `:host` declaration, so it can be set on
the element *or on any ancestor*: `::part(region-highlight)[data-active]` is invalid CSS — Shadow
Parts forbids an attribute selector after `::part()` — so re-pointing a shared `--lr-color-*` token,
and repainting everything else reading it, was previously the only way. Unset, it falls back to
exactly the tokens the rule used before.

**Optional peer dependency:** `dompurify`.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the graphic.

## `lr-html-viewer`

Fetches an HTML document, sanitizes it with the optional `dompurify` peer, and renders the safe markup
inside a bounded, scrollable body.

**Properties:** `src`, `name`, and `maxHeight` (attribute `max-height`) are strings.

**Events:** `lr-render-error` with `detail.error` when fetching or sanitizing fails.

**CSS parts:** `base`, `body`, `html`, `spinner`, and `error`.

**Themeable custom properties:** `--lr-html-viewer-max-height` (default `none`) — maximum block size
of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Optional peer dependency:** `dompurify`.

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
the virtualized list's `active-id`. `highlights` paint as a `part="cell-highlight"` cell wrapping a
focusable `part="cell-highlight-action"` native button, keeping the ARIA table tree intact.

**Properties:** `src`, `name`, and `maxHeight` (attribute `max-height`) are strings. `anchorKinds` is
a readonly `['cell-range']` (this viewer's supported `LyraAnchor.kind` values for the shared
anchor-target contract).

**Methods:** `search(query)` resolves the match count via a case-insensitive substring search over
every body cell's raw string value, ordered row then column (empty/whitespace query behaves like
`clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through matches (wrapping,
resolving `false` when there are none); `clearSearch()` clears the query, matches, and cursor.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails.
`lr-highlight-activate` (`detail: { id }`) — a `highlights` cell was clicked or activated via
Enter/Space. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call. `lr-search-change` (`detail: { query, matchCount, activeIndex }`) — from
`search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`.

**CSS parts:** `base`, `body`, `table`, `header-row`, `header-cell`, `data-row`, `cell`,
`cell-highlight` (a `role="cell"` covered by a `highlights` entry; wraps the action button),
`cell-highlight-action` (the native button filling a highlighted cell — focusable, emits
`lr-highlight-activate` on click or Enter/Space), `spinner`, and `error`. `data-row`, `cell`,
`cell-highlight` and `cell-highlight-action` render inside the internal `<lr-virtual-list>` and are
forwarded via `exportparts`, so `lr-dataset-viewer::part(cell)` reaches them from a consumer
stylesheet.

**Exports:** `DatasetTable` is `{ fields: string[]; rows: Record<string, string>[] }`.

**Themeable custom properties:** `--lr-dataset-viewer-max-height` (default `none`) — maximum block
size of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.
`--lr-dataset-viewer-highlight-color` (default `var(--lr-color-brand)`) — the outline color of a
`cell-highlight` cell. The component writes it inline (as
`var(--lr-color-warning, var(--lr-color-brand))`) on the cell matching `activeHighlightId`, since a
`[data-active]` selector can't be chained onto the `::part(cell-highlight)` the cell reaches this
component's stylesheet through; a custom property inherits across that boundary instead.

**Optional peer dependency:** `papaparse`.

Remote resources are capped at 25 MB, and the parsed table at 10,000 rows and 1,000 columns (the
same shared default as `lr-csv-viewer`/`lr-spreadsheet-viewer`); exceeding either surfaces the
localized `documentPreviewResourceTooLarge` message instead of the table.

## `lr-contact-viewer`

Fetches a vCard document and renders one accessible card per contact. The document registry matches
`.vcf` filenames and the `FN`, `ORG`, `TEL`, `EMAIL`, and `ADR` fields are displayed. `N` is parsed
but never rendered — the card's heading uses `FN` (falling back to a localized "unnamed contact"
label when `FN` is absent).

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the contacts.

**Properties:** `src`, `name`, and `maxHeight` (attribute `max-height`) are strings.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails.

**CSS parts:** `base`, `body`, `contact`, `contact-name`, `contact-org`, `contact-tel`,
`contact-email`, `contact-adr`, `spinner`, and `error`.

**Themeable custom properties:** `--lr-contact-viewer-max-height` (default `none`) — maximum block
size of `[part="body"]`; also settable via the `max-height` property, which writes this token inline.

**Exports:** `parseVCards()` and the `VCardName`, `VCardTypedValue`, `VCardAddress`, and `VCardContact`
types.

## `lr-pdf-viewer`

Fetches a PDF and renders its pages with the optional `pdfjs-dist` peer. Pages are virtualized through
`lr-virtual-list`, and PDF.js's selectable text layer is positioned over each rendered canvas.

Adopts `DocumentAnchorTarget`: `page`, `text-quote`, and `region` anchors resolve, and `highlights`
paint through one `<lr-highlight-layer>` per page, stacked between the canvas and the text layer
(canvas → highlights → text layer) so starting a text selection over a cited passage keeps working.
Pointer activation is hit-tested at the page-wrapper level (the text layer on top intercepts most
direct pointer events); keyboard activation reaches the highlight layer's own roving-tabindex rects
directly, since z-stacking doesn't affect tab order. Residual: a click that *ends a text-selection
drag* over a highlighted passage never activates it — the selection-in-progress check exists exactly
to tell that apart from a genuine activation click.

**Properties:** `src` and `name` are strings. `page: number = 1` is the one-based current page and
`zoom: number = 1` is clamped to `0.25`–`4`. `anchorKinds` is a readonly `['page', 'text-quote',
'region']` (this viewer's supported `LyraAnchor.kind` values for the shared anchor-target contract).

**Events:**
- `lr-render-error` — `detail: { error }` — fetching, parsing, or rendering (page canvas or text
  layer) failed.
- `lr-load` — `detail: { pageCount }` — the document reached `ready`. `page` is reset to `1` first.
- `lr-page-change` — `detail: { page, pageCount }` — fired for scroll-driven page crossings as well
  as `page` assignments and `nextPage()`/`previousPage()`/`goToPage()`.
- `lr-zoom-change` — `detail: { zoom }`.
- `lr-search-change` — `detail: { query, matchCount, activeIndex }` — from `search()`/`searchNext()`/
  `searchPrevious()`/`clearSearch()`. A `src` change resets search state *silently* (no event), since
  match page/offset coordinates only mean anything for the document they were found in.
- `lr-highlight-activate` — `detail: { id }` — a painted highlight was clicked or activated via
  Enter/Space. On a pointer hit-test, the last entry of `highlights` covering the point wins.
- `lr-text-select` — `detail: { text, anchor, rects }` — a selection ended inside a page's text
  layer. `anchor` is the computed anchor (`null` when none resolves), carrying the resolved `page`
  when it is a `text-quote`.
- `lr-anchor-result` — `detail: { found }` — fired after an `anchor` assignment or a
  `scrollToAnchor()` call.

**Methods:** `nextPage()`, `previousPage()`, `zoomIn()`, and `zoomOut()` update the corresponding
controlled state within its supported range. `getPageText(page)` resolves the raw reading-order text
of one page (per-page LRU-cached, 64 pages), rejecting on no loaded document or an out-of-range page.
`renderPageThumbnail(page, canvas, options?)` renders `page` into a caller-owned `canvas` at
`options.width` CSS px (default 96), devicePixelRatio-aware, resolving `false` when not ready or out
of range. `goToPage(page)` scrolls the virtualized list to `page`, resolving `true` once mounted (or
`false` for an out-of-range value, without changing `page`). `getOutline()` resolves the document's
table of contents as `PdfOutlineItem[]` (`{ title, page?, children? }`), `[]` when there is none.
`search(query)` resolves the match count across all pages (empty/whitespace query behaves like
`clearSearch()`); `searchNext()` and `searchPrevious()` advance/step back through matches (wrapping,
resolving `false` when there are none); `clearSearch()` clears the query, matches, and painted marks.

**CSS parts:** `base`, `toolbar`, `page-indicator`, `zoom-indicator`, `pages`, `page`, `page-canvas`
(the canvas one page's content is painted onto), `text-layer`, `text-span` (one generated text run
inside a page's text layer — PDF.js creates these imperatively, and they carry the part so a rule can
reach them without a descendant combinator), `search-match` (a `<mark>` painted into a mounted page's
text layer around one search match), `search-match-active` (the currently active match, also carries
`search-match`), `spinner`, and `error`. Search painting is best-effort: a page outside the
virtualized render window is skipped and repainted once its text layer mounts, and a match spanning a
text-layer span boundary that `Range.surroundContents()` can't wrap stays unpainted (still reachable
via `searchNext()`).

`page`, `page-canvas`, `text-layer`, `text-span`, `search-match` and `search-match-active` are
rendered inside the virtualizing `lr-virtual-list`'s own shadow root and forwarded out through
`exportparts`, so `lr-pdf-viewer::part(page)` (and each of the others) works from a consumer
stylesheet exactly like the parts in this viewer's own shadow root. The selection tint over a page's
text is styled on `text-span` rather than on `text-layer`, because a highlight pseudo-element is
matched against the element the selected text originates in:
`lr-pdf-viewer::part(text-span)::selection { background: … }`.

**Themeable custom properties:** `--lr-pdf-viewer-height` (default `var(--lr-size-24rem)`) — block
size of the virtualized page list (`[part="pages"]`). Everything below the page list is retuned
through the exported parts above rather than through dedicated custom properties.

**Optional peer dependency:** install `pdfjs-dist` with `pnpm add pdfjs-dist`. The component registers
a lazy `application/pdf` renderer with `<lr-document-viewer>` so the PDF library is loaded only when
a PDF is opened. Deviates from the shared degraded-render contract: an absent `pdfjs-dist` renders
`[part="error"]` with the localized `pdfViewerMissingLibrary` message — there is no partial PDF
rendering without it.

Remote resources are capped at 25 MB; exceeding it surfaces the localized
`documentPreviewResourceTooLarge` message instead of the PDF.

## `lr-spreadsheet-viewer`

Fetches and renders `.xlsx` and `.xls` workbooks with the optional `xlsx` (SheetJS) peer. Multiple
worksheets render through a `<lr-tabs>` switcher, and body rows use `<lr-virtual-list>`.

Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses one sheet's raw grid, 1-based, with
its header row included, resolving the target sheet from the anchor's own `sheet` field (falling
back to a `Sheet!`-prefixed `range`, then the active sheet); `scrollToAnchor()` switches
`<lr-tabs>`'s active tab first when needed, then scrolls the addressed row/column into view.
`highlights` paint as a focusable `part="cell-highlight"`.

**Properties:** `src` and `name` are strings. `anchorKinds` is a readonly `['cell-range']` (this
viewer's supported `LyraAnchor.kind` values for the shared anchor-target contract).

**Methods:** `search(query)` resolves the match count across every sheet's stringified cell values,
ordered sheet then row then column, switching tabs as navigation crosses sheets (empty/whitespace
query behaves like `clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through
matches (wrapping, resolving `false` when there are none); `clearSearch()` clears the query,
matches, and painted marks.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing fails.
`lr-highlight-activate` (`detail: { id }`) — a `highlights` cell was clicked or activated via
Enter/Space. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call. `lr-search-change` (`detail: { query, matchCount, activeIndex }`) — from
`search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`.

**CSS parts:** `base`, `tabs`, `sheet`, `header-row`, `data-row`, `cell`, `cell-highlight` (a cell
covered by a `highlights` entry), `rows`, `spinner`, and `error`. `data-row`, `cell` and
`cell-highlight` are rendered inside the internal `<lr-virtual-list>` and forwarded via
`exportparts`, so `lr-spreadsheet-viewer::part(cell)` reaches them from a consumer stylesheet.

**Themeable custom properties:** `--lr-spreadsheet-viewer-highlight-color` (default
`var(--lr-color-brand)`) — the outline color of a `cell-highlight` cell. The component writes it
inline (as `var(--lr-color-warning, var(--lr-color-brand))`) on the cell matching
`activeHighlightId`, since a `[data-active]` selector can't be chained onto the
`::part(cell-highlight)` the cell reaches this component's stylesheet through; a custom property
inherits across that boundary instead.

**Optional peer dependency:** install `xlsx` with `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. The official CDN matches the
`.xlsx` and `.xls` MIME types and filename extensions.

Remote resources are capped at 25 MB, and each parsed sheet at 10,000 rows and 1,000 columns;
exceeding any of these surfaces the localized `documentPreviewResourceTooLarge` message instead of
the workbook.

## `lr-csv-viewer`

Fetches CSV text, parses quoted fields with the optional `papaparse` peer, and virtualizes body rows.

Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses the raw file grid, 1-based, with the
header row included whenever `has-header-row` is set; `scrollToAnchor()` scrolls the addressed
row/column into view via the virtualized list's `active-id`. `highlights` paint as a focusable
`part="cell-highlight"`.

**Properties:** `src` and `name` are strings. `hasHeaderRow: boolean = true` (attribute
`has-header-row`) controls whether the first parsed row is rendered as a sticky header.
`anchorKinds` is a readonly `['cell-range']` (this viewer's supported `LyraAnchor.kind` values for
the shared anchor-target contract).

**Methods:** `search(query)` resolves the match count via a case-insensitive substring match over
the same stringified cell values `cell()` renders, ordered row then column (empty/whitespace query
behaves like `clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through matches
(wrapping, resolving `false` when there are none); `clearSearch()` clears the query, matches, and
painted marks.

**Events:** `lr-render-error` with `detail.error` when fetching or parsing reports an error.
`lr-highlight-activate` (`detail: { id }`) — a `highlights` cell was clicked or activated via
Enter/Space. `lr-anchor-result` (`detail: { found }`) — fired after an `anchor` assignment or a
`scrollToAnchor()` call. `lr-search-change` (`detail: { query, matchCount, activeIndex }`) — from
`search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`.

**CSS parts:** `base`, `sheet`, `header-row`, `data-row`, `cell`, `cell-highlight` (a cell covered by
a `highlights` entry), `rows`, `spinner`, and `error`. `data-row`, `cell` and `cell-highlight` are
rendered inside the internal `<lr-virtual-list>` and forwarded via `exportparts`, so
`lr-csv-viewer::part(cell)` reaches them from a consumer stylesheet.

**Themeable custom properties:** `--lr-csv-viewer-highlight-color` (default `var(--lr-color-brand)`)
— the outline color of a `cell-highlight` cell. The component writes it inline (as
`var(--lr-color-warning, var(--lr-color-brand))`) on the cell matching `activeHighlightId`, since a
`[data-active]` selector can't be chained onto the `::part(cell-highlight)` the cell reaches this
component's stylesheet through; a custom property inherits across that boundary instead.

**Optional peer dependency:** install `papaparse` with `pnpm add papaparse`. The registry matches
`text/csv` and `.csv` filenames.

Remote resources are capped at 25 MB, and the parsed table at 10,000 rows and 1,000 columns;
exceeding any of these surfaces the localized `documentPreviewResourceTooLarge` message instead of
the table.

---

## `lr-include`

Fetches an HTML fragment from `src` and transcludes it as sanitized **light-DOM** content, so the
fragment participates in the surrounding page's CSS cascade like a native server-side include —
unlike `<lr-html-viewer>`, which renders a foreign document inside an isolated preview card. The
markup always passes through the shared DOMPurify-backed sanitizer before it reaches `innerHTML`;
there is deliberately no `allow-scripts`-style escape hatch (the Web Awesome/Shoelace equivalents'
raw injection option is omitted, not shipped as a no-op).

A bare primitive: no label/hint/error chrome, no implicit role, no computed accessible name, and no
`aria-live` wrapper (the fragment can carry its own landmarks; wrapping the host would re-announce
all of it on every load). `aria-busy="true"` is set on the host while a fetch is in flight and
removed once it settles either way. Build error UI from `lr-include-error`.

**Properties:**
- `src: string = ''` (reflected) — URL of the fragment, validated through the shared `safeFetchUrl()`
  allowlist (`http:`, `https:`, `blob:`, `data:`). Empty/falsy is a no-op: no fetch, no events,
  existing content untouched.
- `mode: 'cors' | 'no-cors' | 'same-origin' = 'same-origin'` (reflected) — forwarded to
  `fetch(url, { mode })`. Defaults to `same-origin` (not the upstream components' `cors`) so
  cross-origin fetching is opt-in; an invalid value is normalized back to `same-origin` rather than
  letting `fetch()` throw. `no-cors` is accepted for enum completeness but always yields an opaque
  response (`status` `0`, unreadable body) — a Fetch API limitation, not a bug here.

**Events:**
- `lr-load` — `detail: { src }` — the fragment was sanitized and written into the light DOM.
- `lr-include-error` — `detail: { status, reason, error? }`. `reason` is a `LyraIncludeErrorReason`:
  `'blocked-url'` (`src` failed the allowlist; `fetch()` never ran), `'network'` (`fetch()` rejected),
  `'http'` (response not `ok`; `status` carries the code), `'missing-sanitizer'` (the optional
  `dompurify` peer failed to load), or `'resource-too-large'` (the body exceeded the shared 25 MB
  cap). `status` is `0` for every reason but `'http'`.

**Slots:** default — fallback content shown until (or unless) a fetch succeeds. It is overwritten by
the sanitized fragment on success, and left untouched on failure (as is any previously successful
include).

**CSS parts:** `base` — the `display: contents` wrapper around the default slot.

Deviates from the shared degraded-render contract: an absent `dompurify` fires
`lr-include-error` with `reason: 'missing-sanitizer'` and leaves the existing content in place —
unsanitized markup is never transcluded.

## `lr-highlight-layer`

A presentational overlay that paints highlight rectangles (percent-of-box coordinates) over
positioned content and owns their activation, active/flash styling, and keyboard access. `items`
order is the caller's own reading order; the layer does not re-sort geometrically. Fills its nearest
positioned ancestor.

**Properties:** `items: HighlightLayerItem[] = []` (attribute: false), `activeId: string | null =
null` (attribute `active-id`), and `interactive: boolean = true` (reflected) — gates click/keyboard
activation.

**Methods:** `flash(id)` briefly re-triggers the flash styling for an already-rendered rect (e.g. a
re-click of the same source citation).

**Events:** `lr-highlight-activate` — a rect was activated (click, or Enter/Space while focused).
`detail: { id }`.

**CSS parts:** `base` (the absolutely-positioned overlay, inset 0) and `rect` (one highlight
rectangle; carries `data-tone`/`data-active`/`data-flash` state attributes).

## `lr-page-rail`

A virtualized vertical thumbnail rail for page-addressed documents, with per-page highlight heat
markers. Two modes: **wired** (`viewer`/`for` supply a live page source, e.g. `<lr-pdf-viewer>` —
thumbnails render lazily as rows materialize, and the rail tracks page/count from the viewer's own
events) and **mediated** (`page-count`/`page` are host-bound directly, rows render a placeholder
glyph — still a fully functional pager). In wired mode the viewer's `page` is the single source of
truth.

**Properties:** `viewer: PageThumbnailSource | null = null` (attribute: false) — the wired viewer.
`for: string = ''` — an id selector alternative to setting `viewer` directly. `pageCount: number = 0`
(attribute `page-count`) and `page: number = 1` (reflected) — mediated-mode page state.
`highlights: LyraHighlight[] = []` (attribute: false) — drives the per-page heat markers.
`thumbWidth: number = 96` (attribute `thumb-width`) and `label: string = ''`.

**Events:** `lr-page-select` — a page row was activated (click, or Enter/Space on a focused row).
`detail: { page }`. In wired mode the rail also sets `viewer.page` itself.

**CSS parts:** `base` (the rail), `pages` (the embedded `<lr-virtual-list>`), `page` (one page
button), `page-current` (the button for the current `page`), `thumbnail` (the thumbnail canvas
wrapper), `page-number` (the visible page number), `heat` (the heat-marker cluster), `heat-dot` (one
heat marker), `heat-dot-accent`, `heat-dot-success`, `heat-dot-warning`, `heat-dot-danger` and
`heat-dot-neutral` (the tone-specific name on each marker), and `heat-dot-overflow` (the `+n`
marker).

Page rows are rendered into the embedded `<lr-virtual-list>`'s own shadow root and forwarded with
`exportparts`, so `lr-page-rail::part(page)` and the rest reach them from a consuming stylesheet.
State variants each carry a second name in the element's part list rather than a state attribute,
because `::part()` cannot be followed by an attribute selector: the current row is
`part="page page-current"` and a danger marker is `part="heat-dot heat-dot-danger"`, and `::part()`
matches with `part~=` semantics, so both names select the same element.

**Themeable custom properties:** `--lr-page-rail-height` (default `var(--lr-size-24rem)`) — block
size of the virtualized rail. `--lr-page-rail-current-bg` (default `var(--lr-color-brand-quiet)`) —
background of the `page-current` button, kept while the row is hovered so the current page stays
identifiable under the pointer.

## `lr-notebook-viewer`

Read-only Jupyter notebook (nbformat 4.x) renderer, composing existing components per cell.
Execution is a hard non-goal. Markdown cells render through `lr-markdown`, code cells through
`lr-code-block` (using the notebook's kernel language for syntax highlighting), and raw cells as
plain preformatted text. A code cell's `execute_result`/`display_data` outputs prefer, in order,
`image/png`, `image/jpeg`, `image/svg+xml` (sanitized), `text/html` (sanitized), `application/json`
(via `lr-json-viewer`), then `text/plain`. Stream/error outputs render as plain preformatted text
(tinted `danger` for stderr/tracebacks). Sanitizing raw HTML/SVG output markup lazy-loads the
optional peer `dompurify`; without it, the output renders a localized notice instead of raw markup.
Cells are virtualized through `lr-virtual-list`. `node-path` anchors resolve `path[0]` as a cell
index; `fragment` anchors resolve a cell's own `id`. No execution, no kernels, no editing, no
ipywidgets.

**Properties:** `src: string = ''` — URL to fetch and parse as a notebook; ignored once `notebook` is
set. `notebook?: object | string` (property only) — an already-parsed notebook document, or its raw
JSON text; wins over `src` and is parsed (and validated) synchronously. `name: string = ''` —
accessible label, and matched against a `fragment` anchor's cell id. `outputCollapseLines: number =
40` (attribute `output-collapse-lines`) — a plain-text output longer than this many lines renders
collapsed behind a toggle; `0` disables collapsing. `maxHeight: string = ''` (attribute
`max-height`) — once set, the notebook scrolls internally past this height. `anchorKinds` is a
readonly `['node-path', 'fragment']` (this viewer's supported `LyraAnchor.kind` values for the
shared anchor-target contract).

**Methods:** `search(query)` resolves the match count over cell sources and text outputs — a
matching cell counts as one match (empty/whitespace query behaves like `clearSearch()`);
`searchNext()`/`searchPrevious()` advance/step back through matches, scrolling to and flashing the
target cell; `clearSearch()` clears the query and matches.

**Events:** `lr-load` — `detail: { cellCount, language }`, fired once a notebook has been parsed
and validated (`language` from `metadata.language_info.name`/`kernelspec.language`, else `''`).
`lr-highlight-activate` — `detail: { id }`. `lr-search-change` — `detail: { query, matchCount,
activeIndex }`. `lr-render-error` — `detail: { error }`, fetching, parsing, or validating the
notebook failed.

**CSS parts:** `base` (the root scroll container), `cell` (`data-cell-type="code|markdown|raw"`,
`data-active`), `cell-active` (added alongside `cell` on the cell an anchor currently targets),
`cell-gutter` (the `In [n]`/`Out [n]` label column), `cell-source`, `outputs`, `output`
(`data-output-type`, `data-stream`), `output-error` (added alongside `output` on a stderr stream or
an error output), `error-output-label` (the label introducing an error output's traceback),
`output-toggle`, `error`, `spinner`.

Every cell-level part above is rendered into the embedded `<lr-virtual-list>`'s own shadow root and
forwarded back out through `exportparts`, so `lr-notebook-viewer::part(cell)` and friends work from
a consumer stylesheet. The three state variants are separate part *names* rather than attribute
selectors, because Shadow Parts forbids an attribute selector after `::part()` —
`::part(cell)[data-active]` is invalid CSS, so use `::part(cell-active)`. The `data-*` attributes
remain on the elements for scripting.

**Themeable custom properties:** `--lr-notebook-viewer-max-height` (default `none`).

`--lr-notebook-viewer-active-bg` (default `var(--lr-color-brand-quiet)`) is the background of the
cell currently targeted by an anchor — the `cell-active` part. It is an inline `var()` fallback at
the point of use rather than a `:host` declaration, so it can be set on the element or on any
ancestor.

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

## `lr-xml-viewer`

Collapsible, copyable, `DOMParser`-based tree view for XML documents, mirroring `lr-json-viewer`'s
UX (`collapsed-depth`, `copyable`, structural-path-keyed expand state that survives a same-shape
`xml` reassignment) adapted for XML's own node kinds: elements with attributes, text, comments, CDATA
sections, and processing instructions. Namespace-literal: qualified names render exactly as authored,
with no namespace-URI-aware matching. `DOMParser` never resolves external entities or DTDs, so XXE
injection is structurally out of reach. Not `lr-json-viewer` (JS values); not `lr-html-viewer`
(sanitized *rendered* HTML). No XPath/XSLT evaluation, no editing, no schema validation.

**Properties:** `src: string = ''` — URL to fetch and parse; ignored once `xml` is set. `xml?:
string` (property only) — raw XML text to parse and render; wins over `src`, and setting it parses
synchronously. `name: string = ''` — accessible label. `collapsedDepth?: number` (attribute
`collapsed-depth`) — elements at or beyond this nesting depth (root = 0) start collapsed. `copyable:
boolean = false` (reflected) — shows copy-to-clipboard affordances, one for the whole document plus
one per element. `maxHeight: string = ''` (attribute `max-height`). `anchorKinds` is a readonly
`['node-path']` (this viewer's supported `LyraAnchor.kind` values for the shared anchor-target
contract) — each numeric path segment is the 0-based index within the parent's *element* children,
and an optional trailing string segment `'@attrName'` addresses one attribute.

**Methods:** `search(query)` resolves the match count via a case-insensitive substring search over
every element's tag name, attribute names/values, and own text (empty/whitespace query behaves like
`clearSearch()`); `searchNext()`/`searchPrevious()` advance/step back through matches (wrapping);
`clearSearch()` clears the query and matches.

**Events:** `lr-copy` — `detail: { text }`. `lr-search-change` — `detail: { query, matchCount,
activeIndex }`. `lr-render-error` — `detail: { error }`, fetching or parsing failed, including a
parse error or exceeding the node cap.

**CSS parts:** `base`, `toolbar` (the whole-document copy button row, only when `copyable`),
`copy-button` (the whole-document one, or a per-node one), `tree`, `node` (`data-active` while it's
the resolved anchor target, `data-match`, `data-active-match`), `tag` (`data-match`), `attribute`,
`attribute-name`, `attribute-value` (`data-match`), `text` (`data-match`), `comment`, `cdata`, `pi`,
`toggle` (an element's expand/collapse button, hidden but present for row alignment on leaf/empty
elements), `error`, `spinner`.

**Themeable custom properties:** `--lr-xml-viewer-max-height` (default `none`).
`--lr-xml-viewer-active-match-color` (default `var(--lr-color-warning)`) — the solid outline on the
`[part='node']` holding the *current* search match, leaving every other match on its dashed
`--lr-color-warning` outline. It is an inline `var()` fallback at the point of use rather than a
`:host` declaration, so it can be set on the element *or on any ancestor*:
`::part(node)[data-active-match]` is invalid CSS — Shadow Parts forbids an attribute selector after
`::part()` — so distinguishing the active match previously meant re-pointing the shared
`--lr-color-warning` token, which recolored every other match (and every other warning surface)
along with it. Unset, it falls back to that token, so rendering is unchanged.

`[part='toggle']`'s glyph box stays compact (`1.25rem`) while its *interactive* box takes the shared
minimum target size as a floor via `--lr-icon-button-size`. That token is a floor, not a fixed size,
so lowering it never squashes the chevron below its own box — the visible glyph keeps its size while
the hit target follows the token, and it can never fall under the accessible minimum from this
component's own rules.

```html
<lr-xml-viewer .xml=${payload} collapsed-depth="2" copyable
  search=${query}
></lr-xml-viewer>
```

Node cap: 50,000 — exceeding it renders the localized `xmlViewerTooManyNodes` error instead of the
tree.

## `lr-document-compare`

Comparison surface for two document versions, using `lr-diff-view` for textual diffs and
`lr-document-preview` for side-by-side rendered content.

**Properties:** `oldVersion`, `newVersion`, `view`, `diffLayout`, `language`, `languages`, `anchor`,
`copyable`, `syncScroll`. **Events:** `lr-copy`, `lr-download`, `lr-highlight-activate`,
`lr-render-error`. **CSS parts:** `base`, `diff`, `panes`, `pane-old`, `pane-new`, `pane-header`,
`pane-empty`. **Themeable custom properties:** `--lr-document-compare-pane-max-height` (default
`var(--lr-size-24rem)`) — maximum block size of a `side-by-side` pane before it scrolls internally.

## `lr-geojson-view`

Internal document-registry bridge that fetches, validates, and renders a GeoJSON file through
`<lr-map>`'s `dataLayers` — not a documented public tag: excluded from the README/llms family
tables, present in the generated manifest since a defined custom element is technically reachable.
The document registry matches `application/geo+json` and `.geojson` filenames.

Validates the parsed JSON is a `Feature`/`FeatureCollection`/bare geometry (one of `Point`,
`LineString`, `Polygon`, `MultiPoint`, `MultiLineString`, `MultiPolygon`, `GeometryCollection`) before
rendering; anything else renders the localized `geojsonViewInvalid` error. On success, it walks every
coordinate to compute a bounding box and fits a `center`/`zoom` to it (a Web-Mercator-fit
approximation weighting latitude span ~2x, with 40% padding), then hands the parsed value to
`<lr-map>` as a single `dataLayers` entry (`sourceId: 'lr-geojson'`). When the optional
`maplibre-gl` peer isn't installed, it falls back to a status line plus a `<lr-json-viewer
collapsed-depth="2">` of the raw value instead of the map.

**Properties:** `src: string = ''` — URL to fetch and parse. `name: string = ''` — accessible label,
used as `<lr-map>`'s `label` and the root's `aria-label` (falling back to the localized
`geojsonViewLabel` when unset).

**Events:** `lr-render-error` — `detail: { error }` — fetch, parse, or shape-validation failure.

**CSS parts:** `base` (the root container), `status` (the feature-count status line, `role="status"`,
shown only in the `<lr-map>` path), `missing-library` (the missing-`maplibre-gl` callout shown
alongside the `lr-json-viewer` fallback), `error` (the error region, `role="alert"`), `spinner`
(the loading status region).

Registered by importing `geojson-view/geojson-view.js` directly — not part of the root barrel, the
same as `lr-map`/`lr-graph`, since it depends on the same optional `maplibre-gl` peer. Remote
resources are capped at 25 MB; exceeding it surfaces the localized `documentPreviewResourceTooLarge`
message instead of the map.
