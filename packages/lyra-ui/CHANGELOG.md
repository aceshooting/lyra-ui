# Changelog

## 3.9.0

### Minor Changes

- abdd967: `lyra-activity-feed` gains `renderText?: (entry: ActivityEntry) => TemplateResult`, overriding the
  default plain-text `[part="entry-text"]` rendering with arbitrary rich content — rendered markdown,
  or markdown plus a trailing tool-call chip list — identically whether or not the feed is currently
  virtualized, since both the plain and virtualized paths render every entry through the same
  internal template. Previously `ActivityEntry.text` could only ever render as plain escaped text,
  with no way to attach richer per-entry content.
- b64d4d2: `lyra-graph` gains `dimmedNodeIds`/`dimmedLinkIds` (controlled, mirroring
  `selectedNodeIds`/`selectedLinkIds`): a host can now apply a themeable low-opacity treatment to
  arbitrary nodes/links -- e.g. dimming every non-neighbor of a hovered node -- via a new
  `--lyra-graph-dimmed-opacity` custom property, in both the `svg` (default) and `canvas` renderers.
  Previously the only way to express this was reaching into the shadow DOM; `1` (no-op) by default,
  so existing usage is unaffected.
- 1d1935e: `lyra-input` gains `'search'` as a documented `LyraInputType` member. It already worked at runtime
  via unchecked passthrough to the internal native `<input type="search">` (`type` has no runtime
  validation), but the exported type union didn't include it, so a consumer setting `type="search"`
  got no compile-time confirmation it was supported and no protection against a future stricter-typed
  release silently dropping it.
- f6b4957: New `<lyra-markdown-core>` entry point: a build-lean variant of `<lyra-markdown>` for a consumer
  whose `languages` map already covers every language it renders, mirroring the existing
  `<lyra-code-block>`/`<lyra-code-block-core>` split. Its own module never imports shiki's ~200-
  language default dynamic-import table -- `<lyra-markdown>`'s existing `languagesOnly` flag can't
  give a bundler that guarantee, since it's checked at runtime, not statically provable. Every other
  capability (GFM, heading anchors, text-quote highlights, math) is unchanged from `<lyra-markdown>`;
  a fenced block whose language isn't in `languages` always renders the plain-text fallback.
- 0a5227e: `lyra-thread-list` gains `wrapRow?: (thread: ChatThread, row: TemplateResult) => TemplateResult`
  (data mode only): wraps each row's built-in `lyra-conversation-item` with host-supplied content
  that has no home in the item's own `title`/`excerpt`/`meta`/`actions` surface — most notably a
  leading purpose icon, since `lyra-conversation-item` has no default slot to receive one at all.
  Previously data mode forced an all-or-nothing choice between its built-in grouping/virtualization
  and a host's need for row content outside that surface, which only slotted mode (no grouping, no
  virtualization) could accommodate.
- d3f2e13: `lyra-usage-badge` gains `formatLatency?: (ms: number) => string`, overriding the built-in duration
  algorithm (which has no minutes/hours tier — `'{ms}ms'`, or one-decimal seconds above 1000ms) in
  both the visible strip and the tooltip row. Mirrors `lyra-activity-feed`'s `formatTimestamp`
  convention. Previously a consumer whose latencies commonly exceed a minute (e.g. a long-running
  agent run) had no way to render its own duration scale instead of a bare seconds count.

## 3.8.0

### Minor Changes

- c4cb188: Adds `<lyra-activity-feed>`: an append-only streaming log of granular agent actions, collapsing to
  a localized "Completed N steps" summary once the run is over. Implements the shared follow
  (stick-to-bottom) contract (`follow` property, `lyra-follow-change` event) and virtualizes its body
  through an internal `<lyra-virtual-list>` at/above `virtualizeThreshold` entries, using that
  component's `scrollToIndex()` method to drive its stick-to-bottom follow. `<lyra-virtual-list>`
  also gains `aria-label` forwarding from the host element onto its internal `role="list"`
  container, usable independently of `<lyra-activity-feed>`.
- 5a0276e: Adds an internal, dependency-free ANSI/SGR parser (`src/internal/ansi.ts`, not a public export) —
  shared groundwork for `lyra-terminal`'s streamed console-output rendering. No public API surface
  change on its own; ships alongside the `lyra-terminal` component in the same release.
- b92b5d4: Adds `<lyra-artifact-panel>`: a shell around one generated artifact — title/kind header, a
  preview↔code toggle (rendered only once the `code` slot has content), version navigation with a
  "Restore this version" affordance (`lyra-version-change`/`lyra-restore`, versions are host state),
  `streaming`/`aria-busy` state, and built-in copy/download actions. Renders none of the artifact
  itself — content is slotted.
- cf005b9: `lyra-attachment-trigger` gains an `'audio'` capability, following the existing `camera` capability's
  request-only pattern exactly: activating it fires `lyra-audio-request` (no embedded recorder), and the
  host opens its own capture UI — typically `<lyra-push-to-talk>` in a `<lyra-overlay>`/popover — then
  hands the resulting blob to its attachment tray. Purely additive: the default `capabilities` stays
  `['files']`, and every existing `files`/`image`/`camera` behavior is unchanged.
- b85934b: Adds `<lyra-audio-visualizer>`: a presentational, canvas-drawn voice-activity visualization (bars or
  waveform), driven by a `MediaStream` (lazily wired to a WebAudio analyser), a numeric `level`, or a
  `state` (`idle`/`listening`/`thinking`/`speaking`) alone for an ambient animation. Pairs with
  `lyra-push-to-talk`'s `stream`/`lyra-level` output. Zero dependencies — native Web Audio only,
  reduced-motion-aware.
- 3310f16: Adds `<lyra-av-player>`: an audio/video player built on a native media element with a cue transcript
  synced to playback, `time-range` anchor/highlight support, an optional dependency-free waveform
  (peaks-in, no in-component decoding), playback-rate control, and imperative transcript search.
  Self-registers into the document-viewer registry for the common audio/video MIME types. Owns
  recorded-media transcript sync — distinct from `lyra-transcript-feed` (live voice-session captions)
  and from `lyra-playback` (an index stepper, no media).
- 0fe240b: Adds `<lyra-branch-picker>`: a controlled "‹ 2 / 5 ›" navigator across regenerated/edited variants of
  one chat message, mirroring `lyra-pagination`'s "never mutates its own state" contract. Fires
  `lyra-branch-change` with the requested (always in-bounds) index; the host swaps the displayed branch
  content and applies the new index back. Designed to slot into `lyra-message-actions`' default slot or
  directly into `lyra-chat-message`'s `actions`/`badges` slots.
- bc75a1f: Adds `<lyra-browser-frame>`: a presentational "agent computer" viewport — a safe-URL-gated
  screenshot/frame stream `<img>` (or slotted live media), read-only address bar, visible (never
  color-only) connection status, kind-distinct action-ping overlays, and take-over/stop affordances
  (`lyra-take-over`, `lyra-stop`). No automation transport and no input relay — take-over is an event;
  the host swaps in its own interactive element.
- e29f575: `lyra-button` and `lyra-input` gain `size="2xs"`, a sub-`xs` tier for dense, toolbar-embedded controls
  (e.g. a search input and text buttons inside a compact dialog header). Composes with `appearance`/
  `variant` the same way the existing five sizes already do.
- e4762fd: `lyra-button` gains `appearance="quiet"`: a bordered, transparent-until-hover tier for a toolbar-style
  icon+label action whose border/text read fixed `--lyra-color-border`/`--lyra-color-text-quiet` tokens
  regardless of `variant`, unlike `appearance="outlined"`'s variant-tinted text — for a call site that
  needs a genuinely muted resting state rather than a bold bordered button. New
  `--lyra-button-quiet-border`/`--lyra-button-quiet-text` custom properties back the two tokens.
- 4ac983b: `lyra-chat-message` gains `actionsOutsideBubble` (reflects to `actions-outside-bubble`): renders the
  `actions` slot's content as a sibling immediately after the message bubble instead of nested inside its
  footer's own padding/background box. Previously a consumer whose action row (e.g. a hover-reveal copy
  button) had to sit visually outside the bubble's chrome could not adopt this component at all, since
  `::part(footer)` styling alone cannot detach it from the bubble's box.
- 65a1f8c: Adds `<lyra-chat-viewport>`: the transcript scroll container for a chat/agent conversation surface —
  owns the stick-to-bottom `follow` state machine (`follow` property, `lyra-follow-change` event,
  matching the same shared follow contract `<lyra-activity-feed>` already implements) while an answer
  streams, a built-in "jump to latest" pill with a pluralized unread count, and an unread divider. Two
  content shapes are auto-detected: ordinary element children (slotted mode) or exactly one
  `lyra-virtual-list` (virtual mode, built on that component's `scrollToIndex()` method). Renders no
  messages and computes no unread state itself — the host supplies `unreadStartIndex` and slots its
  own message elements or a virtual list.
- bf601c8: Adds `<lyra-checkpoint>`: an inline conversation restore point — a labeled marker between messages
  whose Restore affordance confirms inline (an accessible-name-carrying button swap, focus-managed,
  Escape/focus-out-aware) before firing a `lyra-restore { checkpointId, label }` event. Persists and
  restores nothing itself — host state in, events out. `confirmRestore="false"` skips the inline
  confirm step entirely; `restorable="false"` renders a plain, non-interactive marker for read-only
  views or the currently-restored point.
- 22c1006: Adds `<lyra-chunk-inspector>`: a ranked retrieved-chunks "why this answer" panel — relevance score
  bars with tier-mapped tones, expandable chunk text (state keyed by chunk id, survives streaming
  reassignment), and `lyra-chunk-open` for landing a chunk in `lyra-document-viewer` with its anchor.
  Virtualizes automatically above `virtualizeAt` rows via the existing `lyra-virtual-list`.
- c274bd6: `lyra-code-block` and `lyra-code-block-core` gain `highlight-lines` (declarative `"3-5,7"`-style
  line emphasis), `interactive-lines` (turns the line-number gutter into a keyboard-navigable,
  clickable roving-tabindex group emitting `lyra-line-click`), and `line-range` anchor-target support
  (`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lyra-text-select`) — identical on
  both components since they share the new line-addressing logic. Previously there was no way to
  emphasize or deep-link to a specific line/range of lines in a rendered code block.
- f71fcac: Adds `<lyra-commit-card>`: a compact commit summary card — abbreviated/copyable hash, subject/body
  message split, author/time meta, a non-color-only aggregate `+N -M` diffstat, and a collapsible
  per-file change list (`lyra-file-select` on activation) reusing `lyra-file-tree`'s `GitStatus`
  vocabulary and shared `gitStatus*` labels.
- 22c1006: Adds `<lyra-community-card>`: a GraphRAG community-report card — label, summary excerpt, member
  count, member chips with a "+N" overflow chip, and a drill-in action (`lyra-drill`) surfaced from
  the header, an explicit drill button, and the overflow chip alike. A `compact` mode renders just
  title + member count + drill button for dense listings (e.g. inside `lyra-provenance-panel`).
- 1432601: Add `lyra-compare-panel`: side-by-side A/B output comparison with a winner vote (LMSYS-arena /
  LangSmith-pairwise style) — two slotted panes (`a`/`b`), an optional shared `prompt` header, a
  `role="group"` vote bar (better-A / better-B / tie / both-bad, the last two individually
  hideable), and optional proportional `syncScroll` between panes. No hotkeys (slotted content may
  contain inputs); casting a vote announces through an internal live region.
- bc75a1f: Adds `<lyra-confirm-bar>`: an inline, non-modal approve/deny block for one proposed action — the
  in-flow sibling of `lyra-tool-approval-dialog` for confirmations that belong in the transcript instead
  of an overlay. Same `lyra-approve`/`lyra-deny` event shapes and the same heading/args-label/deny/approve
  localization keys as the dialog, so the two stay in lockstep. No focus trap, scroll lock, or
  Escape/backdrop handling; on activation, focus moves synchronously to the always-present decided-state
  text before the Deny/Approve buttons unmount, and an internal live region announces the outcome.
- 23bfb7b: `lyra-conversation-item` gains a `meta` slot (small, non-focusable structured fields below the
  title/excerpt — e.g. a day label, project name, cost) and an `excerpt` slot that wins over the
  existing `excerpt` property whenever it has assigned content, mirroring `lyra-timeline-item`'s own
  `timestamp` slot-wins-over-property pattern. Previously a consumer needing a rich excerpt (e.g. a
  search-hit snippet with `<mark>` highlighting) or a multi-field meta line had to flatten that
  structure into the plain-text `excerpt` property or hand-roll the row entirely.
- 2ad038b: `lyra-dataset-viewer` now virtualizes through `lyra-virtual-list` (a new `item-role="row"` mode,
  mapping to a proper `role="table"`/`role="row"`/`role="rowgroup"` accessibility tree) instead of a
  single synchronous `<table>`, lifting its row cap from 1,000 to the shared 10,000-row default every
  other tabular viewer already uses. It also gains `cell-range` anchor-target support (`highlights`,
  `activeHighlightId`, `scrollToAnchor()`, event `lyra-highlight-activate`) and an imperative
  in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
  `lyra-search-change`), sharing the same raw-grid cell addressing as `lyra-csv-viewer`, with the
  header row always included since this viewer always parses with PapaParse's `header: true`. The
  `lyra:dataset` document-viewer registration now declares `capabilities: { anchors: ['cell-range'],
search: true, textSelect: false }`. `lyra-virtual-list` itself gains the underlying
  `item-role`/`row-index-offset` properties this required, additive and defaulting to today's exact
  `listitem` behavior for every other consumer. Previously a 1,001+ row dataset file failed to load at
  all, and there was no way to highlight or search a cell.
- 2ad038b: `lyra-diff-view` gains `layout="split"` (two side-by-side columns derived from the same line-diff
  alignment as the default unified view — unbalanced replace hunks pad the shorter side with empty
  placeholder rows) and optional syntax highlighting via `language`/`languages` (same fine-grained
  shiki-core-only shape as `lyra-code-block-core`, so the peer-free default stays truly peer-free).
  Previously diff-view only rendered a single interleaved unified view with no highlighting option.
- dc168c7: `lyra-docx-viewer` gains `getHeadingTree()` (a document-ordered heading outline stamped with
  GitHub-slugger-style ids, using the same slugging algorithm as `lyra-markdown`), `fragment`/
  `text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
  `lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result`), and an imperative in-document
  search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
  `lyra-search-change`). Previously there was no way to deep-link into a section, highlight a quoted
  passage, or search inside a rendered Word document.
- d3edf31: `lyra-ebook-viewer` gains `getToc()` (a flat, nested table of contents from the EPUB's own
  navigation document), a `location` property (get/set the current CFI or spine href, with
  `lyra-location-change` on user navigation), an imperative in-book search API (`search()`,
  `searchNext()`, `searchPrevious()`, `clearSearch()`, event `lyra-search-change`), and `cfi`/
  `text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
  `lyra-highlight-activate`/`lyra-text-select`). Previously there was no way to read an EPUB's table
  of contents, deep-link into a specific location, or search inside a rendered book.
- 2ad038b: `lyra-email-viewer` attachments become interactive: each row is now a real button emitting
  `lyra-attachment-open { attachment: { filename, mimeType, content } }` with the attachment's decoded
  bytes attached (the component itself never opens/downloads anything — host-owned routing, e.g. into
  `lyra-document-viewer`). A new `fold-quotes` property collapses trailing quoted-reply text/HTML
  (`>`-prefixed text runs, `gmail_quote`/`yahoo_quoted`/Outlook-style HTML blocks) behind a localized
  toggle. Previously attachments were inert metadata with no way to retrieve their content, and quoted
  reply chains always rendered in full.
- ba094cb: Adds `<lyra-emoji-picker>`: a searchable, keyboard-navigable, form-associated emoji picker
  (`value`/`lyra-change`, matching this library's other form-control conventions). `groups` is fully
  consumer-suppliable — this component ships no emoji data of its own — with an optional convenience
  auto-loader for a default set via the `emoji-picker-element-data` peer when `groups` is left unset.
  Lets a consumer currently wrapping the third-party `emoji-picker-element` custom element (plus its
  locale-data package) as a direct dependency replace it with a first-party `lyra-*` component instead.
- 22c1006: Adds `<lyra-entity-card>`: a dossier card for one knowledge-graph entity (`LyraEntity`) — type
  badge, description, key/value property rows, relationship-degree and community rows, and a
  built-in "focus in graph" action that emits `lyra-entity-activate` for a host to route into
  `lyra-graph`'s `focusNode()`.
- 22c1006: Adds `<lyra-entity-chip>`: an inline `@entity` mention for agent prose with a hover/focus preview
  popover, reusing `lyra-citation-badge`'s interaction contract wholesale (200ms hover-leave grace,
  independent hover/focus hold-open state, Escape dismissal, Space opens/Enter activates). The
  knowledge-graph sibling of `lyra-citation-badge` — renders its `label` text rather than a `[n]`
  index, and reflects `type` for host-level per-type theming.
- 2ab49e6: Adds `<lyra-env-list>`: a masked key/value list for environment variables and secrets
  (`<dl>`/`<dt>`/`<dd>` semantics), defaulting every entry to masked (a fixed eight-bullet run,
  length-independent so value length is never leaked) with per-row reveal (`lyra-reveal-change`, state
  keyed by name and position, and reset for a row whose name shifts position) and copy (`lyra-copy`,
  always copies the real value). `revealable=false` for screen-share-safe hosts. Masking is
  presentational, not a security boundary.
- 892c9d3: Adds `<lyra-file-tree>`: a file-explorer preset over `lyra-tree` + `lyra-file-icon` with path-keyed
  nodes, per-file git-status badges and `+N -M` diffstat, lazy directory loading (`setChildren()`,
  `lyra-load-children`), `revealPath()`, and `lyra-file-select`/`lyra-file-open` events (matching the
  "Enter/click on an already-selected file opens it" keyboard parity rule).
- 22c1006: Adds `<lyra-flow-canvas>`: a dependency-free, pannable/zoomable DAG workflow canvas — HTML card
  nodes with typed connection handles, SVG Bézier edges with arrowheads and labels, a shared layered
  auto-layout for unpositioned nodes, and controlled selection/drag/connect gestures behind three
  independent opt-in flags (`nodes-draggable`, `connectable`, `droppable`). Readonly viewer by default;
  never mutates `nodes`/`edges` itself. Ships a `registerCompanion()` hook so `lyra-flow-minimap`,
  `lyra-flow-controls`, and `lyra-flow-run-overlay` (following in subsequent releases) can attach
  without reaching into its shadow DOM.
- 22c1006: Adds `<lyra-flow-controls>`: the zoom in/out, fit, and interaction-lock button cluster for
  `lyra-flow-canvas`, so every flow surface ships the same affordances without hosts rebuilding them.
  Zoom buttons disable at the resolved canvas's `minZoom`/`maxZoom` bounds; the lock toggle stays in
  sync with the canvas's `locked` attribute regardless of what changed it.
- 22c1006: Adds `<lyra-flow-minimap>`: a corner overview map for `lyra-flow-canvas` — scaled node rectangles
  (status-tinted) plus a draggable, keyboard-operable viewport rectangle for orientation and fast
  navigation on canvases larger than the screen. Attaches via `registerCompanion()`, either slotted
  into one of the canvas's corner slots or externally via `for="canvas-id"`.
- 22c1006: Adds `<lyra-flow-node>`: the workflow node card — header/body/toolbar chrome, tool-lifecycle status
  tones with a visible (never color-only) status chip, a determinate progress bar, and named
  connection-handle elements. Used automatically by `lyra-flow-canvas` as the default card for any
  node without a slotted override, and usable standalone for palette previews or docs.
- 22c1006: Adds `<lyra-flow-run-overlay>`: execution-state presentation for `lyra-flow-canvas` — mirrors a
  `FlowRunDecorations` map into the resolved canvas (which owns the actual node/edge paint) and
  renders a compact "{done} of {total} steps complete" summary strip with per-status counts.
  Status transitions announce through a throttled live region. Pure pushed state — no execution,
  polling, or internal clock.
- 2ad038b: Adds an internal `application/geo+json` document-viewer registry bridge (`<lyra-geojson-view>`,
  `.geojson` filename matching included): fetches and validates a GeoJSON `Feature`/`FeatureCollection`/
  bare-geometry payload, computes a bounding-box fit, and renders it through `lyra-map`'s new
  `dataLayers` property with a feature-count status line. Falls back to `lyra-json-viewer` with a
  missing-library callout when the optional `maplibre-gl` peer isn't installed. Not a documented public
  tag this round — importing `geojson-view/geojson-view.js` opts a host into the bridge, matching how
  `lyra-map`/`lyra-graph`/the chart family already stay out of the root barrel import.
- ca9258f: `lyra-graph` gains `renderer: 'svg' | 'canvas'` (default `'svg'`, unchanged). `'canvas'` swaps the
  per-node/per-link SVG DOM for a single DPR-aware `<canvas>` (reusing `lyra-heatmap`'s proven backing-
  store/resize/DPR-watch machinery), targeting roughly 5,000 nodes / 10,000 links versus SVG's ~500/
  ~1,500 ceiling. Hit-testing uses an offscreen color-picking canvas (exact hits for all three node
  shapes, stroked/dashed links, and hull blobs, one code path, zero new dependencies); pointer drag,
  click, double-click-to-expand, and hover tooltips all work via that same hit-test. Keyboard/screen-
  reader parity is preserved through an offscreen virtual-cursor button list driving the identical
  roving/announcement logic as SVG mode — the honest v1 trade-off is no `::part(node)`/`::part(link)`
  styling (pixels, not elements) and a drawn focus ring instead of a CSS one, both documented. Fully
  additive — the default `renderer: 'svg'` reproduces today's DOM exactly.
- c6ab7c8: `lyra-graph` gains `GraphNode.communityId` and a `communities` property, rendering one translucent
  convex-hull blob per entry (membership = union of `memberIds` and matching `communityId`) behind
  links/nodes. Hulls are keyboard/click-activatable (`lyra-community-click`), join the roving focus
  ring after nodes and links, and are included in `fit()`'s bounding-box calculation. Fully additive
  — an empty `communities` array (the default) renders no hulls and leaves the roving ring/`fit()`
  behavior unchanged.
- c996af0: `lyra-graph` gains `showEdgeLabels` (default `false`) to draw each link's `label` as visible SVG
  text at the segment midpoint, and `edgeLabelMinZoom` (default `0.6`) to hide all edge labels below
  that zoom scale. A per-label length gate also hides a label whose measured text width exceeds 85%
  of its edge's current on-screen length. Labels are `aria-hidden` (the accessible name already
  carries `label` via the existing link announcement) and fully opt-in — a graph that never sets
  `showEdgeLabels` renders no edge-label DOM at all.
- 7f7511a: `lyra-graph` gains a double-activate expand gesture: double-clicking a node, or activating the same
  focused node twice via Enter/Space within 500ms, emits `lyra-node-expand { id }`. A new
  `GraphNode.expandable` flag renders a "+" badge and adds "expandable" to the node's spoken text. A
  node newly linked to an already-positioned neighbor (e.g. appended after an expand) now spawns near
  that neighbor instead of a random position. Fully additive — no existing click/keyboard behavior
  changes, and a graph that never sets `expandable` never renders the badge (though the
  `lyra-node-expand` event itself fires for any double-activated node, matching native
  dblclick semantics).
- 5d77b48: `lyra-graph` gains a programmatic camera (`focusNode(id, { zoom? })`, `fit({ padding? })`, both
  reduced-motion-aware rAF tweens that keep d3-zoom's own state consistent), a declarative
  `focusId` twin (centers once, renders a persistent `focus-halo` ring), and a controlled selection
  model (`selectionMode: 'none' | 'single' | 'multiple'`, `selectedNodeIds`/`selectedLinkIds`,
  `lyra-selection-change`) mirroring `lyra-heatmap.selectedCell`'s controlled contract — the
  component only ever emits intent, never assigns the selection props itself. Fully additive: default
  `selectionMode: 'none'` and unset `focusId` reproduce today's behavior exactly.
- 844fe95: `lyra-graph` gains `lyra-node-enter`/`lyra-node-leave`/`lyra-link-enter`/`lyra-link-leave` hover
  events (mirroring the existing `lyra-node-click`/`lyra-link-click` detail shapes) plus a `data-hovered`
  attribute toggled on the hovered node/link element for pure-CSS theming. Both are suppressed while a
  drag or pan gesture is in progress, so a drag crossing over other nodes/links doesn't spam
  enter/leave pairs. Previously a consumer computing an adjacency-based neighbor highlight on hover
  (e.g. dimming every unconnected node/link) had no way to observe which node/link was currently
  hovered from outside the component.
- f8d6b9e: `lyra-graph` gains `layout: 'force' | 'layered'` (default `'force'`, unchanged). `'layered'`
  computes a deterministic Sugiyama-lite layout instead of running d3-force — longest-path layering,
  barycenter crossing reduction, cycle-safe (back edges reversed internally, the caller's data is
  never mutated). The algorithm itself lives in a new shared, dependency-free
  `src/internal/layered-layout.ts`, a standalone util suitable for any future layered-diagram
  consumer. Node drag is disabled in layered mode; pan/zoom, keyboard, focus/fit, hulls, edge labels,
  and type filtering all work identically to force mode. Fully additive — the default `layout:
'force'` reproduces today's simulation-driven layout exactly.
- 22c1006: Adds `<lyra-graph-legend>`: a node-type legend for a paired `lyra-graph`, rendering one swatch +
  label + count row per §3.4 node type and doubling as a visibility filter. Event-decoupled from any
  graph instance — a host forwards `graph.nodeTypes` in as `types` and forwards
  `lyra-visibility-change`'s `hiddenTypes` back out to `graph.hiddenTypes`.
- 942798e: `lyra-graph` gains `GraphNode.type` and a new `nodeTypes` property declaring each type's legend
  label, fill color, and shape (`circle`/`square`/`diamond`). Fill resolution precedence is
  `node.color` > the type's own color > an ordered categorical fallback palette
  (`--lyra-graph-cat-1`…`--lyra-graph-cat-8`, new tokens) by the type's index in `nodeTypes` > the
  existing untyped default. Typed nodes also gain richer spoken text ("{label} ({type})"). Fully
  additive — a graph with no `type`/`nodeTypes` set renders identical circles, unchanged.
- 32f7b12: `lyra-graph` gains `hiddenTypes: string[]`, hiding every node whose `type` is listed (plus incident
  links) from rendering, the simulation, the keyboard roving ring, and the accessible data list/
  counts. Positions round-trip via a new remembered-position cache, so toggling a type off and back
  on restores each node where it was instead of re-randomizing. Fully additive — an empty
  `hiddenTypes` (the default) renders every node/link exactly as before.
- e022166: Adds `<lyra-handoff-divider>`: a labeled semantic separator marking control transfer between agents
  in a transcript (e.g. "Transferred to Research Agent"), with an optional `avatar` slot. Root is
  `role="separator"` named by the computed label; the label is announced once on first connect
  through an internal live region, since a handoff lands mid-stream and later property changes never
  re-announce.
- 4cddc07: Adds `<lyra-highlight-layer>`: a presentational overlay that paints highlight rectangles
  (percent-of-box coordinates) over positioned content — a pdf page, an image, any relatively-positioned
  frame. Roving-tabindex keyboard access (ArrowUp/Down/Left/Right honoring RTL, Home/End, Enter/Space),
  `aria-current` on the active rect, a one-shot `flash()` emphasis pulse with a reduced-motion static
  fallback, and token-mapped tones. Zero dependencies. `lyra-pdf-viewer` adopts it next for per-page
  highlight painting.
- 4c707de: Adds `<lyra-image-viewer>`: a full pan/zoom raster-image viewer with labeled region highlights and
  opt-in region annotation (pointer-drag or keyboard), self-registering into the document-viewer
  registry for `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/avif`, and `image/bmp`.
  Distinct from `<lyra-svg-viewer>` (vector documents) and `<lyra-image-comparer>` (before/after
  comparison) — this is the landing surface for `region`-anchored citations (bounding-box grounding).
- 2ad038b: `lyra-json-viewer` gains an imperative search API (`runSearch()`, `searchNext()`,
  `searchPrevious()`, `clearSearch()`, event `lyra-search-change`) as a thin layer over its existing
  declarative `search` property -- the property, its highlighting, and its force-expand behavior are
  unchanged; the new methods add match-count resolution and a navigable cursor (`data-active` on the
  current match) on top. The count-resolving entry point is named `runSearch()` rather than `search()`
  (unlike this same quartet on other viewers) because `search` is already this component's own public
  string property -- a method can't share its name. Previously there was no way to count matches or
  step between them programmatically.
- ac19eb0: `lyra-lite-chart` gains a `legendText?: (label: string, datasetIndex: number) => string` hook,
  appending formatter-supplied text (e.g. a value or percentage share) after each series' label in the
  built-in legend row — mirrors the existing `pointText`/`tickFormat` opt-in-hook convention. Previously
  a consumer needing per-series legend text beyond the bare label had to hand-roll an entire replacement
  legend instead of using the built-in `legend` prop.
- c721d97: `lyra-map` gains a `dataLayers: GeoJsonDataLayer[]` property: each entry adds a GeoJSON source plus
  fill/line/circle layers (colored from `--lyra-*` tokens by an optional `tone`), independent of the
  existing `choropleth` prop (which requires `field`/`stops` and can't display plain geometry). Defaults
  to an empty array — zero behavior change for existing `lyra-map` users. This is the enabler for the
  upcoming GeoJSON-file document-viewer bridge, and is useful standalone for rendering arbitrary
  GeoJSON shapes (routes, zones, points of interest) without hand-building maplibre-gl layers.
- 92955fc: `lyra-markdown` gains `heading-anchors` (stamps computed GitHub-slugger-style ids on headings),
  `getHeadingTree()` (a document-ordered heading outline, computed regardless of `heading-anchors`),
  `fragment`/`text-quote` anchor-target support (`highlights`, `activeHighlightId`, `anchor`,
  `scrollToAnchor()`, events `lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result`), and
  `math` (renders `$...$`/`$$...$$` TeX as MathML via the optional `katex` peer, falling back to
  literal source text when the peer isn't installed). Previously there was no way to deep-link into a
  section, highlight a quoted passage, or render math in rendered Markdown content.
- 3492739: `lyra-markdown` gains real shiki syntax highlighting for fenced code blocks, reusing
  `<lyra-code-block>`'s own optional `shiki` peer and grammar-loading machinery directly (not by
  embedding `<lyra-code-block>` itself, which would have hit DOMPurify's default custom-element
  blocklist and re-mounted — losing state and re-triggering async loads — on every streaming chunk).
  On by default whenever the `shiki` peer is installed (set `highlightCode="false"` to opt out); new
  `languages`/`languagesOnly` properties mirror `<lyra-code-block>`'s own fine-grained bundle-size
  controls. Highlighting is skipped entirely while `streaming` is `true` and applied once a stream
  settles, so there is no added per-chunk cost while content is still arriving.
- e5df5af: Adds `<lyra-message-actions>`: the per-message action toolbar for `lyra-chat-message`'s `actions` slot
  — opt-in built-ins (`copy` / `regenerate` / `edit` / `feedback`, in `controls`-array order) that emit
  intent events (`lyra-regenerate`, `lyra-edit`, plus bubbled `lyra-copy`/`lyra-change`/`lyra-submit`
  from the embedded copy button and thumbs-only feedback), and a default slot for custom controls (e.g.
  a slotted `lyra-branch-picker`) that participate in the toolbar's ArrowLeft/ArrowRight/Home/End
  navigation. Optional `reveal-on-hover` hides the bar until the enclosing `lyra-chat-message` is
  hovered or a control inside has focus.
- 9544450: Add `lyra-message-feedback`: thumbs up/down for one assistant message, with an optional inline
  detail step (multi-select reason chips + a free-text comment) that opens as a disclosure directly
  below the thumbs rather than a floating overlay. Fires `lyra-change` on every rating toggle and
  `lyra-submit` (`{ value, reasonIds, comment }`) from the panel's submit button; stores nothing
  itself — a host persists the rating and may reflect a previously-recorded one back via `value` +
  `disabled`. Re-activating the pressed thumb clears the rating unless its own detail panel is open,
  in which case that click re-opens the panel with any surviving draft instead.
- 22c1006: Adds `<lyra-mind-map>`: a radial expandable topic tree (NotebookLM-style Mind Maps) — zero-dependency
  SVG, closed-form arc-subdivision layout in its own `mind-map-layout.ts` module, single-tab-stop
  keyboard roving (mirroring `lyra-word-cloud`), and `lyra-topic-select`/`lyra-topic-toggle` events.
  Multiple root topics hang off an implicit center hub; expansion state is keyed by topic id and
  survives streaming `topics` reassignment.
- 2ad038b: Recorded decision: `.msg` (Outlook) files are not supported this round. `.msg` is OLE/CFB binary per
  MS-OXMSG; the available npm parser (`@kenjiuno/msgreader` plus its `decompressrtf` companion) is
  below this library's maintenance bar for an optional peer. `.msg` files continue to resolve to
  `<lyra-document-preview>`'s generic download fallback, exactly like any other unregistered format —
  convert to `.eml` server-side to use `<lyra-email-viewer>` instead. No API change; this changeset
  exists to document the decision, guarded by a permanent regression test.
- 22c1006: Adds `<lyra-neighbor-list>`: one entity's relationship rows (relation, direction, neighbor) with
  per-row navigate (`lyra-entity-activate`) and expand-in-graph (`lyra-node-expand`, matching
  `lyra-graph`'s own event name/detail) affordances, optional relation grouping, and automatic
  `lyra-virtual-list` virtualization above `virtualizeAt` rows.
- 22c1006: Adds `<lyra-node-palette>`: a searchable, categorized node library for workflow editors — drag an
  item onto a `droppable` `lyra-flow-canvas`, or place it by keyboard (`lyra-palette-place`/
  `lyra-select`). Fully decoupled from the canvas itself, agreeing only on the exported
  `FLOW_PALETTE_MIME_TYPE` drag-payload constant.
- a0e579a: Adds `<lyra-notebook-viewer>`: a read-only Jupyter notebook (nbformat 4.x) renderer that parses
  `.ipynb` JSON natively and composes `lyra-markdown`/`lyra-code-block`/`lyra-json-viewer` per cell,
  with `node-path`/`fragment` cell anchors and imperative search over cell sources and text outputs.
  Self-registers into the document-viewer registry for `application/x-ipynb+json`. Execution, kernels,
  and ipywidgets are out of scope; stream/error outputs render as plain preformatted text this round.
- 15062d0: Adds `<lyra-page-rail>`: a virtualized vertical thumbnail rail for page-addressed documents, with
  per-page highlight heat markers. Wired mode (`viewer`/`for`) tracks page/count from a
  `PageThumbnailSource`-shaped viewer's own `lyra-load`/`lyra-page-change` events and lazily renders
  thumbnails as rows materialize (`lyra-pdf-viewer` satisfies this structurally); mediated mode
  (`page-count`/`page`) works as a fully functional pager without a wired viewer. Roving-tabindex
  keyboard access via `lyra-virtual-list`, typed-digit page jump, `lyra-page-select` event.
- 22c1006: Adds `<lyra-path-strip>`: a compact, horizontally scrollable node -> relation -> node chain
  rendering a GraphRAG reasoning path, with one roving tab stop across every element (nodes and
  relations alike), logical (RTL-mirroring) directed-edge arrows, and `lyra-entity-activate`/
  `lyra-relation-activate` events.
- 75c17bd: `lyra-pdf-viewer` becomes the reference `DocumentAnchorTarget` implementation: resolves `page`,
  `text-quote`, and `region` anchors (`scrollToAnchor()`), paints highlights per page via
  `lyra-highlight-layer`, exposes `getPageText(page)` and `renderPageThumbnail(page, canvas, options?)`
  for rail/search/chunking consumers, and emits `lyra-load { pageCount }`,
  `lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result`. The `application/pdf` document-
  viewer registration now declares its anchor/text-select capabilities and forwards `anchor`/
  `highlights`. All additive — existing `src`/`page`/`zoom`/`nextPage()`/`previousPage()`/`zoomIn()`/
  `zoomOut()` and their events are unchanged.
- 1879c40: `lyra-pdf-viewer` gains an imperative in-document search API (`search()`, `searchNext()`,
  `searchPrevious()`, `clearSearch()`, event `lyra-search-change`), a public `goToPage(page):
Promise<boolean>` method, and `getOutline(): Promise<PdfOutlineItem[]>` for reading a PDF's table of
  contents. Search matches paint as `<mark part="search-match">` (`search-match-active` for the
  current one) without touching any highlight state. The `application/pdf` document-viewer
  registration now declares `search: true` in its capabilities. Previously there was no way to search
  inside a rendered PDF, jump to a page programmatically, or read its outline.
- 22c1006: Adds `<lyra-provenance-panel>`: the grounding breakdown for one answer — a four-section disclosure
  panel (Entities / Relationships / Communities / Text chunks) composing `lyra-entity-chip`,
  `lyra-path-strip`, compact `lyra-community-card`s, and a compact `lyra-chunk-inspector`. Every child
  event bubbles straight through unmodified; its own `lyra-toggle` event tracks per-section
  expand/collapse state, which survives streaming `provenance` reassignment.
- 2d15c51: Adds `<lyra-push-to-talk>`: a mic capture button owning the full `getUserMedia`/`MediaRecorder`
  lifecycle — permission request, hold or toggle recording, optional chunked streaming
  (`lyra-record-chunk`) for streaming STT, an opt-in RMS level meter (`lyra-level`), a `max-duration-ms`
  auto-stop guard, and `lyra-record-start`/`lyra-record-stop`/`lyra-record-cancel`/`lyra-record-error`
  events. No SDK dependency — native browser APIs only. Previously lyra-ui had no voice-capture
  component at all; every agentic voice UI had to hand-roll this lifecycle from scratch.
- 3a2f6d2: Add `lyra-rubric-form`: a configurable annotation rubric (LangSmith annotation-queue style) —
  score, category, and freeform-comment keys with a submit-and-next flow for working through an eval
  queue. Follows `lyra-tool-param-form`'s exact `ElementInternals`-attached-directly, JSON-serialized
  form-value pattern; a `score` key renders `lyra-segmented` (≤10 integer steps) or `lyra-slider`,
  `category` renders `lyra-select` or `lyra-checkbox-group` (`multiple`), and `comment` renders
  `lyra-textarea`.
- c388b94: Add themeable static edge fades and native horizontal scrolling to overflowing `lyra-segmented` and
  `lyra-tabs` rows.
- de5b8b7: Adds `<lyra-sequence-strip>`: a compact, one-thin-cell-per-item strip visualizing a sequence of
  categorical states with an optional secondary per-cell marker (e.g. a CI build-step strip, a
  log-severity strip, or — the motivating case — a per-turn conversation-history strip). Pure CSS/flex,
  zero dependencies, `role="img"` with an auto-generated per-category "label: count" `aria-label`
  summary (matching `lyra-sparkline`'s accessibility model), plus a pointer-hover tooltip showing each
  item's own label.
- 22c1006: Adds `<lyra-source-picker>`: a checkbox tree/list scoping which sources ground the next answer —
  tri-state folders, select-all, `lyra-file-icon` type icons, and built-in search that keeps matching
  descendants' ancestors visible. Deliberately not `FormAssociated` (a scoping panel, not a form
  control, mirroring `lyra-tool-select-dialog`'s stance) and renders its own `role="tree"` rather than
  composing `lyra-tree`, since `TreeItem` has no tri-state checkbox model.
- 685eb35: Add `lyra-span-waterfall`: the horizontal-timeline projection of the same `LyraSpan[]`
  `lyra-trace-tree` consumes — a time axis, one row per span in start order, and status-toned,
  keyboard-navigable bars (Langfuse timeline / Temporal event-history style). Declarative
  `viewStartMs`/`viewEndMs` window props (composable with `lyra-time-range` as a brush) stand in for
  zoom/pan gestures this round. Both components emit the same `lyra-span-select { id }` and accept
  the same `activeSpanId`, so a host syncs selection between them with two listeners and one property
  binding.
- 2ad038b: `lyra-spreadsheet-viewer` and `lyra-csv-viewer` gain `cell-range` anchor-target support
  (`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lyra-highlight-activate`) and an
  imperative in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`,
  event `lyra-search-change`) — identical on both viewers, addressing cells by the same 1-based raw
  grid (header row included) an A1 reference already implies. Spreadsheet's search/anchor resolution
  additionally spans every sheet, switching `lyra-tabs` as needed. Both registry entries now declare
  `capabilities: { anchors: ['cell-range'], search: true, textSelect: false }`. Previously there was
  no way to highlight or search a specific cell/range in a rendered spreadsheet or CSV file.
- 761ab24: Adds `<lyra-stack-trace>`: parses V8/JS-TS, Firefox/Safari, and Python stack traces (including
  chained-error groups) into a message plus collapsible, activatable frames (`lyra-frame-select`),
  folding internal frames (`node_modules/`, `node:internal`, `site-packages/`, ...) behind a
  count-labeled toggle. Falls back to verbatim raw text when nothing parses.
- b33bb35: Adds `<lyra-suggestion-chips>`: starter prompts (empty thread) and follow-up suggestions (after a
  response) as a horizontally scrollable chip row (or a wrapping grid via `wrap`), each with an optional
  secondary detail line. Fires `lyra-suggestion-select` (`{ id, label }`) on activation — never writes
  into a composer or sends anything itself. Keyed `repeat()` on `id` preserves focus across a mid-stream
  suggestions replacement.
- 2ad038b: `lyra-svg-viewer` and `lyra-document-preview` (its image-format path) gain an opt-in `zoomable`
  property that wraps the rendered content in an internal `lyra-zoomable-frame` for pan/zoom
  inspection, plus display-only `region` anchor-target support (`highlights`, `activeHighlightId`,
  `scrollToAnchor()`, event `lyra-highlight-activate`) for percent-unit bounding-box highlights that
  scale with the zoom level. `zoomable` defaults to `false` on both, so an inline thumbnail (e.g. in a
  chat stream) doesn't unexpectedly grow a focusable zoom-chrome viewport. Previously neither viewer
  had any pan/zoom or region-highlighting capability.
- 1e051a4: `lyra-swatch-picker` options gain an optional `icon` field (`SwatchOption.icon`, mirroring
  `lyra-segmented`'s `SegmentedItem.icon`): a consumer-supplied shape (e.g. a brand glyph) rendered in
  place of the plain filled circle, exposed as `::part(swatch-icon)`. A `currentColor`-based SVG picks up
  the option's `color` automatically through the swatch's `color` custom property, so consumers who
  previously hand-rolled a row of colored icon buttons (rather than plain color circles) can now use the
  picker directly.

  The selected swatch also gains two new opt-in, off-by-default custom properties for a more emphatic
  selected state: `--lyra-swatch-picker-selected-blur` (0 by default, a crisp ring; set a real length for
  a soft glow tinted by the swatch's own color -- works for both a plain color circle and an icon swatch,
  via a `box-shadow`/`drop-shadow` split so the glow follows the icon's actual silhouette rather than an
  invisible transparent box) and `--lyra-swatch-picker-shine-duration` (0s by default, static; set a real
  duration for a rhythmic brighten-and-settle pulse, disabled under `prefers-reduced-motion: reduce`).
  Together they cover a "shining" gemstone-style accent-theme picker without changing the default look
  for any existing consumer.

- 55140c3: `lyra-table` gains heat-tint mode: a per-column `heatValue(row)` accessor drives a `color-mix()`-based
  cell background computed from a shared min/max scale across the whole grid (auto-derived from the
  data, or overridden via the new `heatTintScale` property), matching `lyra-heatmap`'s own
  `--lyra-heatmap-scale-lo`/`-hi` ramp-token convention via new `--lyra-table-heat-tint-lo`/`-hi` custom
  properties. Previously a consumer needing a value-driven cell background had to hand-compute a color
  string themselves via the existing `cellStyle` escape hatch.
- 6f7c938: `lyra-table` gains `rowTotal`/`grandTotal`: a trailing column showing each row's total (`rowTotal`)
  and, when at least one column also defines `footer`, a grand-total cell at its bottom-right
  intersection (`grandTotal`). Both share the existing `footer(rows)` hook's "consumer computes/renders,
  table only positions" contract rather than assuming addition. Previously a consumer needing row/grand
  totals alongside `lyra-table`'s existing per-column `footer` had to render them outside the table
  entirely, breaking column alignment.
- 4cae327: Adds `<lyra-task-list>`: a live, collapsible tracker for an agent's plan, embedded in the
  transcript. Renders ordered steps with per-step lifecycle status (`pending`/`running`/`success`/
  `error`) and one level of nested sub-steps; status changes are announced through an internal
  throttled live region. A dynamic `detail-<id>` slot per item accepts rich content such as a
  `<lyra-tool-call-chip>`. Unlike `<lyra-stepper>` (a single-selection navigation control),
  `<lyra-task-list>` is a read-only status report — several steps may be `running` at once, and
  there is no selection.
- bf223ca: Adds `<lyra-terminal>`: a read-only, virtualized ANSI console for streamed agent/tool output — SGR
  color rendering (16 named colors, 256-color, truecolor), stick-to-bottom `follow` with a
  `lyra-follow-change` event, `write()`/`content` streaming, `\r`/`\b`/`\t` cursor handling so progress
  bars render correctly, in-buffer `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`,
  `line-range` highlight/anchor support (`scrollToAnchor()`, `lyra-highlight-activate`), and built-in
  copy/download affordances. Not a PTY — no stdin/keystroke handling or cursor-addressed full-screen
  apps.
- 52a90e5: Adds `<lyra-test-results>`: a pass/fail suite summary with visible (never color-only) per-status
  counts, `aria-pressed` status filter toggles, and failure rows that auto-expand by default and can
  host a slotted `detail-{testId}` diff/code block. Row state (expansion, filter) survives a streaming
  `suites` reassignment mid-run, and a run's completion is announced through an internal live region.
- 967e785: Adds `<lyra-thread-list>`: the conversation sidebar — a grouped ("Pinned / Today / Yesterday / Previous
  7 days / …"), searchable list of chat sessions built on `lyra-conversation-item` and virtualized via
  `lyra-virtual-list`. Data mode (`threads` array) renders rows with optional pin/archive/delete row
  actions, all controlled events (`lyra-thread-pin`/`-archive`/`-delete`/`-rename`) carrying the
  _requested_ new state — no CRUD or persistence of its own. Slotted mode (host-supplied
  `lyra-conversation-item`s) skips grouping/virtualization/row-actions entirely, for a host that wants
  full control over a short, unconstrained list.
- 9448c10: Add `lyra-trace-tree`: a collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith
  run-tree style) — kind icon, name, status, an inline duration bar on the shared trace time scale,
  and optional tokens/cost columns. Consumes a flat `LyraSpan[]` array (hierarchy derived from
  `parentId`); expand state survives a streaming reassignment of `spans`. The shared `LyraSpan` type
  (`components/trace-tree/span.ts`) is also consumed by the upcoming `lyra-span-waterfall`, so the
  two components can render the same trace as two synchronized projections.
- bef6b0d: Adds `<lyra-transcript-feed>`: a data-driven live-captions surface for an in-progress voice session —
  `entries` in (`{ id, speaker?, text, interim?, timestamp? }[]`), reconciled keyed by `id` so a same-id
  interim-to-final upgrade moves the row into the announcing `role="log"` region without a duplicate
  announcement. Ships the shared stick-to-bottom "follow" contract (`follow`/`lyra-follow-change`, the
  same vocabulary `lyra-terminal` uses). No dependency, no STT/diarization built in — bring your own
  transcription source and stream entries in.
- ec5fe96: Adds the `DocumentAnchorTarget` mixin (`internal/anchor-target.ts`) and its `LyraAnchorTarget`
  interface: the shared implementation of the anchor-target contract every anchor-capable lyra-ui
  viewer adopts — `highlights`/`activeHighlightId`/`anchor` properties, `scrollToAnchor()` with a
  generation-guarded retry-until-loaded loop and screen-reader announcements, and
  `lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result` event plumbing including
  selection->anchor emission. Internal module; no adopter yet in this release (`lyra-pdf-viewer` adopts
  it next). No behavior change for any existing component.
- 44b6de7: Adds the shared `LyraAnchor`/`LyraHighlight` grounding-bridge type module
  (`@aceshooting/lyra-ui/components/document-viewer/anchors.js`): a W3C Web-Annotation-inspired
  discriminated union (`page`, `text-quote`, `fragment`, `line-range`, `cell-range`, `cfi`,
  `time-range`, `region`, `node-path`) that every anchor-capable viewer and every knowledge-grounded
  citation surface will address a passage through. Pure types plus one constant; nothing to register,
  no runtime behavior change for existing components.
- c644abd: Widens `DocumentFile` with optional `anchor`/`highlights`/`alt` fields and
  `DocumentRendererDefinition` with an optional `capabilities` declaration; `lyra-document-viewer` gains
  matching `anchor`/`highlights`/`alt` properties, forwards them to the resolved renderer, and emits
  `lyra-anchor-result { found }` once per applied anchor. Every addition is optional and every existing
  registration/usage is unaffected — this removes the previous limitation where even a renderer's own
  props (like pdf's `page`) couldn't be reached through the router.
- 5f92994: Adds `internal/text-highlights.ts`: a highlight paint manager for HTML-flow document viewers, using
  the CSS Custom Highlight API when available and falling back to `<mark>`-wrapping otherwise, with a
  uniform `acquireHighlightHandle()` API that never requires callers to branch on browser support
  themselves. Internal module with no public tag and no adopter yet in this release; ships ahead of the
  markdown/html-viewer/docx-viewer highlight support that will consume it. No behavior change for any
  existing component.
- b067b83: Adds `internal/text-quote.ts`: dependency-free `text-quote` anchor resolution (quote/prefix/suffix ->
  DOM `Range`, and the reverse — a selection `Range` -> a `text-quote` anchor with captured context).
  Internal module with no public tag; used by the `DocumentAnchorTarget` mixin's default selection
  handling and by `lyra-pdf-viewer`'s anchor/highlight resolution. No behavior change for any existing
  component.
- bc75a1f: Adds `<lyra-usage-badge>`: a compact, static resource strip for one message or run — tokens in/out,
  cost, latency — with a hover/focus tooltip breakdown (full grouped figures, plus a computed Total
  tokens row when both counts are set). Purely formatting: it computes no counts, rates, or prices,
  and every segment is independently optional. Reuses `<lyra-tool-call-chip>`'s hover/focus/Escape
  tooltip contract. Distinct from `<lyra-context-meter>` (occupancy of a fixed capacity) and
  `<lyra-generation-status>` (a live ticking readout with a Stop button) — this is the static spend
  record shown after a message or run completes.
- f3c744b: `lyra-virtual-list` gains a public `scrollToIndex(index, { align, behavior })` method: scrolls a
  specific row into view (`align: 'start' | 'end' | 'auto'`, reduced-motion-aware `behavior`) without
  the `aria-current`/"active row" side effect of the existing `active-id` property. In
  `row-height="auto"` mode, a far-off target's estimate-based offset is corrected with a single re-scroll
  once the row's real height is measured. Previously there was no way to programmatically scroll to a
  specific row at all except by driving `active-id`, which also marks that row as the current selection —
  a streaming transcript's own stick-to-bottom auto-scroll has nothing to do with "selection."
- e24ae10: Adds `<lyra-voice-picker>`: a TTS voice selector mirroring `lyra-model-select`'s closed-dropdown/
  free-text-combobox dual mode and form-association, with a `catalog` entry shape carrying
  `language`/`description`/`previewUrl`, and an event-first preview affordance (`lyra-preview-request`,
  cancelable) that plays through one internal `<audio>` when a `previewUrl` is present and the host
  doesn't take over. No TTS SDK, no catalog fetching, no selection persistence — those stay host
  concerns.
- 37a89cb: Adds `lyra-widget-renderer`'s internal type registry (`registerWidgetType()`,
  `getDefaultWidgetTypeRegistry()`) and its security-critical, DOM-free allowlist resolver
  (`resolveTree()`): unknown widget types and disallowed/mistyped props are skipped, never rendered;
  `forcedProps` always win; a child's `slot` outside its parent's allowlist renders unslotted; depth
  (32) and node-count (5000) caps are enforced. No public API surface change on its own — groundwork
  for the `<lyra-widget-renderer>` element, landing in the same release.
- bcd3c2b: Adds `<lyra-widget-renderer>`: renders an agent-streamed declarative JSON widget tree through an
  allowlisted `type → lyra tag` registry (`card`/`badge`/`button`/`stat`/`result-card`/`result-field`/
  `markdown`/`image` built in, plus `row`/`col`/`text` structural built-ins) — unknown types and
  disallowed/mistyped props are silently skipped, never rendered, with a deduped dev-mode warning; a
  single bubbling `lyra-widget-action` event surfaces actions; streamed updates reconcile keyed by
  `id` (or structural path), so a mapped widget's own internal state survives a re-resolve.
  `registerWidgetType()` extends the default registry app-side; a per-instance `registry` property
  fully overrides it. No `innerHTML`/`unsafeHTML` path exists anywhere in the implementation.
- dc168c7: Adds `<lyra-xml-viewer>`: a `DOMParser`-based collapsible XML tree view mirroring
  `lyra-json-viewer`'s UX (`collapsed-depth`, `copyable`, structural-path expand state that
  survives a same-shape `xml` reassignment), with an imperative `search()`/`searchNext()`/
  `searchPrevious()`/`clearSearch()` API and `node-path` anchors (element indices plus an optional
  trailing `'@attrName'` segment for attribute-level targeting). Self-registers into the
  document-viewer registry for `application/xml`/`text/xml` and `.xml`/`.xsd`/`.xsl`/`.xslt`/`.rss`/
  `.atom` files. No XPath/XSLT evaluation, no editing, no schema validation.

### Patch Changes

- 7bbd069: Internal only: adds three new `src/internal/` modules (`slugger.ts`, `cell-range.ts`,
  `viewer-search.ts`) and five new localization keys (`viewerSearchMatchCount(Plural)`,
  `viewerSearchNoMatches`, `viewerSearchActiveMatch`, `viewerHighlightLabel`) used by upcoming
  per-viewer search/anchor/highlight support. No consumer-visible behavior change on its own.
- da8bbf0: Requires `@aceshooting/lyra-flags` `^1.4.0` (up from `^1.3.0`) as the optional flag-asset peer.
  1.4.0 is a docs/metadata-only release of the flags package (no runtime change), so this is a
  range refresh, not a behavioral requirement bump.
- 967e785: Fixes `<lyra-virtual-list>`: a `groups`-supplied group marker no longer carries `role="heading"`
  `aria-level="2"`. Those markers render inside the scroll container's `role="list"`, and ARIA's `list`
  role only permits `listitem` as a direct owned child — a `heading` sibling was a critical
  `aria-required-children` violation for any consumer combining `groups` with an accessibility check
  (surfaced by `<lyra-thread-list>`'s date-grouped rows). The marker is still rendered as visible,
  non-interactive text; it's just no longer exposed as a heading landmark.

## 3.7.0

### Minor Changes

- 05c9f9c: Add `appearance="link"` to `<lyra-button>`: a true inline-link tier that renders as zero-chrome underlined text — no padding, border, border-radius, or `min-block-size` floor — colored from the same `--lyra-button-accent` token `appearance="plain"` uses (so `variant` still selects the link color) and inheriting the surrounding font-size/weight so it flows within a sentence rather than as a button-shaped control. Previously the smallest `<lyra-button>` was still a padded, rounded, 24px-tall pill with a (transparent-but-present) border and no `text-decoration`, so an inline text link had to be hand-rolled; `appearance="link"` now covers that case directly. The notable design choice: the link rules are declared after the per-`size` rules so `font: inherit` and the zero padding/border/min-height win over whatever `size` is set, and the shared `[part='base']:focus-visible` outline is deliberately left intact.
- 2ed831d: `<lyra-file-icon>` gains a `size` property (bytes, formatted via the same convention as `<lyra-attachment-chip>`) shown alongside its label, and exposes the raw MIME type as a `title` tooltip.
- a5482d8: Add `<lyra-swatch-picker>`, a single-select picker over a small, fixed set of color swatches — the row-of-round-accent-color-buttons pattern apps hand-roll, generalized into a first-party component. It carries the WAI-ARIA APG `radiogroup` contract (`role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation on click or arrow-key move, cyclic Arrow/Home/End navigation), takes an `options: { value; color; label }[]` array plus a controlled `value`, and emits `lyra-change` (`detail: { value }`) only when the selection actually changes. It is distinct from `<lyra-color-picker>`'s freeform native color input: this picks exactly one of N designer-chosen named colors.

  Notable design choice: the selection ring uses a dedicated `--lyra-swatch-picker-selected-color` token (defaulting to `--lyra-color-brand`) so it retheme independently of the focus ring, mirroring `<lyra-heatmap>`'s `--lyra-heatmap-selected-color`; each swatch's fill comes from its option's `color`, applied through a per-swatch custom property so a consumer's `::part(swatch)` background rule can still override it.

### Patch Changes

- f3a606f: Fix `<lyra-file-icon>`'s format badge overflowing its fixed size for multi-word localized labels (e.g. "Word document") — long badge text now truncates with an ellipsis instead of spilling outside the badge.
- 64e6cb6: Document `<lyra-file-icon>`'s new `size` property and `size` csspart in `llms-full.txt`, and add the explicit-MIME-vs-filename-extension precedence test called for by the original feature request's acceptance criteria.
- 0975bcd: Fix `<lyra-map>` throwing an unhandled error when the underlying maplibre-gl `Map` emits an `'error'` event (e.g. a tile/style source request failing) with no listener attached — maplibre-gl's `Evented` base rethrows in that case. The error is now caught and logged via `console.error` instead of surfacing as an uncaught exception.

## 3.6.0

### Minor Changes

- 30db265: Nine new components:

  - `lyra-animated-image` — a still/animated-GIF-style image that pauses on `prefers-reduced-motion`
    and exposes a play/pause toggle.
  - `lyra-animation` — declarative Web Animations API wrapper for a slotted target, with named
    timing presets, `prefers-reduced-motion` handling, and `lyra-start`/`lyra-finish`/`lyra-cancel`
    events.
  - `lyra-avatar-group` — a stacked, overlapping set of avatars with a "+N" overflow indicator.
  - `lyra-include` — fetches and renders external HTML/Markdown/plain-text content client-side, with
    URL validation and DOMPurify sanitization.
  - `lyra-known-date` — a form-associated day/month/year input for approximate or partial dates
    (e.g. a birth date where only the year is known).
  - `lyra-lightbox` — a full-screen, modal, click-to-enlarge image viewer with prev/next navigation
    across an ordered set of images, built on the same shared overlay infrastructure as
    `lyra-dialog`/`lyra-command-palette`.
  - `lyra-qr-code` — renders a QR code from text/URL data, via the optional `qrcode` peer dependency
    (same optional-peer pattern as the chart/map bundles).
  - `lyra-random-content` — displays a randomly (or sequentially) chosen subset of its slotted
    children, with optional autoplay.
  - `lyra-timeline`/`lyra-timeline-item` — a vertical event timeline with per-item status/icon
    markers.
  - `lyra-tour` — a guided, multi-step product-tour overlay that highlights target elements in
    sequence.

### Patch Changes

- e1aca7e: Shared-infrastructure hardening pass following a full-library audit:

  - `lyra-contact-viewer` and `lyra-email-viewer` now expose a proper localized `aria-label` on their
    root surface (previously had no naming mechanism at all); `lyra-calendar-viewer` gets the same
    fallback chain's final localized tier.
  - `lyra-stat`'s trend announcement now interpolates the percentage into one localized template
    instead of concatenating separately-localized fragments (word order safe for non-English locales).
  - Fixed a real bug in `lyra-model-settings-panel`'s `decimalPlaces` helper that returned `0` instead
    of the correct precision for exponential-notation step values (e.g. `1e-7`); it now shares the
    same exponential-aware implementation as `lyra-slider`/`lyra-time-range` via a new
    `src/internal/numbers.ts` export instead of a diverging local copy.
  - Deduplicated five other byte-identical/near-identical helpers that had drifted into 2-5 separate
    component files each (`prefersReducedMotion`, canvas-context memoization, swatch-color
    sanitization, slotted-content detection, and a title-attribute-stripping mixin) into single
    `src/internal/` implementations.
  - Removed an unused, never-adopted RTL helper (`rtlAwareSide`/`PhysicalSide`) from
    `src/internal/rtl.ts`.
  - Added missing accessibility test coverage for `lyra-icon-button` and the standalone `lyra-option`
    element (previously the only two custom elements in the library with no axe check).

## 3.5.0

### Minor Changes

- 681ed1f: Broad component hardening pass across ~50 components:

  - `lyra-command-palette` now uses the shared overlay infrastructure (`lyra-dialog`'s
    focus-trap/Escape/backdrop/scroll-lock manager) instead of a bespoke implementation, adds
    `aria-activedescendant` tracking, and keeps the highlighted row scrolled into view.
  - `lyra-table` forwards `spellcheck`/`autocapitalize`/`autocorrect` to its filter input and inline
    text-cell editor, matching the string-aware `spellcheck` converter already used by
    `lyra-textarea`/`lyra-model-select`.
  - `lyra-token-input` and `lyra-code-editor` fix `label`/`hint`/`error` slot-vs-attribute detection
    (a `[part]:empty` selector never matches since the part always contains a `<slot>`), and
    `lyra-token-input` adopts the `effectiveDisabled`/`_fieldsetDisabled` pattern so a `<fieldset
disabled>` ancestor no longer permanently overwrites its own `disabled` property.
  - `lyra-calendar`: month grid gets proper `role="grid"`/`role="row"`/`role="gridcell"` semantics,
    per-day `aria-label`, a sanitized event-color style (rejects `url(...)` and anything else that
    isn't real CSS color syntax), and RTL-aware nav chevrons; `firstDayOfWeek` tolerates out-of-range
    input instead of producing `Invalid Date`.
  - `lyra-icon` clones custom slotted SVG content into the component's own `<svg>` so slotted
    path/circle/group children paint reliably in Chromium.
  - `lyra-document-preview` simplifies its abortable-fetch generation tracking onto the shared
    `beginAbortableLoad` helper.
  - `lyra-app-rail-item`'s tooltip text now ignores text incidentally living in the decorative `icon`
    slot, mirroring `lyra-chip`'s `labelText` getter.
  - Smaller accessibility/consistency fixes across app-rail, attachment-chip, breadcrumb, callout,
    chart/histogram, checkbox-group, data-grid, empty, format-\*, heatmap, html-viewer,
    image-comparer, intersection/mutation/resize-observer, map, model-select, pdf-viewer,
    phone-input, progress, radio/radio-group, responsive-panel, scroller, segmented, sparkline,
    split, stat, stepper, streaming-text, switch, tool-param-form, tool-select-dialog, widget, and
    zoomable-frame, plus a new standalone `breadcrumb-item.styles.ts` module and expanded test
    coverage throughout.

## 3.4.0

### Minor Changes

- d0ee919: Add command-palette, checkbox-group, token-input, icon/icon-button, code-editor, data-grid, and
  calendar components. Harden file-input with clipboard paste, native directory selection, and
  dropped-folder rejection reporting.
- 1293f48: Hardening pass across ~70 components: document the button/spinner interaction custom-property APIs
  (`--lyra-button-width`, hover-brightness, active-scale, spinner-duration) and add missing cssparts;
  `lyra-breadcrumb` now reads its accessible-name override from the standard `aria-label` attribute
  (was `accessible-label`); phone-input preserves the caret through adapter reformats and ships a
  libphonenumber-js-backed adapter path with a clearer incomplete-number message; prune unused
  localization keys and size/line-height tokens; broaden test coverage across the library.

## Unreleased

### Minor Changes

- Added `<lyra-command-palette>` with searchable command registration, groups, keyboard navigation,
  Escape dismissal, and a configurable `mod+k` shortcut.
- Added `<lyra-checkbox-group>` and `<lyra-token-input>` as form-associated composite controls with
  array values, native reset/validity behavior, localized chrome, and accessible focus/editing APIs.
- Added `<lyra-icon>` and `<lyra-icon-button>` as dependency-free SVG and icon-only action primitives.
- Added `<lyra-code-editor>` with line numbers, tab insertion, native textarea selection APIs, and
  editing-assistance passthrough.
- Added `<lyra-data-grid>` with sortable headers, roving cell focus, row selection events, loading/
  empty states, and responsive overflow.
- Added `<lyra-calendar>` with responsive month and agenda views, event markers, date navigation,
  RTL-aware keyboard navigation, and date/event selection events.
- Hardened `<lyra-file-input>` with clipboard paste support, optional native directory selection, and
  explicit dropped-folder rejection reporting.
- Updated the component catalog, consumer API reference, custom-elements manifest, stories, and
  accessibility/behavior coverage for the new public surface.

## 3.3.0

### Minor Changes

- 7e7cc44: Harden every remote-resource viewer against oversized, cancelled, and failed loads, and close a set of localization gaps.

  **Resource limits.** A new internal resource loader caps any remote resource a viewer fetches at 25 MB before handing it to a parser, enforced by streaming the response so the cap holds even when the server omits `Content-Length`. Parsed tabular data is additionally capped at 10,000 rows and 1,000 columns before it is retained or rendered. Exceeding either limit now surfaces the localized `documentPreviewResourceTooLarge` message instead of attempting the parse. This is a behavior change for consumers previewing documents above those thresholds — they will now see a size error where the viewer previously tried (and typically hung or crashed) on them.

  **Cancellable loads.** `LyraElement` gained internal `beginAbortableLoad()` and `scheduleAfterUpdate()` helpers. In-flight fetches are now aborted when the element disconnects or its `src` changes again, and loads are coalesced to one per update rather than firing from `willUpdate`. This fixes stale responses racing a newer `src` and work continuing after an element is removed from the DOM. A `src` assigned while an element is detached is held and replayed when it reconnects, rather than being dropped.

  **Error messages no longer leak internals.** Viewers previously rendered raw `error.message` text (fetch/parser internals, URLs) directly into the UI on failure. They now render the localized `documentPreviewFailedToLoad` message, with the underlying error still available to consumers via the `lyra-render-error` event.

  Affected viewers: `lyra-archive-viewer`, `lyra-calendar-viewer`, `lyra-contact-viewer`, `lyra-csv-viewer`, `lyra-dataset-viewer`, `lyra-docx-viewer`, `lyra-document-preview`, `lyra-ebook-viewer`, `lyra-email-viewer`, `lyra-html-viewer`, `lyra-pdf-viewer`, `lyra-pptx-viewer`, `lyra-spreadsheet-viewer`, `lyra-svg-viewer`.

  **Localization fixes.**

  - Form-associated components rendered the required-field validation message as a hardcoded English string (`Please fill out this field.`). It now resolves through the `fieldRequired` message key, so `registerLyraLocale()` and per-element `strings` overrides apply. Note that this also changes the default English text to `This field is required.` — if you assert on `validationMessage`, update the expected string.
  - Removed a duplicate `hidePassword` member from the `LyraMessageKey` union. The key itself is unchanged and still used by `lyra-input`; only the redundant second declaration is gone.

  **Component coverage contract.** A new `check-component-coverage.mjs` gate runs as part of `contract-policy` (and therefore `lint`), requiring every public tag in the manifest to be exercised by a story and a behavior test, and every component family to carry an accessibility assertion. Stories and tests were added across the library to satisfy it, and `test:coverage` now runs the full test suite rather than five hardcoded files. No public API change.

## 3.2.0

### Minor Changes

- 62c6b05: `lyra-attachment-chip` gains a preview action: a new `previewSrc` property (used when `file` is
  unset; a real `File` takes precedence via a temporary blob URL) and `previewable` boolean (default
  `true`) show a new `preview-button` part whenever a file or preview source is available, emitting
  `lyra-preview` (`detail: { id, name, mimeType, src }`) to open `<lyra-document-viewer>` with the
  same effective MIME type. `lyra-document-viewer` gains a matching `download-link` slot and
  `lyra-download` event for a safe native download action. Both properties/events are additive and
  default off/no-op, so existing usages are unaffected.

## 3.1.0

### Minor Changes

- de80dc5: Adds `<lyra-archive-viewer>` for listing names and human-readable sizes inside `.zip` archives via
  the optional `jszip` peer. It registers standard ZIP MIME types and a `.zip` filename fallback with
  `<lyra-document-viewer>`; other archive formats remain on the generic download fallback.
- de80dc5: Adds the optional `line-numbers` display to `<lyra-code-block>` and `<lyra-code-block-core>`.
- 53c7c13: Add sanitized SVG and HTML viewers, plus PapaParse-backed dataset and vCard contact viewers to the document renderer registry.
- c6dd26c: Adds `<lyra-document-viewer>`, a dialog-hosted, format-dispatching document viewer, plus a
  `registerDocumentRenderer()` registry for plugging in per-format renderers. Files without a
  registered renderer fall back to the existing `<lyra-document-preview>` component.
- d992ee7: Adds `<lyra-docx-viewer>`, rendering `.docx` Word documents as sanitized semantic HTML through the
  optional `mammoth` and `dompurify` peers. It registers the official WordprocessingML MIME type and
  falls back to matching `.docx` filenames.
- de80dc5: Adds `<lyra-ebook-viewer>` using the optional `epubjs` peer and registers EPUB files with the
  document-viewer registry.
- 49f7b87: Adds `<lyra-email-viewer>` for sanitized `.eml` messages via the optional `postal-mime` and
  `dompurify` peers, plus `<lyra-calendar-viewer>` for `.ics` event lists via optional `ical.js`.
  Both viewers register their standard MIME types and filename-extension fallbacks with
  `<lyra-document-viewer>`.
- de80dc5: Adds `getFileTypeMetadata()`, `registerFileTypeMetadata()`, and `<lyra-file-icon>` for localized,
  tokenized MIME/filename format presentation.
- 68bb5e3: Adds `<lyra-pdf-viewer>`, a PDF renderer built on optional `pdfjs-dist`, with pagination, zoom, selectable text, and virtualized page rendering.
- de80dc5: Adds `<lyra-pptx-viewer>` using the optional `@aiden0z/pptx-renderer` peer for best-effort client-side
  PPTX rendering with a persistent fidelity notice.
- 0b6f412: Add SheetJS-backed spreadsheet and PapaParse-backed CSV document viewers with virtualized rows.

## 3.0.0

### Major Changes

- a712749: **Breaking:** the outer, externally-overridable tier of the design-token chain no longer lives in
  the previous external theme-input namespace — it moved to lyra's own `--lyra-theme-*` namespace
  (for example, the brand fill input now uses `--lyra-theme-color-brand-fill-loud`). Any consumer
  retheming components through the old external custom properties must rename those
  properties to `--lyra-theme-*`; the two-tier override mechanism itself (set one property at any
  ancestor to retheme every component) is unchanged. This removes lyra-ui's remaining live runtime
  CSS coupling to Web Awesome.

### Minor Changes

- 66c8819: Adds an independent `--lyra-theme-*` shared token layer, aligns `<lyra-button>`'s medium size with
  the standard Lyra font scale, exposes its host-width and size contracts, and adds opt-in native
  per-cell semantics to `<lyra-heatmap>` through `accessible-cells`.

### Patch Changes

- 11e6a03: `lyra-details`/`lyra-accordion-item` no longer render the localized "Details" fallback text alongside rich content slotted into `summary` when the plain-string `summary` prop is left unset. The fallback previously always rendered whenever `summary` was empty, regardless of whether a `slot="summary"` child was present — visible only when a consumer needed markup (an icon, multiple spans) in the summary rather than a plain string.
- 581f5f3: `installHappyDomFormAssociatedShims()` no longer throws a `ReferenceError` when `HTMLElement` isn't a global at all — e.g. a plain Node Vitest environment sharing one `setupFiles` entry with happy-dom/jsdom test files. It previously read `HTMLElement.prototype` unconditionally, contradicting its own documented "safe to call unconditionally from a shared setup file used across multiple test environments" contract.
- b5de65c: `lyra-popover`/`lyra-dropdown`/`lyra-tooltip`'s `[part="popup"]` is now `position: fixed` from the start instead of only once the popup is first opened and JS positions it. Previously, while closed, the popup stayed `position: static` sized to its full slotted content, inflating the component's own inline-block host box to match -- an invisible-but-still-hit-testable area that could sit on top of unrelated page content and intercept pointer events until the trigger was first clicked.

## 2.13.0

### Minor Changes

- 80cb577: `lyra-table` gains opt-in row selection (`selectionMode: 'single' | 'multiple'`, `selectedKeys`,
  `lyra-selection-change`), a built-in filter field (`filterable`, `filterText`, `filter`,
  `lyra-filter-change`), controlled pagination through `<lyra-pagination>` (`pageSize`, `page`,
  `totalItems`, `paginationMode`, `lyra-page-change`), a `loading` state with an indeterminate
  spinner, per-column double-click inline editing (`TableColumn.editable`/`editValue`/`editType`,
  `lyra-cell-edit`), and row grouping (`groupBy`, `groupLabel`). All new properties default to
  today's exact behavior when left unset.
- 5628327: `lyra-input` and `lyra-textarea` now also emit native-style `input`/`change` events (composed,
  matching the native element's own timing) alongside the existing `lyra-input`/`lyra-change`
  aliases, so consumers migrating from a native `<input>`/`<textarea>` don't need to rename their
  listeners. Both components also forward `spellcheck`, `autocapitalize`, `autocorrect`,
  `inputmode`, and `enterkeyhint` to their internal native control.
- d009cd8: Adds a new "Web Awesome parity primitives" family: `lyra-badge`/`lyra-tag`, `lyra-callout`,
  `lyra-divider`, `lyra-breadcrumb`/`lyra-breadcrumb-item`, `lyra-details`/`lyra-accordion`/
  `lyra-accordion-item`, `lyra-button-group`, `lyra-carousel`/`lyra-carousel-item`,
  `lyra-color-picker`, `lyra-drawer`, `lyra-popover`/`lyra-tooltip`/`lyra-dropdown`/
  `lyra-dropdown-item`, `lyra-radio`/`lyra-radio-group`, `lyra-rating`, `lyra-spinner`,
  `lyra-progress-bar`/`lyra-progress-ring`, `lyra-format-number`/`lyra-format-date`/
  `lyra-format-bytes`/`lyra-relative-time`, `lyra-image-comparer`, `lyra-zoomable-frame`,
  `lyra-scroller`, and headless `lyra-intersection-observer`/`lyra-mutation-observer`/
  `lyra-resize-observer` wrappers. `lyra-number-input` and `lyra-time-input` join `lyra-input` as
  sibling native-input-type primitives.

  These close out the remaining free-tier Web Awesome components with no prior lyra-ui equivalent —
  133 tags total, up from 97.

### Patch Changes

- 5766257: `installHappyDomFormAssociatedShims()`'s stub `ElementInternals` now implements `setValidity()` as a no-op. `AnchoredValidityController` (used by every form-associated component) calls `internals.setValidity()` on every update, not just at construction, so a consumer's happy-dom test suite installing the shim would throw the moment any shimmed component's value changed after mount.

## 2.12.0

### Minor Changes

- 42036af: `lyra-table` gains expandable rows: a table-level `expandedContent?: (row) => unknown` renders a
  full-width panel beneath any row whose key is in the new consumer-owned `expandedKeys: Set<string |
number>` property, toggled via a built-in leading chevron cell and the new `lyra-row-expand-toggle`
  event (`detail: { row, key }`). An optional `canExpand?: (row) => boolean` gates which rows get an
  interactive toggle at all. All three properties are additive and default to a no-op, so existing
  tables are unaffected.

- d612939: Make card headers wrap with their actions in narrow allocations, expose citation previews through
  a stable tooltip relationship, and localize the complete citation status announcement.

  Add reactive `accessibleLabel` overrides to both code-block variants and media cards so host
  `aria-label` values reach the actionable or semantic element inside shadow DOM. Media-card's
  unnamed actions now use complete, per-kind localized messages.

  Keep markdown within logical narrow allocations and make its `streaming` state hold `aria-busy`
  until the final content update.

- 159f3c9: `lyra-file-input` now forwards host accessible names to its dropzone and file input, exposes an
  imperative focus target, reports explicit enabled/disabled ARIA state, and announces accepted and
  rejected file counts with correct singular and plural messages.

  `lyra-export-button` now forwards host accessible names to its trigger, exposes native focus and
  blur methods, and keeps long format menus within the positioned overlay's available space.

  `lyra-document-preview` now supports explicit image alternative text (including `alt=""` for
  decorative previews), aborts superseded text fetches, and documents its sizing, font, and spinner
  motion custom properties.

- 3da4f80: `lyra-button` ships a default `:hover`/`:active` pointer-interaction treatment on `[part='base']`
  (`filter: brightness(--lyra-button-hover-brightness)` on hover, `transform: scale(--lyra-button-active-scale)`
  on active, both disabled under `prefers-reduced-motion`) -- previously it had zero hover/active CSS,
  so a mechanical `wa-button` -> `lyra-button` rename silently dropped all pointer-interaction feedback.

  `lyra-button` is now form-associated (`static formAssociated = true` + `attachInternals()`), so it
  participates in an ancestor `<form>.elements` the same way `wa-button` does -- a sibling text field's
  own Enter-to-submit lookup (which scans `form.elements` for a `type === 'submit'` control) now finds
  it, instead of silently failing to submit the form.

  `lyra-button` gains an `appearance="accent"` value -- a loud, high-contrast filled tier equivalent to
  `wa-button`'s own runtime-default appearance, including for `variant="neutral"` (`'filled'` reads the
  ambient surface color there, matching `wa-button`'s `appearance="filled"`; `'accent'` reads a solid
  neutral fill, matching `wa-button`'s own unset-appearance default). New `--lyra-button-accent-fill`/
  `-accent-on-fill` custom properties back it.

  `lyra-heatmap` gains a `monthLabelText?: (jsMonth: number, year: number) => string | undefined`
  property, the month-axis analogue of the existing `weekdayLabelText` -- lets a consumer's calendar-mode
  month labels track the same locale signal (e.g. an app's own i18n store) as every other localizable
  string on the component, instead of always following `toLocaleString(undefined, ...)`'s browser/OS-
  language default. Unset (the default) reproduces today's exact locale-derived output.

- 8a1777b: `lyra-skeleton` adds an `announce` switch so grouped or decorative placeholders can avoid
  duplicating live-region announcements. Pulse and sheen effects now use the shared
  `--lyra-transition-ambient` motion token and remain disabled by the reduced-motion branch.
- 8e8a77f: `lyra-tool-result-dialog` now forwards host `aria-label` to the internal dialog, exports its
  typed event map, localizes complete duration messages, omits non-finite durations, exposes its
  running-spin timing, and wraps footer actions in narrow layouts.

### Patch Changes

- 6ba4d1f: Localize generation metrics, graph position announcements, attachment upload context, and duration templates. Mirror JSON viewer disclosure chevrons in RTL and give map content a named semantic group with correct host-label precedence.
- b67a25e: Forward host accessible names to the semantic canvas or SVG in the chart, histogram, box-plot,
  and lite-chart families. Localize numeric summaries, mirror chart axes in RTL, refresh derived
  histogram data, improve BoxPlot theming and reduced-motion behavior, and support narrow allocations
  with long content across charts and context meters.
- 5dd8066: `lyra-chat-message` now formats its default timestamp with the component's effective locale,
  uses the shared ambient-motion token for streaming feedback, and wraps crowded footer controls
  in narrow allocations.
- e95f942: Adds a complete interpolated localization message for citation status announcements so
  translations can reorder the citation index and status naturally.
- 303e701: `lyra-heatmap` now localizes its built-in value label and formats legend, accessible-range, cell,
  and calendar-date values with the component's effective locale. Explicit `value-label` text remains
  verbatim.
- 87eb96a: `lyra-heatmap` now mirrors its low-to-high legend ramp in right-to-left layouts, including
  consumer-provided multi-stop palettes.
- 134dba0: Adds a complete interpolated localization message for lite-chart mark announcements so
  translations can reorder series, label, value, and position naturally.
- 0260f9b: Harden `lyra-app-rail`, `lyra-attachment-chip`, `lyra-avatar`, and `lyra-chip-group`: respect the
  configured element prefix, preserve localized attachment-message word order, support image `File`
  objects in thumbnail-only mode, make spinner timing themeable, retry replacement avatar images,
  forward avatar accessible-name overrides, and collapse slot-forwarded overflow chips correctly.
- 9033a43: Forward host naming and native textarea editing APIs through `lyra-chat-composer`, complete
  `lyra-phone-input` selection and range-editing methods, and expose observable focus/blur contracts
  for pagination, playback, and select controls.
- acbbf00: Logical safe-area tokens now mirror the underlying physical browser insets in right-to-left
  layouts, keeping dialogs, toasts, widgets, and tool overlays clear of notches on the correct side.
- 1f93e0c: `lyra-sparkline` now applies its generated or consumer-provided accessible name to the internal
  SVG that owns the image role. Generated value summaries also respect the component's effective
  locale and per-instance message overrides.
- 18003e2: `lyra-tool-call-chip` now interpolates duration values through localized message templates and
  exposes coherent motion controls for its running spin and pending pulse. Its event map is also
  exported for typed listeners.
- 140f9ea: Align `lyra-checkbox` with the native checkbox keyboard, focus, reset, ARIA-state, and `input`/`change` event contracts while retaining `lyra-change` as a compatibility alias.
- d099ea7: Complete the combobox's native editing surface and clearable compatibility, align conversation-item event and story semantics, add accessible disabled and timing controls to copy-button, and localize and theme flag presentation.

## 2.11.0

### Minor Changes

- c0648ec: `lyra-input` gains a `size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property (reflected), the same scale
  `lyra-select`/`lyra-combobox` already use — `--lyra-input-padding-block`/`-padding-inline`/
  `-font-size` swap per size, the same pattern as `lyra-select`'s own size tokens. Unset (the default,
  `'m'`) reproduces today's exact sizing.

## 2.10.0

### Minor Changes

- f506542: `lyra-heatmap` gains a `selectedCell` property (`{ row, col }` in matrix mode, `{ date }` in
  calendar mode) — a controlled, consumer-owned marker (mirroring `lyra-lite-chart`'s
  `selectedIndex`) that draws a persistent canvas ring independent of keyboard focus, appends a
  "Selected: ..." description to the host's own `aria-label` so it stays discoverable after focus
  moves elsewhere, and appends a "(selected)" suffix to the keyboard live-region announcement. Unset
  (the default, `null`) reproduces today's exact output.
- 6f6d758: Add `lyra-button`, a generic action-button primitive (`variant`/`appearance`/`size`/`loading`/`disabled`/`type`, default + `start`/`end` slots) -- the `lyra-*` equivalent of a plain `wa-button`.
- 5eda04d: Add `lyra-input`, a single-line plain-text input primitive (`type="text"`/`"password"`/`"email"`/`"number"`, label/hint/error chrome, form-associated validation, a built-in password-visibility toggle) -- the `lyra-*` equivalent of a plain `wa-input`.
- 7c95e95: `lyra-tool-result-view` gains a real `fallback="text"` mode (previously accepted as an attribute
  value but silently treated identically to `"json"`): a string `result` renders as preformatted text
  instead of being forced through `<lyra-json-viewer>`'s tree view, falling back to the `"json"`
  behavior when `result` isn't a string. A new `copyable` property adds a copy-to-clipboard affordance
  to either fallback kind. Additive — unset, both fallback kinds and every existing consumer render
  byte-identical to before.

### Patch Changes

- 83fe6ba: Fix `lyra-heatmap`'s `llms-full.txt` section, which was missing four real, already-shipped members
  (`cellInteractive`, `weekdayLabelText`, `colorSteps`, `refreshTheme`), and add a matching
  `focus()`/`blur()` mention to `lyra-button`'s own section. Add a `pnpm run llms-freshness` lint gate
  (wired into `contract-policy`, so it runs in `lint`/CI/`publish.sh`) that fails the build if any
  custom element's public property isn't mentioned anywhere in its own `llms-full.txt` section, so
  this can't silently drift again. A small baseline of ~20 pre-existing drift items on unrelated
  components (chart family, dialog, menu, split, tree-node, widget, etc.), discovered while building
  this check, is exempted for now via a documented allowlist in the script — out of scope for this
  change, left for a follow-up cleanup.

## 2.9.0

### Minor Changes

- b4a6f5b: `lyra-heatmap`'s color ramp now preserves a translucent `rgba()`/`hsla()`/hex-with-alpha color instead of silently resolving it to fully opaque. `resolveRgb()`/`hexToRgb()` return an `[r, g, b, a]` quadruple (previously `[r, g, b]`), and the ramp emits `rgba(...)` whenever an endpoint is translucent — unchanged `rgb(...)` output for opaque colors, so an existing consumer using only opaque `--lyra-heatmap-scale-lo`/`-hi` values sees no difference. Lets a consumer key a ramp endpoint off a themed semi-transparent surface token (e.g. a "quiet baseline" tint) and get the intended translucent cell color instead of a stark opaque one.

## 2.8.0

### Minor Changes

- 0331bbf: `lyra-table` gains a public, reflected `showAllColumns` property/`show-all-columns` attribute for its reveal-hidden-columns state, plus a `lyra-columns-revealed` event fired when `[part='reveal-columns-button']` toggles it. Consumers can now read the current reveal state back (to persist it) and set an initial one (to restore a previously-persisted preference), mirroring the read-back/set-forward contract `sortKey`/`sortDir` already support. The button still toggles the state itself by default, so existing usage is unaffected.

## 2.7.0

### Minor Changes

- af61856: `lyra-app-rail`'s navigation landmark (and its `role="dialog"` while the mobile overlay is open) now honors a host-level `aria-label` attribute, taking precedence over the `label` property and its localized `"Navigation"` default, mirroring `<lyra-date-input>`'s `accessibleLabel` pattern. Previously a host-level `aria-label` on `<lyra-app-rail>` had no effect on the accessible name computed inside its shadow DOM.
- 4ee4e76: `lyra-chat-composer` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<textarea>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
- 06e5fda: `lyra-chip` gains a `--lyra-chip-pressed-bg` custom property (falls back to `--lyra-chip-bg`) so the pressed/selected background can be set independent of the resting background. A toggleable-but-unpressed chip now announces `aria-pressed="false"` instead of omitting the attribute entirely, matching the ARIA Authoring Practices convention for toggle buttons.
- a158b6b: `lyra-combobox` gains a `size` property (`'xs'|'s'|'m'|'l'|'xl'`, default `'m'`) mirroring `lyra-select`'s existing scale, including matched sizing for the "+N" overflow tag so it stays visually consistent with the trigger at every size. Async `ComboboxSourceRow` results can now carry a decorative `icon`, trailing `badge`, richer `accessibleLabel`, and opaque `data`; the read-only `selectedRows` getter retains the structured rows and payloads for the current selection. The new visuals are exposed through `option-icon` and `option-badge` CSS parts.
- 480d9e2: `lyra-conversation-item` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its in-place rename `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary while a rename is in progress.
- 74dcaa7: `lyra-date-input` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
- 22f206c: `lyra-dialog` now lets a host-level `aria-label` attribute win over its computed accessible name (a slotted heading, `heading`, or `label`), matching `<lyra-date-input>`'s `accessibleLabel` pattern. Previously a consumer setting `aria-label` directly on `<lyra-dialog>` was silently ignored in favor of the bespoke `label`/`heading` props. Additive — left unset, today's existing three-tier fallback is unchanged.
- 80b22ba: `lyra-empty`'s `compact` mode gains a `--lyra-empty-compact-align` custom property (defaulting to today's exact `flex-start`/`start` pair) so a consumer can combine `compact`'s denser padding with a centered heading/description layout by setting it to `center`.
- 0f21c57: `lyra-export-button` accepts custom format descriptors with consumer-supplied labels, descriptions, and extension metadata. Custom formats emit `lyra-export` for application handling without bundling an encoder, while a new controlled `loading` state exposes busy semantics and prevents duplicate activation during async exports.
- 3ac5e4d: `lyra-gauge` gains a full-circle `type="ring"` presentation and a `--lyra-gauge-fill` custom property for setting the fill stroke per instance across radial, ring, and linear gauges.
- f6b2aa5: `lyra-graph` nodes gain independent accessible labels and SVG tooltip descriptions. Links gain stable ids, spoken-name/tooltip relationship-label fallbacks (not visible edge text), tooltip descriptions, directed arrowheads, per-link colors, and dash patterns; `lyra-link-click` now includes the optional link id and the marker is exposed through the `arrowhead` CSS part. A host `aria-label` is forwarded to the internal semantic SVG.
- efc1182: `lyra-map` now forwards a host-level `aria-label` attribute onto `[part="base"]`'s accessible name as a fallback when `label` is left unset, matching `lyra-slider`/`lyra-checkbox`/`lyra-switch` — previously a host `aria-label` was silently dropped in favor of the localized `'map'` default.
- 085d173: `lyra-mention-popover` now honors a host-level `aria-label` attribute as the accessible name for its internal `role="listbox"` popup, taking priority over the `label` property and its localized default. Previously the popup's name came only from `label`/`localize()`, so a plain `aria-label` set on `<lyra-mention-popover>` itself was silently ignored — matches the same fallback already used by `lyra-combobox`/`lyra-table`.
- 3b59e94: `lyra-menu`'s `role="menu"` popup now honors a host-level `aria-label` attribute over both the `label` prop and its localized default, matching `lyra-select`/`lyra-model-select`'s established `this.getAttribute('aria-label') || <computed default>` precedence. Additive — `aria-label` is unset by default, so every existing consumer (whether relying on the default `"Menu"` text or an explicit `label` prop) renders byte-identical to before.
- 653173d: `lyra-model-select` gains an opt-in `hint`/`error-text` form-control chrome (matching named slots and `hint`/`error` CSS parts, mirroring `lyra-select`, with `aria-describedby` wired to the rendered ids), plus `spellcheck`/`autocapitalize`/`autocorrect` passthrough and bubbling `blur`/`focus` events on the free-text mode's internal `<input>`. All additive — a bare `<lyra-model-select>` with none of these set renders byte-identical to before.
- 992b0ba: Add `lyra-pagination`, a controlled, localized page-navigation component with previous/next controls, a validated numeric page jump, range summaries, applied-page announcements, loading/empty handling, RTL-aware icons, five sizes, and container-responsive stacking. Enrich `TreeItem` rows with optional `icon`, `description`, and `accessibleLabel` fields plus matching structured CSS parts while preserving the existing tree keyboard model.
- dfb2f5e: Add `lyra-phone-input`, a form-associated country/telephone field that keeps canonical form values in E.164 while preserving partial editable input. Numbering metadata stays opt-in through an injected adapter or the consumer-loaded `loadLibphonenumberAdapter()` helper; `libphonenumber-js` is an optional peer and international E.164 input works without a formatter.
- d88377a: `lyra-switch` gains an opt-in `hint`/`error-text` form-control chrome (props + matching named `hint`/`error` slots + CSS parts), mirroring `lyra-select`'s pattern for those two pieces, with `aria-describedby` wired to whichever are rendered. Left unset, neither renders and the control is unchanged. The default slot stays the control's visible, clickable label (same as `lyra-checkbox`) — no separate top-of-field `label` prop was added.
- c8709cd: `lyra-textarea` gains optional label/hint/error chrome, accessible-name forwarding, bounded auto-resize, editing-assistance attributes, public native-input and selection/caret APIs, synchronized `setRangeText()`, and bubbling composed focus/blur events. Existing visual and behavioral defaults remain unchanged when the new options are unused.
- fca0ffb: `lyra-tool-approval-dialog`'s raw-JSON args `<textarea>` now also hardcodes `autocapitalize="off"` and `autocorrect="off"` alongside its existing `spellcheck="false"`, so a mobile browser (notably iOS Safari, which defaults textarea `autocapitalize` to `'sentences'`) can no longer auto-capitalize or auto-correct JSON key/value text while a user edits tool-call arguments, silently corrupting the JSON.
- 5b9b056: `lyra-tree` now forwards a host-level `aria-label` attribute onto the internal `role="tree"` element's accessible name as a fallback when `label` is left unset, matching `lyra-slider`/`lyra-select` — previously a host `aria-label` was silently dropped since `role="tree"` lives on an internal element, not the host.
- 12595bd: `lyra-typing-indicator`'s dots-variant stagger delays are now themeable via `--lyra-typing-dot-stagger-1`/`-2` (defaulting to today's exact `600ms`/`1200ms`), so a consumer retiming `--lyra-transition-ambient` can keep the stagger proportional.

## 2.6.0

### Minor Changes

- 78d4b58: `lyra-chat-message` gains an `attachments-position` prop (`'before' | 'after'`, default `'after'`) so the `attachments` slot can render above the message body instead of below it, keeping DOM/visual/reading order in sync.
- a072af9: `lyra-chip` gains a `--lyra-chip-pressed-border` custom property so a consumer can set the pressed/selected border color independent of `--lyra-chip-accent` (which also drives the label text color). Falls back to `--lyra-chip-accent`, so existing consumers are unaffected.
- b56bdb2: `lyra-empty` gains a `--lyra-empty-compact-padding` custom property to override `compact`'s fixed uniform padding (e.g. with an asymmetric shorthand like `8px 2px`). Falls back to `var(--lyra-space-xs)`, today's exact value.
- e029ac2: `lyra-heatmap` calendar mode gains a `weekdayLabelText?: (jsWeekday: number) => string | undefined` hook to override the weekday-axis label text (e.g. for a consumer with its own locale/translation state independent of the browser's runtime locale).
- 6d5f9c4: Add `lyra-textarea`, a bare multiline plain-text input primitive (value/rows/resize/placeholder, form-associated validation) — the `lyra-*` equivalent of a plain `wa-textarea`.
- bbe8007: `lyra-segmented`'s `SegmentedItem` gains an optional `icon` field, rendered before the item's label.
- e98013a: `lyra-table`'s `TableColumn` gains a `headerCell` render hook (mirroring `cell`/`footer`) and `width`/`minWidth` fields. Any column defining `width` switches the table to `table-layout: fixed` so widths are authoritative.
- 993809a: `lyra-widget` gains a `backdrop-inset` prop to decouple the fullscreen backdrop's inset from the panel's own `fullscreen-inset`. Falls back to `fullscreen-inset`, so existing consumers are unaffected.

### Patch Changes

- 1c78bd2: Fix `lyra-poll-status`, `lyra-typing-indicator`, and `lyra-stream-status`'s ambient "still alive" pulse/bounce animations, which reused `--lyra-transition-base` (180ms — reserved for discrete UI micro-interactions) and rendered as a fast flicker instead of a calm breathing loop. Adds a dedicated `--lyra-transition-ambient` token (1.8s) for infinite looping indicators.
- e029ac2: Fix `lyra-heatmap`'s `cellColor` hook silently rendering solid black when it returns a CSS custom property or other non-literal color (e.g. `color-mix(...)`) — the value is now resolved via a cached, hidden probe element before being assigned to the canvas `fillStyle`.
- 600544f: Fix `lyra-skeleton` rendering as an invisible 0×0 box everywhere: `[part='base']` was a bare `<span>` (UA default `display: inline`), so its own `inline-size`/`block-size` were CSS no-ops per spec. Adds `display: block`.

## 2.5.0

### Minor Changes

- 84cefde: `lyra-attachment-trigger`'s single-capability trigger `aria-label`s ("Attach files"/"Attach an
  image"/"Use camera"), its multi-capability menu's "Add attachment" label/aria-label, and its menu
  item labels ("Upload files"/"Upload a photo"/"Take a photo") now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- 6bf30ea: `lyra-avatar` now accepts default-slotted icon/glyph content (e.g. an inline SVG), shown in place of
  the image/initials and taking priority over both `src` and `initials` — useful for a chat UI
  distinguishing an "AI" avatar from a "user" avatar by role glyph rather than a photo or initials. Set
  `alt` alongside the icon for an accessible name, since the glyph itself is treated as decorative.
- 87890ea: `lyra-checkbox`'s built-in required-field validation message ("Please check this box if you want
  to continue.") now routes through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English output is unchanged when no override is set.
- b720eda: Fixed `lyra-chip`'s opt-in `selected` toggle/pressed mode so it stays interactive after the first
  click. `[part='base']`'s `role="button"`, `tabindex`, `aria-pressed`, and click/keydown handlers
  used to be gated on the _current_ value of `selected`, so a chip that started `selected` and was
  clicked (flipping it to `false`) lost its focusable/clickable semantics on the next render — there
  was no way to click it back on. `selected` becoming `true` at any point now latches the chip into
  toggle mode for good, so it stays clickable in both directions. A chip that must be interactive
  from the outset while starting **unselected** (e.g. an initially-inactive filter chip) can opt in
  explicitly with the new `toggleable` property, since `selected`'s own default (`false`) can't be
  told apart from "never opted in" on its own.
- cbfec47: `lyra-citation-badge`'s visible status words folded into its computed accessible name ("High
  confidence"/"Medium confidence"/"Low confidence"/"Verified"/"Unverified") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- dba57e9: `lyra-context-meter`'s accessible summary ("{used} of {total} used" / "{used} used") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 7379a41: `lyra-conversation-item`'s "Untitled conversation" fallback title now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- acdaa37: `lyra-dock-panel`'s resize-handle and collapse-toggle `aria-label`s ("Resize panel",
  "Collapse panel"/"Expand panel") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- eca2ea4: `lyra-document-preview`'s hardcoded English strings — the image-preview `alt` fallback
  ("Document preview"), the unsafe-URL error ("Document URL is not allowed."), the non-`Error`
  fetch-failure message ("Failed to load document."), and the empty-`error-message` fallback
  ("Something went wrong.") — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Its in-flight text-fetch spinner label ("Loading document…")
  is now also wired through the existing `loadingDocument` message key. Default English output is
  unchanged when no override is set.
- a3c4ebf: `lyra-export-button`'s trigger button text (default "Export", also reused for the format menu's
  `aria-label`) now routes through `this.localize()` when `label` is left at its built-in default,
  overridable via `.strings`/`registerLyraLocale()` — matching `lyra-attachment-chip`'s
  `removeLabel`/`retryLabel` convention. Setting the `label` attribute/property explicitly still
  overrides it directly. Default English output is unchanged when no override is set.
- df8341b: `lyra-generation-status`'s stop-button `aria-label` ("Stop generating") now routes through
  `this.localize()` (sharing the existing `stopGenerating` key used elsewhere in the library), and
  the tokens segment's singular/plural noun ("token"/"tokens") is now localizable too, matching
  `lyra-json-viewer`'s/`lyra-word-cloud`'s existing count-noun pattern. Overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 20ae3e7: `lyra-graph`'s visually-hidden data-list `aria-label` ("Graph data") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 8c29581: `lyra-segmented` gains a `label` property giving its `role="radiogroup"` root an accessible name.
  When unset, a plain `aria-label` attribute on the host element is honored as a fallback, matching
  `lyra-slider`'s existing `label`/`aria-label` convention. Previously the radiogroup had no way to
  receive an accessible name at all.
- 259c0c6: Completed a full-library i18n/RTL/styling standardization pass across the remaining component
  families not yet covered by earlier rounds — `chart` (and `box-plot`/`histogram`/`lite-chart`),
  `avatar`, `code-block`, `combobox`, `date-picker`, `dialog`, `document-preview`, `export-button`,
  `file-input`, `graph`, `heatmap`, `map`, `time-range`, `tool-call-chip`, `tool-param-form`,
  `tool-result-dialog`, `tree`, `widget`, and several smaller components. Highlights:

  - Routed remaining hardcoded English strings (accessible descriptions, aria-labels, empty-state
    text) through `this.localize()`.
  - Fixed RTL gaps: `date-picker`'s previous/next chevrons now mirror under `dir="rtl"` (rotating
    the wrapping `part`, not the icon), matching the grid's own arrow-key swap.
  - `lyra-avatar`: fixed a dangling `--lyra-color-surface-alt` token reference, corrected its `size`
    JSDoc, and extended the accessible-name role/`aria-label` to the initials-fallback path (not
    just the icon-slot path) whenever `alt` is set.
  - `lyra-export-button` now fires `lyra-show`/`lyra-hide` on its format menu, matching the same
    convention already used by `lyra-menu`/`lyra-select`/`lyra-combobox`.
  - Fixed a `this.localize(key, literalFallback)` pattern that unconditionally short-circuited
    `registerLyraLocale()` lookups for the affected keys (the fallback is now omitted wherever
    `DEFAULT_STRINGS` already carries the same default).

  AGENTS.md gained a new "Internationalization (i18n), RTL, and theming" section documenting the
  resulting standard, and both READMEs now summarize it for consumers.

- 79e4390: Fixed gaps found during a full re-verification pass over previously-completed work:

  - `lyra-menu`'s type-ahead navigation now excludes `hidden`/`aria-hidden` items (it already
    excluded `disabled` ones), matching the Arrow/Home/End roving-focus navigation it sits next to.
  - The root barrel (`src/lyra.ts`) now re-exports 13 component event-map types that were previously
    unreachable from the package root even though their owning classes were exported: `LyraChip`,
    `LyraChipGroup`, `LyraCitationBadge`, `LyraCopyButton`, `LyraDiffView`, `LyraFileInput`,
    `LyraHeatmap`, `LyraLiteChart`, `LyraMediaCard`, `LyraSelect`, `LyraSourceCard`, `LyraSplit`, and
    `LyraTimeRange`'s `*EventMap` types are now all importable from `@aceshooting/lyra-ui`.

- 59d4477: `lyra-media-card`'s hardcoded English fallback strings — the file-chip "Untitled file" name, the
  `image`/`video` alt-text fallbacks ("Image attachment"/"Video attachment"), and the accessible
  "Open …" label (both the named and generic-kind forms) — now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- ea774a8: `lyra-mention-popover`'s default listbox accessible name ("Suggestions") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()` — matching the already-shared
  `noMatches` key its empty-state row uses. An explicit `label`/`empty-text` value still wins
  verbatim. Default English output is unchanged when no override is set.
- cd10606: `<lyra-menu>` gains an opt-in `closeOnEscapeAnywhere` property. Escape has always closed the menu
  and refocused the trigger when it originates from a real `<lyra-menu-item>`, but slotted non-item
  content (e.g. a form control slotted alongside the items) previously got full default keyboard
  behavior with no way to close the menu on Escape. Setting `closeOnEscapeAnywhere` extends that
  same Escape-closes-and-refocuses behavior to keydowns from anywhere in the list, including slotted
  non-item content. Defaults to `false`, so existing consumers are unaffected.
- 7d63af9: `lyra-menu`'s `role="menu"` popup default accessible name ("Menu") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. An explicit `label` value
  still wins verbatim. Default English output is unchanged when no override is set.
- f232381: `lyra-model-settings-panel`'s hardcoded English strings — the visible "Temperature" caption
  (also reused as the nested `lyra-slider`'s accessible name) and the internal `lyra-model-select`'s
  "Select a model…" placeholder — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 1686322: `lyra-playback`'s play/pause button and position-slider `aria-label`s ("Play"/"Pause",
  "Playback position") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 0cacb4d: `lyra-poll-status`'s pause/resume button aria-label, due-state countdown text ("Refreshing…"), and its
  three live-region announcements ("Paused."/"Resumed."/"Refreshing now.") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. It also now shows a distinct
  "Paused" countdown state while `paused`, instead of freezing on whatever value it last displayed.
  Default English output is unchanged when no override is set.
- 870523f: `lyra-widget` gains two new named slots, `collapse-icon` and `fullscreen-icon`, overriding the
  built-in chevron/expand-or-close glyphs on the collapse and fullscreen toggle buttons entirely
  (platform slot-fallback-content mechanism: whatever is assigned wins, otherwise the default glyph
  renders unchanged). `WidgetView`'s `label` is now optional and a new `ariaLabel` field lets a view
  toggle be icon-only while still exposing an accessible name — previously a toggle with no `label`
  had no accessible name at all.
- c2bc232: Re-audited every component against the library's i18n/RTL/theming standard and fixed the
  remaining gaps found:

  - Removed several `this.localize(key, literalFallback)` call sites (`toolApprovalHeading`,
    `playback`'s play/pause/position labels, `model-settings-panel`'s temperature/model labels,
    `media-card`'s five accessible-name strings, `kbd`'s shortcut-token labels, `chat-composer`'s
    composer label) where the literal fallback silently defeated `registerLyraLocale()` translation
    for that call site.
  - Routed remaining hardcoded strings through `this.localize()`: `date-picker`'s next-month label
    and `date-input`'s validation messages, `toast-item`'s/`chip`'s/`combobox`'s remove/close
    labels (now interpolated via a `{placeholder}` instead of string concatenation), `heatmap`'s
    matrix/calendar aria-labels and "no data"/row/col fallbacks, `chart`/`box-plot`'s description
    and data-table text, `lite-chart`'s mark-position announcement, `document-preview`'s empty-state
    nouns, `json-viewer`'s copy/expand/collapse/count labels, `stat`'s trend announcement,
    `dialog`'s `confirm()` cancel button, `typing-indicator`'s default label, `tool-param-form`'s
    edge-case validation message, and `tool-result-dialog`/`tool-call-chip`'s duration seconds unit.
  - Fixed RTL gaps: `app-rail-item`'s icon tooltip now flips side under `dir="rtl"` via
    `rtlAwarePlacement()`, `chat-message`'s and `source-list`'s collapse/disclosure chevrons now
    mirror under RTL, and `lite-chart`'s roving-tabindex point navigation now swaps
    ArrowLeft/ArrowRight under RTL.

  Also compressed the shared string registry (`internal/localization.ts`): removed 21 `kbd*` base
  keys (`kbdEnter`, `kbdEscape`, `kbdTab`, etc.) that were fully superseded by their `*Word`/`*Visual`
  counterparts and had no remaining call sites anywhere in the library, reducing the packed consumer
  bundle size.

- aeef118: `lyra-select`'s required-field validation message ("Please select an option.") and its
  trigger's fallback accessible name ("Select", used only when no `aria-label`, `label`, or
  `placeholder` is set) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 4fb27a2: `lyra-skeleton`'s default accessible name ("Loading…") now routes through `this.localize()`
  (reusing the shared `loading` key), overridable via `.strings`/`registerLyraLocale()`. An
  explicit `label` still wins verbatim. Default English output is unchanged when no override is set.
- f7b9f0e: `lyra-source-list`'s fallback header text ("Sources", used only when neither `label` nor
  `label-plural` is set) now routes through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- f2ea145: `lyra-stepper`'s `StepItem` gains an optional `title` field, rendered as a native `title` tooltip on
  that step's button — useful for explaining why a `disabled` step is locked (e.g. "Complete Basics
  first"). Steps that omit it render no `title` attribute at all, unchanged from today.
- 9e5864a: `lyra-stream-status`'s built-in stalled-message default ("Taking longer than usual…") and its
  three live-region announcements ("Connection stalled."/"Connection restored."/"No longer
  stalled.") now route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`.
  Default English output is unchanged when no override is set.
- 9174500: `lyra-switch`'s built-in required-field validation message ("Please turn this on.") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 60084ba: `lyra-thinking-panel`'s default header label ("Thinking") and its duration-display text ("Thought
  for …"/"Thinking…") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. An explicit `label` still wins verbatim. Default English
  output is unchanged when no override is set.
- b113bda: `lyra-tool-approval-dialog`'s heading text, generic tool-name fallback, args-editor accessible
  name, invalid-JSON fallback error, and its Deny/Edit/Approve button labels now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 3b1f930: `lyra-tool-call-chip`'s visible status labels (Pending/Running/Success/Error/Denied, shared with
  `lyra-tool-result-dialog`'s identical vocabulary) and its unnamed-tool fallback ("Tool call") now
  route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- bbaea80: `lyra-tool-param-form`'s validation messages (required field, wrong type for a string/number/
  integer/boolean, enum mismatch, const mismatch, unsupported field type, malformed schema shape,
  non-serializable value) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- bda19ac: `lyra-tool-select-dialog`'s dialog title, search placeholder, "use default tools" switch label
  and hint, category count/"Other" fallback, tools-enabled summary, no-matches message, and the
  no-tools-available empty state now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 220bd73: `lyra-widget`'s collapse/expand, exit-fullscreen/expand-to-fullscreen, and view-toggle-group
  aria-labels, plus its fullscreen dialog's fallback accessible name, now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. The collapse/expand labels
  reuse `lyra-dock-panel`'s existing `dockPanelCollapse`/`dockPanelExpand` keys. Default English
  output is unchanged when no override is set.

### Patch Changes

- 00ce49f: Fix `lyra-date-picker`'s day-grid keyboard navigation to swap ArrowLeft/ArrowRight under `dir="rtl"`, matching the grid's own visual mirroring (the day cells use unset `direction`, so the browser already lays them out right-to-left). ArrowUp/ArrowDown (by week) are unaffected.
- 37e1a2f: `lyra-table`'s header-cell ArrowLeft/ArrowRight roving-tabindex navigation now derives its RTL
  check through the shared `isRtl()` helper instead of a duplicated inline `getComputedStyle`
  check, and gains test coverage confirming ArrowRight/ArrowLeft already swap correctly under
  `dir="rtl"` (a native `<table>` mirrors column visual order under RTL on its own) while
  ArrowUp/ArrowDown row navigation is unaffected. No behavior change.
- 2fd3786: Fix calendar-heatmap weekday-axis labels to respect firstDayOfWeek instead of always labeling grid rows 1/3/5.

## 2.4.0

### Minor Changes

- 171bdbd: `lyra-attachment-chip`'s file-size unit abbreviations ("B"/"KB"/"MB"/"GB"/"TB") now route through
  `this.localize()` when rendered, overridable via `.strings`/`registerLyraLocale()`. The exported
  `formatFileSize()` pure function gains an optional `unitLabel` resolver parameter, defaulting to the
  plain English abbreviation — every existing single-argument call is unaffected.
- 5f043ba: `lyra-chart`'s data-table "Category" column header, per-row "Point N" fallback label, and "Reset
  zoom" button text now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- 5e90140: `lyra-chat-composer`'s action button labels ("Send message"/"Stop generating") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Also adds `stoppable: boolean =
true` — when set to `false`, the button never renders as a Stop/cancel control while busy; it stays a
  disabled Send button instead, for backends with no cancellation endpoint. Default behavior is
  unchanged.
- 558e76c: `lyra-chat-message`'s visible status text ("Sending…"/"Responding…"/"Failed to send") and its two
  live-region status-change announcements ("Message failed to send."/"Message complete.") now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English text is
  unchanged.
- 238c8d7: `lyra-chip-group`'s collapsed overflow-indicator's visible "+N" text now routes through
  `this.localize('showMoreCollapsed', ...)`, matching the aria-label it sits beside, which was already
  localized. Default English output ("+N") is unchanged.
- 0d9018f: `lyra-code-block`'s collapse-toggle, copy-button, and code-region aria-labels now route entirely
  through `this.localize()` instead of concatenating a localized verb with a hardcoded English suffix
  ("code"/"to clipboard"/"Code"). Default English output is unchanged.
- a249bd6: `lyra-diff-view`'s copy-button aria-label now routes entirely through `this.localize('copyDiff', ...)`
  instead of concatenating the localized "copy" verb with a hardcoded " diff" suffix. Default English
  output ("Copy diff") is unchanged.
- 58c6e59: `lyra-file-input`'s drag-preview live-region announcements ("Release to add the file." / "This file
  type is not accepted.") now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged. The post-drop `acceptedMessage`/
  `rejectedMessage` properties and the visible `label` property are unaffected (already
  consumer-overridable).
- b3e3bb6: `lyra-json-viewer`'s root-node toggle/copy fallback words ("array"/"object"/"value", used only when a
  node has no key label) now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- b322e75: `lyra-model-select`'s synthetic stale-value row badge ("not in catalog") now routes through
  `this.localize('notInCatalog')`, so it can be overridden via `.strings`/`registerLyraLocale()` like
  the component's other built-in message (`noMatches`). Default English text is unchanged.
- e54eeee: `lyra-source-card`'s "Untitled source" fallback and its " — p. N" page-suffix format now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- 0576643: `lyra-split` now redistributes the track space freed when a `panelConstraints` pixel bound clamps a
  panel's percentage basis down (e.g. a `maxPx` cap on a wide viewport) to sibling panels that have no
  pixel constraint of their own, instead of leaving that space unused. No behavior change for splits
  without `panelConstraints`, or where no panel is actually clamped this render.
- 97756af: `lyra-table`'s `columns[].sticky` option now accepts `'start' | 'end'` in addition to the legacy
  `boolean` (`true` continues to mean `'start'`, unchanged). An `'end'`-sticky column pins to the
  inline-end edge instead — useful for a trailing actions column that would otherwise be pushed off
  a narrow viewport — via the same `inset-inline-*` logical-property approach, so RTL is unaffected.
- ffee803: `lyra-tool-result-dialog`'s tool-name fallback ("Tool call"), visible status label
  ("Pending"/"Running"/"Success"/"Error"/"Denied"), and maximize/restore button aria-label now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- f9f57f9: `lyra-word-cloud`'s default aria-label's pluralized "word"/"words" noun now routes through
  `this.localize()` too, so a registered translation of the `wordCloud` template's `{word}` slot is no
  longer stuck in English. Default output is unchanged.

## 2.3.0

### Minor Changes

- a1b2f8e: `lyra-app-rail` gains `dragging` (reflected boolean, true for the duration of a pointer-driven
  resize -- not a keyboard step -- so its own `[part='base']` transition suppresses during the drag
  instead of visibly "chasing" the pointer) and `hideToggle` (suppresses the built-in mobile hamburger
  button for a consumer that owns its own external toggle wired to `open`).
- e9075b8: `lyra-app-rail-item` gains an opt-in `tooltip` property: a hover/focus flyout showing the item's
  label text while `icon-only` hides it from view, using the library's existing Floating-UI-backed
  `place()` positioner -- an explicit, documented alternative to hand-rolling a `::part()`+`::after`
  tooltip composition.
- 8160548: `lyra-attachment-chip`'s `compact` variant now also shrinks font-size and gap (via new
  `--lyra-attachment-chip-compact-font-size`/`-compact-gap` custom properties), not just
  border/radius/padding/thumbnail-size. Also adds `thumbnailOnly`, which -- combined with `compact`
  on an image-mime chip -- hides the filename/size text entirely for a pure thumbnail density with
  no consumer-side CSS.
- 099fa8a: Add `lyra-avatar`: a small, fixed-size identity marker (image, or an initials fallback) for a
  user-menu trigger or similar identity affordance -- `size`/`shape`/`tone` variants mirror
  `lyra-chip`'s existing tone vocabulary for consistency.
- bf9d442: Add `lyra-card`: a generic bordered content container (`appearance` variants mirroring `wa-card`,
  `header`/`media`/`footer`/`actions` slots) for the "small bordered surface with padding" idiom
  common across hero highlights and clickable grid tiles -- a real `lyra-ui` parity counterpart to
  `wa-card`, which this library otherwise mirrors 1:1.
- f9ecffd: `lyra-chip` gains an opt-in `selected`/pressed interactive mode: `[part='base']` becomes
  keyboard-activatable and reflects `aria-pressed`, toggling on click/Enter/Space and emitting
  `lyra-chip-select`. Not combinable with `removable` (avoids a nested-interactive a11y violation);
  today's passive-label-pill usage is unaffected since `selected` defaults to `false`.
- db24359: Add `lyra-code-block-core`: a build-lean variant of `lyra-code-block` for a consumer whose
  `languages` map already covers every language it renders. Unlike `languagesOnly` (a runtime flag
  on `lyra-code-block` itself, which a bundler can't prove always-true and so can't tree-shake),
  `lyra-code-block-core` is a genuinely separate module that never references shiki's full
  ~200-language default entry point at all -- importing it instead of `code-block.js` gives a real
  compile-time exclusion of that table from the build output.
- 83ba36c: `lyra-dialog` gains `--lyra-dialog-width`, unset by default -- when set, the panel actually
  stretches to that width instead of only shrink-wrapping its content capped at
  `--lyra-dialog-max-width`, which was a real gotcha for anyone porting from `wa-dialog`'s
  assertive `--width` token.
- a1d7030: Add `lyra-diff-view`: a real two-string line diff (LCS-aligned), rendered as interleaved
  unified-diff output -- unlike diff-flavored syntax highlighting over an already-formatted string,
  this computes the alignment itself, so a one-line change inside a longer block renders as one
  red/green pair near the change instead of every old line then every new line.
- b56abda: `lyra-empty`'s `heading`/`description` gain the same slot-override-attribute treatment
  `lyra-stat`'s `caption`/`sub` already have -- a consumer can now pass rich mid-sentence content
  (e.g. an inline `<code>` reference) while the plain-string attribute stays the default.
- 4324a73: `lyra-graph` now renders a link whose `target` isn't a real node as a short dashed stub off the
  source's position, instead of silently dropping it -- for a wiki-style `[[link]]`/broken-reference
  visualization where "this edge exists but its endpoint doesn't" is a meaningful state, not noise.
  A dangling `source` is still dropped (no position to draw a stub from).
- 1e71d71: Rewrite `lyra-heatmap`'s two weekday-axis-label tests to assert against independently fixed dates
  instead of re-deriving the implementation's own formula, which could never fail regardless of
  correctness -- the underlying `weekdayLabels()`/`firstDayOfWeek` anchoring was already correct.
  Also add `cellColor`, an optional per-cell color override function (mirroring the existing
  `cellText`/`cellInteractive` shape) that bypasses the color ramp entirely for an exact value.
- 2e74ea0: Fix `lyra-lite-chart`'s `minBarHeight` z-order bug for stacked bars: a floored near-zero segment
  was being overdrawn by the segment stacked on top of it, since each segment's position was derived
  independently from cumulative value rather than from where the previous (possibly-floored) segment
  actually ended on screen. Also add `selectedIndex: number[]`, reflecting `data-selected` onto every
  bar at a given category index across all datasets, for highlighting a whole selected column.
- 00f3b37: `lyra-markdown` gains `escapeHtml`, an opt-in property overriding `marked`'s `html` renderer hook
  to emit escaped text instead of parsed/sanitized markup -- for a consumer rendering arbitrary
  already-written content (transcripts, logs) where a stray angle bracket should render as visible
  text rather than a real DOM element, without giving up GFM tables/lists/etc.
- d3fbf36: Add `lyra-poll-status`: a "next scheduled refresh" countdown with a built-in pause control -- a
  ticking M:SS display, a "Refreshing…" due state, and an internal live region announcing phase
  transitions, mirroring `lyra-stream-status`'s own composition for a different concern (a scheduled
  interval, not transport/connection health).
- b5464bd: Add `lyra-segmented`: a single-select button row with the WAI-ARIA APG `radiogroup` contract
  (role="radio", roving tabindex, automatic-activation Arrow/Home/End navigation) built in --
  "choose exactly one of N labeled options" is ubiquitous settings/filter-panel UI that otherwise
  gets hand-rolled without keyboard/ARIA semantics every time.
- 551f272: `lyra-select` gains `--lyra-select-trigger-height`, unset (auto) by default -- when a consumer sets
  it, the trigger resolves to exactly that height (both floor and cap) instead of only being
  floored by `--lyra-select-trigger-min-height`, for pixel-matching a sibling form field in the same
  row without a blunt `::part(trigger){block-size:...}` override.
- 1fddbdc: Add `lyra-stepper`: ordered multi-step wizard navigation (label + index, current/completed/
  locked/error state, click-to-jump, horizontal/vertical orientation). Fully data-driven and
  controlled -- like `lyra-table`, it never mutates its own `steps` data, firing a cancelable
  `lyra-step-select` event and leaving state updates to the host, so gating a jump behind an
  external validity check (e.g. "does the target step's data exist yet") is a normal listener, not a
  workaround.
- 60dbf18: `lyra-table` gains two per-column hooks: `footer(rows)`, rendered in a real sticky-bottom
  `<tfoot>` (only when at least one column defines it) -- e.g. a totals row; and `cellStyle(row)`,
  applied via `styleMap` directly to the generated `<td>` -- e.g. a computed heat-tint background --
  which coexists safely with the existing sticky-column offset styling.
- 6ce5b87: Add a new `./testing` subpath exporting `installHappyDomFormAssociatedShims()` -- an opt-in,
  environment-guarded polyfill for `HTMLElement.prototype.attachInternals`, for a downstream
  consumer's own Vitest+happy-dom test suite (happy-dom has no `ElementInternals` implementation,
  and every form-associated `lyra-*` component calls `attachInternals()` unconditionally in its
  constructor). Not used by this package's own tests, which already run against real browsers.
- 25254f2: `lyra-widget` gains a leading `icon` slot, rich `label`/`sublabel` slot overrides (mirroring
  `lyra-stat`'s `caption`/`sub` pattern), and a `views` property driving a built-in header toggle
  group plus one named slot per entry -- for a chart/table (or similar) toggle inside the same card
  chrome, so a consumer no longer has to hand-roll that shell around a bare default slot.

### Patch Changes

- 062f036: Fix `lyra-attachment-trigger`'s internal hidden `<input type="file">` actually rendering as a
  visible, focusable-adjacent element in normal document flow — it now has `display: none` by
  default (and a new `hidden-input` CSS part, for the rare integration that needs to override that).
- 9094b39: Fix `lyra-chart` losing a user's legend-toggled hidden-dataset state on every data-driven redraw --
  `draw()` now snapshots each dataset's `isDatasetVisible()` state before reassigning `chart.data` and
  restores it via `setDatasetVisibility()` afterward, since Chart.js's own dataset-object identity
  changes on every reactive update from a live-polling consumer.
- a413c8c: Fix `lyra-chip-group`'s "+N"/"Show less" overflow toggle hardcoding English strings instead of using
  the library's own existing `localize()`/`strings` override mechanism, which every other component
  with translatable text already uses (including the identical `showMore`/`showLess` keys, already
  consumed by `lyra-source-card`).
- 4010bc4: `lyra-menu`'s `onListKeyDown` now ignores a keydown whose target isn't a real `<lyra-menu-item>`,
  matching the same `instanceof LyraMenuItem` guard `onItemSelect`/`onListFocusIn` already use --
  previously it unconditionally intercepted Arrow/Home/End/Enter/Space/Escape/Tab from any keydown
  bubbling through `[part="list"]`, including from non-item slotted content (e.g. a custom-range
  date input), hijacking keystrokes meant for it. Note: Escape/Tab now also only close the menu when
  the event originates from a real item -- a slotted non-item control gets fully default keyboard
  behavior instead.
- a5a055f: Fix `lyra-split`'s fixed-percent panels not reserving space for the auto-inserted divider between
  them, causing a deterministic `(panelCount - 1) * dividerWidth` container overflow in the default
  (uncollapsed) state. Panels now get a nonzero `flex-shrink` so they absorb the dividers' own width
  instead of the row overflowing.
- 18003f0: Fix `lyra-stat`'s `[part='base']` not stretching to fill its host in a CSS Grid -- a stat tile with
  a longer `sub`/breakdown-rows line rendered visibly taller than its row-mates. `block-size: 100%` on
  `[part='base']` now matches the convention `lyra-word-cloud`/`lyra-context-meter` already use.
- 55c384e: Fix `lyra-tabs`'s `tablist` part showing a phantom vertical scrollbar on a tablist with no
  vertically-overflowing content — `overflow-x: auto` alone can leave the y axis's computed overflow
  at `auto` too per the CSS overflow spec, which sub-pixel rounding can trip; `overflow-y: hidden` is
  now explicit, since the tablist is never meant to scroll vertically.

## 2.2.0

### Minor Changes

- ff41aba: `lyra-app-rail`: add a `resizable` opt-in (drag + keyboard-steppable `[part="resizer"]` handle,
  `railWidthPx`/`minRailWidthPx`/`maxRailWidthPx`, `lyra-rail-resize` event) for the `'full'` state's
  width; add `preferredMode` to manually prefer `'full'`/`'icon-only'` while the mobile breakpoint
  keeps tracking automatically; and fix the mobile toggle button's `aria-label` to use a proper
  `openNavigation` message key (consistent with the existing `closeNavigation` key) instead of
  concatenating a hardcoded `" navigation"` suffix onto a partially-localized string.
- 3b1a404: `lyra-app-rail-item`: add an `active` property that reflects `aria-current="page"` onto the
  internal link/button, mirroring `lyra-conversation-item`'s existing `active` pattern.
- 3b7a98b: `lyra-attachment-chip`: fix the uploading progressbar/spinner's `aria-label` to actually use
  `uploadingLabel` (previously hardcoded, unlike the adjacent visible status text); add an
  `untitledLabel` override for the empty-name fallback; add a `compact` density variant.
- 49be9e4: `lyra-attachment-trigger`: add a `triggerTitle` property forwarded to the internal trigger
  button(s)' native `title` (a sighted-mouse-user hover tooltip, distinct from `triggerLabel`'s
  `aria-label` role); reduce the internal `.trigger-button:hover` rule's specificity via `:where()`
  so a consumer's `::part(trigger):hover` override wins without needing `!important`.
- 4d04843: `lyra-code-block`: add a `languagesOnly` opt-in that skips the default `loadShikiHighlighter()`
  call entirely, so a consumer whose `languages` map already covers every language it renders has no
  bundler-reachable path to shiki's full per-language dynamic-import table.
- 2968d7b: Add `lyra-copy-button`: a standalone icon-only copy-to-clipboard button for a plain text `value`,
  with no positioning opinion of its own — for a consumer needing just the copy/checkmark-swap
  affordance without adopting `lyra-code-block`'s or `lyra-json-viewer`'s full content model.
- 49be9e4: `lyra-dialog`: add `noLightDismiss` to opt out of backdrop-click dismissal, and make `close()`
  actually respect a `lyra-dialog-close` listener's `preventDefault()` (the event is now genuinely
  `cancelable: true`) for every dismissal path — Escape, backdrop, the built-in close button, and a
  consumer's own `close()` call.
- 6958595: `lyra-heatmap`: add a `cellInteractive` predicate to opt individual cells out of hit-testing and
  keyboard roving focus, and a `colorSteps` discrete-array ramp as an alternative to the 2-endpoint
  `--lyra-heatmap-scale-lo`/`-hi` linear interpolation (governs both `mode`s and both `scale`
  values). Also adds test coverage confirming `firstDayOfWeek`'s calendar-mode weekday-axis labels
  are correct for a non-Sunday-first week (the underlying computation was already correct; only the
  test combining the two was missing).
- 2c6fc82: `lyra-lite-chart`: add a `minBarHeight`/`min-bar-height` pixel floor for near-zero stacked
  segments, fix `scale="sqrt"` proportionality for stacked bars (previously compressed each
  segment's absolute cumulative stack position independently instead of the bar's total height
  split linearly by segment share), and add a `chartLabel`/`chart-label` override for the chart's
  auto-derived `aria-label`.
- e29b2f9: `lyra-markdown`: add `part="paragraph"`, `part="list"` (both `<ul>` and `<ol>`), and
  `part="inline-code"` (bare inline codespans only, not a fenced code block's `<code>`, which
  already has its own `part="code-block"` wrapper) so a consumer's `::part()` CSS can reach plain
  text elements that previously had no themeable hook.
- 3b7a98b: `lyra-split`: add a `dividerLabel` function property overriding the auto-inserted divider's
  hardcoded English `aria-label` template.

## 2.1.0

### Minor Changes

- 82a3419: `<lyra-attachment-chip>`: added four label-override properties for i18n/locale — `removeLabel`/`retryLabel` (`remove-label`/`retry-label` attributes, the verb prefixed to the remove/retry buttons' `aria-label` ahead of the interpolated filename) and `uploadingLabel`/`uploadFailedLabel` (`uploading-label`/`upload-failed-label` attributes, the verb/phrase used in the visible uploading/error status text, keeping the live percentage interpolation intact for `uploadingLabel`). All four default to today's exact hardcoded English text (`'Remove'`, `'Retry'`, `'Uploading'`, `'Upload failed'`), so leaving them unset changes nothing for existing consumers.
- 82a3419: `<lyra-attachment-trigger>`: added a `triggerLabel` property (`trigger-label` attribute) that overrides the single-capability trigger button's `aria-label`, which previously came unconditionally from the built-in `CAPABILITY_META` table (e.g. `'Attach files'`, `'Attach an image'`, `'Use camera'`). Lets a host localize the accessible name without forking the component. Unset (the default) preserves today's exact `CAPABILITY_META`-derived label for every capability.
- 82a3419: Add `<lyra-code-block>` `languages`, a map of language id to an already-imported shiki grammar module (e.g. `import bash from 'shiki/langs/bash.mjs'`). When `language` matches a key in `languages`, highlighting for it is seeded from exactly that pre-supplied grammar via a fine-grained `createHighlighterCore()` highlighter (`code-loader.ts`'s new `loadShikiHighlighterCore()`), bypassing the default `loadShikiHighlighter()` singleton and its dynamic per-language `loadLanguage()` import entirely for that language — no loading skeleton either, since this path never waits on that singleton. shiki's main entry point (what the default path imports) bundles a dynamic `import()` per bundled language (~200 of them), since a bundler can't statically narrow which of those a `loadLanguage(lang: string)` call might request at runtime; `shiki/core`'s fine-grained API has no such table, so a consumer who pins its full, known language set this way gets a build output scoped to just those languages instead of shiki's entire bundled set. A `language` value absent from `languages` (or left unset, or when `languages` itself is unset) still falls back to the ordinary dynamic-import path unchanged — this is a partial, additive opt-in, not a replacement for it.
- 82a3419: Fixed 'confirm()''s own usage example to import from the granular subpath
  ('@aceshooting/lyra-ui/components/dialog/confirm.js') instead of the root barrel
  ('@aceshooting/lyra-ui') — following the root-barrel example as written previously pulled in the
  library's entire ~80-component side-effect-import chain into a consumer's eager bundle
  (confirmed via a real build: +79 KB gzip regression, fixed by switching to the subpath import).
  No code changed, documentation only.
- 82a3419: Add `heading`/`closable` convenience chrome and a `--lyra-dialog-max-width` token to `<lyra-dialog>`. `<lyra-dialog>` previously required a consumer to hand-build any visible title bar (by slotting a real heading element) and any close affordance (via a footer button wired to `close()`) — `heading` now renders a visible header row with that text when no heading element is slotted (still deferring to a slotted heading, unchanged, when present), and `closable` renders a built-in close (X) button in that same header row, wired through the exact same `close()` path Escape/backdrop-dismiss already use, with reason `'close-button'`. `[part="panel"]`'s previously-hardcoded `max-inline-size: min(32rem, 100%)` is now `min(var(--lyra-dialog-max-width, 32rem), 100%)`, mirroring `<lyra-media-card>`'s `--lyra-media-card-max-height` — the default stays exactly `32rem` when unset. All three are additive/opt-in; existing consumers see no behavior change.
- 82a3419: `<lyra-heatmap>`'s calendar mode gained four additive extensions. `firstDayOfWeek` (0-6, Sunday-first default, same numbering as `CalendarCellPos.weekday`) anchors the week grid at a different weekday instead of always Sunday, threaded into `buildCalendarGrid()`'s new `firstDayOfWeek` parameter; matrix mode ignores it. `rowY` overrides the y-origin computed for each weekday row, the vertical analogue of the existing `columnX`, consulted consistently by drawing, hit-testing, and the keyboard focus ring via a new private `rowYFor()` helper mirroring `columnXFor()`'s exact dispatch-with-computed-fallback shape. The previously matrix-mode-only `cellSize`/`fitToWidth` properties now also size calendar mode's grid, replacing its hardcoded 11px cell constant when explicitly set (unset, calendar mode keeps that original 11px default). The previously matrix-mode-only `scale` property now also governs calendar mode's bucketing: `scale="sqrt"` compresses via the same square-root magnitude compression matrix mode uses instead of always calling `quartileBucket()`, so one heavy day doesn't wash out a skewed dataset; the default `"linear"` preserves today's exact quartile-only calendar behavior. All four are opt-in and no-ops when left unset/default.
- 82a3419: `<lyra-lite-chart>` gained seven additive properties. `pointText` overrides the per-bar/per-point `<title>`/`aria-label` tooltip text (mirrors `lyra-heatmap`'s `cellText` hook), falling back to today's exact raw-value template when unset. `roundedBars` draws bars as a rounded-top-corner path instead of a square-cornered rect (default `false` keeps the plain rect). `skipZero` omits a bar entirely — no mark, no `tabindex`, no tooltip — for a value that is exactly `0`, instead of today's zero-height-but-focusable bar (default `false` unchanged). `padLeft`/`barGapRatio` override the internal `PAD_LEFT`/`BAR_GROUP_GAP` layout constants (36px / 0.2 respectively) when set. `scale` (`'linear' | 'sqrt'`, `type="bar"` only) switches the bar-height mapping from the default linear `niceDomain` fraction to a `Math.sqrt(value / domainMax)` compression mirroring `lyra-heatmap`'s matrix-mode `sqrt` scale, so a skewed dataset's smaller bars aren't washed out by one dominant value; `type="line"` ignores `scale` entirely. `hideAxis` suppresses `renderGrid()`'s gridlines and y-axis tick labels altogether (x-axis category labels are unaffected). All seven are opt-in and no-ops when left unset/`false`.
- 82a3419: `<lyra-markdown>` gains four additive properties. Every rendered `<img>` now carries a `part="img"` (with a matching `[part='img'] { max-width: 100% }` base style), alongside the existing `content`/`heading`/`code-block`/`link`/`table`/`blockquote` parts — previously images went through marked's default renderer with no styling hook at all. `heading-offset` (default `0`) shifts every rendered heading's depth before emitting `<h${depth}>`, clamped to `<h1>`–`<h6>`, letting a consumer nest rendered markdown under an existing heading level without losing document outline. `link-target` (default `'_blank'`, unchanged) can now be set to `null`/`''` to omit `target`/`rel="noopener noreferrer"` entirely and open links in the same tab, instead of always forcing a new tab. `eager-load` (default `false`) skips `connectedCallback()`'s async `marked`/`dompurify` `import()` and renders synchronously whenever the shared module cache (`markdown-loader.ts`) is already warm — e.g. a second `<lyra-markdown>` on the same page, or a consumer that primes `loadMarkdownDeps()` at startup — avoiding the brief plain-text fallback paint that otherwise happens on every connect, even when both peers load without error. All four are opt-in; unset, output is byte-identical to before.
- 82a3419: `<lyra-menu-item>` gained a `type` property (`'normal' | 'checkbox'`, default `'normal'`) and a `checked` boolean, mirroring `wa-dropdown-item`'s identical `type="checkbox"` pattern for building things like a "Word wrap" or "Show minimap" toggle inside a `<lyra-menu>`. A `type="checkbox"` item renders `role="menuitemcheckbox"` (instead of `role="menuitem"`) with `aria-checked` reflecting `checked` and a checkmark glyph shown once checked; activating it (click, or Enter/Space via a parent `<lyra-menu>`'s roving-focus handling) toggles `checked` and fires a new `lyra-menu-item-change` event (`detail: { value, checked }`) in addition to — not instead of — the existing `lyra-menu-item-select`, so a parent menu still closes and re-fires its consolidated `lyra-menu-select` exactly as before. `type="normal"` (the default, and every existing `<lyra-menu-item>` in the wild) is completely unaffected: same role, same rendering, same events as prior releases.
- 82a3419: `<lyra-model-select>`: added a `label` property that renders a visible `part="form-control-label"` title above the trigger/combobox, paired with it via `for`/`id`, mirroring `<lyra-select>`'s own `label` exactly. Once non-empty it also takes over as the accessible-name source, with an explicit host `aria-label` still winning over it (same precedence as `lyra-select`). Unset (the default), the control keeps today's exact `aria-label || placeholder || 'Model'` fallback chain unchanged.
- 82a3419: `<lyra-select>`'s single-enabled-option auto-commit trigger (added 1.3.0) is now gated behind a new `autoCommitSingleOption` property, default `false`. Previously this behavior was unconditional as soon as exactly one `<lyra-option>` was enabled, silently swapping the trigger's ARIA role and keyboard model on any consumer whose option list happened to narrow to one entry at runtime. Existing consumers now get the pre-1.3.0 combobox trigger unless they explicitly opt in with `auto-commit-single-option`.
- 82a3419: `<lyra-split>`'s `collapseState` is now a public accessor with force/auto semantics mirroring `<lyra-app-rail>`'s `mode`: it was previously derived only from the `ResizeObserver`-measured container width, but assigning a concrete `'wide'`/`'rail'`/`'floating'` value now pins it there (ignoring further measurement) until released back to automatic tracking by assigning the write-only `'auto'` sentinel, which immediately re-derives it from the current width. `lyra-split-collapse-change` fires on both a forced assignment and a release-to-auto, exactly as it already did for a breakpoint crossing, and only when the effective state actually changes. The `'floating'` tier also gains a new `open` property (default `false`): previously this state always rendered its pane as an always-visible overlay card the moment the container narrowed past `float-breakpoint`; it's now a hidden-by-default drawer — the pane renders nothing (hidden, out of the accessibility tree) until a consumer sets `open`, at which point it renders with a `[part="backdrop"]` scrim, traps focus, and closes (`open = false`) on Escape or a backdrop click, mirroring `<lyra-app-rail>`'s mobile overlay. `collapseState` still reflects to a `collapse-state` attribute for CSS targeting. `open` defaulting to `false` is a deliberate behavior change for the `'floating'` tier specifically (it was previously always visible); every other collapse behavior, and `collapse="none"` (the default), is unaffected.
- 82a3419: `<lyra-tabs>` can now render a leading icon inside a generated tab button without changing its accessible name. Give a panel's tab an extra direct-child sibling of `<lyra-tabs>` carrying `slot="<id>-icon"` (any markup — an inline SVG, an emoji span, a custom icon element) and it renders ahead of the label inside that tab's button, wrapped in a new `part="tab-icon"` `aria-hidden="true"` span so it's always excluded from the button's accessible name (which stays exactly the `label` attribute's text, as before). A tab with no matching `<id>-icon` sibling renders no icon wrapper at all, so every existing text-only `<lyra-tabs>` is byte-for-byte unaffected. A named slot (rather than an `icon="<name>"` attribute keyed into this library's internal `icons.ts`) was chosen because that internal set is a small closed vocabulary of chrome glyphs for this library's own components, not a public icon registry — a slot lets a consumer supply an arbitrary, domain-specific icon instead.

## 2.0.0

### Major Changes

- 8b5f729: **Breaking:** the root `@aceshooting/lyra-ui` entry point no longer re-exports or
  side-effect-registers the optional-peer-dependent component families — `<lyra-chart>`
  and its typed subclasses, `<lyra-box-plot>`, `<lyra-histogram>`, `<lyra-map>`, and
  `<lyra-graph>`. Import each of these directly from its own subpath instead (the README
  already recommends granular subpath imports as the primary pattern):

  ```js
  import "@aceshooting/lyra-ui/components/chart/chart.js";
  import "@aceshooting/lyra-ui/components/map/map.js";
  ```

  Why: the root barrel previously re-exported every component's public API from one
  `lyra.ts` file, so TypeScript had to resolve `chart.js`/`maplibre-gl`/`d3-force`'s type
  declarations even for a consumer who only imports an unrelated component (e.g.
  `LyraEmpty`) from the package root — a hard compile error for anyone who hadn't
  installed every optional peer. Splitting these families out of the root barrel means
  importing `@aceshooting/lyra-ui` (or any of its remaining members) never requires an
  optional peer's types to be resolvable.

  Every other component (including `<lyra-lite-chart>`, which has zero peer
  dependencies) is unaffected — the root barrel still re-exports/registers everything
  else exactly as before.

### Minor Changes

- 144ad8f: Add a `compact` flag tier and expose three fidelity tiers via `variant`.

  `@aceshooting/lyra-flags`: the ~65 emblem flags now ship a tiny WebP raster at
  `flags/compact/<code>.webp` (~1–3 KB) alongside the standard vector and the pristine `detailed`
  original. `flagUrl(code, { variant: 'compact' | 'standard' | 'detailed' })` selects a tier,
  code-split per flag _and_ per tier so a bundled app ships only the tiers it actually uses. The
  `standard` tier was also re-derived from the pristine originals so every flag is now under 80 KB
  (no fidelity loss perceptible at card/row scale).

  `@aceshooting/lyra-ui`: `<lyra-flag>` gains a `variant="compact" | "standard" | "detailed"`
  property — a tiny raster for icon-scale use (menu items, language selectors), the default
  icon-optimized vector for card/row sizes, or the pristine full-detail vector for hero display.
  The `detailed` boolean is deprecated but kept working as an alias for `variant="detailed"`.

- 2a7390d: Fix `lyra-heatmap` calendar mode's month/weekday axis labels to follow the runtime locale instead of hardcoded English, and add a `columnX` override so a calendar's week columns can be pixel-aligned with an external coordinate function.
- 43864d6: Add `lyra-lite-chart` `layout="scroll"` (fixed-width, horizontally-scrollable bars via `barWidth`), `maxLabels` axis-label decimation, and a `barX` coordinate override for pixel-aligning bars with a sibling `lyra-heatmap`.
- 043b7b0: Move `LyraSelectSize` above `<lyra-select>`'s class JSDoc block so `custom-elements.json` correctly documents `lyra-select` as a custom element.
- 7bbe3d2: Add `lyra-split` opt-in responsive collapse (`collapse="start"|"end"`, `rail-width`, `rail-breakpoint`, `float-breakpoint`): below `rail-breakpoint` the chosen pane clamps to a fixed rail width, below `float-breakpoint` it becomes an absolutely-positioned floating overlay, both signaled via a `data-collapse-state` attribute/dataset marker and the new `lyra-split-collapse-change` event.
- f14165f: `<lyra-stat>` breakdown rows (`StatRow`) gain an optional `exactValue` field, mirroring the headline value's tooltip: setting it renders a `title` tooltip and makes that row's `[part='row-value']` keyboard-focusable, independently per row.
- d62725d: `lyra-table`'s `[part='reveal-columns-button']` now renders only when a `priority` column is actually hidden by the `@container` breakpoints (or `showAllColumns` force-visible mode is active), instead of whenever any column merely declares a `priority`; the new `columnsHidden` reactive property and `lyra-columns-hidden-change` event expose the same real-time state to consumers.

### Patch Changes

- Updated dependencies [144ad8f]
  - @aceshooting/lyra-flags@1.3.0

## 1.3.0

### Minor Changes

- 6358479: Added a "Conversation & Agent UI" family: chat/tool-call/agent-config building blocks for
  streaming AI interfaces, plus the general-purpose primitives (dialog, tabs, checkbox, switch,
  menu, chip, JSON viewer, live region, markdown, code block) they're built from. No breaking
  changes to any existing component.

  New tags: `lyra-dialog`/`confirm()`, `lyra-tabs`, `lyra-checkbox`, `lyra-switch`,
  `lyra-json-viewer`, `lyra-live-region` (+ `internal/announcer.ts`'s throttled `Announcer`),
  `lyra-markdown` (needs the optional peers `marked`/`dompurify`), `lyra-chat-message`,
  `lyra-typing-indicator`, `lyra-tool-call-chip`, `lyra-tool-result-view` (+ its
  `registerToolRenderer()` renderer registry), `lyra-tool-result-dialog`, `lyra-chat-composer`
  (form-associated), `lyra-attachment-chip`, `lyra-stream-status`, `lyra-virtual-list`,
  `lyra-conversation-item`, `lyra-model-select`, `lyra-slider` (form-associated),
  `lyra-tool-select-dialog`, `lyra-citation-badge`, `lyra-source-list`/`lyra-source-card`,
  `lyra-app-rail`, `lyra-responsive-panel`, `lyra-mention-popover`, `lyra-streaming-text`,
  `lyra-thinking-panel`, `lyra-generation-status`, `lyra-code-block` (needs the optional peer
  `shiki`), `lyra-tool-approval-dialog`, `lyra-tool-param-form`, `lyra-menu`/`lyra-menu-item`,
  `lyra-chip`/`lyra-chip-group`, `lyra-model-settings-panel`, `lyra-context-meter`,
  `lyra-dock-panel`, `lyra-document-preview`, `lyra-media-card`, `lyra-attachment-trigger`,
  `lyra-kbd`, `lyra-result-card`/`lyra-result-field`.

  Also extends `internal/rtl.ts` with `rtlAwareSide()`/`rtlAwarePlacement()` (mirrors a physical
  `left`/`right` value, or the `left`/`right` component of a Floating UI `Placement`, under RTL) —
  used by `lyra-menu`'s `placement` property so an explicit `placement="left-start"` still anchors
  to the trailing edge instead of the physical left when the page is RTL.

- 6358479: `<lyra-select>`: when exactly one `<lyra-option>` is enabled, the trigger now auto-commits that
  option on click or Arrow Up/Down instead of opening a single-row listbox — no chevron, no popup,
  `role="button"` instead of `role="combobox"`. Avoids an unnecessary extra click for "only one
  choice available" states (e.g. a filtered picker that's converged to a single match). Multi-option
  selects are unaffected; `value`/validity defaults are unchanged. Not gated behind a new prop — this
  is the new default trigger behavior for any select with a single enabled option.

## 1.2.0

### Minor Changes

- 6e832d5: `<lyra-chart>`: added `IntersectionObserver`-gated lazy redraw and content-signature memoization — a
  chart skips calling into Chart.js while scrolled off-screen (redrawing once when it re-enters the
  viewport) or when none of its content-affecting properties (`type`, `labels`, `datasets`, `legend`,
  `area`, `xLabel`, `yLabel`, `y2Label`, `beginAtZero`, `horizontal`, `stacked`, `config`) have actually
  changed since the last draw. `refreshTheme()` is unaffected and always redraws.
- 9d36af5: `<lyra-combobox>`: the input's accessible name now checks a host-level `aria-label` attribute before
  falling back to `label`/`placeholder`/`"Combobox"` — previously a plain `aria-label` on
  `<lyra-combobox>` was silently ignored. Matches the same fix in `<lyra-select>`.
- 0b3ea6c: `<lyra-flag>`: added a `detailed` boolean property that requests the pristine, full-detail source SVG
  for the minority of flags whose default rendering was recently optimized for icon scale (e.g. `es`,
  `pt`, `sv` — see the `@aceshooting/lyra-flags` changeset). A safe no-op for every other flag. Useful
  for a flag rendered larger than icon scale (e.g. a hero display) where the extra illustrative detail
  is actually visible.
- 2027e3f: `<lyra-flag>`: the default accessible name (`alt`, used when `label` is unset) is now a human-readable
  region name via `Intl.DisplayNames` (e.g. `language="en"` → `"United Kingdom"`) instead of the bare
  uppercase country code (`"GB"`, previously read letter-by-letter by most screen readers).
- 49569ed: `<lyra-heatmap>`: fixed `role="img"` conflicting with the canvas's own focusable, keyboard-interactive
  descendant (arrow-key roving focus, Enter/Space activation) — now `role="group"`, matching
  `lyra-lite-chart`/`lyra-word-cloud`'s existing pattern. Added `cellText?: (pos, value) => string`, a
  formatter hook for the per-cell hover tooltip and keyboard live-region announcement (both draw from the
  built-in English template by default; this is additive, not breaking). Also fixed calendar mode's date
  label formatting, which hardcoded the literal `'en'` locale instead of the runtime locale.
- ef74f4a: `<lyra-lite-chart>`: added `tickFormat?: (value: number) => string` to customize y-axis tick label
  formatting (e.g. currency, duration) instead of the built-in nice-number formatter. Also added
  `IntersectionObserver`-gated lazy rendering and content-signature memoization — a chart skips
  recomputing its grid/marks while scrolled off-screen or when none of its content-affecting properties
  (`type`, `labels`, `datasets`, `legend`, `xLabel`, `yLabel`, `beginAtZero`, `stacked`, plot size) have
  actually changed since the last render.
- 22cf001: `<lyra-select>`: added a `size` property (`xs`/`s`/`m`/`l`/`xl`, default `m`, same scale as
  `lyra-toast-item`'s `size`) for compact toolbar placements that don't fit the default trigger height.
  Also, the trigger's accessible name now checks a host-level `aria-label` attribute before falling back
  to `label`/`placeholder`/`"Select"` — previously a plain `aria-label` on `<lyra-select>` was silently
  ignored.
- 4bf80aa: `<lyra-stat>`: added `exact-value` (shown as a hover/focus tooltip on the headline value, e.g.
  `value="$1.2K" exact-value="$1,204.37"`), a `sub` property/slot (a secondary line distinct from
  `caption`, e.g. a comparison-period label), a `prose` boolean (renders `value` as smaller/lighter text
  with `unit` hidden, for a loading/status message in place of a numeric value), and a `compact` boolean
  (tighter padding for constrained spaces — same convention as `lyra-empty`'s and `lyra-widget`'s
  `compact`).
- c8206f8: `<lyra-widget>`: added `fullscreen-inset` (a raw CSS `inset` shorthand, e.g. `"0 0 0 240px"`, applied to
  the fullscreen panel and backdrop instead of the default `var(--lyra-space-l)` on every side — for apps
  with a persistent sidebar/toolbar that should stay visible during fullscreen) and a `compact` boolean
  (tighter header/body padding), matching `lyra-empty`'s existing `compact` convention.
- a768a20: `<lyra-word-cloud>`: fixed the rendered `<svg>` not respecting a host-assigned height —
  `[part='base']` had no `block-size` rule, so the internal `svg { block-size: 100% }` resolved against
  an indefinite containing-block height and fell back to the spiral layout's own intrinsic size instead,
  overflowing past the host's box. `[part='base']` now constrains to `block-size: 100%`, matching the
  component's own documented `<lyra-word-cloud style="height: 20rem">` usage pattern.

### Patch Changes

- Updated dependencies [da766cb]
  - @aceshooting/lyra-flags@1.2.0

## 1.1.0

### Minor Changes

- c033ec0: `@aceshooting/lyra-flags`: `flagUrl(code)` is now genuinely code-split per flag — each code is
  its own dynamically-`import()`ed chunk, so using it (directly, or via `<lyra-flag
country=...>`/`<lyra-flag language=...>`) only ever fetches the flags actually requested at
  runtime, not all 249. This makes `flagUrl()` `async` (**breaking**: `Promise<string | undefined>`
  instead of `string`). `FLAG_URLS` (the old synchronous, eager, all-249-at-once map) is no longer
  exported from the package root — the equivalent for a consumer that genuinely wants every flag up
  front (e.g. a flag-picker listing every country) is the new `flagUrls()` (`async`, resolves the
  full map). `FLAG_LOADERS` (the new lazy per-code map `flagUrl()` is built on) is exported directly
  for consumers that want the per-code laziness without going through `flagUrl()`.

  `@aceshooting/lyra-ui`: `<lyra-flag>` transparently picks up the lazy-loading fix — no changes
  needed at call sites using `country`/`language`. Also adds a new `src` property: a pre-resolved
  flag image URL that takes precedence over `country`/`language` and skips the peer-package lookup
  (and its loading-skeleton round trip) entirely, for consumers who already have a flag's URL at
  build time (e.g. via `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`).

- c033ec0: Added `<lyra-lite-chart>` — a dependency-free bar/line chart (plain SVG/DOM rendering, zero peer
  dependencies) for projects whose architecture forbids a charting dependency outright. Covers
  grouped/stacked bars, multi-series lines, per-point click (`lyra-point-click`, same detail shape as
  `lyra-chart`'s), and hover tooltips via native SVG `<title>`. Not a full `lyra-chart` replacement —
  no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no horizontal/dual-y-axis, no raw-config
  passthrough. Reuses `lyra-chart`'s `--lyra-chart-*` theme token names for free cross-component
  theming.
- c033ec0: Added `<lyra-word-cloud>` — a dependency-free SVG word/tag cloud, laid out via an outward
  Archimedean-spiral placement search (heaviest word first). Supports `linear`/`sqrt` weight-to-font
  scaling, optional `mixed` (rotated) orientation, per-word or per-`group` coloring with a themeable
  `--lyra-word-cloud-color-1..8` palette, and roving-tabindex keyboard navigation matching
  `lyra-heatmap`'s pattern (a single tab stop, arrow keys, Home/End, a live-region announcement).

  Also a hardening pass across the rest of the library — real bugs fixed, not just polish:

  - `lyra-skeleton`: `width`/`height` properties had zero visual effect (the custom property was set
    on the wrong shadow-DOM node); now actually resizes the placeholder.
  - `lyra-combobox`: setting `open` directly (bypassing `show()`) never wired up click-outside or
    fired `lyra-show`/`lyra-hide`; picking a row or clearing while using `source` left stale async
    results displayed; a `<lyra-option selected>` appended after the first slotchange was ignored;
    two nameless `multiple` comboboxes in the same form merged their submitted values; a pending
    debounced `source` fetch could fire after the element was removed.
  - `lyra-chart`: bubble-chart series got a categorical (not numeric) x-axis, collapsing every point
    onto one tick; `resetZoom()` double-emitted `lyra-zoom`, briefly reporting the stale pre-reset
    `zoomed` state to `{ once: true }` listeners.
  - `lyra-date-picker` / `lyra-date-input`: the already-exported `clampDate()` was never actually
    wired in, so `goToDate()`/`goToToday()` could navigate to (and focus) an out-of-range date;
    locale/weekday-format/first-day-of-week wiring gained test coverage; outside-month placeholder
    cells are now `aria-hidden` only in rows that also have a real visible day.
  - `lyra-tree`: mouse-driven expand/collapse/select could desync the roving-tabindex `activeId` from
    real DOM focus; arrow-key expand/collapse is now RTL-aware, matching `lyra-split`/`lyra-time-range`.
  - `lyra-widget`: the fullscreen focus trap didn't pierce into a slotted custom element's own shadow
    root, letting focus escape to a hidden nested control.
  - `lyra-toast-item`: the close button used the native `disabled` attribute, which force-blurs a
    focused element with nothing to restore it — switched to `aria-disabled`.
  - `lyra-empty`: gained a live-region announcement when entering the empty state, matching
    `lyra-skeleton`'s existing `role="status"` convention.
  - Accessibility, documentation, and test-coverage fixes across most other components; `llms.txt`,
    `llms-full.txt`, and both READMEs corrected for drift against the current API surface.

  No breaking changes.

### Patch Changes

- Updated dependencies [c033ec0]
  - @aceshooting/lyra-flags@1.1.0

## 1.0.1

### Patch Changes

- 436b1ce: Fix `scripts/publish.sh` to commit `CHANGELOG.md` and `custom-elements.json` with each release commit (previously only `package.json`/the lockfile were staged, leaving those generated files uncommitted after every release). Remove the redundant `.github/workflows/publish.yml` CI job, which always failed by re-publishing a version `publish.sh` had already shipped.

## 1.0.0

### Major Changes

- 99fb0e0: Added several new components

### Patch Changes

- Updated dependencies [99fb0e0]
  - @aceshooting/lyra-flags@1.0.0

All notable changes to `@aceshooting/lyra-ui` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes on GitHub (`gh release create --generate-notes`) are generated from commit
history and may be more granular than this file; this file is the curated, human-readable
summary.

## [Unreleased]

No unreleased changes yet.

## [0.1.3] baseline

Current published baseline at the time this changelog was introduced. Historical versions
prior to 0.1.3 were not backfilled into this file — see git tags (`git tag -l`) and GitHub
Releases for the full release history.

- Free, clean-room Lit 3 web-component library — an open-source companion to Web Awesome.
- Tiered component set (layout/atoms, forms, overlays, data-viz/dashboard, temporal/graph,
  map/file/flag families) — see `packages/lyra-ui/llms.txt` and `llms-full.txt` for the full
  API reference.
- `@aceshooting/lyra-flags` optional companion package for `<lyra-flag>` artwork.

[Unreleased]: https://github.com/aceshooting/lyra-ui/compare/0.1.3...HEAD
[0.1.3]: https://github.com/aceshooting/lyra-ui/releases/tag/0.1.3
