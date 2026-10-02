# Native document editing

Status: feasibility in progress. No document editor is shipped or promised for the current release.
All existing file viewers, including the lightweight, read-only `lr-docx-viewer`, stay in
`@aceshooting/lyra-ui`. Editing belongs in the optional `@aceshooting/lyra-docs` companion.
Editor component names and the engine remain subject to the first phase's qualification.

The [preliminary feasibility findings](document-editing-feasibility.md) record the candidate
engine, rejected integration path, dependency boundaries and remaining qualification. Basic
prototype success does not complete the phase or establish document fidelity.

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

DOCX is the first editing format under investigation. The package name leaves room for other
formats through separate entry points and separately qualified engines. Spreadsheet, presentation
and PDF editing are not implied by the initial DOCX work. Importing one format must not load engines
for other formats, and the DOCX engine itself must load only when needed.

The companion reuses Lyra's public controls, tokens, localization and accessibility utilities.
Its first implementation remains private and experimental until the applicable release gates
pass; creating the package does not make an editor available in the current Lyra UI release.

Study useful architecture from
[EigenPal DOCX Editor](https://github.com/eigenpal/docx-editor/tree/0bc6d8fa8ec5a35bb267ac171e10102617a68535),
without importing its application, React/Vue interface or complete feature set into Lyra.
Its framework-independent core is a candidate optional engine. Lyra owns the public component,
Lit interface, supported commands, lifecycle, accessibility, theming and integration contract.
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
- [ ] Prove mounting, selection, caret, IME and toolbar focus in a small Lit composition. Validate
  shadow-root support explicitly: document-level focus and selection assumptions may require an
  upstream correction or a supported, scoped light-DOM surface. Do not patch browser globals.
- [ ] Establish a representative DOCX corpus, including unsupported content, malformed packages,
  RTL, large documents and round trips through Word and LibreOffice.
- [ ] Measure production JS/CSS, lazy chunks, WASM, fonts, opening time, typing latency and retained
  memory. Verify that the companion's format entry points and lazy loading isolate these costs.

Exit: a documented engine/DOM/packaging decision, license inventory and reproducible baseline.
Stop or narrow the proposal if supported integration or preservation cannot be demonstrated.

### 1. Shared document and lifecycle contract

- [ ] Define document loading, readiness, dirty state, revision, selection, command availability,
  error diagnostics, read-only behavior and explicit save/export. Keep engine internals private.
- [ ] Keep the engine mount stable during Lit updates and design/locale changes. Specify disconnect,
  reconnect and replacement behavior, including whether undo history and selection survive.
- [ ] Implement bounded, cancellable resource loading; release observers, listeners, object URLs,
  fonts, workers and document buffers when no longer owned. Support multiple independent editors.
- [ ] Design shared controls and event conventions using existing Lyra APIs. Choose provisional
  editor names only after establishing whether rich text and DOCX need separate public surfaces.

Exit: lifecycle and public API tests pass, with no engine import or initialization for non-users.

### 2. Basic rich-text editing

- [ ] Support paragraphs, headings, bold/italic/underline, links, lists, alignment and selections.
- [ ] Provide undo/redo, keyboard shortcuts, clipboard handling, find/replace and localized status.
- [ ] Compose native Lyra toolbar/menu controls with selection retention and accurate disabled and
  pressed states. Preserve authored document colors independently from the surrounding Lyra look.
- [ ] Verify keyboard-only use, IME/composition, Unicode, mixed-direction text, text zoom, touch
  selection, accessible names and read-only mode. Document supported input/output formats.

Exit: a useful editor with reliable history and input behavior. Share the chosen model with later
DOCX work; do not create a second rich-text engine solely to discard it in the next phase.

### 3. DOCX loading, editing and saving

- [ ] Add explicit local-byte/file loading and optional bounded URL loading; open blank documents
  and report unsupported or refused content without silently losing it.
- [ ] Support common paragraph/run styles, hyperlinks/bookmarks, numbered lists, basic tables and
  embedded images, with insertion, deletion and resize commands where supported.
- [ ] Preserve untouched relationships, media, extensions and unknown OOXML parts through edits.
  Separate preservation support from rendering and editing support in the capability matrix.
- [ ] Save on demand, expose meaningful dirty/revision events, and verify save/reopen plus external
  application round trips. Do not send full document bytes on every keystroke.

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
