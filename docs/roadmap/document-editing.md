# Native document editing

Status: public experimental editor package with broader qualification in progress. No document editor
is shipped in `@aceshooting/lyra-ui`. All existing file viewers, including the lightweight,
read-only `lr-docx-viewer`, stay in `@aceshooting/lyra-ui`. Editing belongs in the optional
`@aceshooting/lyra-docs` companion. The current component is `<lr-docx-editor>` and the exact
internal runtime engine derives from `@docx-editor.dev/core@2.32.0`; neither choice establishes general DOCX
support or completes a roadmap phase.

The [implementation and qualification record](document-editing-feasibility.md) records verified
browser behavior, the bounded admission policy, asset measurements, and remaining qualification.
Passing browser checks establish only the specific behaviors and corpus cases they exercise.

## Current state (lyra-docs 0.6.2)

Evidence: `packages/lyra-docs` (published as `@aceshooting/lyra-docs@0.6.2`): 35 colocated Node
test files in `src/docx/`, per-area three-engine browser scripts in `scripts/*-browser.mjs`
(`browser-test.mjs`, formatting, tables, images, review, commands, inspection, layout), synthetic
fixtures in `test/corpus.ts`, a Storybook story in `test/editor.stories.js`, and the package README.
Passing checks qualify only the cases they exercise.

| Phase | State |
|---|---|
| 0 Feasibility | Engine decision done. Corpus, IME and full measurement remain open; the corpus is synthetic |
| 1 Lifecycle contract | Implemented and tested, except retained-memory qualification |
| 2 Basic rich text | Implemented and tested for exercised cases; keyboard shortcuts, clipboard, IME and assistive-technology qualification open |
| 3 DOCX load/edit/save | Local open, save receipts, simple tables and table formatting, narrow image tools done; URL loading, broad image/table fidelity and Word/LibreOffice round trips open |
| 4 Pagination, fidelity | Mostly not started; engine paginates, page-break action, embedded fonts and cached-value chart painting exist, with no qualification |
| 5 Agent operations | Partial: outline, document checks, revision-scoped queries; no edit batches or fragment reads |
| 6 Review | Partial: comments, replies, resolve/delete, tracking mode, bounded accept/reject; not qualified for Word interoperability |
| 7 Collaboration | Not implemented |
| 8 Export, final qualification | Not implemented |

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

The companion builds the Apache-2.0 framework-independent core from a pinned source
archive, without importing its React/Vue application. The derivative of
`@docx-editor.dev/core@2.32.0` is included in the package and loaded when a document
opens. Reviewed semantic feature boundaries defer table, note, drawing, control,
comment, TOC and rich-paste implementations until needed. Exact source, dependency,
patch and generated-input inventories bind the maintainer build; consumers do not
fetch source or install an engine peer. Lyra owns the public component, Lit interface,
supported commands, lifecycle, accessibility, theming and integration contract.
Commands await required modules and revalidate document and selection ownership
before their synchronous transaction.
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
- [ ] (Partial: browser-tested; IME and assistive technology unqualified.) Qualify mounting, selection, caret, native IME/composition and toolbar focus in a Lit
  composition. The implemented light-DOM surface passes browser checks for typing, selection,
  toolbar focus and formatting. Shadow-DOM mounts are explicitly refused; this does not qualify
  native input methods or complete keyboard and assistive-technology behavior. Do not patch browser
  globals.
- [ ] (Partial: synthetic fixtures in `test/corpus.ts` only.) Establish a representative DOCX corpus, including unsupported content, malformed packages,
  RTL, larger real documents and round trips through Word and LibreOffice. Current preservation
  checks cover selected opaque parts in a synthetic fixture only.
- [ ] (Partial: bundle and single-run timings recorded; no memory or font budget.) Measure production JS/CSS, lazy chunks, WASM, fonts, opening time, typing latency and retained
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
- [ ] (Not implemented as a measurement.) Qualify release of all retained resources and memory across repeated open/save/destroy cycles.
  No dedicated engine worker or font assets are configured, and retained-memory results remain
  inconclusive.
- [x] Use existing Lyra controls and event conventions. The selected public surface is the
  `<lr-docx-editor>` component plus the `@aceshooting/lyra-docs/docx` session entry.

Exit: lifecycle and public API tests pass, with no engine import or initialization for non-users.

### 2. Basic rich-text editing

Since this text was written the toolbar also gained strikethrough, superscript, subscript, clear
formatting, highlight, indent/outdent, line spacing and page break, plus Ctrl/Command+K command search
and Ctrl/Command+F find (see the package README). The check counts below record the earlier increment;
the current per-area browser scripts supersede them.

The experimental implementation includes paragraph text entry and selection, the original five string
commands (bold, italic, underline, undo and redo), and a parameterized `DocxAction` API for
paragraph styles, four alignments, bullet/numbered lists, font family and size, text color, links,
find, match navigation and replace-one. The current increment passes 51 focused checks in each
of Chromium, Firefox and WebKit, including the listed actions through undo/redo and save/reopen,
and checks preservation of protected synthetic OPC parts. This qualifies those exercised cases;
the phase remains open for broader inputs, interoperability and user qualification.

- [ ] (Implemented; qualification partial, synthetic cases only.) Expand qualification of paragraph styles, headings, bold/italic/underline, links, lists,
  alignment and selections through editing, undo/redo, save/reopen and browser interaction. The
  current 51-check-per-engine increment covers focused synthetic cases. The API validates style
  membership and safe links; links allow HTTPS, `mailto:` and fragment-only targets, and refuse
  HTTP. Replace-one is a single undoable edit; replace-all is not supported.
- [ ] (Implemented and tested for the exercised cases; mixed-value, stale-match and typing-does-not-search checks exist in `scripts/browser-test.mjs`. Left open pending broader input.) Verify formatting-value semantics and on-demand catalogs/search, including mixed or
  unavailable values, stale match refusal, result/context bounds, and that typing does not trigger
  catalog reads or searches. Color reads as `null`; see the
  [formatting-values note](../../packages/lyra-docs/README.md#custom-element).
- [x] Provide undo/redo and localized status messages; add Alt+F10 toolbar entry with arrow,
  Home/End and Escape navigation.
- [x] Compose the initial five-command toolbar from Lyra controls, retaining selection for toolbar
  actions and exposing command availability and active formatting state.
- [ ] (Partial: Alt+F10, Ctrl/Command+K and Ctrl/Command+F exist; clipboard handling is the engine's native behavior and unqualified.) Add editing shortcuts beyond toolbar access and clipboard handling; qualify the implemented
  find/replace controls, localized feedback across input methods, and authored document styling
  independently from the surrounding Lyra look.
- [ ] (Partial: narrow RTL, 320px, axe and read-only checks exist; IME, touch selection and text zoom are unqualified.) Verify keyboard-only use, IME/composition, Unicode, mixed-direction text, text zoom, touch
  selection, accessible names and read-only mode. Document supported input/output formats.

Exit: a useful editor with reliable history and input behavior. Share the chosen model with later
DOCX work; do not create a second rich-text engine solely to discard it in the next phase.

### 3. DOCX loading, editing and saving

- [x] Open blank documents, caller-provided bytes and local files; report normalized refusals. The
  component does not fetch URLs.
- [ ] (Not implemented; the component does not fetch URLs.) Evaluate optional bounded URL loading with the same external-resource and cancellation rules.
- [x] Qualify bounded simple-table actions through the Lyra API and toolbar: insert a rectangular
  table and insert/delete rows and columns or delete the table, including history and save/reopen.
  These controls require a collapsed body caret and operate only on simple rectangular, unnested
  tables; API/toolbar growth is limited to 20 rows, 20 columns and 400 cells. Stale selection or
  revision intent is refused. These guards do not constrain or veto native engine insertion/resize
  gestures, so their policy remains a production gate.
- [ ] (Partial: styles, links, lists, narrow image tools and table formatting such as header row, shading, borders and width are implemented and tested; bookmarks, broad images and broad tables are not.) Support and qualify common paragraph/run styles, hyperlinks/bookmarks, numbered lists, and
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
- [ ] (Partial: `inspectDocument()` reports counts per capability with preserve/render/edit marked unverified; no matrix.) Establish a preservation/rendering/editing capability matrix for relationships, media,
  extensions and unknown OOXML parts. Selected opaque parts survive the current synthetic edit,
  save and reopen fixture; this does not prove general part preservation or usability.
- [x] Save on demand, expose dirty/revision/change events and require a host persistence receipt
  acknowledgement. No document bytes are emitted per keystroke.
- [ ] (Not implemented; save/reopen is tested in-engine only.) Verify representative save/reopen and external application round trips through Word and
  LibreOffice.

Exit: supported edits survive round trips; unsupported content is preserved or explicitly refused.
Do not route editing through the existing viewer's lossy semantic HTML conversion.

### 4. Pagination and advanced Word fidelity

- [ ] (Not implemented as an API; the engine paginates and a page-break action exists.) Add page sizes, margins, orientation, page/section breaks, zoom and incremental pagination;
  keep rendered page count bounded by the viewport and a measured overscan budget.
- [ ] (Partial: embedded fonts load through the browser font loader under a private alias; no offline font configuration or substitution diagnostics.) Introduce lazy font resolution, offline asset configuration, font substitution diagnostics
  and stable editing/history while fonts arrive. Qualify shaping, CJK, RTL and mixed scripts.
- [ ] (Not implemented as qualified capability groups.) Extend styles, nested/merged tables, headers/footers, footnotes/endnotes, page numbers,
  fields, contents lists and content controls in separately tested capability groups.
- [ ] (Partial: Word bar, column, line and area charts paint from cached values; other kinds keep placeholders; no published preserve/render/edit limits.) Evaluate wrapping/anchored images, shapes, text boxes, equations, charts and diagrams.
  Publish explicit preserve/render/edit limits for each; do not claim full Word equivalence.

Exit: corpus-backed fidelity results and bounded layout work, including large-document editing.

### 5. Agent-friendly document operations

- [ ] (Partial: `outline()`, `inspectDocument()` and revision-scoped identifiers with `expectedRevision` guards exist; fragment reads and ranges do not.) Expose compact outlines, selected ranges and requested document fragments with stable
  addresses and revisions; avoid requiring complete document XML or engine snapshots in prompts.
- [ ] (Not implemented; single typed actions with revision checks exist.) Add typed, bounded edit batches with validation, revision/conflict checks, preview and grouped
  undo. Report unsupported or partial operations explicitly and avoid duplicate application on retry.
- [ ] (Not implemented.) Compose existing evidence, citation, comparison and approval controls for proposed edits.
  Keep model calls, credentials, business policy and approval authority in the host application.
- [ ] (Not implemented.) Measure task-context tokens and operation payloads for representative agent workflows;
  publish granular references, examples and error contracts without exposing private engine types.

Exit: reproducible agent tasks make targeted, reviewable changes with recoverable failures and a
measured context budget. Core editing commands do not require an Office.js-compatible product.

### 6. Review and tracked changes

- [ ] (Partial: comments, replies and resolve/reopen/delete are implemented and browser-tested via `scripts/review-browser.mjs`; anchor maintenance and Lyra review-component reuse are not qualified.) Define comment threads, anchored annotations, author identity and resolved states; maintain
  anchors through edits and undo, and reuse existing Lyra review components where practical.
- [ ] (Partial: tracking mode and accept/reject for unnested insert/delete wrappers in one body paragraph; formatting, move and paragraph-mark revisions are read-only; no accepted/original/markup views.) Specify insertion/deletion/format revision handling, accepted/original/markup views and
  accept/reject operations, including DOCX interoperability.
- [ ] (Partial: the Apache-2.0 engine is used; no independent review implementation.) Select an appropriately licensed implementation or build independently from public standards;
  do not copy proprietary review code or imply that preserving revisions means editing them works.
- [ ] (Not implemented; overlapping and ambiguous revisions are refused as read-only.) Qualify overlapping revisions, deleted anchors, permissions supplied by the host, accessible
  review navigation and large review histories.

Exit: review actions and serialization preserve authorship and supported revision semantics.

### 7. Collaboration, persistence and history

- [ ] (Not implemented.) Define optional transport/provider adapters and document identity, version and conflict
  contracts. Keep servers, authentication, authorization and storage outside the UI library.
- [ ] (Not implemented.) Add presence, remote cursors/selections and concurrent edits with a qualified shared model;
  distinguish these from comments and tracked changes.
- [ ] (Not implemented.) Verify per-user undo, reconnect, offline recovery, operation ordering, schema compatibility
  and conflicts involving tables, media, sections and review state.
- [ ] (Not implemented.) Provide host-controlled autosave, checkpoints and version comparison through supported hooks;
  measure bandwidth, retained history and memory under multi-user workloads.

Exit: documented convergence/recovery guarantees and limits; collaboration remains optional.

### 8. Export, integrations and final qualification

- [ ] (Not implemented.) Evaluate accessible HTML, plain text, Markdown, PDF and print as independent outputs. Preserve
  links, resources and layout where promised; disclose lossy conversions and server-only requirements.
- [ ] (Not implemented.) Qualify licensed export backends separately, with cancellation, progress and bounded resources.
  Add application file/storage adapters without embedding service credentials or provider policy.
- [ ] (Partial: 320px, RTL and axe checks exist for the exercised views; no assistive-technology review.) Complete responsive desktop/mobile compositions, localization and RTL coverage, keyboard and
  assistive-technology review, three-engine tests, hostile-input tests and lifecycle checks.
- [ ] (Not implemented.) Publish the supported feature matrix, granular imports, size/performance evidence, migration
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
