# Native document editing

Status: public experimental editor package with broader qualification in progress. No document editor
is shipped in `@aceshooting/lyra-ui`. All existing file viewers, including the lightweight,
read-only `lr-docx-viewer`, stay in `@aceshooting/lyra-ui`. Editing belongs in the optional
`@aceshooting/lyra-docs` companion. The current component is `<lr-docx-editor>` and the exact
optional runtime engine peer is `@docx-editor.dev/core@2.27.0`; neither choice establishes general DOCX
support or completes a roadmap phase.

The [implementation and qualification record](document-editing-feasibility.md) records verified
browser behavior, the bounded admission policy, asset measurements, and remaining qualification.
Passing browser checks establish only the specific behaviors and corpus cases they exercise.

## Objective and boundaries

Provide a native Lyra editing experience with Lit controls, design tokens, localization and a
compact API for applications and agents. Progress from basic editing to DOCX fidelity, review
and collaboration through independently qualified increments. Preserve existing library features
and keep document-engine, font, WASM and collaboration costs outside ordinary component imports.

## Package boundary

`@aceshooting/lyra-docs` is an independently versioned companion in the Lyra monorepo, following
the optional-package model of `@aceshooting/lyra-flags`. It is for editors; it does not relocate,
replace or add dependencies to the file viewers in `@aceshooting/lyra-ui`. Applications that only
view files continue to install and import Lyra UI as before.

A later breaking migration is planned to consolidate all document editors and viewers in
`@aceshooting/lyra-docs`. That package will continue to depend on `@aceshooting/lyra-ui` for shared
controls and utilities. The migration must move viewer entry points and guide consumers to the new
imports without adding a Lyra UI dependency on Docs or a re-export cycle. No viewer has moved.

DOCX is the first editing format under investigation. The package name leaves room for other
formats through separate entry points and separately qualified engines. Spreadsheet, presentation
and PDF editing are not implied by the initial DOCX work. Importing one format must not load engines
for other formats, and the DOCX engine itself must load only when needed.

The companion reuses Lyra's public controls, tokens, localization and accessibility utilities.
Its first release exposes the bounded experimental editor described in the package README;
broader format fidelity and interoperability qualification remain open.

Use the public framework-independent core behind original Lyra controls, without importing its
React/Vue application or complete feature set. The runtime peer is
`@docx-editor.dev/core@2.27.0`, dynamically loaded when a document opens. The
[public core implementation](https://github.com/eigenpal/docx-editor/tree/42c6c267) is reference
material; the runtime is the published package at the exact peer version. Lyra owns the
public component, Lit interface, supported commands, lifecycle, accessibility, theming and
integration contract.
Copying isolated parser/layout files is not automatically a smaller solution: those modules share
document identity, styles, resources, transactions and serialization invariants.

The referenced core uses Apache-2.0; review, the higher-level Office.js-compatible API and PDF
packages have separate license terms. Verify each exact dependency and asset before reuse, retain
required notices, and preserve Lyra's free, MIT-licensed public surface. Proprietary implementation
is not a source for independent features. Later capabilities need suitable open-source dependencies
or original implementations; a commercial integration, if offered, must be separate and optional.

## Ideas to retain and improvements to prove

| Idea already present upstream | Direction for Lyra |
|---|---|
| A canonical OOXML model preserves untouched and unsupported package content | Keep document data separate from the editing DOM; qualify load/edit/save/reopen fidelity |
| Transactions, typed commands and queries, revision-based change events | Expose a small stable Lyra vocabulary; return only requested context to agents and serialize on explicit save |
| Incremental layout and viewport-aware page rendering | Reuse proven behavior; measure local-edit latency, pagination work and memory before claiming improvements |
| Shared chunks, optional modules and lazy font resolution | Require independent entry points, on-demand assets and no editor-engine cost for non-editor consumers |
| Bounded parsing and resource handling | Apply Lyra's fetch limits and cancellation, then bound ZIP expansion, images, XML and layout work |

Reuse existing Lyra controls, menus, overlays, trees, upload controls and review surfaces. Introduce
new primitives only when an existing supported composition cannot express the behavior. Smaller
CSS profiles, worker offloading, fewer copied buffers and reduced engine profiles are measurement
candidates, not established performance wins. A smaller implementation must retain the same
advertised fidelity, keyboard behavior and input correctness.

## Delivery sequence

Each phase requires its own public contract, focused documentation, examples and verification.
Accessibility, localization, RTL, disposal and all supported browser engines apply from the first
interactive increment. Later phases do not postpone those requirements.

### 0. Feasibility and engine decision

- [x] Compare a public optional engine behind native Lyra controls, a cohesive reusable engine
  subset, and an independently maintained editor. Record ownership, licenses and maintenance cost.
- [ ] Qualify mounting, selection, caret, native IME/composition and toolbar focus in a Lit
  composition. The implemented light-DOM surface passes browser checks for typing, selection,
  toolbar focus and formatting. Shadow-DOM mounts are explicitly refused; this does not qualify
  native input methods or complete keyboard and assistive-technology behavior. Do not patch browser
  globals.
- [ ] Establish a representative DOCX corpus, including unsupported content, malformed packages,
  RTL, larger real documents and round trips through Word and LibreOffice. Current preservation
  checks cover selected opaque parts in a synthetic fixture only.
- [ ] Measure production JS/CSS, lazy chunks, WASM, fonts, opening time, typing latency and retained
  memory. Current evidence records emitted JS, CSS and WASM plus a final diagnostic run on a
  2,000-paragraph fixture: 1,868.9 ms fresh open, 111.8 ms save, 1,602.8 ms warm reopen, and
  128.1 ms median / 146.3 ms p95 from input through two animation frames. These are individual-run
  observations, not guarantees or optimization claims. Fonts, retained memory and a qualified
  lazy-loading budget remain open; see the [performance and bundle record](document-editing-feasibility.md#bundle-and-performance-observations).

Exit: a documented engine/DOM/packaging decision, license inventory and reproducible baseline.
Stop or narrow the proposal if supported integration or preservation cannot be demonstrated.

### 1. Shared document and lifecycle contract

- [x] Define loading, readiness, dirty state, revisions, selection, command availability, normalized
  error codes, fixed per-session read-only behavior and explicit save/acknowledgement. Keep engine
  types private.
- [x] Keep the engine mount stable during Lit, theme and locale updates. Specify terminal disconnect,
  reconnect, and dirty-document replacement behavior; undo history and selection do not survive
  destruction.
- [x] Bound DOCX archive admission, support cancellation and stale-result guards, release mount
  ownership and observers, and support independent editor instances.
- [ ] Qualify release of all retained resources and memory across repeated open/save/destroy cycles.
  No dedicated engine worker or font assets are configured, and retained-memory results remain
  inconclusive.
- [x] Use existing Lyra controls and event conventions. The selected public surface is the
  `<lr-docx-editor>` component plus the `@aceshooting/lyra-docs/docx` session entry.

Exit: lifecycle and public API tests pass, with no engine import or initialization for non-users.

### 2. Basic rich-text editing

The experimental implementation includes paragraph text entry and selection, the original five string
commands (bold, italic, underline, undo and redo), and a parameterized `DocxAction` API for
paragraph styles, four alignments, bullet/numbered lists, font family and size, text color, links,
find, match navigation and replace-one. The current increment passes 51 focused checks in each
of Chromium, Firefox and WebKit, including the listed actions through undo/redo and save/reopen,
and checks preservation of protected synthetic OPC parts. This qualifies those exercised cases;
the phase remains open for broader inputs, interoperability and user qualification.

- [ ] Expand qualification of paragraph styles, headings, bold/italic/underline, links, lists,
  alignment and selections through editing, undo/redo, save/reopen and browser interaction. The
  current 51-check-per-engine increment covers focused synthetic cases. The API validates style
  membership and safe links; links allow HTTPS, `mailto:` and fragment-only targets, and refuse
  HTTP. Replace-one is a single undoable edit; replace-all is not supported.
- [ ] Verify formatting-value semantics and on-demand catalogs/search, including mixed or
  unavailable values, stale match refusal, result/context bounds, and that typing does not trigger
  catalog reads or searches. Color reads as `null` because the editor uses `getSelectionFormatting()`,
  whose result omits color; although `snapshot().formatting` exposes color, the editor does not
  consume it for this contract.
- [x] Provide undo/redo and localized status messages; add Alt+F10 toolbar entry with arrow,
  Home/End and Escape navigation.
- [x] Compose the initial five-command toolbar from Lyra controls, retaining selection for toolbar
  actions and exposing command availability and active formatting state.
- [ ] Add editing shortcuts beyond toolbar access and clipboard handling; qualify the implemented
  find/replace controls, localized feedback across input methods, and authored document styling
  independently from the surrounding Lyra look.
- [ ] Verify keyboard-only use, IME/composition, Unicode, mixed-direction text, text zoom, touch
  selection, accessible names and read-only mode. Document supported input/output formats.

Exit: a useful editor with reliable history and input behavior. Share the chosen model with later
DOCX work; do not create a second rich-text engine solely to discard it in the next phase.

### 3. DOCX loading, editing and saving

- [x] Open blank documents, caller-provided bytes and local files; report normalized refusals. The
  component does not fetch URLs.
- [ ] Evaluate optional bounded URL loading with the same external-resource and cancellation rules.
- [x] Qualify bounded simple-table actions through the Lyra API and toolbar: insert a rectangular
  table and insert/delete rows and columns or delete the table, including history and save/reopen.
  These controls require a collapsed body caret and operate only on simple rectangular, unnested
  tables; API/toolbar growth is limited to 20 rows, 20 columns and 400 cells. Stale selection or
  revision intent is refused. These guards do not constrain or veto native engine insertion/resize
  gestures, so their policy remains a production gate.
- [ ] Support and qualify common paragraph/run styles, hyperlinks/bookmarks, numbered lists, and
  embedded images for rendering and editing, along with broader table behavior. Paragraph style,
  alignment/list, font, color and link actions plus bounded find/replace-one have focused browser
  and synthetic OOXML evidence. The selected-image increment adds resizing, title/description,
  and deletion for a narrow plain unstyled body inline raster picture shape, with separate
  contextual dialogs, keyboard-accessible Previous/Next image navigation, original selection
  intent, and unchanged-request no-ops. Styled or hidden
  content, enabled locks, transforms, other stories and ambiguous structures are refused; neither
  snapshot context nor enabled availability proves eligibility. Broad image rendering/editing,
  native image handles/insertion/paste, broad table rendering, and external round-trip
  qualification remain open. See the [exact image action scope](../../packages/lyra-docs/README.md#selected-existing-image-actions).
- [ ] Establish a preservation/rendering/editing capability matrix for relationships, media,
  extensions and unknown OOXML parts. Selected opaque parts survive the current synthetic edit,
  save and reopen fixture; this does not prove general part preservation or usability.
- [x] Save on demand, expose dirty/revision/change events and require a host persistence receipt
  acknowledgement. No document bytes are emitted per keystroke.
- [ ] Verify representative save/reopen and external application round trips through Word and
  LibreOffice.

Exit: supported edits survive round trips; unsupported content is preserved or explicitly refused.
Do not route editing through the existing viewer's lossy semantic HTML conversion.

### 4. Pagination and advanced Word fidelity

- [ ] Add page sizes, margins, orientation, page/section breaks, zoom and incremental pagination;
  keep rendered page count bounded by the viewport and a measured overscan budget.
- [ ] Introduce lazy font resolution, offline asset configuration, font substitution diagnostics
  and stable editing/history while fonts arrive. Qualify shaping, CJK, RTL and mixed scripts.
- [ ] Extend styles, nested/merged tables, headers/footers, footnotes/endnotes, page numbers,
  fields, contents lists and content controls in separately tested capability groups.
- [ ] Evaluate wrapping/anchored images, shapes, text boxes, equations, charts and diagrams.
  Publish explicit preserve/render/edit limits for each; do not claim full Word equivalence.

Exit: corpus-backed fidelity results and bounded layout work, including large-document editing.

### 5. Agent-friendly document operations

- [ ] Expose compact outlines, selected ranges and requested document fragments with stable
  addresses and revisions; avoid requiring complete document XML or engine snapshots in prompts.
- [ ] Add typed, bounded edit batches with validation, revision/conflict checks, preview and grouped
  undo. Report unsupported or partial operations explicitly and avoid duplicate application on retry.
- [ ] Compose existing evidence, citation, comparison and approval controls for proposed edits.
  Keep model calls, credentials, business policy and approval authority in the host application.
- [ ] Measure task-context tokens and operation payloads for representative agent workflows;
  publish granular references, examples and error contracts without exposing private engine types.

Exit: reproducible agent tasks make targeted, reviewable changes with recoverable failures and a
measured context budget. Core editing commands do not require an Office.js-compatible product.

### 6. Review and tracked changes

- [ ] Define comment threads, anchored annotations, author identity and resolved states; maintain
  anchors through edits and undo, and reuse existing Lyra review components where practical.
- [ ] Specify insertion/deletion/format revision handling, accepted/original/markup views and
  accept/reject operations, including DOCX interoperability.
- [ ] Select an appropriately licensed implementation or build independently from public standards;
  do not copy proprietary review code or imply that preserving revisions means editing them works.
- [ ] Qualify overlapping revisions, deleted anchors, permissions supplied by the host, accessible
  review navigation and large review histories.

Exit: review actions and serialization preserve authorship and supported revision semantics.

### 7. Collaboration, persistence and history

- [ ] Define optional transport/provider adapters and document identity, version and conflict
  contracts. Keep servers, authentication, authorization and storage outside the UI library.
- [ ] Add presence, remote cursors/selections and concurrent edits with a qualified shared model;
  distinguish these from comments and tracked changes.
- [ ] Verify per-user undo, reconnect, offline recovery, operation ordering, schema compatibility
  and conflicts involving tables, media, sections and review state.
- [ ] Provide host-controlled autosave, checkpoints and version comparison through supported hooks;
  measure bandwidth, retained history and memory under multi-user workloads.

Exit: documented convergence/recovery guarantees and limits; collaboration remains optional.

### 8. Export, integrations and final qualification

- [ ] Evaluate accessible HTML, plain text, Markdown, PDF and print as independent outputs. Preserve
  links, resources and layout where promised; disclose lossy conversions and server-only requirements.
- [ ] Qualify licensed export backends separately, with cancellation, progress and bounded resources.
  Add application file/storage adapters without embedding service credentials or provider policy.
- [ ] Complete responsive desktop/mobile compositions, localization and RTL coverage, keyboard and
  assistive-technology review, three-engine tests, hostile-input tests and lifecycle checks.
- [ ] Publish the supported feature matrix, granular imports, size/performance evidence, migration
  guidance and agent skill references. Demonstrate only qualified capabilities on the website.

Exit: each released increment satisfies the library's
[release gates](../agents/ci-and-gates.md#release-integrity). Unfinished capabilities stay explicitly
planned; completing one phase does not imply completion of the entire editor program.

### Bounded local image insertion

The experimental companion includes a separate local image picker and
`canInsertImage()` / `insertImage()` facade. One PNG, JPEG without APP1 metadata,
or single-frame GIF can be inserted at its original plain body caret after
bounded package validation. The normalized default document plus ordinary
body typing is supported; imported documents outside the finite profile refuse
unchanged. Width and height use explicit point dimensions, with optional bounded
title and description. The picker retains the original intent across reading and
draft editing, discards canceled or stale reads, and closes on dispatch while
insertion activity gates other operations. Broader imported-document insertion,
replacement, floating images, clipboard/drop and remote sources remain open.

Native keyboard, narrow RTL, zoomed dialog accessibility, cancellation and
round-trip qualification accompany this increment; those checks do not establish
full document, assistive-technology or native input-method compatibility.
