# Document editing implementation and qualification

Status: public experimental implementation, 4 October 2026. This record describes
specific implementation and test evidence; it is not a claim of general DOCX compatibility.
The [document editing roadmap](document-editing.md) tracks broader phases, which remain open
until their full exit conditions are met.

## Current decision and boundary

`@aceshooting/lyra-docs` contains the experimental `<lr-docx-editor>` component and a session API.
The runtime engine is the exact optional peer `@docx-editor.dev/core@2.27.0`, dynamically loaded
when a document opens. Lyra owns the public Lit surface, native controls, admission checks,
lifecycle, and host persistence contract. The engine's framework adapters and any Pro-only packages
are not included. Existing viewers, including `<lr-docx-viewer>`, remain in `@aceshooting/lyra-ui`.

The selected mount uses connected, empty light DOM. Shadow DOM mounts fail closed. The toolbar
includes New/Open/Save and the original five string commands (bold, italic, underline, undo, and
redo); the editing tools add paragraph, alignment, list, font, color, link, find and replace-one,
plus bounded simple-table insertion and contextual row/column/table actions. The basic-editing
increment has focused browser checks in Chromium, Firefox and WebKit; synthetic OOXML checks cover
the exercised edits and protected parts. Simple-table qualification covers the Lyra API and
toolbar operations described below, not every native engine gesture. Broader user, corpus and
interoperability qualification remains open. Saving returns bytes and a revision
receipt; the host persists those bytes and acknowledges the same receipt to clear dirty state. The
host owns storage and any URL-fetch policy.

The first implementation increment depended on public core 2.24.0. It introduced the original
five string commands: bold, italic, underline, undo and redo. The subsequent basic-editing
increment adds a parameterized `DocxAction` contract for paragraph style, alignment, bullet and
numbered lists, font family/size, text color, links, and bounded find, match navigation and
replace-one. Replace-all is omitted because the pinned core does not offer the required atomic,
single-undo operation. Catalog and search work is demand-driven, never per-keystroke. Formatting
color reads as `null` because the editor derives formatting through `getSelectionFormatting()`,
whose result omits color. Although `snapshot().formatting` exposes color, the editor does not
consume it for this contract. Links accept
HTTPS, `mailto:`, and fragment-only targets; HTTP is refused. The current browser evidence for
these actions is recorded below, alongside the earlier first-increment results. The
[public core 2.25 source reference](https://github.com/eigenpal/docx-editor/tree/42c6c267) is
read-only reference material; the runtime is the published package at the exact peer version, not that source checkout
or an implementation source. Current license
texts and attribution are documented in
[`packages/lyra-docs/THIRD_PARTY_NOTICES.md`](../../packages/lyra-docs/THIRD_PARTY_NOTICES.md).

## Earlier feasibility prototype (archived)

A separate Lit prototype (public core `2.24.0`, Lit `3.3.3`) chose the engine direction; it does not
qualify the current component. Three approaches were compared:

| Approach | Benefit | Cost and limitation |
| --- | --- | --- |
| Complete public DOCX core | One canonical model for editing, layout and package preservation | Substantial optional dependency requiring asset, browser and fidelity qualification |
| Selected core subpaths or copied modules | Public subpaths may omit unrelated modules | Editing still needs a coherent model, layout and serializer; copying transfers maintenance to Lyra without a demonstrated size advantage |
| Independent ProseMirror editor | Maintained foundation for schema-defined rich text and transactions | HTML/JSON editing is a different contract; preserving DOCX parts, relationships and Word layout would become separate work |

Findings that still shape the design:

- A stable light-DOM mount passed typing, selection, formatting, undo/redo, save/reopen and
  two-instance checks in Chromium, Firefox and WebKit; a shadow-DOM mount failed in Firefox
  (typed text saved in reverse order, range selection did not reach the command), so shadow mounts
  are refused. No browser global is patched.
- A declared engine command name did not establish availability (`replaceMatch` reported
  `unsupported`); availability is always read, never assumed. Detach/reattach recreates the session,
  so undo history and caret do not survive it.
- Seven synthetic documents round-tripped with protected payload hashes, relationships, text and
  namespace bindings preserved; modeled XML is normalized, so ZIP byte equality is not the fidelity
  criterion. Eight malformed containers were refused by a separate bounded preflight, not by the
  engine. This small set does not establish general preservation or Word/LibreOffice interoperability.
- Prototype build-artifact sizes, single-run timings and retained-memory samples were inconclusive
  and are superseded by the current figures below; none is a performance claim.

## Dependency and asset boundaries

The wrapper's MIT license does not relicense dependencies or optional assets. The current package
ships the exact dependency notices linked above; the exploratory inventory below records terms to
check if additional assets or features are introduced.

| Material considered | Published terms | Scope |
| --- | --- | --- |
| Public core and i18n | Apache-2.0 | Current optional engine and engine strings |
| HarfBuzz glue and WASM | MIT glue; supplied HarfBuzz Old MIT text for WASM | Separate shaping asset, requested only where needed |
| Optional font loader | Apache-2.0 code | Does not grant a blanket license for font binaries |
| Carlito, Caladea, Liberation and optional Noto CJK fonts | SIL OFL-1.1 | Possible substitutions with their own notices and modification terms; not bundled in this increment |
| TeX Gyre Adventor fonts | GUST Font License / LPPL-1.3c-or-later | Possible optional assets with separate redistribution duties; not bundled in this increment |
| Pro, Office.js-compatible editor API and DOCX-to-PDF packages | `LicenseRef-EigenPal-Pro-Evaluation-1.0` (EigenPal Pro License) | Excluded from the free implementation |

See the pinned [core license](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/core/LICENSE),
[font package scope](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/fonts/LICENSE)
and [Pro terms](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/pro/LICENSE.md).
Preserving an existing revision is not tracked-change authoring, and public interfaces for review,
collaboration or export do not establish a free implementation of those capabilities.

## Browser evidence

The first-increment browser evidence passed 23 checks in each of Chromium, Firefox, and WebKit: 69
browser-check runs total. The expanded basic-editing increment passes 51 checks in each engine:
153 browser-check runs total for that increment. Its checks exercise paragraph styles, all four
alignments, bullet and numbered lists, font family and size, safe link actions, bounded find,
match navigation, replace-one, undo/redo and save/reopen. They include mixed and null-to-concrete
formatting values, history behavior and rejection of XML 1.0 control characters. Separate
synthetic OOXML checks verify protected-part preservation through the exercised edits. These
results qualify only those cases and fixtures. The first-increment checks cover
lazy editor loading, typing and revisions, localized controls, toolbar selection retention,
dirty replacement and veto, undo/redo, responsive rendering down to 320px, explicit save and
acknowledgement, reopen, two independent editors, live theme and locale changes, read-only mode,
oversized and malformed input, selected preservation cases, mount removal, abort/disconnect, and
axe on the populated component. The run recorded no external browser requests or page, console, or
request errors.

The final expanded browser suite passed 91 focused checks in each of Chromium, Firefox and WebKit
(273 browser-check runs total), including Lyra API and toolbar cases for rectangular simple-table
insertion, row/column insertion, and row/column/table deletion. The tested cases include
stale-intent handling, history and save/reopen. The 20-row, 20-column and 400-cell growth limits,
simple-topology checks, and stale selection/revision guards apply to these Lyra commands. Native
engine insertion and resize gestures bypass these commands and have no public veto/disable hook;
their gesture policy remains a production gate. This evidence does not qualify arbitrary tables or
general table layout/preservation fidelity. The same final run passed 179 Node/tooling tests.
Coverage was 3,337/3,345 lines and statements (99.76%), 329/331 functions (99.39%), and 2,600/2,802
branches (92.79%).

These checks do not qualify every user input method, document feature, or external application.
The categories below keep content preservation separate from what renders and what users can edit.

| Area | What current evidence establishes | What it does not establish |
| --- | --- | --- |
| Preserve | In the synthetic representative fixture, selected opaque parts (`custom/payload.bin`, `customXml/item1.xml`, and an image payload) retain their original hashes through edit, save, and reopen. Selected text, numbering, list, and tested simple-table structures remain in the saved output. | General preservation of arbitrary OPC extensions, all relationships or unsupported OOXML, arbitrary tables, or round trips through Word and LibreOffice. |
| Render | The public core mounts and renders its paginated editing surface in all three tested engines. Tests verify text, narrow allocation, and theme/locale updates. | Simple-table command and saved-output checks do not establish table layout fidelity. Word-equivalent page layout, fonts and shaping, image rendering, or broad document fidelity remain unqualified. |
| Edit | Native Unicode text entry, selection, the original five toolbar commands, expanded parameterized editing/search actions, and bounded Lyra simple-table API/toolbar actions pass focused browser increments and associated synthetic OOXML checks. | Broader real-document coverage, clipboard, advanced/merged/nested tables, native insertion/resize gesture policy, review, tracked-change authoring, or collaboration. Replace-all is intentionally omitted. |
| Refuse | Bounded preflight rejects malformed XML, DTDs, unsupported relationships, external resources, ZIP64/encrypted input, unsupported image formats, and resource-limit violations before engine open. Safe HTTPS, `mailto:`, and fragment-only hyperlinks are allowed. | Safety of arbitrary document content or every behavior of the external engine outside this bounded admission path. |

## DOCX admission limits

The adapter validates the archive and its XML and media before passing a document to the engine.
Exceeding a bound returns a normalized refusal code.

| Resource | Limit |
| --- | ---: |
| Input archive | 4 MiB |
| ZIP entries | 2,048 |
| Expanded size per entry | 8 MiB |
| Expanded archive total | 32 MiB |
| XML part | 4 MiB |
| XML nodes across the archive | 150,000 |
| XML nesting depth | 128 |
| Individual image | 4 MiB |
| Image width or height | 8,192 pixels |
| Pixels in one image | 16 million |
| Unique images | 128 |
| Pixels across unique images | 32 million |

XML must be valid UTF-8. Only stored or deflated, unencrypted, non-ZIP64 DOCX archives are
accepted. DTDs, embedded fonts, `altChunk`, embedded objects, packages, controls, and external
resource relationships are refused. The accepted image formats are PNG, one-frame GIF, and JPEG;
animated and other image formats are refused. External links are allowed only for HTTPS, `mailto:`,
or fragment targets.

## Bundle and performance observations

The previously recorded first-increment browser evidence build emitted 3,305,053 bytes of
JavaScript (983,794 bytes gzipped at level 6), 218,362 bytes of CSS (31,625 bytes gzipped), and
426,620 bytes of WASM (174,437 bytes gzipped). The emitted HarfBuzz WASM was not requested in the
recorded browser cases. These are emitted test-build asset sizes, not compressed HTTP transfer
measurements or a release budget.

The final expanded-increment normal browser build emitted 3,651,712 bytes of
JavaScript (1,055,466 bytes gzipped at level 6), 219,039 bytes of CSS
(31,720 bytes gzipped), and 426,620 bytes of WASM (174,437 bytes gzipped).
The lazy editor entry was 509,778 bytes (122,290 gzipped), and the engine chunk
was 2,795,708 bytes (816,742 gzipped). These measurements come from the normal
production browser-test build, not the source-mapped coverage build. They are
emitted asset sizes, not compressed HTTP transfer measurements or a release
budget.

Before/current measurements for the first increment on the same 2,000-paragraph fixture were:

| Measurement | Before | Current |
| --- | ---: | ---: |
| Large-document open | 2,721.3 ms | 1,818.7 ms |
| Save | 1,354.1 ms | 88.6 ms |
| Warm reopen | 2,041.8 ms | 1,541.1 ms |
| Input-to-two-frames median | 114.4 ms | 115.8 ms |
| Input-to-two-frames p95 | 153.7 ms | 132.9 ms |

Both columns were measured on the same Intel Xeon Gold 6226R host with Node 22.23.2 and Chromium
153.0.8010.12. The process saw 60 logical CPUs, affinity to CPUs 0–59, and no cgroup CPU quota.
This is a different allocation from the earlier eight-CPU prototype, so the historical timings
above are not a comparison baseline. Open, save and reopen entries are individual wall-clock
samples; typing values summarize the recorded input-to-two-animation-frames samples. Opening
includes dynamic engine loading, layout, and two animation frames.

The current save path holds the editor surface inert while the engine completes its public save
barrier, then restores focus if suspension displaced the caret. It no longer switches the engine
from edit to view mode and back, avoiding full page repaints while retaining the current mode and
selection. The same-environment save samples dropped from 1,354.1 to 88.6 milliseconds after this
change. Open and reopen are single samples subject to run-to-run variation; their differences do
not establish an optimization effect. None of these observations are latency guarantees or a
general performance claim. Retained memory remains unqualified.

The final expanded-increment diagnostic run used the normal production browser
build with Chromium 153.0.8010.12, Node 22.23.2, and a 2,000-paragraph,
218,577-byte stored DOCX fixture with every tenth paragraph RTL. Fresh blank
open took 285.5 ms; fresh large-document open took 1,868.9 ms; save took
111.8 ms and produced 32,238 bytes; warm reopen took 1,602.8 ms. Across 20
input-to-two-animation-frame samples, median was 128.1 ms and p95 was 146.3 ms
(range 116.8–178.1 ms). Opening includes engine loading, layout and two
animation frames. Input timing runs from `beforeinput` through two animation
frames in the page. The host exposed 60 logical CPUs with affinity to CPUs
0–59 and no cgroup CPU quota. These are single-run diagnostic observations;
browser and OS caches may be warm, and the measurements establish neither a
performance guarantee nor an optimization relative to the historical samples.
Retained memory remains unqualified.

The separate final simple-table diagnostic used Node 22.23.2, Chromium 153.0.8010.12 and an Intel
Core i7-7820X Linux host with 16 visible CPUs. In 20 samples, paragraph typing measured from
`beforeinput` through two post-commit frames had an 87.1 ms median and 105.1 ms p95; typing in a
380-cell table measured 82.2 ms median and 95.2 ms p95. Ten row insertions taking a 19-by-20 table
to 20-by-20 measured 66.6 ms median and 105.5 ms p95; each insertion was followed by a separately
timed undo. One thousand advisory table reads took 2.9 ms without changing the document revision.
These are host-specific diagnostic samples, not guarantees. The paragraph fixture matches the
separately recorded 2,000-paragraph, 218,577-byte input, but the runs used different hardware; no
cross-run performance claim is made. Cold engine-index work is not bounded by the advisory-read
timing.

## Qualification still required

- Human testing of native IME/composition, assistive technology, touch selection, and keyboard
  navigation beyond the checked toolbar path.
- Qualification of public component properties, events, lifecycle and framework bindings with
  supported consumer frameworks, plus design-token variants, reduced motion, RTL and hostile-host
  CSS. Checked theme and locale changes do not cover every combination.
- A capability matrix with separate preserve, render, and edit results for a representative real
  document corpus, including fonts, RTL, unsupported parts, and larger documents.
- Round trips through Word and LibreOffice; the current synthetic preservation fixture is not an
  interoperability corpus.
- Repeated open/save/destroy memory measurements and cleanup evidence for browser-managed buffers
  and any future fonts, workers, or shaping assets.
- Broader text/layout qualification, arbitrary and advanced table coverage (including native
  insertion/resize gesture policy), image rendering/editing, accessibility, and editing
  qualification before adding further capabilities to the supported contract.

The package is public with a bounded experimental contract while these items are open. The browser
suite and resource limits are evidence for the current slice only; they do not complete feasibility,
DOCX fidelity, or broader product qualification.
