# @aceshooting/lyra-docs

`@aceshooting/lyra-docs` is a private, experimental companion package for the
native Lyra DOCX editor. Its runtime uses the public `@docx-editor.dev/core@2.25.0`
engine as an optional peer. Existing document viewers, including
`<lr-docx-viewer>`, remain in `@aceshooting/lyra-ui`.

The editor supports opening local DOCX files or caller-provided bytes, a blank
document, paragraph and text formatting, bounded find and replace-one, and
explicit save receipts. This
package is private; its current editor and format support do not establish
general Word compatibility or a shipping support commitment.

## Imports

Use the smallest entry point for each job. Import the registration and static
stylesheet explicitly when using the custom element:

```ts
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-docs/docx/editor';
import '@aceshooting/lyra-docs/docx/editor.css';
```

The imports provide:

| Entry point | Provides |
| --- | --- |
| `@aceshooting/lyra-docs/docx` | `createDocxSession` and public session, snapshot, result, and editor types |
| `@aceshooting/lyra-docs/docx/editor` | Registers `<lr-docx-editor>` |
| `@aceshooting/lyra-docs/docx/editor.class` | Exports `LyraDocxEditor` without registering its tag |
| `@aceshooting/lyra-docs/docx/editor.css` | Static stylesheet for the engine document surface |

The CSS entry is an explicit static import. Load it in the host document before
opening a file. Load `@aceshooting/lyra-ui/theme.css` first so the editor and its
Lyra controls inherit the public theme. The engine is dynamically loaded on the
first open, so importing the session API or registering the custom element does
not initialize it.
`@docx-editor.dev/core` is an exact `2.25.0` peer dependency and development
dependency; consumers may omit it until they use the editor.

## Custom element

The toolbar has **New**, **Open**, and **Save**, plus **Bold**, **Italic**,
**Underline**, **Undo**, and **Redo**. Its editing tools also support paragraph
styles, alignment, bullet and numbered lists, font family and size, text color,
hyperlinks, and find/replace-one. The host owns saved bytes and
durable storage. Changes do not send document bytes. A save is explicit, and the
host must persist its receipt and acknowledge that receipt before the editor
clears its dirty state:

```js
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-docs/docx/editor';
import '@aceshooting/lyra-docs/docx/editor.css';

const editor = document.querySelector('lr-docx-editor');
if (!editor) throw new Error('DOCX editor is not mounted');

editor.addEventListener('lr-save', async event => {
  const { receipt } = event.detail;
  await persistDocument(receipt.bytes);
  const acknowledged = editor.acknowledgeSaved(receipt);
  if (!acknowledged.ok) throw new Error(`Save acknowledgement failed: ${acknowledged.code}`);
});

const opened = await editor.open(file);
if (!opened.ok) console.error(opened.code);
```

`save()` and the Save button emit `lr-save` with a receipt containing the saved
bytes and document revision. Persist those bytes first, then pass the same
receipt object to `acknowledgeSaved()`. Only the latest receipt for the current
revision can clear dirty state. There is no background save or per-keystroke
byte payload.

The `read-only` property is applied when the next document is opened. It stays
fixed for that session; changing the property does not alter an already open
session. Read-only sessions still allow selection, focus, and export.

Scalar formatting values are reported in the session snapshot when the public
engine can derive them. Missing, mixed, or unavailable scalar values are
`null`; color is `null` because the editor derives formatting from
`getSelectionFormatting()`, whose result does not include color. Although
`snapshot().formatting` exposes color, the editor does not consume it for this
contract. `bulletList` and `numberedList` remain booleans from the engine's
`isActive` query, so `false` may include a mixed selection; the API does not
invent a mixed state for lists. The editor does not infer color from the last
action. Paragraph style and font catalogs are read only when requested (for
example, when a picker opens), not on each keystroke. A style action must refer
to a style present in the open document.

The component's localizable messages use these keys through Lyra's inherited
`strings` property:

```text
docxEditorLabel, docxEditorNew, docxEditorOpen, docxEditorSave,
docxEditorBold, docxEditorItalic, docxEditorUnderline, docxEditorUndo,
docxEditorRedo, docxEditorUntitled, docxEditorIdle, docxEditorOpening,
docxEditorReady, docxEditorUnsaved, docxEditorSaving, docxEditorError,
docxEditorDisconnected, docxEditorShortcut, docxEditorDiscardQuestion,
docxEditorDiscard, docxEditorKeep, docxEditorFormatting,
docxEditorParagraphStyle, docxEditorAlignment, docxEditorAlignLeft,
docxEditorAlignCenter, docxEditorAlignRight, docxEditorAlignJustify,
docxEditorLists, docxEditorBullets, docxEditorNumbering,
docxEditorFontFamily, docxEditorFontSize, docxEditorTextColor,
docxEditorAutomaticColor, docxEditorColorUnknown, docxEditorLink,
docxEditorLinkUrl, docxEditorLinkHint, docxEditorLinkText,
docxEditorApplyLink, docxEditorRemoveLink,
docxEditorTable, docxEditorInsertTable, docxEditorTableRows,
docxEditorTableColumns, docxEditorTableSizeHint, docxEditorTableStale,
docxEditorTableDimensions, docxEditorTableCell, docxEditorTableRowAbove,
docxEditorTableRowBelow, docxEditorTableColumnLeft, docxEditorTableColumnRight,
docxEditorTableDeleteRow, docxEditorTableDeleteColumn, docxEditorTableDelete,
docxEditorImage, docxEditorResizeImage, docxEditorDescribeImage,
docxEditorDeleteImage, docxEditorImageWidth, docxEditorImageHeight,
docxEditorImageRatio, docxEditorImageSizeHint, docxEditorImageTitle,
docxEditorImageDescription, docxEditorImageDescriptionHint,
docxEditorImageStale, docxEditorImageDimensions, docxEditorImageApply,
docxEditorPreviousImage, docxEditorNextImage, docxEditorNoImage,
docxEditorCancel, docxEditorFind, docxEditorFindQuery,
docxEditorFindSubmit, docxEditorMatchCase, docxEditorWholeWord,
docxEditorFindCount, docxEditorFindTruncated, docxEditorPrevious,
docxEditorNext, docxEditorReplacement, docxEditorReplace,
docxEditorReplaced, docxEditorEditUnavailable
```

Press **Alt+F10** to move focus from the document to the toolbar. The arrow keys
move between enabled formatting controls (with RTL-aware direction); **Home**
and **End** move to the first and last control. **Escape** closes the dirty
replacement prompt or returns focus from the toolbar to the document.

The table controls insert a rectangular table with a default of 2 rows and 2
columns. Both dimensions accept whole numbers from 1 to 20. When a table cell
is selected, contextual buttons insert a row above/below or a column left/right,
or delete the current row, column or table. Displayed row and column coordinates
start at one; the session snapshot uses zero-based coordinates. Contextual
availability is advisory: unsupported table topology can still be refused on
execution, with the localized editing message.

The insertion dialog retains its original selection. Changing the document or
selection invalidates that intent: close the dialog and reopen it at the desired
caret. Cancel and Escape return to the insert trigger; successful insertion
returns to the document, unless focus has moved elsewhere during closing.
Composition keystrokes remain native. The table controls and native engine table
insertion labels use the current scoped strings without replacing the mount.
Table parts include `table-tools`, `table-insert-popover`, `table-insert-trigger`,
`table-fields`, `table-rows`, `table-columns`, `table-hint`,
`table-dialog-actions`, `table-insert-apply`, `table-insert-cancel`,
`table-context`, `table-actions`, and `table-button`.

**Previous image** and **Next image** select eligible body images in document
order, wrapping at either end. From a text caret, Next selects the first and
Previous the last. These navigation controls are available in ready documents,
including read-only documents, and report when no image is available for the
tools. Navigation changes selection without changing document content or history;
selecting the sole already selected target is unchanged. Use **Alt+F10** and the
toolbar's arrow keys to reach them without a pointer.

Selected image context adds **Resize image**, **Image description**, and **Delete
image** controls. Resize and Description open separate dialogs with one Apply
and Cancel each. Dimensions start from the actual committed values in points;
the initial aspect-ratio option uses the captured original dimensions when either
axis changes. Turn it off to edit the axes independently. Description reads the
complete bounded title and multiline description only when its dialog opens;
empty fields clear existing text. Neither field supplies the control's accessible
name.

Each dialog retains its original image selection. Changing the document or
selection disables Apply; close and reopen the dialog after selecting the desired
image. Cancel and Escape return to that dialog's trigger. Successful Apply returns
to the document unless focus moved elsewhere during closing. An unchanged Apply
closes without adding a revision, dirty transition, or history entry. Context and
availability are advisory; unsupported canonical content can still be refused on
Apply. The exact scope and limits are in **Selected existing image actions** below.

### Events

| Event | Detail and behavior |
| --- | --- |
| `lr-before-open` | Cancelable; `{ kind, currentRevision }` before replacing a dirty document. Call `preventDefault()` to veto a programmatic New or Open. |
| `lr-ready` | `{ revision }` for the opened document. |
| `lr-change` | `{ snapshot }`, where the snapshot may be `null` after disconnect. It never includes document bytes. |
| `lr-selection-change` | `{ selection }` with selection kind and version. |
| `lr-error` | `{ code }`, a normalized refusal without document contents or engine error text. |
| `lr-save` | `{ receipt }`, including the bytes that the host must persist. |

New and Open from the toolbar show an in-editor confirmation when the current
document is dirty. Programmatic `newDocument()` and `open()` do not show that
confirmation; use the cancelable `lr-before-open` event to apply a host policy.

The component exposes `snapshot()`, `open(input, options)`,
`newDocument(options)`, `can(action)`, `execute(action, options)`,
`paragraphStyles()`, `fontFamilies()`, `imageDescription()`, `selectImage(direction)`, `find(query, options)`,
`selectMatch(id, options)`, `replaceMatch(id, text, options)`, `save(options)`,
`acknowledgeSaved(receipt)`, and `focusEditor()`. The editing and search
methods use the same action, result, revision, and bounds contract described
in the session API below. `open()` accepts a `Uint8Array` or `File`;
`newDocument()` opens a blank document. These methods return `DocxResult`
values except `snapshot()`; `open()`, `newDocument()`, and `save()` return
`Promise<DocxResult<...>>`.

### Styling hooks

The component reserves its `document` slot for its own stable light-DOM mount.
Do not provide content in that slot or move, remove, or reuse the mount. The
engine needs a connected, empty element in the document's light DOM; Shadow DOM
mounts are unsupported.

Documents keep their native 100% scale. A narrower allocation scrolls horizontally
inside the document viewport; the toolbar and dialogs still adapt to the available width.
The document viewport scrolls within a maximum block size of `30rem`, using
`--lr-size-30rem` when available. Set `--lr-docx-editor-document-max-block-size`
to a valid CSS length on the component to change that allocation. Direct session
hosts can set the same inherited property on their mount. Set it to `none` to
let the document grow with its content; image selection still works, while
bringing an offscreen target into view then depends on the host's scroll layout.

| Parts | Purpose |
| --- | --- |
| `base`, `toolbar`, `file-actions`, `format-actions` | Editor surface and toolbar groups |
| `new-button`, `open-button`, `save-button`, `format-button`, `file-input` | File and formatting controls; `format-button` identifies its command with `data-command` |
| `confirm`, `discard-button`, `keep-button` | Dirty-document replacement confirmation |
| `editing-tools`, `paragraph-style`, `alignment-actions`, `list-actions`, `edit-button` | Paragraph and text formatting controls; `edit-button` identifies its action with `data-edit` |
| `font-family`, `font-size`, `text-color`, `color-auto`, `color-state` | Font and text-color controls; `color-state` reports when the engine cannot expose the current text color |
| `link-popover`, `link-trigger`, `link-fields`, `link-href`, `link-text`, `link-actions`, `link-apply`, `link-remove`, `link-cancel` | Hyperlink editor and actions |
| `image-tools`, `image-previous`, `image-next`, `image-navigation-status`, `image-context`, `image-delete` | Image navigation, no-image feedback, selected dimensions, and deletion |
| `image-resize-popover`, `image-resize-trigger`, `image-resize-fields`, `image-width`, `image-height`, `image-ratio`, `image-resize-hint`, `image-resize-actions`, `image-resize-apply`, `image-resize-cancel` | Image dimensions dialog and original aspect-ratio option |
| `image-description-popover`, `image-description-trigger`, `image-description-fields`, `image-title`, `image-description`, `image-description-hint`, `image-description-actions`, `image-description-apply`, `image-description-cancel` | Bounded title and multiline description dialog |
| `find-toggle`, `find`, `find-query`, `find-match-case`, `find-whole-word`, `find-submit`, `find-count`, `find-previous`, `find-next`, `find-replace`, `find-replace-button` | Demand-driven find and replace-one controls |
| `document` | Scrollable document surface |
| `error`, `edit-error`, `status`, `filename`, `state` | Load/save or edit error, file name, and editor state |

Import `@aceshooting/lyra-docs/docx/editor.css` to style engine content. It is
not injected into the page by the element.

## Session API

Use `createDocxSession` when the host needs to control its own UI. It claims one
connected, empty light-DOM mount for one session. The mount remains exclusively
owned until `destroy()`; removing or moving it destroys the session. Destruction
is terminal.

```ts
import { createDocxSession } from '@aceshooting/lyra-docs/docx';
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-docs/docx/editor.css';

const mount = document.querySelector<HTMLElement>('#docx-mount');
if (!mount) throw new Error('DOCX mount is not present');

const created = createDocxSession({ mount });
if (!created.ok) throw new Error(`Could not create session: ${created.code}`);
const session = created.value;

try {
  const opened = await session.open({ kind: 'docx', bytes });
  if (!opened.ok) throw new Error(`Could not open document: ${opened.code}`);

  const saved = await session.save();
  if (!saved.ok) throw new Error(`Could not save document: ${saved.code}`);
  await persistDocument(saved.value.bytes);
  const acknowledged = session.acknowledgeSaved(saved.value);
  if (!acknowledged.ok) throw new Error(`Save acknowledgement failed: ${acknowledged.code}`);
} finally {
  session.destroy();
}
```

The session reports immutable state through `snapshot()` and `subscribe()`.
`open()` accepts a blank source or DOCX bytes. `can()` reports whether a
`DocxAction` is available; `execute()` runs one of the five string commands or
one parameterized edit action. The original `DocxCommand` remains
`bold | italic | underline | undo | redo`; parameterized actions are:

```ts
type DocxEdit =
  | { type: 'paragraph-style'; styleId: string }
  | { type: 'alignment'; value: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'toggle-list'; kind: 'bullet' | 'numbered' }
  | { type: 'font-family'; family: string }
  | { type: 'font-size'; points: number }
  | { type: 'text-color'; color: string }
  | { type: 'link'; href: string; text?: string }
  | { type: 'remove-link' }
  | DocxTableAction
  | { type: 'resize-image'; widthPoints: number; heightPoints: number }
  | { type: 'image-description'; title: string; description: string }
  | { type: 'delete-image' };
type DocxAction = DocxCommand | DocxEdit;
interface DocxFormatting {
  readonly paragraphStyleId: string | null;
  readonly alignment: 'left' | 'center' | 'right' | 'justify' | null;
  readonly fontFamily: string | null;
  readonly fontSizePoints: number | null;
  readonly color: string | null;
  readonly bulletList: boolean;
  readonly numberedList: boolean;
}
```

The cached `snapshot()` includes immutable `formatting: DocxFormatting`.
Scalar fields are `null` when absent, mixed, or not derivable; the boolean list
fields come from `isActive`, where `false` can include a mixed selection.
`paragraphStyles()` returns `DocxResult<DocxParagraphStyles>` with
`{ items: { id, label }[], truncated }`; `fontFamilies()` returns
`DocxResult<DocxFontFamilies>` with `{ items: string[], truncated }`. Both are
on-demand. Search methods are:

```ts
find(query: string, options?: {
  matchCase?: boolean;
  wholeWord?: boolean;
  limit?: number;
}): DocxResult<DocxSearchResults>;
selectMatch(id: string, options?: { expectedRevision?: DocxRevision }): DocxResult<void>;
replaceMatch(
  id: string,
  text: string,
  options?: { expectedRevision?: DocxRevision },
): DocxResult<DocxRevision>;
```

Find returns at most 100 revision-scoped rows `{ id, text, before, after }`,
with at most 48 code units of context per side, plus the revision and a
`truncated` flag. Search uses literal text, not regular expressions; a later
query or committed edit invalidates earlier match ids. `selectMatch()` moves
to a result without dirtying the document. `replaceMatch()` replaces one
result as one undoable edit. Replace-all is not supported. Catalog enumeration
and search are demand-driven and do not run for ordinary typing.

`can()` temporarily reports `busy` for formatting/history actions while native input settles;
this prevents capability reads from committing queued typing. It otherwise validates the actual proposed edit, including that a paragraph style
exists in the current document and that a link meets the safe URL policy.
Links may target HTTPS, `mailto:`, or a same-document fragment; HTTP is
refused, and destinations are never fetched. Family names are limited to 64
Unicode code points; font size is 1–1638 points in half-point steps; colors
are `#RRGGBB` or `auto`; style ids are limited to 128 code units; link URLs to
2048 and link/replacement text to 4096 code units. Catalogs cap at 256 styles
and 128 font choices. Search queries are 1–256 code units, and returned
matches are capped at 100. Invalid or over-limit arguments are refused before
calling the engine. Link destinations, link text, and replacement text must
contain valid XML 1.0 characters. TAB, LF, and CR are accepted; forbidden
control characters, U+FFFE/U+FFFF, and unpaired UTF-16 surrogates are refused
before the document changes.

Use `retainSelection()` when host controls need to preserve an editor selection
while focus moves outside the document surface. `focus()` returns focus to the
editing surface. `save()` returns bytes and a receipt; the session never writes
to storage on its own. Always destroy the session when finished.

## Input and format limits

Admission checks run before DOCX bytes reach the document engine. Files beyond
any of these bounds are refused:

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

XML must be valid UTF-8. Only stored or deflated, unencrypted, non-ZIP64 DOCX
archives are accepted. The parser rejects DTDs, external resources, embedded
fonts, `altChunk`, embedded objects, packages, and controls. It accepts static
PNG, one-frame GIF, and JPEG images; other formats and animated images are
refused. HTTPS, `mailto:`, and fragment-only hyperlinks are allowed.

The engine preservation corpus verifies that selected unknown OPC parts remain
byte-identical through edit, save, and reopen. That result applies to the tested
corpus only; it does not establish general preservation of arbitrary DOCX
extensions or compatibility with desktop word processors.

## Lifecycle and qualification

Disconnecting `<lr-docx-editor>` destroys its session, undo history, and
selection. Reconnecting does not restore them; reopen bytes retained by the
host. Moving or removing a session API mount also ends its session. There is no
Shadow DOM mount mode.

Native IME and touch behavior, font fidelity beyond rejecting embedded fonts,
advanced editing, broader DOCX compatibility, Word and LibreOffice
interoperability, and collaboration still need qualification. The browser
checks cover Chromium, Firefox, and WebKit. The current basic-editing increment
passes 51 focused checks per engine (153 across Chromium, Firefox, and WebKit)
and associated synthetic OOXML preservation checks. Those results cover the
exercised actions and fixtures; human input and
assistive-technology review, real-document and font coverage, external
word-processor round trips, and retained-memory behavior remain open.
Performance runs record a fixed fixture and environment for comparison; they
do not support a general speed claim.
The final normal production browser run used a 2,000-paragraph, 218,577-byte
stored DOCX: fresh large open 1,868.9 ms, save 111.8 ms, warm reopen 1,602.8
ms, and input-to-two-animation-frame median/p95 of 128.1/146.3 ms across 20
samples. Browser and OS caches may be warm; these are diagnostic values, not
latency guarantees. Full environment and bundle details are in the
[qualification record](../../docs/roadmap/document-editing-feasibility.md#bundle-and-performance-observations).

## Development checks

Run builds, tests, and browser checks on the repository's test host with the
pinned Node 22.23.2 and pnpm 12.8.1 toolchain. From the repository root, build
Lyra UI before the companion package:

```sh
pnpm --filter @aceshooting/lyra-ui build
pnpm --filter @aceshooting/lyra-docs build
pnpm --filter @aceshooting/lyra-docs lint
pnpm --filter @aceshooting/lyra-docs test
DOCX_BROWSERS=chromium,firefox,webkit pnpm --filter @aceshooting/lyra-docs test:browser
pnpm --filter @aceshooting/lyra-docs test:coverage
```

The coverage command combines Node and Chromium native V8 ranges, remaps them
to TypeScript, and inventories all emitted executable source files, including
files that were not loaded (those receive zero line coverage). It writes
`coverage/coverage-summary.json`, `coverage/coverage-metadata.json`,
`coverage/coverage-gaps.json`, `coverage/lcov.info`, and `coverage/index.html`.
The metadata marks coverage complete only when both the unit and browser suites
pass; an incomplete run cannot qualify a coverage result. V8 cannot enumerate
functions or branches in unloaded modules, and the report flags those metrics
as incomplete. Its statement count is based on V8 line counters, so statements
and lines share that denominator. The current complete run passes 137 Node tests
and 51 Chromium browser checks, with every emitted runtime module included (15
modules, including styles). It measures 2,736/2,742 lines and statements
(99.78%), 272/274 functions (99.27%), and 1,922/2,094 branches (91.78%). CI
enforces the 99.6% lines/statements floor; branch coverage is reported separately
and has no floor.

The browser command runs the three engines serially and writes browser evidence
under `packages/lyra-docs/.browser-output/`. To include the Chromium performance
fixture and diagnostic timing samples, run:

```sh
DOCX_BROWSERS=chromium,firefox,webkit DOCX_PERFORMANCE=1 pnpm --filter @aceshooting/lyra-docs test:browser
```

The performance report records hardware, browser, fixture size, and timing
samples. Timings include browser startup and rendering work and are not latency
guarantees.

The package remains private and is excluded from Changesets version preparation.
See [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and
[`THIRD_PARTY_LICENSES/`](THIRD_PARTY_LICENSES/) for licensing details.

### Simple table actions

The session and element `execute()` APIs accept `insert-table` with integer
`rows` and `columns` from 1 to 20, `insert-table-row` with `where: 'above' | 'below'`,
`insert-table-column` with `where: 'left' | 'right'`, and `delete-table-row`,
`delete-table-column`, or `delete-table`. Each successful change is one undoable
engine command. The Lyra toolbar exposes these actions through the insertion
dialog and contextual table controls described above.

Lyra table commands require a collapsed body caret. New tables require a caret outside
an existing table. Row, column, and whole-table deletion operate only on ordinary
rectangular, unnested tables. Merge markers, nested tables, structural wrappers,
ambiguous structures, non-body selections, and cell rectangles are refused.
Growth is limited to 20 rows, 20 columns, and 400 cells; larger imported simple
tables may be reduced within the bounded inspection limits.

These bounds and simple-topology checks apply to the session/element actions and
Lyra toolbar controls. Core-owned table insertion furniture and native resize
gestures execute through the engine's own route and do not pass through these
Lyra guards. Their localized labels do not extend this qualification to those
mutations. The editor does not promise document-wide authoring bounds; native
gesture integration remains an open qualification requirement.

`snapshot().table` contains copied `rows`, `columns`, and zero-based `rowIndex` and
`columnIndex`, or `null` when the rendered selection context is unavailable. It
is advisory: neither a non-null context nor an enabled `can(tableAction)` proves
that canonical topology permits execution. Table availability reads are pure and
do not scan document trees. Execution performs the bounded canonical check and
can return `unsupported` or `resource-limit` even when `can()` reports enabled.
The target-table traversal has explicit limits; a cold engine ancestry index may
also traverse the admitted document body.

An explicit table command settles previously queued native text before checking
its final revision and selection guard. Thus a stale table request can return
`stale-revision` after a prior user typing change commits; the table is unchanged.
Invalid action fields are rejected before settlement. Retained selection leases
invalidated by that typing change return `stale-selection`. Reentrant edits are
blocked while the synchronous table command owns the input surface. Table
qualification does not save, finalize form values, or export the document.

### Selected existing image actions

The session and element accept `resize-image` with both `widthPoints` and
`heightPoints`, `image-description` with both `title` and `description`, and
`delete-image`. Each real change is one undoable command. Both dimensions must
be finite numbers from 1 to 1440 points, inclusive, independently rounded to
the nearest EMU (1 point = 12700 EMUs). Title is at most 256 UTF-16 code units
and description at most 2048; both must be valid XML 1.0 text. Empty strings
clear metadata. Invalid or over-limit arguments are refused before input
settlement or engine calls. Nothing is coerced or truncated.

This increment supports a narrow plain-picture shape in a body paragraph/run
without style references: one visible, unlocked inline raster image with positive
layout and inner shape extents and one internal PNG, JPEG, or static GIF media
relationship. The outer document layout extent determines actual size. Resizing
updates that extent and preserves the inner shape extent; their values need not
match. Style references
on the owning selected paragraph/run are refused, as are documents containing hidden rules
in their styles part, because inherited visibility cannot be established safely.
Images inside tables, other stories, hyperlinks, tracked changes, content
controls, or text boxes are refused. Floating/wrapped drawings, hidden content,
enabled picture/frame locks, crop, rotation, flips, effects, ambiguous or
unknown drawing structures, unavailable media, and over-limit imported metadata
are preserved and refused. This does not establish general image editing or
the eligibility of every ordinary-looking picture.

Execution uses bounded explicit inspection: at most 128 canonical parts,
20000 main-part nodes, depth 64, 64 attributes per element, and 512 nodes in
the selected drawing. Current raster bytes and content type must agree. The
qualifier never saves, fetches, decodes/re-encodes media, or repairs unsupported
content.

`snapshot().image` is `null` or an immutable copied pair `{ widthPoints,
heightPoints }` describing actual committed EMUs divided by 12700. It exposes
no media or drawing identifiers, XML, or engine objects. Image selection keeps
the existing `selection.kind: 'other'` vocabulary. `imageDescription()` returns
`DocxResult<Readonly<{ title: string; description: string }>>` from the settled
bounded cache, including for read-only sessions. `snapshot()`, `can(imageAction)`,
and `imageDescription()` do not settle native input or perform layout/canonical
reads. A queued input, save, or command can make the metadata read `busy`;
composition returns `composing`. Unsupported or over-limit metadata is refused,
never returned partially.

`selectImage('next' | 'previous')` returns `DocxResult<void>` and selects an
eligible body image through the public session or editor component. It wraps in
document order, permits read-only navigation, and returns `no-selection` when no
eligible target exists. It does not settle queued input or create a content edit.
Selecting a different target invalidates an earlier retained selection lease;
selecting the already selected singleton is a no-op. Drawing identities remain
private. Busy, composition, ownership, and terminal gates still apply.

Each navigation performs one bounded canonical traversal using the inspection
limits above, with at most 256 candidate drawings, 64 qualification attempts,
and 16 MiB of inspected unique media. Exceeding a bound returns `resource-limit`
before moving selection. Navigation does not expose an image inventory or use
DOM image order as selection authority.

Navigation also inspects at most 256 published layout pages and 20,000 layout
records. An image at an ambiguous line boundary may be unavailable to
Previous/Next. If its position cannot be resolved uniquely to its own image
line, navigation returns `unsupported` before changing selection or document
content; it does not skip to another target. This navigation restriction does
not change the eligibility of an already selected image for editing.

Image execution always captures the original image intent before explicitly
settling input. If that settlement changes the document revision or selection,
the image command refuses even when `expectedRevision` was omitted; earlier
typing may commit, but the image stays untouched. A retained lease also refuses
after reselection, including selecting A, then B, then A again. Released,
replaced, or foreign leases never fall back to the current image. Identical
committed dimensions or metadata are successful no-ops only for an eligible
live original intent, with no command dispatch or history/dirty/revision change.

These guards cover the Lyra session/element actions and contextual controls.
Image insertion, replacement, native resize handles, paste/drop, floating
layout, and broad native gesture policy remain outside this contract. Admission
and export limits are unchanged; an edited export is not promised to fit the
4 MiB input admission ceiling. The package remains private and experimental.
