# Document editing feasibility

Status: preliminary findings, October 2026. This is not a supported editor or a release commitment.
The [document editing roadmap](document-editing.md) remains the delivery contract; its first phase
still has open qualification requirements.

## Provisional direction

Continue with the public, framework-independent EigenPal core behind original Lit and Lyra
controls, using a stable light-DOM editing surface. The provisional packaging choice is an
optional companion, keeping engine, styles, shaping, fonts and serialization outside ordinary
Lyra imports. Asset and performance qualification must confirm that choice; package and component
names remain undecided.

This chooses a candidate for further qualification. It does not import the upstream React/Vue
application, promise all upstream features, or change the existing read-only `lr-docx-viewer`.
Lyra would own the public contract, controls, resource policy, lifecycle and accessibility.
All Lyra principles remain release requirements. A successful engine API call does not by itself
qualify the composed interface, its localization or its framework interoperability.

| Approach | Benefit | Cost and limitation |
|---|---|---|
| Complete public DOCX core | Keeps one canonical document model for editing, layout and package preservation | A substantial optional dependency requiring asset, browser and fidelity qualification |
| Selected core subpaths or copied modules | Public subpaths can avoid unrelated imports | The interactive editor still needs a coherent model, layout and serializer; copying a subset transfers their maintenance to Lyra and has no demonstrated size advantage |
| Independent ProseMirror editor | A maintained foundation for schema-defined rich text and transactions | HTML/JSON editing is a different contract; preserving DOCX parts, relationships and Word layout would become separate implementation work |

The comparison uses public core `2.24.0`, Lit `3.3.3` and Lyra `25.3.1`. The published core's
[source commit](https://github.com/eigenpal/docx-editor/tree/7267e125c0b7ddede8c6bc51cd8634bd0108aae7)
precedes the originally inspected
[source snapshot](https://github.com/eigenpal/docx-editor/tree/0bc6d8fa8ec5a35bb267ac171e10102617a68535)
by one documentation/baseline commit; core and font source did not change between them.
ProseMirror's official development moved from GitHub to
[its current hosting service](https://github.com/ProseMirror/prosemirror); the archived GitHub
repositories do not imply that the project is abandoned.

## Integration findings

A small Lit composition mounts the engine through its public API and uses native Lyra formatting
buttons. The engine owns only its stable editing subtree. Commands use the public selection,
history and explicit save interfaces, rather than treating rendered HTML as document data.

In the light-DOM composition, Chromium 153, Firefox 155 and WebKit 26.6 passed basic typing,
selection, formatting, undo/redo, save/reopen, stable Lit updates and two-instance checks.

Light DOM is the candidate for further work. The shadow-DOM prototype failed in Firefox:
ordinary typed text was saved in reverse order and range selection did not reach the formatting
command. Basic typing in Chromium and WebKit did not establish portable shadow support. No
browser-global patches were added to compensate for the failure.

The editor consumes Tab for editing, so a toolbar needs an explicit keyboard route and selection
retention. A host-owned Alt+F10 shortcut followed by Enter activates Lyra formatting controls in
all three light-DOM cases. This is a narrow keyboard result, not complete keyboard qualification.

Disposal, reconnection and memory have different contracts. Removing painted nodes is not proof
that all listeners, buffers and font resources have been released. The upstream public
[editor contract](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/core/src/contracts/editor.ts)
also documents that detach/reattach recreates the session: undo history and the caret must not be
promised to survive it without a separately qualified retention policy.

The declared `replaceMatch` command returned `unsupported` from both `can` and `exec` in this
configuration. Public `selectMatch` followed by native typing did produce the requested edit.
A future command facade must honor capability refusals; membership in a TypeScript command union
does not establish that the active engine supports the operation.

## Corpus and measurement scope

Fifteen original synthetic inputs cover seven accepted documents and eight refused containers.
The accepted set includes lists, tables, an embedded image, headers/footers, RTL text, unknown OPC
parts, unsupported content and a document with 2,000 content paragraphs. The refused set includes
non-ZIP/truncated input, missing and duplicate parts, traversal names, excessive compression,
malformed XML and DTD declarations. Refusal comes from a separate bounded preflight prototype;
these results do not qualify the engine itself as safe for arbitrary untrusted input.

The seven accepted documents were edited, saved and reopened in Chromium through public selection
and native input. Independent comparisons passed the chosen preservation checks for all seven
targeted saves and a separate unchanged save of the unsupported-content fixture: protected payload
hashes, relationship targets, text, control/revision metadata and namespace bindings survived.
Initial strict XML comparisons flagged added paragraph tracking IDs and removal of redundant
`xml:space` attributes; those differences were reviewed separately, with whitespace-sensitive and
content-loss checks retained. Modeled XML can be normalized, so whole-ZIP byte equality is not a
valid fidelity test. This small synthetic set establishes neither general unsupported-content
preservation nor Word/LibreOffice interoperability.

The production prototype emits 3,872,134 bytes, or 1,166,118 bytes when each artifact is gzipped at
level 6. Of that total, the lazily requested editor chunks account for 3,021,198 raw bytes and
880,369 gzip bytes, including editor CSS loaded as a JavaScript string. These are build-artifact
sizes, not measured compressed HTTP transfer or an established budget for a finished component.
The emitted 426,620-byte HarfBuzz WASM file was not requested in the sampled cases. No font package
or font assets were configured; full shaping, font loading and Word pagination remain unqualified.

On Linux with an Intel Xeon Gold 6226R and eight assigned logical CPUs, one headless Chromium
sample opened the large fixture in 2.02 seconds, saved the edited document in 130 milliseconds and
reopened it in 1.33 seconds. Initial opening included lazy module loading, layout and two animation
frames. These single samples are a feasibility baseline, not a performance guarantee. Automated
typing wall time includes driver overhead and is not input-to-paint latency. There is no qualified
retained-memory result yet.

## Dependency and asset boundaries

The license inventory is per package and asset; the wrapper's MIT license does not relicense its
dependencies. Retain the applicable license texts, attribution and notices when distributing them.

| Candidate material | Published terms | Scope |
|---|---|---|
| Public core and i18n | Apache-2.0 | Candidate engine and engine strings |
| HarfBuzz glue and WASM | MIT glue; supplied HarfBuzz Old MIT text for WASM | Separate shaping asset, loaded only where required |
| Optional font loader | Apache-2.0 code | Does not grant a blanket license for font binaries |
| Carlito, Caladea, Liberation and optional Noto CJK fonts | SIL OFL-1.1 | Optional substitutions, with their own notices and modification terms |
| TeX Gyre Adventor fonts | GUST Font License / LPPL-1.3c-or-later | Optional asset with separate redistribution obligations |
| Pro, Office.js-compatible editor API and DOCX-to-PDF packages | `LicenseRef-EigenPal-Pro-Evaluation-1.0` (EigenPal Pro License) | Excluded from the free implementation candidate |

See the pinned [core license](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/core/LICENSE),
[font package scope](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/fonts/LICENSE)
and [Pro terms](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/pro/LICENSE.md).
Public interfaces for review, collaboration or export do not establish that a free implementation
of those capabilities exists. Preserving existing revisions is not tracked-change authoring.

## Qualification still required

- Native IME/composition, assistive technology, touch selection and keyboard navigation across
  later pages, not only first-page typing and formatting.
- Complete localized controls and announcements, locale-aware formatting, RTL and live language
  changes. The engine's translation hooks do not prove complete localization.
- Public custom-element properties, slots, events, types and lifecycle with the supported frontend
  frameworks. The prototype establishes only a Lit composition, not all framework bindings.
- Shadcn, glass opacity, accent, density, reduced motion and narrow allocations down to 320px.
  Theme the application chrome without recoloring or otherwise changing authored document content.
- Independent Word and LibreOffice round trips, with preservation, rendering and editing recorded
  separately for every advertised capability.
- Hostile-host CSS, theme/locale changes, allocation changes and multiple-editor isolation.
- Bounded archive expansion, XML, images, relationships and external resources before engine input;
  cancellation and stale-result protection throughout asynchronous loading.
- Font substitution, WASM and offline asset handling; full opening, typing and retained-memory
  measurements using representative documents and stated environments.
- A public lifecycle contract, especially disconnect/reconnect and command refusal, before any
  component or optional package is published.

The next increment is a bounded document/session adapter with explicit readiness, revision,
selection, dirty state, capability checks and save. It must close the applicable qualification
gaps before being advertised as an editor. No viewer-to-HTML conversion, browser-global patch or
silent loss of unsupported DOCX content is an acceptable shortcut.
