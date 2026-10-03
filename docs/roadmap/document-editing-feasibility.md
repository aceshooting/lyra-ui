# Document editing implementation and qualification

Status: private experimental implementation in progress, 3 October 2026. This record describes
specific implementation and test evidence; it is not a release commitment or a claim of general
DOCX compatibility. The [document editing roadmap](document-editing.md) remains the delivery
contract, and its phases remain open until their full exit conditions are met.

## Current decision and boundary

`@aceshooting/lyra-docs` contains the experimental `<lr-docx-editor>` component and a session API.
The runtime engine is the exact optional peer `@docx-editor.dev/core@2.24.0`, dynamically loaded
when a document opens. Lyra owns the public Lit surface, native controls, admission checks,
lifecycle, and host persistence contract. The engine's framework adapters and any Pro-only packages
are not included. Existing viewers, including `<lr-docx-viewer>`, remain in `@aceshooting/lyra-ui`.

The selected mount uses connected, empty light DOM. Shadow DOM mounts fail closed. The component
has a New/Open/Save toolbar and five editing commands: bold, italic, underline, undo, and redo.
Saving returns bytes and a revision receipt; the host persists those bytes and acknowledges the
same receipt to clear dirty state. The host owns storage and any URL-fetch policy.

The implementation depends on public core 2.24.0. The
[public core 2.25 source reference](https://github.com/eigenpal/docx-editor/tree/42c6c267) is
reference material only; it is not the runtime package or an implementation source. Current license
texts and attribution are documented in
[`packages/lyra-docs/THIRD_PARTY_NOTICES.md`](../../packages/lyra-docs/THIRD_PARTY_NOTICES.md).

## Earlier feasibility prototype (archived evidence)

Before the current package implementation, a separate Lit prototype compared three approaches.
The comparison used public core `2.24.0`, Lit `3.3.3` and Lyra `25.3.1`; it explains the current
engine direction but does not qualify the current component.

| Approach | Benefit | Cost and limitation |
| --- | --- | --- |
| Complete public DOCX core | One canonical model for editing, layout and package preservation | Substantial optional dependency requiring asset, browser and fidelity qualification |
| Selected core subpaths or copied modules | Public subpaths may omit unrelated modules | Editing still needs a coherent model, layout and serializer; copying transfers maintenance to Lyra without a demonstrated size advantage |
| Independent ProseMirror editor | Maintained foundation for schema-defined rich text and transactions | HTML/JSON editing is a different contract; preserving DOCX parts, relationships and Word layout would become separate work |

The published 2.24 core's [source commit](https://github.com/eigenpal/docx-editor/tree/7267e125c0b7ddede8c6bc51cd8634bd0108aae7)
preceded the originally inspected [source snapshot](https://github.com/eigenpal/docx-editor/tree/0bc6d8fa8ec5a35bb267ac171e10102617a68535)
by one documentation/baseline commit; core and font source did not change between them.
ProseMirror's official development moved from GitHub to
[its current hosting service](https://github.com/ProseMirror/prosemirror); its archived GitHub
repositories did not imply abandonment.

The prototype mounted the public core in a stable light-DOM subtree with Lyra formatting buttons.
Chromium 153, Firefox 155 and WebKit 26.6 passed basic typing, selection, formatting, undo/redo,
save/reopen, stable Lit updates and two-instance checks. A shadow-DOM prototype failed in Firefox:
ordinary typed text saved in reverse order, and range selection did not reach the formatting
command. Basic typing in the other two browsers did not establish portable shadow support. No
browser-global patch was used. The prototype's Alt+F10 then Enter path activated toolbar controls
in all three light-DOM cases; it was a narrow keyboard result.

The public core exposed `replaceMatch`, but both `can` and `exec` returned `unsupported` in that
configuration. Public `selectMatch` followed by native typing produced the requested edit. A
declared command name therefore did not establish availability. Its public
[editor contract](https://github.com/eigenpal/docx-editor/blob/7267e125c0b7ddede8c6bc51cd8634bd0108aae7/packages/core/src/contracts/editor.ts)
also described detach/reattach as recreating the session; undo history and caret retention were
not established.

The prototype corpus had 15 original synthetic inputs: seven accepted documents and eight refused
containers. Accepted cases included lists, tables, an embedded image, headers/footers, RTL text,
unknown OPC parts, unsupported content and a 2,000-paragraph document. Refused cases included
non-ZIP/truncated input, missing and duplicate parts, traversal names, excessive compression,
malformed XML and DTD declarations. Refusal came from a separate bounded preflight prototype,
not from the engine's own safety contract.

The seven accepted documents were edited, saved and reopened through public selection and native
input in all three browsers. Selected checks for seven targeted edits and an unchanged save of the
unsupported-content fixture preserved protected payload hashes, relationship targets, text,
control/revision metadata and namespace bindings; 32 output comparisons covered first saves and
saves after reopening. Initial strict XML comparisons found added paragraph tracking IDs and
removal of redundant `xml:space` attributes. Those differences were reviewed separately while
whitespace-sensitive and content-loss checks remained. Modeled XML can be normalized, so ZIP byte
equality was not the fidelity criterion. This small synthetic set did not establish general
unsupported-content preservation or Word/LibreOffice interoperability.

The prototype build emitted 3,872,134 bytes, or 1,166,118 bytes with each artifact gzipped at level
6. Its lazily requested editor chunks accounted for 3,021,198 raw and 880,369 gzipped bytes,
including editor CSS loaded as a JavaScript string. An emitted 426,620-byte HarfBuzz WASM file was
not requested in sampled cases. No font package or font assets were configured. These are archived
build-artifact figures, not current package sizes or measured compressed HTTP transfer.

On an Intel Xeon Gold 6226R Linux host with **eight assigned logical CPUs**, one headless Chromium
sample opened the large fixture in 2.02 seconds, saved an edit in 130 milliseconds and reopened it
in 1.33 seconds. Opening included lazy module loading, layout and two animation frames. Automated
typing wall time included driver overhead and was not input-to-paint latency. These samples cannot
be compared as a speedup or slowdown with the current run, whose process saw 60 logical CPUs and
no cgroup CPU quota.

Retained memory was inconclusive. After one warmup, three image-document mount/destroy cycles in
each browser emptied the mount, released four host subscriptions and revoked each observed live
image blob URL. No dedicated engine worker was created. Chromium's post-GC page-level DOM and
listener counts stayed constant, while used JavaScript heap was about 0.73, 1.50 and 1.64 MB above
the warmed baseline after successive cycles. Those differences did not establish their cause or
leak freedom. Comparable native counters were unavailable for Firefox/WebKit, and font/shaping
resources were not covered.

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

## Current browser evidence

The recorded browser evidence passed 23 checks in each of Chromium, Firefox, and WebKit: 69
browser-check runs total. The checks
cover lazy editor loading, typing and revisions, localized controls, toolbar selection retention,
dirty replacement and veto, undo/redo, responsive rendering down to 320px, explicit save and
acknowledgement, reopen, two independent editors, live theme and locale changes, read-only mode,
oversized and malformed input, selected preservation cases, mount removal, abort/disconnect, and
axe on the populated component. The run recorded no external browser requests or page, console, or
request errors.

These checks do not qualify every user input method, document feature, or external application.
The categories below keep content preservation separate from what renders and what users can edit.

| Area | What current evidence establishes | What it does not establish |
| --- | --- | --- |
| Preserve | In the synthetic representative fixture, selected opaque parts (`custom/payload.bin`, `customXml/item1.xml`, and an image payload) retain their original hashes through edit, save, and reopen. Selected text, numbering, list, and table structures remain in the saved output. | General preservation of arbitrary OPC extensions, all relationships or unsupported OOXML, or round trips through Word and LibreOffice. |
| Render | The public core mounts and renders its paginated editing surface in all three tested engines. Tests verify text, narrow allocation, and theme/locale updates. | The representative list, table and image are covered by saved-output checks, not separate layout assertions. Word-equivalent page layout, fonts and shaping, or broad document fidelity remain unqualified. |
| Edit | Native Unicode text entry, selection, the five toolbar commands, undo/redo, revision updates, and explicit serialization pass the tested browser cases. | Headings, links, bookmarks, alignment, clipboard, find/replace, advanced tables, review, tracked-change authoring, or collaboration. |
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

The current browser evidence build emits 3,305,053 bytes of JavaScript (983,794 bytes gzipped at
level 6), 218,362 bytes of CSS (31,625 bytes gzipped), and 426,620 bytes of WASM (174,437 bytes
gzipped). The emitted HarfBuzz WASM was not requested in the recorded browser cases. These are
emitted test-build asset sizes, not compressed HTTP transfer measurements or a release budget.

Before/current measurements on the same 2,000-paragraph fixture were:

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
- Broader text, layout, table, image, accessibility, and editing qualification before adding
  capabilities to the supported contract.

The package remains private while these items are open. The browser suite and the resource limits
are evidence for the current experimental slice only; they do not complete feasibility, DOCX
fidelity, or release qualification.
