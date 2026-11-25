# Changelog

## 1.5.0

### Minor Changes

- 40f8be5: `@aceshooting/lyra-gen/adapters/a2ui-candidate.js` adds `A2uiV1Processor`, an opt-in processor for a declared A2UI v1.0 candidate profile that is separate from the stable v0.9.1 processor. It accepts `createSurface` with an initial component tree and data model, component replacement by id, data model updates with explicit-null deletion, and per-component `@catalogId` limited to host-registered catalogs built with `createA2uiV1Catalog()`. It enforces `allowedParents` and `allowedChildren` nesting and maps `@accessibility.label` onto the target role's accessible-name property. Each surface becomes a `validateView`-admitted lyra-gen view whose node identities stay stable across updates. Out-of-profile input is rejected with a v1.0 `error` message (`VALIDATION_FAILED`, `UNALLOWED_PARENT`, `UNALLOWED_CHILD`, `INTEGRITY_ERROR` or `INVALID_FUNCTION_CALL`) that the host can return to the model. `exportA2uiV1Catalog()` exports the catalog with its nesting rules, and `a2uiV1RendererCapabilities()` advertises nothing unless the host asserts qualification.
- 522a4c8: Validation errors are now actionable for models and common content mistakes can enter the repair loop. Every diagnostic a model can fix carries a concise `hint`: allowed enum values, the expected type and bounds of a value, the missing required property and its shape, the nearest declared name for an unknown component, property, slot, action, query or state path, and the owning node for a duplicate identity or an overlapping binding; hints never repeat generated values. Content-shape failures that `recovery: 'isolate'` can contain (unknown properties and component types, reads of unowned state, wrong types, out-of-range values, missing required properties) are now in `REPAIRABLE_DIAGNOSTIC_CODES`, and the new `isRepairableDiagnostic()` keeps schema failures outside a node's own properties, such as action payloads, terminal; identity, binding ownership, content policy, catalog version, revision and resource-limit failures stay non-repairable, and every repaired candidate is still validated as a whole. The new `formatRepairMessage(diagnostics, { maxCharacters, view })` renders diagnostics as a compact, deterministic, size-bounded repair instruction grouped by node.
- 40f8be5: New reviewed chart roles exported as `chartExtraRoles` broaden the dashboard vocabulary: `donut-chart` (`lr-doughnut-chart`), `radial-chart` (`lr-polar-area-chart`), `radar-chart` (`lr-radar-chart`), `horizontal-bar` and `bar-list` (`lr-bar-chart` profiles whose horizontal axis, and for the ranked list the hidden legend and grid, are pinned by a trusted adapter), `bubble-chart` (`lr-bubble-chart`), `category-bar` (`lr-context-meter` segments with variant tones), `tracker` (`lr-sequence-strip` cells coloured only from a closed set of theme colour tokens) and `chord` (`lr-chord`). Every role renders from plain bounded JSON with a usage guide and one reviewed example; raw colours, formatters, plugins, chart configuration and activation callbacks stay host-owned.
- 83884b3: Smaller model-facing prompts and schemas, plus provider tool helpers. `buildCatalogPrompt()` now leaves out renderer-only metadata and the implicit object closure and default number range while keeping every bound a model must respect (about 15-19% fewer tokens), and accepts `format: 'markup'` (Lyra Markup output with Markup examples), an opt-in `profile: 'signature'` that describes each role on one typed line (about a quarter of the size), and `examples`. `exportCatalogJsonSchema()` hoists repeated sub-schemas into `$defs` (about a quarter of the size; `{ inline: true }` returns the equivalent inline schema). New `buildRefinementPrompt()` asks for a patch scoped to one node with only the roles it uses, and `@aceshooting/lyra-gen/provider-tools.js` wraps prompt and schema as Anthropic, OpenAI and AI SDK-style tool definitions with an `estimatePromptTokens()` approximation.
- 40f8be5: New `@aceshooting/lyra-gen/dashboard-plan.js` entry point: `planDashboard(view, catalog)` returns a deterministic, frozen plan of a dashboard's panels (role, accessible label, query name with literal or state-pointer parameters, live and repeat sources, interactive controls with the state paths they own) plus static warnings for unowned parameter reads, live reads with no data source, repeats without a template and panels with nothing to show. `dryRunDashboard(view, catalog, { queryProvider, ... })` runs every bound query once against the current state without running actions or changing state, checks results against the catalog schemas as `lr-gen-view` does with a per-query timeout and abort, and reports each panel as ok, empty, failed, invalid-result or oversized (generic messages only) with an overall `publishable` flag, so a host can verify a dashboard before publishing it.
- 9e94ac0: New opt-in `dashboardCatalog()` overlay and `liveDashboardCatalog` preset add reviewed live-dashboard roles — `gauge`, `sparkline`, `progress-bar`, `progress-ring`, `budget-meter`, `number-ticker`, `funnel`, `poll-status`, `tabs`/`tab`/`tab-panel`, `details`, `timeline`/`timeline-item`, `series-chart`, `treemap`, `sankey`, `word-cloud`, `heatmap`, `data-grid`, `time-range` and `filter-bar` — each rendering from plain bounded JSON with host-owned formatters and callbacks. `mapCatalog(base, { mapStyle })` adds a `map` role with bounded markers and camera over a host-owned basemap, plus choropleth values keyed to a host-declared region set when `regions` is supplied.
- 40f8be5: New `@aceshooting/lyra-gen/data-export.js` extracts the data of every data-bearing node of a view (tables, charts, data grids, heatmaps, funnels, stats, gauges, sparklines, treemaps, sankeys, word clouds) as named tables with `exportViewData()`, writes them as RFC 4180 CSV with spreadsheet formula protection, an optional byte order mark and a size bound with `toCsv()`, and builds a standalone, script-free, print-styled HTML document for printing to PDF or rasterizing with `exportPrintableHtml()`. New `@aceshooting/lyra-gen/dashboard-copy.js` adds `copyDashboardPanel()`, which copies one saved panel subtree into another view as a validated patch insertion with collision-free ids, dropping bindings, reads and actions the target catalog does not allow.
- 8a8ecb0: The dashboard chart roles `bar-list` and `category-bar` now render the dedicated `lr-bar-list` and `lr-category-bar` components with plain-data schemas (`items`/`sort`/`max`, and `values`/`variants`/`marker`/`withLabels`), and a new `radial-bar` role renders concentric progress rings through `lr-radial-bar`. The polar-area `radial-chart` role is unchanged. The `tracker` role now requires a `label`, used as the strip's accessible name.
- 83884b3: Developer tools for building generated dashboards without a backend or a model: `mock-data.js` derives deterministic, bound-respecting sample JSON from a catalog (`mockQueryResult()`, `mockLiveData()` and `createMockQueryProvider()` for `lr-gen-view.queryProvider`), `telemetry.js` adds dependency-free OpenTelemetry-shaped spans and counters for parse, validate, preview, repair and render phases plus `observeGenView()` and `recordUsage()` that never report state values, prompts or user text, and `lyra-gen init [dir]` scaffolds a static starter host that streams a canned dashboard with mock data and refuses to overwrite existing files.
- 40f8be5: Add `<lr-gen-devtools>`, a read-only developer inspector for an `lr-gen-view` loaded from its own `@aceshooting/lyra-gen/devtools.js` entry point. Assign `.target` to a generated view to browse its node tree (selecting a node outlines it and marks it with a temporary `data-gen-inspected` attribute), the current and last ready revision with its `changes`, binding state with dirty pointers, live data, a bounded log of ready, state-change, action and error events, and the catalog's roles and actions. It never dispatches actions or edits state, always masks values bound by password, one-time code, payment card and secret fields, and is localized, keyboard and screen-reader accessible. Nothing else in the package imports it, so production bundles leave it out.
- 1d41e18: `lr-gen-view` gains `elementForNode(nodeId)`, returning a generated node's rendered element in the current revision (stable across revisions and keyed reorders), and documents the `data-gen-id` and `data-gen-type` attributes every rendered element carries, so hosts can highlight, scroll to or annotate a node without inferring it from DOM order.
- 40f8be5: Catalog components can declare a trusted `eventPayload(event)` adapter that derives an action payload from the event that initiated it; the result is validated against the action schema, and a throw denies the action. The `mcp-app` role uses it so an embedded app's own tool name and arguments reach the host's authorization instead of the node's static payload.
- 40f8be5: Generated nodes can declare `visible` (show only while a condition over owned state, live data or the current repeat item holds, keeping the element and its state), `checks` (conditions that must all hold, otherwise a role with `disabled` renders disabled) and `computes` (a declared property computed by a host-registered pure function from referenced values, through `lr-gen-view.functions`, defaulting to the built-in bounded registry). Conditions use a closed operator set and literal comparisons; no generated code is evaluated.
- 522a4c8: `@aceshooting/lyra-gen/lines.js` adds Lyra Lines, an opt-in compact output profile: one indented line per node with the catalog's required properties written positionally, optional properties as `key=value`, node members as `@member=JSON` and text after `| `. `parseLines()` and the streaming `createLinesParser()` turn it into an ordinary JSON v1 view before validation and storage, so nothing is stored in a new format; `encodeLines()` writes it losslessly, and `buildLinesPrompt()` (`@aceshooting/lyra-gen/prompts-lines.js`) asks a model for it. A header pins the positional order to the catalog id and version, ids are explicit unless `elideIds` derives `<type>-<n>` before validation, and the bounded parser rejects ambiguous or oversized input with line and column diagnostics instead of guessing. On the offline dashboard benchmark it measures about 0.56x the approximate tokens of JSON; it stays opt in until evaluated with a real model.
- 9e94ac0: Generated nodes can declare `liveReads`, mapping a declared, non-URL property to a pointer into the host-published `lr-gen-view.liveData`; reassigning `.liveData` updates those properties without a new revision or state change, falling back to the node's own props when a value is missing or violates its schema.
- 40f8be5: New opt-in `mcp-app` role embeds a sandboxed MCP App through `lr-mcp-app`. The host supplies the reviewed resources (`ui://` identity, inline document or URL, CSP and permissions), the protocol and capability grants, and the allowed tool names; generated content can only choose one of the host-allowlisted resource ids, set a label and pass bounded scalar input. Tool requests from the app initiate a confirmed `mcp-tool-call` action limited to the allowlisted tools, so `lr-gen-view`'s existing action authorization applies and lyra-gen never executes a tool.
- 83884b3: Add media and entity answer roles. `mediaComponents(base, { origins })` supplies a `media-card` role whose `src` is a declared media URL sink limited to the exact HTTPS origins the host approves, with a required kind and accessible description, and the plain-data `entity-card` role shows one entity's label, description, text or number rows, relationship count and community without type colours, links or actions.
- 40f8be5: New `@aceshooting/lyra-gen/model-context.js` entry point: `createModelContext(view, state, options)` serializes what the user currently sees and has edited (surface id, revision, a compact node outline, bound values, dirty pointers, host selection and live-data summary) into a frozen, deterministic, byte-bounded plain-JSON object to send back to a model on the next turn, and `toPromptText(context)` renders it as a compact text block. Host-declared private JSON Pointers and every state path owned by a password, one-time-code, payment-card or secret field are never emitted, and oversize contexts drop the least relevant parts first and are marked `truncated`.
- 40f8be5: Generated nodes can declare `a11y`: `label` fills the role's own accessible-name property (and satisfies required names), `description` becomes `aria-description`, and on non-interactive roles `live` (`off`/`polite`) and `hidden` set a live region or hide decorative content; interactive roles can never be hidden or made live regions.
- 9e94ac0: `editDashboardLayout()` accepts `add` (a panel with a new id, placed in the first free cell under `pack`) and `remove` (unpinned panels only) edits; every other panel keeps its position and the layout constraints still hold.
- 40f8be5: `lr-gen-view.partial` renders a progressive parser's partial view as a streaming preview: the surface is inert, no `lr-gen-ready` fires, state is not reconciled, and nodes whose subtree is still open carry the `partial` part and `aria-busy`; the committed `document` for the same surface and revision replaces it while keeping every shown element.
- 1d41e18: `applyViewPatch()` accepts an `insert` operation (`{ op: 'insert', parentId, node, before?, after? }`) that adds a new node under an existing parent, before or after one of its current children or appended last, validated against the parent's catalog children and the same limits, with every untouched sibling keeping its identity.
- 83884b3: Chat islands can preview while they stream. `createChatStream({ progressive: true })` (or `{ minCodeUnits }`) gives each `loading` island a `partial` view: a validated, only-growing preview of the fenced `lyra` block received so far, carrying the surface and revision of the committed document and with host source authorization already applied. Hosts pass it to the island's `lr-gen-view` as `.partial`, which renders inert until the committed `.document` of the same surface and revision replaces it. Cancellation, interruption, rejection and invalid islands clear the preview and keep their existing fallbacks, previews never contain nodes absent from or invalid in the source, and the committed document is identical with or without the option. `createIslandParser()` accepts the same opt-in as `progressive: { catalog, minCodeUnits? }` and exposes the preview on the open island part.
- 40f8be5: Generated views can now render progressively while they stream. `createJsonViewStream({ progressive: true })` and the new `createProgressiveMarkupParser()` return a validated `partial` preview on `incomplete` pushes: the complete nodes received so far, with still-open containers closed and listed in `partialNodes`, and the unfinished trailing node left out rather than guessed. Previews only grow (a shown node keeps its identity), carry the surface and revision of the final commit, are spaced so validation work stays linear in the stream length, and stop at the first syntax defect; `finish()` returns exactly the result of a non-progressive stream. Lyra Markup also accepts `visible`, `checks`, `computes` and `a11y` node members.
- 40f8be5: Catalogs can declare host data `queries`, and generated nodes name one through `dataQuery` with literal `params` and `paramReads` from owned state (filters, selection, time range); `lr-gen-view.queryProvider` runs it once per distinct argument set, aborts superseded runs, keeps the last result with the `query-pending`/`query-failed` parts, and the node's `liveReads` read the result. A node's `repeat` renders its single template child once per keyed item of a live-data, query or state array, with `itemReads` relative to each item and stable element identity across reorders.
- 1d41e18: `lr-gen-ready` now carries `changes` — the node ids a revision `added`, `changed` and `removed` since the previous ready revision of the same surface (absent for a surface's first one) — and the added and changed components carry the unstyled `changed` part until the next ready revision, so hosts can highlight a refinement. The new `diffViews(previous, next)` helper computes the same comparison.
- 40f8be5: Add reviewed rich answer roles, exported as `richAnswerRoles`: `markdown` (Markdown source rendered with raw HTML shown as text and with links and images rendered as plain text), the agent metrics `context-meter`, `stream-status` and `generation-metrics` (plain numbers and status; the built-in Stop and Resume actions and the stall timer stay host-owned), bounded `graph` (at most 200 nodes and 400 edges, sized to its cell) and `mind-map` (one root, at most 12 by 12 topics), and driving controls that write view state through bindings: `segmented`, `toggle-group` with `toggle`, `checkbox-group` with `checkbox-option`, `radio-group` with `radio`, `number-input` (bind `valueAsNumber` to share a number) and `date-input` (one `YYYY-MM-DD` day). Every role carries a reviewed example and usage guide, and none exposes callbacks, URL sinks, data providers or editing.
- 40f8be5: Add `@aceshooting/lyra-gen/scripted-conversation.js`, a framework-free controller for branching scripted (no-model) conversations on one generated surface. `createScriptedConversation({ tree, catalog, surfaceId, buildStep })` validates a bounded, acyclic choice tree; tracks the current path through `choose()`, `back()`, `restart()`, `goTo()` and `retry()`; and gives every transition a new, strictly increasing revision, including Back. A later transition aborts and discards a superseded build. Control edits through `setControls()` are coalesced into at most one in-flight build, and the latest values win. Each step result is validated against the host catalog, and the controller publishes frozen snapshots with the current choices, a transcript of application-owned copy and a focus hint. `connectScriptedConversation()` binds the controller to an `lr-gen-view`: it assigns each committed document, accepts `lr-gen-ready` only for that revision and restores focus to the next choices only when the host opts in.
- 40f8be5: The reviewed `slider` role accepts `withValue`, `withTooltip`, `tooltipPlacement` and a declarative `format` (`decimal`, `currency`, `percent` or an Intl unit, with fraction digits); the trusted adapter turns the format into a locale-bound `valueFormatter`, so generated sliders show and announce values such as "€200" or "80%" instead of a bare thumb and a raw number.
- 1d41e18: Generated nodes can declare `reads`: a declared, non-URL component property shown from a local-state path that a binding in the same view owns, so a slider bound to `/limit` updates a sibling gauge or stat live without a new revision. A read value applies only while it satisfies the property schema; the prompt schema, markup, templates and static SSR understand `reads`.
- 40f8be5: The dashboard overlay gains reviewed technical-answer roles: `code-block` (bounded source text with a closed language list), `json-viewer` (JSON at most four containers deep), `diff-view` (two bounded texts), `test-results` (bounded suites and tests with status and duration) and `trace-tree` and `span-waterfall` (bounded spans linked by parent with status and timing). Copy actions, remote sources, highlight anchors, callbacks and editing stay host-owned.
- 40f8be5: Generated views can now be driven by any agent stack over standard wire formats. The new `@aceshooting/lyra-gen/adapters/json-patch.js` entry translates RFC 6902 JSON Patch operations addressed at node positions (for example `/root/children/1/props/title` or `/root/children/-`) into identity-addressed revision patches applied through `applyViewPatch`, so the revision, catalog, limit and identity guards all still apply, and `viewPatchToJsonPatch()` turns two view revisions back into RFC 6902 operations for clients that consume JSON Patch. The new `@aceshooting/lyra-gen/adapters/ag-ui.js` entry provides `createAgUiViewReducer()`, a synchronous reducer from AG-UI `STATE_SNAPSHOT`/`STATE_DELTA` (and optionally `ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA`) events to validated `view`, `liveData` and `bindingState` values that rejects invalid deltas with diagnostics while keeping the previous valid view. The AI SDK bridge now reconciles data parts by name and id as the SDK does, and its new `resolveData()` admits raw `onData` chunks, including transient view updates that advance the revision without replacing message history.

### Patch Changes

- 83884b3: `<lr-gen-view>` renders large views and live dashboards faster. Preparation slices are time-budgeted instead of capped at a fixed step count, so a small view commits in one frame and a 500-node view in a few instead of about twenty. A `liveData`, state or query-result update re-prepares only the nodes whose `liveReads`, `reads`, `bindings`, `itemReads`, `visible`, `checks`, `computes` or `dataQuery` read the changed source and reuses every other prepared node and its element. Live data that changes while a render is in flight no longer restarts it: the render commits, then re-prepares the affected nodes, so frequent ticks cannot starve a large view. Rendered output, events and readiness are unchanged; `lr-gen-ready` still fires once per document revision, not on live ticks.
- 83884b3: Validation, patching and streaming previews are several times faster with identical results. A catalog schema is admitted and inspected once per set of limits instead of once per property value (`createCatalog()` now deep-freezes property, action payload and query schemas), property values already admitted with their view are not copied again, and resolved limits are reused. A view returned by validation, or by `applyViewPatch()`, validates again at no cost against the same created catalog and limits, so a patch no longer re-validates its unchanged base and addresses nodes through one identity index. Progressive JSON and Markup previews reuse the admitted copy and recorded checks of every completed subtree, so each preview validates only new or still-open nodes while identity, binding-ownership and read checks still run over the whole preview. `applyViewPatch()` also accepts `{ op: 'set', nodeId, prop, value }` to assign one property and `{ op: 'move', nodeId, parentId, before?, after? }` to relocate a subtree; both pass the same full validation of the patched view.

## 1.4.2

### Patch Changes

- Updated dependencies [d02b1b6]
- Updated dependencies [22a4f2f]
- Updated dependencies [6dc25b2]
- Updated dependencies [53802fc]
- Updated dependencies [5b4d9ac]
- Updated dependencies [6dc25b2]
- Updated dependencies [3cbc444]
- Updated dependencies [6dc25b2]
- Updated dependencies [6dc25b2]
- Updated dependencies [e4f09a0]
- Updated dependencies [7f10f6e]
- Updated dependencies [6dc25b2]
- Updated dependencies [6dc25b2]
- Updated dependencies [6756f15]
- Updated dependencies [6dc25b2]
- Updated dependencies [6dc25b2]
- Updated dependencies [6dc25b2]
- Updated dependencies [599ae22]
- Updated dependencies [e2ef760]
- Updated dependencies [1fa99d5]
- Updated dependencies [91a6b10]
- Updated dependencies [52a9ecf]
- Updated dependencies [6dc25b2]
- Updated dependencies [6dc25b2]
- Updated dependencies [6dc25b2]
- Updated dependencies [52a9ecf]
- Updated dependencies [6dc25b2]
- Updated dependencies [f920ad2]
- Updated dependencies [72f11d6]
  - @aceshooting/lyra-ui@33.0.0

## 1.4.1

### Patch Changes

- cd597ad: Size ceilings follow reviewed measurements after the consumer-gap theming tokens and options. These are the form, overlay, map, chart, table and layout hooks, plus dialog `fullscreen-narrow` and panel tokens, drawer `floating`, popover sizing, toast insets, chip-group selection, label placement, and the shared form-control transition and focus-outline hooks. Measured gzip bytes:

  - 1,815,368 for `dist/autoloader-cdn.js` and 1,815,250 for `dist/autoloader.js`
  - 487,533 for the data barrel, 296,640 for forms, 401,656 for media, 160,986 for overlays and 248,451 for utility
  - 152,747 for `dist/lyra.js`; `prompt()` stays on its granular subpath, so the root entry does not carry `lr-input`
  - 95,916 for the standalone combobox and 153,922 for the component p95
  - 39,447 initial marginal bytes for combobox and 16,827 for tooltip

  In `@aceshooting/lyra-gen`, the same additions change how gen-view's lazy chunks split. Lazy raw JavaScript grows by only 362 bytes, but the per-file gzip sum reaches 257,942 bytes. Chat-composition lazy JavaScript measures 1,044,304 raw and 305,790 gzip bytes.

  Each exceeded ceiling advances only to the next 64-byte boundary above its measurement. Passing ceilings, the headroom policy and optional-peer exclusions are unchanged.
- 67cef2a: Size ceilings follow reviewed measurements after the `lr-table` structure options (stacked headers, header-less rows, row headers, row attributes, cell wrapping and the `--lr-table-*` tokens) and the consumer theming tokens and options across forms, layout, overlays, utility, data, media, charts and conversation. Measured gzip bytes:

  - 1,835,181 for `dist/autoloader-cdn.js`, 1,835,012 for `dist/autoloader.js`, 1,595,774 for `dist/all.js` and 1,859,275 for `dist/ssr/all.js`
  - 491,093 for the data barrel, 298,510 for forms, 415,697 for layout, 407,286 for media and 253,095 for utility
  - 153,301 for `dist/lyra.js`
  - 39,626 initial marginal bytes for combobox

  With their documented styling hooks, the lyra-ui package measures 24,321,454 unpacked bytes (npm estimate) and the generated IDE data 1,946,895 packed archive bytes.

  In `@aceshooting/lyra-gen`, gen-view lazy JavaScript measures 259,887 gzip bytes and chat-composition lazy JavaScript 1,051,747 raw and 307,678 gzip bytes.

  Each exceeded ceiling advances only to the next 64-byte boundary above its measurement. Passing ceilings, the headroom policy and optional-peer exclusions are unchanged.

## 1.4.0

### Minor Changes

- d72f7b0: Add optional catalog-directed normalization for misplaced generated properties, theme generated heading and paragraph typography, and document styling generated component parts.
- 59cb878: - `lr-heatmap` gains `label` and `description`, matching `lr-chart`: a host `aria-label` still wins, a blank label falls back to the generated summary (which moves to the new `[part="description"]` while a label names the chart), and `description` replaces that summary as the canvas, grid or `matrixSource` description.
  - Lyra Gen object schemas accept a bounded open map: `additionalProperties: <schema>` with required `maxProperties` and `propertyNames.maxLength`. Validation, the exported catalog JSON Schema and the content policy (URL-named map keys are refused) all honor it; the closed profile rejects it.
  - Lyra Gen roles can declare `hostProperties`: element properties only `prepareProperties` supplies. The view assigns them, generated content cannot set or bind them, and prompts, catalog artifacts and exported schemas omit them.
- 3814758: - `lr-chart`: a `type: 'band'` series with per-category `lower`/`upper` bounds fills a confidence
    interval or percentile envelope beneath every line on line and bar charts, tinted by the new
    `--lr-chart-band-opacity` token. The tooltip, generated data table, keyboard announcement, summary,
    CSV export (`<label> lower`/`<label> upper`) and legend swatch carry both bounds; formatters receive
    them as `statistic: 'min'`/`'max'`. New localized string `chartBandRange`.
  - Chart legends: `--lr-chart-legend-gap`, `--lr-chart-legend-padding`, `--lr-chart-legend-font-size`,
    `--lr-chart-legend-item-min-height`, `--lr-chart-legend-item-padding`,
    `--lr-chart-legend-swatch-size` and `--lr-chart-legend-swatch-radius` style the DOM legend of
    `lr-chart` and its typed aliases (such as `lr-doughnut-chart`) and `lr-box-plot`; `lr-lite-chart`
    honors the gap, padding, font-size and swatch tokens. Defaults are unchanged.
  - `lyra-gen`: the reviewed `stat` role accepts `frame`, `deltaPercent` and `goodDirection`, sharing the
    `kpi-row` validators.

### Patch Changes

- afb2b75: Keep keyboard focus and text selection when a generated view reorders a keyed input inside a consumer shadow root.

  Ignore confirmation results from replaced documents and retire deferred form resets when their binding state or document changes.

  Fix the installed README and guide links for the existing AG-UI transport and catalog preset examples.
- 7f71f81: - `lr-diff-view` no longer paints a highlight whose start lies outside the diff on the last line; painting and `scrollToAnchor()` now agree.
  - `lr-email-viewer` shows a localized note instead of a blank body when an HTML-only message sanitizes to nothing.
  - `lr-include` resolves a same-page `#id` inside the shadow root that contains it before falling back to the document.
  - `lr-format-bytes` and `formatBytes()` show a value that rounds up to the next unit step on that unit (`1 MB`, not `1,000 kB`).
  - `lr-image-comparer` drops a pending keyboard change when it is disconnected.
  - `lr-model-viewer` keeps the loaded model when only `name` changes and the detected format stays the same.
  - `lr-word-cloud` keeps words legible in a narrow host (scrolls instead of shrinking) via the new `--lr-word-cloud-legible-font-size` token.
  - `lyra-docs` and `lyra-gen` publish a `custom-elements.json` for `lr-docx-editor` and `lr-gen-view`.
- Updated dependencies [d72f7b0]
- Updated dependencies [7f5ec4a]
- Updated dependencies [d7c393e]
- Updated dependencies [844a92c]
- Updated dependencies [6962da4]
- Updated dependencies [6962da4]
- Updated dependencies [6962da4]
- Updated dependencies [b42179f]
- Updated dependencies [6962da4]
- Updated dependencies [6962da4]
- Updated dependencies [dba234e]
- Updated dependencies [afb2b75]
- Updated dependencies [5bb1448]
- Updated dependencies [f226c9b]
- Updated dependencies [8e9ad29]
- Updated dependencies [67673cb]
- Updated dependencies [c768915]
- Updated dependencies [71a8b37]
- Updated dependencies [376f3e2]
- Updated dependencies [8e9ad29]
- Updated dependencies [c768915]
- Updated dependencies [96166b2]
- Updated dependencies [376f3e2]
- Updated dependencies [c768915]
- Updated dependencies [96166b2]
- Updated dependencies [376f3e2]
- Updated dependencies [8e9ad29]
- Updated dependencies [376f3e2]
- Updated dependencies [f226c9b]
- Updated dependencies [67673cb]
- Updated dependencies [8e9ad29]
- Updated dependencies [71a8b37]
- Updated dependencies [8e9ad29]
- Updated dependencies [8e9ad29]
- Updated dependencies [71a8b37]
- Updated dependencies [8e9ad29]
- Updated dependencies [c768915]
- Updated dependencies [8e9ad29]
- Updated dependencies [8e9ad29]
- Updated dependencies [cb9fb3d]
- Updated dependencies [d72f7b0]
- Updated dependencies [8e9ad29]
- Updated dependencies [376f3e2]
- Updated dependencies [376f3e2]
- Updated dependencies [376f3e2]
- Updated dependencies [7e55a01]
- Updated dependencies [b68579a]
- Updated dependencies [5026900]
- Updated dependencies [0a87a8b]
- Updated dependencies [d72f7b0]
- Updated dependencies [14a0730]
- Updated dependencies [600bf98]
- Updated dependencies [369dc81]
- Updated dependencies [81bd291]
- Updated dependencies [921d77a]
- Updated dependencies [8b312f4]
- Updated dependencies [6fb4cdf]
- Updated dependencies [7d210b5]
- Updated dependencies [d266133]
- Updated dependencies [44b9c4f]
- Updated dependencies [7f31eef]
- Updated dependencies [59cb878]
- Updated dependencies [9ba9cca]
- Updated dependencies [9ba9cca]
- Updated dependencies [0e15a2a]
- Updated dependencies [70a9046]
- Updated dependencies [0e15a2a]
- Updated dependencies [0e15a2a]
- Updated dependencies [70a9046]
- Updated dependencies [0e15a2a]
- Updated dependencies [0e15a2a]
- Updated dependencies [5cbe812]
- Updated dependencies [70a9046]
- Updated dependencies [0d12725]
- Updated dependencies [2a6d019]
- Updated dependencies [7386ae0]
- Updated dependencies [2a6d019]
- Updated dependencies [55c733d]
- Updated dependencies [2a6d019]
- Updated dependencies [55c733d]
- Updated dependencies [2a6d019]
- Updated dependencies [55c733d]
- Updated dependencies [181418d]
- Updated dependencies [55c733d]
- Updated dependencies [3814758]
- Updated dependencies [23afcda]
- Updated dependencies [b183985]
- Updated dependencies [17a0be0]
- Updated dependencies [b183985]
- Updated dependencies [8db6263]
- Updated dependencies [23afcda]
- Updated dependencies [ee5dc18]
- Updated dependencies [ee5dc18]
- Updated dependencies [3bd1aa6]
- Updated dependencies [8db6263]
- Updated dependencies [88f2a91]
- Updated dependencies [e75ecdd]
- Updated dependencies [e75ecdd]
- Updated dependencies [4b94b62]
- Updated dependencies [4b94b62]
- Updated dependencies [4b94b62]
- Updated dependencies [17a0be0]
- Updated dependencies [181418d]
- Updated dependencies [e75ecdd]
- Updated dependencies [17a0be0]
- Updated dependencies [e0ab518]
- Updated dependencies [c6489ec]
- Updated dependencies [fdb38b1]
- Updated dependencies [3f4a1ef]
- Updated dependencies [e87ee1d]
- Updated dependencies [2a4a51c]
- Updated dependencies [76d8604]
- Updated dependencies [81f9ed8]
- Updated dependencies [f7fc46c]
- Updated dependencies [a3635b5]
- Updated dependencies [a9446ce]
- Updated dependencies [f92b674]
- Updated dependencies [5608cb5]
- Updated dependencies [d8397b8]
- Updated dependencies [1e2bd68]
- Updated dependencies [ce63ef5]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [d8c0eb1]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [150dd68]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [ef57ee6]
- Updated dependencies [723f026]
- Updated dependencies [fff6b42]
- Updated dependencies [e4d6610]
- Updated dependencies [fff6b42]
- Updated dependencies [fff6b42]
- Updated dependencies [180a4ba]
- Updated dependencies [52e8c37]
  - @aceshooting/lyra-ui@32.0.0

## 1.3.3

### Patch Changes

- fe6ba7d: Update the A2UI binding guide to the AG-UI 1.0.5 clients verified by the HTTP streaming compatibility tests.

  Account for the select keyboard fix and shared tree size styles in the chat composition bundle budget. Lazy JavaScript measures 1,035,590 bytes, 31 bytes above the preceding prepared build; its raw limit advances by 64 bytes to 1,035,648. Gzip, eager-loading and all other limits remain unchanged.
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
  - @aceshooting/lyra-ui@31.2.0

## 1.3.2

### Patch Changes

- Updated dependencies [47d5ced]
- Updated dependencies [fceec2c]
- Updated dependencies [c3498de]
- Updated dependencies [44b9773]
- Updated dependencies [5e894d7]
- Updated dependencies [53874fa]
- Updated dependencies [3b2998e]
- Updated dependencies [5cc0590]
- Updated dependencies [a0d873c]
- Updated dependencies [33515ec]
- Updated dependencies [f9b769c]
- Updated dependencies [e69c1a0]
- Updated dependencies [f044d39]
- Updated dependencies [411cb01]
- Updated dependencies [055fb82]
- Updated dependencies [fdee86f]
- Updated dependencies [926d1b0]
- Updated dependencies [2dbef4f]
- Updated dependencies [eb64a53]
- Updated dependencies [88c0382]
- Updated dependencies [43c4859]
- Updated dependencies [a182932]
- Updated dependencies [4decda0]
- Updated dependencies [5d47cee]
- Updated dependencies [71b8079]
- Updated dependencies [81b0923]
- Updated dependencies [d77a865]
- Updated dependencies [b23677f]
- Updated dependencies [a1dadb4]
- Updated dependencies [7b61dc8]
- Updated dependencies [4e1f338]
- Updated dependencies [707146a]
- Updated dependencies [11cb9f6]
- Updated dependencies [5236f0d]
- Updated dependencies [6a59684]
- Updated dependencies [c6fde08]
- Updated dependencies [bc213b1]
- Updated dependencies [ec87368]
- Updated dependencies [26bef2a]
- Updated dependencies [a1dadb4]
- Updated dependencies [5363490]
- Updated dependencies [ddac560]
- Updated dependencies [7a85d8d]
- Updated dependencies [2391e13]
- Updated dependencies [2f03bb2]
- Updated dependencies [ddf7081]
- Updated dependencies [04fb410]
- Updated dependencies [fed2225]
- Updated dependencies [a7a5763]
- Updated dependencies [e52be70]
- Updated dependencies [e104409]
- Updated dependencies [29cb92f]
- Updated dependencies [7bf8abe]
- Updated dependencies [474c4cb]
- Updated dependencies [524f2f4]
- Updated dependencies [b5c8da4]
- Updated dependencies [7378f05]
- Updated dependencies [65c60d4]
- Updated dependencies [644b1f2]
- Updated dependencies [bdb0150]
- Updated dependencies [644b1f2]
- Updated dependencies [a76b936]
- Updated dependencies [79d296f]
- Updated dependencies [2229e1a]
- Updated dependencies [50f634b]
- Updated dependencies [88e7806]
- Updated dependencies [2060c47]
- Updated dependencies [b43b4dc]
- Updated dependencies [ccb0d35]
- Updated dependencies [57fb2a3]
- Updated dependencies [f7ccc57]
- Updated dependencies [d531e88]
- Updated dependencies [fbbfdda]
- Updated dependencies [f916304]
- Updated dependencies [7b1badf]
- Updated dependencies [fdee86f]
- Updated dependencies [f282fc2]
- Updated dependencies [a49df38]
- Updated dependencies [353292c]
- Updated dependencies [922d2d3]
- Updated dependencies [52fafa4]
- Updated dependencies [45063a8]
- Updated dependencies [711b1fa]
- Updated dependencies [f4ffb25]
- Updated dependencies [40780b4]
- Updated dependencies [6218e9e]
- Updated dependencies [644b7ab]
- Updated dependencies [2170466]
- Updated dependencies [bac361a]
- Updated dependencies [d867044]
- Updated dependencies [6a24221]
- Updated dependencies [f251b0d]
- Updated dependencies [ee91edf]
- Updated dependencies [38b99fa]
- Updated dependencies [e868ed4]
- Updated dependencies [cf16424]
- Updated dependencies [ecaebc3]
- Updated dependencies [c8b457a]
- Updated dependencies [2479fe6]
- Updated dependencies [31a13bc]
- Updated dependencies [fbbfdda]
- Updated dependencies [5b86df0]
- Updated dependencies [4ba3e5e]
- Updated dependencies [2279caf]
  - @aceshooting/lyra-ui@31.0.0

## 1.3.1

### Patch Changes

- 5481ded: Preserve resource-limit diagnostics when a schema exceeds JSON admission budgets, including the original error code and path. Unsafe or malformed schemas remain rejected as `schema.invalid`.

  Clarify that `maxNodes` counts JSON values in input and schema snapshots and separately bounds schema validation work, rather than rendered components.
- Updated dependencies [630bae1]
- Updated dependencies [9a6b7bb]
- Updated dependencies [ee377e2]
- Updated dependencies [5afdde7]
- Updated dependencies [4bcb093]
- Updated dependencies [80e85b6]
- Updated dependencies [a1cde90]
- Updated dependencies [ee377e2]
- Updated dependencies [df2c163]
- Updated dependencies [6113927]
- Updated dependencies [4c6b8d9]
- Updated dependencies [8d430ea]
- Updated dependencies [5979980]
- Updated dependencies [7f8a11f]
- Updated dependencies [c77649c]
- Updated dependencies [36f1381]
- Updated dependencies [f0277da]
- Updated dependencies [cfc6524]
- Updated dependencies [6488a11]
- Updated dependencies [5481ded]
  - @aceshooting/lyra-ui@30.7.0

## 1.3.0

### Minor Changes

- 0bd9ba4: Let a subset catalog leave out optional child roles. `LyraGenComponent` gains `optionalChildren`
  (a subset of `children`); the built-in `alert` (`text`, `button`), `empty` (`button`) and
  `source-card` (`text`) declare theirs, so `subsetCatalog()` accepts `alert` or `empty` without
  `button` in a read-only catalog. The unselected role is removed from that parent's allowed children,
  so generated content placing it there is rejected by `validateView()`. Required child roles
  (`select` to `option`, `source-list` to `source-card`, `chat-viewport` to `chat-message`) still fail
  with `catalog.dependency`. The catalog presets document each role's required and optional companions.

### Patch Changes

- Updated dependencies [0bd9ba4]
- Updated dependencies [0bd9ba4]
  - @aceshooting/lyra-ui@30.6.0

## 1.2.0

### Minor Changes

- d2a48f9: Add opt-in error isolation. With `recovery: 'isolate'`, `validateView`, `applyViewPatch`, the JSON
  and completion parse routes, the AI SDK bridge, chat options and `<lr-gen-view recovery="isolate">`
  replace a component-local failure (unknown role, invalid or missing property, invalid text or slot,
  disallowed child, missing accessible name, invalid block content) by an in-place fallback with part
  `isolated` and the localized invalid-view message, and report it in `isolated` plus warning
  diagnostics. Identity, binding, action, URL and security, budget and root failures still reject the
  whole view, and identities are never renamed. Strict rejection remains the default; persist the
  original input and isolate again on load.

  Add `answerBlocksCatalog()`, an opt-in catalog overlay with three composite answer blocks:
  `kpi-row` (one to six metrics rendered as stat cards), `comparison` (rendered as a table) and
  `steps` (a read-only stepper). Blocks expand during validation into existing components with
  deterministic child identities; existing catalogs and stored views are unchanged.

### Patch Changes

- Updated dependencies [13b4c5d]
  - @aceshooting/lyra-ui@30.5.0

## 1.1.0

### Minor Changes

- 348dba9: Saved dashboards no longer become unreadable after many revisions: records are validated against record-level bounds, and the new `maxHistory` store option (default 100) prunes the oldest drafts while keeping the current revision and every publication. `delete` works for oversized legacy records.

  Fix recovery and navigation edge cases: a component type that failed on bad data renders again once a later revision is valid; a rejected push keeps the already completed prose and islands beside its diagnostic; `refresh()` asks the leave guard before unmounting and keeps the screen and route when the answer is to stay; rejected `enter` or `back` no longer cancels a pending navigation; one throwing shared-state listener no longer prevents the others from receiving the committed update.

  Streaming, JSON input, rendering and live data do less repeated work: chunk scanning no longer copies the accumulated source, JSON streams compare character codes and skip a redundant second parse, unchanged views are recognized by identity before structural comparison, prepared component inputs are compared per property, binding ownership and state creation avoid quadratic walks, and SSR restoration watches only the container's ancestors. Live-data and shared dashboard snapshots are now deep-frozen and shared between listeners instead of copied for each one; their types were already read-only, so code that mutated them at runtime must copy first.

  The guided demo example now shows each scripted reply once.

## 1.0.0

### Major Changes

- c8fab8e: Establish the 1.x compatibility contract for constrained generated views, interactive chat, saved and live dashboards, static semantic SSR, and the documented SDK and protocol profiles. The A2UI candidate artifact entry remains experimental. Replace wildcard imports with the documented explicit entry points; supported public imports remain available.

  Add deterministic Markets, Weather, and Travel Budget walkthroughs with authored prompts, streamed replies, follow-up actions, cancellation, replay, and host-provided translations. Expand input-route, localization, restoration, declaration, and packed-example checks, and add reproducible browser performance and memory qualification tools. These examples require no model credentials and do not claim provider quality or token-cost results.

## 0.1.0

Initial experimental release. The package guides document the supported profiles and
qualification limits.

- Restricted Lyra Markup and JSON input, reviewed catalogs, schemas, diagnostics and bounded parsing.
- Incremental generated views, local and controlled form state, host-authorized actions and repairs.
- Chat integration, replay tooling and portable dashboard, revision and host-persistence contracts.
- Keyboard focus return after host approval cancellation, preserving focus deliberately moved elsewhere.
- Live-dashboard selection binds to loaded chart and table controls, including delayed role loaders.
- Versioned A2UI processing with explicit capability limits and independent protocol fixtures.

The package does not provide model credentials, a hosted generation service, application identity
or a production dashboard database. Stored definitions have explicit versions and must be validated
against the host's selected catalog before use.
