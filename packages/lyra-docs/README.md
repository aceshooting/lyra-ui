# @aceshooting/lyra-docs

`@aceshooting/lyra-docs` is a public, experimental companion package for the
native Lyra DOCX editor. Its runtime uses the public `@docx-editor.dev/core@2.26.0`
engine as an optional peer. Existing document viewers, including
`<lr-docx-viewer>`, remain in `@aceshooting/lyra-ui`.

The editor supports opening local DOCX files or caller-provided bytes, a blank
document, paragraph and text formatting, bounded find and replace-one, and
explicit save receipts. This first release covers the bounded inputs and actions
documented here. It does not
establish general Word compatibility or a broader format support commitment.

Install the package and its optional document engine when using the editor:

```sh
pnpm add @aceshooting/lyra-docs @docx-editor.dev/core@2.26.0
```

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
`@docx-editor.dev/core` is an exact `2.26.0` peer dependency and development
dependency; consumers may omit it until they use the editor.

## Custom element

The toolbar has **New**, **Open**, and **Save**, plus **Bold**, **Italic**,
**Underline**, **Strikethrough**, **Superscript**, **Subscript**, **Clear formatting**,
**Undo**, and **Redo**. Its editing tools also support paragraph styles, alignment,
bullet and numbered lists, indent and outdent, line spacing, font family and size, text
color and highlight, page breaks, hyperlinks, and find/replace-one.

Text color and highlight are Word-style panels: a palette of Word's standard colors (or
its highlight colors), **Automatic color** or **No highlight**, and for text an inline
custom color picker. A palette click or Enter applies and closes the panel; each committed
custom color applies and keeps it open; Escape closes without editing. Because the engine
cannot report the current run color, each trigger's bar shows the last applied value, as
Word's split color buttons do. The host owns saved bytes and
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
docxEditorBold, docxEditorItalic, docxEditorUnderline, docxEditorStrikethrough,
docxEditorSuperscript, docxEditorSubscript, docxEditorClearFormatting,
docxEditorIndentIncrease, docxEditorIndentDecrease, docxEditorLineSpacing,
docxEditorPageBreak, docxEditorZoom, docxEditorZoomFit, docxEditorChart, docxEditorHighlight, docxEditorNoHighlight,
docxEditorCustomColor, docxEditorColor* (DarkRed, Red, Orange, Yellow, LightGreen,
Green, BrightGreen, LightBlue, Turquoise, Blue, DarkBlue, Teal, Purple, Pink, Violet,
DarkYellow, Black, Gray, DarkGray, LightGray), docxEditorUndo,
docxEditorRedo, docxEditorUntitled, docxEditorIdle, docxEditorOpening,
docxEditorReady, docxEditorUnsaved, docxEditorSaving, docxEditorError,
docxEditorErrorTooLarge, docxEditorErrorExternal, docxEditorErrorInvalid,
docxEditorDisconnected, docxEditorShortcut, docxEditorDiscardQuestion,
docxEditorDiscard, docxEditorKeep, docxEditorFormatting,
docxEditorParagraphStyle, docxEditorAlignment, docxEditorAlignLeft,
docxEditorAlignCenter, docxEditorAlignRight, docxEditorAlignJustify,
docxEditorLists, docxEditorBullets, docxEditorNumbering,
docxEditorFontFamily, docxEditorFontSize, docxEditorTextColor,
docxEditorAutomaticColor, docxEditorLink,
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
docxEditorInsertImage, docxEditorReadingImage, docxEditorInsertingImage,
docxEditorImageInserted, docxEditorImageInsertSizeHint,
docxEditorImageInsertRatioUnavailable, docxEditorImageInsertMetadataHint,
docxEditorImageInsertScopeHint, docxEditorImageInsertLimit,
docxEditorImageInsertInvalid, docxEditorImageInsertUnsupported,
docxEditorImageInsertStale, docxEditorImageInsertRefused,
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

**Insert image** opens a local file picker at the original plain paragraph
caret. Choose a PNG, JPEG, or single-frame GIF of up to 4 MiB. A JPEG's APP1
camera metadata (EXIF and XMP, which can include location) is removed before
insertion; EXIF orientation is therefore not applied. The file name and declared file type do not
supply image metadata or establish its format. The dialog offers width and
height in points, the original aspect ratio, and optional title and description.
Defaults use encoded dimensions at 96 pixels per inch, scaled proportionally
to keep both dimensions between 1 and 1440 points. If that ratio cannot fit,
enter both sizes independently. Dimensions retain full precision. Title and
description start empty; description supports ordinary line breaks.

The picker, read and draft retain one original caret. Cancel, Escape, changed
selection, replacement and disconnect discard pending drafts; a late file read
cannot retarget insertion. Insert closes the dialog immediately, while insertion
activity disables editing, navigation and save. There is no post-dispatch Cancel
button. A refusal requires a new caret/file intent. Successful insertion adds
one undo unit. Imported documents must satisfy the bounded insertion profile;
availability before selecting a file is advisory.

**Previous image** and **Next image** select eligible body images in document
order, wrapping at either end. From a text caret, Next selects the first and
Previous the last. These navigation controls are available in ready documents,
including read-only documents, and report when no image is available for the
tools. Navigation changes selection without changing document content or history;
selecting the sole already selected target is unchanged. Use **Alt+F10** and the
toolbar's arrow keys to reach them without a pointer.

Word bar, column, line and area charts are painted from the document's own cached
values with Lyra's `<lr-lite-chart>`, in Office's default series colors, over the engine's
chart placeholder (`[part="chart"]`, with `data-chart-type`). The painting follows scroll
and zoom, is decorative (inert and hidden from assistive technology, like the placeholder
it covers), and never edits the chart: chart parts are preserved on save. Pie, scatter,
and other chart kinds keep the placeholder. At most 32 charts, 16 series and 500 points
per chart are read; chart parts over 2 MiB are not painted.

Selecting an editable image paints a frame with eight resize handles over it. Drag a
corner to scale proportionally or an edge to change one axis; hold Shift to invert that
choice. The live size is shown while dragging, Escape or a lost pointer cancels, and
release commits one undoable resize through the same bounded 1–1440 pt path as the
dialog. Read-only documents and unsupported images show no handles.

Selected image context adds **Resize image**, **Image description**, and **Delete
image** icon controls. Resize and Description open separate dialogs with one Apply
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
| `lr-before-open` | Cancelable; `{ kind, currentRevision }` before replacing a document with unsaved content. Call `preventDefault()` to veto a programmatic New or Open. |
| `lr-ready` | `{ revision }` for the opened document. |
| `lr-change` | `{ snapshot }`, where the snapshot may be `null` after disconnect. It never includes document bytes. |
| `lr-selection-change` | `{ selection }` with selection kind and version. |
| `lr-error` | `{ code }`, a normalized refusal without document contents or engine error text. |
| `lr-save` | `{ receipt }`, including the bytes that the host must persist. |

New and Open from the toolbar show an in-editor confirmation when the current
document has unsaved content. A new blank document starts clean, and an edited document
reduced to one empty page is replaced without asking. Programmatic `newDocument()` and `open()` do not show that
confirmation; use the cancelable `lr-before-open` event to apply a host policy.

The component exposes `snapshot()`, `open(input, options)`,
`newDocument(options)`, `can(action)`, `execute(action, options)`,
`paragraphStyles()`, `fontFamilies()`, `imageDescription()`, `selectImage(direction)`,
`canInsertImage()`, `insertImage(source, options)`, `find(query, options)`,
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

Common formatting, alignment, list, insertion and history actions use icons with localized
accessible names and keyboard/hover tooltips. Wide allocations place file, history,
insertion, font and paragraph formatting tools on one row; narrower allocations use
two rows. Contextual image and table actions are compact icon buttons with localized
tooltips, so they fit beside the file and insertion tools; only very narrow allocations
scroll that row horizontally, keeping the toolbar height and document position stable.
Formatting groups wrap within narrower widths; keyboard focus reveals offscreen actions.
Replace a toolbar glyph with a decorative SVG or icon assigned to its named slot:

```html
<lr-docx-editor>
  <lr-icon slot="bold-icon" path="M6 4h7a4 4 0 0 1 0 8H6z M6 12h8a4 4 0 0 1 0 8H6z"></lr-icon>
</lr-docx-editor>
```

Icon slots: `new-icon`, `open-icon`, `save-icon`, `undo-icon`, `redo-icon`,
`bold-icon`, `italic-icon`, `underline-icon`, `strikethrough-icon`, `superscript-icon`,
`subscript-icon`, `clear-formatting-icon`, `text-color-icon`, `highlight-icon`,
`indent-increase-icon`, `indent-decrease-icon`, `line-spacing-icon`, `page-break-icon`,
`alignment-left-icon`,
`alignment-center-icon`, `alignment-right-icon`, `alignment-justify-icon`,
`list-bullet-icon`, `list-numbered-icon`, `link-icon`, `find-icon`,
`image-insert-icon`, `table-insert-icon`, `image-previous-icon`, `image-next-icon`,
`image-resize-icon`, `image-description-icon`, `image-delete-icon`,
`table-row-above-icon`, `table-row-below-icon`, `table-column-left-icon`,
`table-column-right-icon`, `table-delete-row-icon`, `table-delete-column-icon`, and
`table-delete-table-icon`.
The editor owns each button's localized name, tooltip, pressed state and action;
slotted icons must not contain focusable or interactive content. History and image
navigation icons mirror with the reading direction; alignment icons remain physical. Import
`@aceshooting/lyra-ui/components/lr-icon.js` when using the icon element separately.

The document paper stays white in light and dark themes; authored text colors are preserved.

Documents open at 100% scale. The status bar's **Zoom** select (and the reflected
`zoom` property: `fit` or a factor from 0.25 to 4) changes the page scale without
changing the document; `fit` follows the available width, which suits phones. At a
fixed zoom a narrower allocation scrolls horizontally inside the document viewport;
the toolbar and dialogs still adapt to the available width.
The document viewport scrolls within a maximum block size of `30rem`, using
`--lr-size-30rem` when available. Set `--lr-docx-editor-document-max-block-size`
to a valid CSS length on the component to change that allocation. Direct session
hosts can set the same inherited property on their mount. For a component in a bounded
application layout, allocate its block size and set the maximum to `100%`; the toolbar
and status remain outside the scrollable document. Set it to `none` to
let the document grow with its content; image selection still works, while
bringing an offscreen target into view then depends on the host's scroll layout.

| Parts | Purpose |
| --- | --- |
| `base`, `toolbar`, `file-actions`, `format-actions` | Editor surface and toolbar groups |
| `new-button`, `open-button`, `save-button`, `format-button`, `file-input` | File and formatting controls; `format-button` identifies its command with `data-command` |
| `confirm`, `discard-button`, `keep-button` | Dirty-document replacement confirmation |
| `editing-tools`, `paragraph-style`, `alignment-actions`, `list-actions`, `edit-button` | Paragraph and text formatting controls; `edit-button` identifies its action with `data-edit` |
| `font-family`, `font-size` | Font controls |
| `text-color`, `text-color-popover`, `text-color-swatches`, `text-color-custom`, `color-auto` | Text color trigger (its bar shows the last applied color), palette, custom picker and Automatic |
| `highlight`, `highlight-popover`, `highlight-swatches`, `highlight-none` | Highlight trigger, Word highlight palette and No highlight |
| `line-spacing`, `line-spacing-popover`, `line-spacing-options`, `line-spacing-option` | Line spacing trigger and multiples (`data-value`) |
| `link-popover`, `link-trigger`, `link-fields`, `link-href`, `link-text`, `link-actions`, `link-apply`, `link-remove`, `link-cancel` | Hyperlink editor and actions |
| `image-insert-trigger`, `image-insert-dialog`, `image-insert-file`, `image-insert-fields`, `image-insert-width`, `image-insert-height`, `image-insert-ratio`, `image-insert-title`, `image-insert-description`, `image-insert-hint`, `image-insert-actions`, `image-insert-apply`, `image-insert-cancel`, `image-insert-status` | Local image picker, original-caret draft, dimensions, metadata, actions and refusal feedback |
| `image-tools`, `image-previous`, `image-next`, `image-navigation-status`, `image-delete` | Image navigation, no-image feedback, and deletion; the resize trigger's name and tooltip carry the selected dimensions |
| `image-frame`, `image-handle`, `image-size` | Selected-image frame, pointer resize handles (`data-handle`), and the live size while dragging |
| `image-resize-popover`, `image-resize-trigger`, `image-resize-fields`, `image-width`, `image-height`, `image-ratio`, `image-resize-hint`, `image-resize-actions`, `image-resize-apply`, `image-resize-cancel` | Image dimensions dialog and original aspect-ratio option |
| `image-description-popover`, `image-description-trigger`, `image-description-fields`, `image-title`, `image-description`, `image-description-hint`, `image-description-actions`, `image-description-apply`, `image-description-cancel` | Bounded title and multiline description dialog |
| `find-toggle`, `find`, `find-query`, `find-match-case`, `find-whole-word`, `find-submit`, `find-count`, `find-previous`, `find-next`, `find-replace`, `find-replace-button` | Demand-driven find and replace-one controls |
| `document` | Scrollable document surface |
| `error`, `edit-error`, `status`, `filename`, `state`, `zoom` | Load/save or edit error, file name, editor state, and the page zoom select |

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
`DocxAction` is available; `execute()` runs one string command or one parameterized
edit action. `DocxCommand` is
`bold | italic | underline | strikethrough | superscript | subscript | undo | redo`;
parameterized actions are:

```ts
type DocxEdit =
  | { type: 'paragraph-style'; styleId: string }
  | { type: 'alignment'; value: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'toggle-list'; kind: 'bullet' | 'numbered' }
  | { type: 'font-family'; family: string }
  | { type: 'font-size'; points: number }
  | { type: 'text-color'; color: string }
  | { type: 'highlight'; color: DocxHighlight } // Word names, e.g. 'yellow', 'darkCyan', or 'none'
  | { type: 'indent'; direction: 'increase' | 'decrease' }
  | { type: 'line-spacing'; multiple: number } // 1–5 in 0.05 steps
  | { type: 'clear-formatting' }
  | { type: 'page-break' }
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
| Input archive | 16 MiB (the largest package a save produces) |
| ZIP entries | 2,048 |
| Expanded size per entry | 16 MiB |
| Expanded archive total | 64 MiB |
| XML part | 16 MiB |
| XML nodes across the archive | 1,000,000 |
| XML nesting depth | 128 |
| Individual image | 4 MiB |
| Image width or height | 8,192 pixels |
| Pixels in one image | 16 million |
| Unique images | 256 |
| Pixels across unique images | 64 million |

XML must be valid UTF-8. Only stored or deflated, unencrypted, non-ZIP64 DOCX
archives are accepted; an Info-ZIP Unicode path field must spell the entry name.
The parser rejects DTDs, processing instructions (except Office's inert `mso-*`
instructions in custom XML parts), `altChunk`, and ActiveX controls. Embedded
fonts, OLE objects and chart packages are kept as opaque parts. External
relationships are admitted only when the engine never fetches them: hyperlinks
(HTTP(S) without credentials, `mailto:`, fragments), the Word template a document
was created from, and linked pictures, which render as placeholders. Other
external targets are refused.

Every PNG, GIF or JPEG under `word/`, and every picture the document references,
must be a well-formed static image within the pixel limits (trailing bytes after
the end marker are tolerated). Referenced Windows metafiles (EMF, WMF and their
compressed forms) are kept and painted as placeholders; referenced SVG must pass
the XML checks without external references; other formats that browsers would
sniff and decode (WebP, BMP, TIFF) are refused. Unreferenced package metadata,
such as the Word thumbnail, is never decoded.

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
checks cover Chromium, Firefox, and WebKit, with associated synthetic OOXML
preservation checks. Qualification covers the exercised actions and fixtures;
human input and assistive-technology review, real-document and font coverage,
external word-processor round trips, and retained-memory behavior remain open.
Performance runs record a fixed fixture and environment for comparison; they
do not support a general speed claim.
An earlier basic-editing benchmark used a 2,000-paragraph, 218,577-byte
stored DOCX: fresh large open 1,868.9 ms, save 111.8 ms, warm reopen 1,602.8
ms, and input-to-two-animation-frame median/p95 of 128.1/146.3 ms across 20
samples. Browser and OS caches may be warm; these are diagnostic values, not
latency guarantees. Full environment and bundle details are in the
[qualification record](https://github.com/aceshooting/lyra-ui/blob/main/docs/roadmap/document-editing-feasibility.md#bundle-and-performance-observations).

## Development checks

Run builds, tests, and browser checks on the repository's test host with the
pinned Node 22.23.2 and pnpm 12.9.1 toolchain. From the repository root, build
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
and lines share that denominator. Every emitted runtime module, including
styles, belongs to the coverage inventory. The generated reports record the
executed suite counts and measured coverage for that run. CI enforces the 99.6%
lines/statements floor; branch coverage is reported separately and has no floor.

The browser command runs the three engines serially and writes browser evidence
under `packages/lyra-docs/.browser-output/`. To include the Chromium performance
fixture and diagnostic timing samples, run:

```sh
DOCX_BROWSERS=chromium,firefox,webkit DOCX_PERFORMANCE=1 pnpm --filter @aceshooting/lyra-docs test:browser
```

The performance report records hardware, browser, fixture size, and timing
samples. Timings include browser startup and rendering work and are not latency
guarantees.

The package is public and independently versioned through Changesets.
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

This increment supports plain inline pictures in body paragraphs, including
paragraphs inside plain table cells: one visible inline raster image with positive
layout and inner shape extents and one internal PNG, JPEG, or static GIF media
relationship. The outer document layout extent determines actual size. Resizing
updates that extent and preserves the inner shape extent; their values need not
match. The markup Word writes around ordinary pictures qualifies: `wp:effectExtent`,
`wp14` anchor and edit ids, `a:extLst` extension records (preserved verbatim),
`cstate`, `bwMode="auto"`, empty fill and line, and aspect-ratio or arrowhead locks.
Paragraph and run style references qualify; documents containing hidden rules in
their styles part are refused, because inherited visibility cannot be established
safely. Images inside other stories, hyperlinks, tracked changes, content controls,
or text boxes are refused. Floating/wrapped drawings, hidden content, other enabled
picture/frame locks, crop, rotation, flips, effects, ambiguous or unknown drawing
structures, unavailable media, and over-limit imported metadata are preserved and
refused. This does not establish general image editing or the eligibility of every
ordinary-looking picture.

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
Replacement, native resize handles, paste/drop, floating layout, and broad
native gesture policy remain outside this selected-image contract. Local byte
insertion has the separate bounded contract below. The admission
input ceiling equals the 16 MiB export ceiling, so a saved package reopens. The package remains experimental.

### Local image insertion

The session and element expose `canInsertImage()` and asynchronous
`insertImage(source, options)`. Import `DocxImageSource` and
`DocxInsertImageOptions` from `@aceshooting/lyra-docs/docx`. Sources contain a
`Uint8Array` of encoded bytes, required `widthPoints` and `heightPoints`, and
optional `title` and `description`. Each dimension must be finite and between
1 and 1440 points; fractional values are preserved through the conversion
`Math.round(points * 12700)`. Title permits up to 256 UTF-16 code units and
description up to 2048. Both must be valid XML text with no carriage returns;
use LF for line breaks. Omitted metadata means empty text. A present `undefined`
value is invalid. No trimming or metadata inference occurs.

```ts
const availability = editor.canInsertImage();
const revision = editor.snapshot()?.revision;
if (availability.enabled && revision) {
  const lease = editor.retainSelection();
  if (lease.ok) {
    try {
      const result = await editor.insertImage({
        bytes: pngBytes,
        widthPoints: 120,
        heightPoints: 60,
        title: 'Overview',
        description: 'Two related measurements',
      }, { selection: lease.value, expectedRevision: revision });
      if (result.ok) console.log(result.value);
    } finally {
      lease.value.release();
    }
  }
}
```

The API copies only the visible byte range synchronously before its first await
or notification. It validates the encoded PNG, JPEG (after removing APP1
camera metadata), or single-frame GIF and also requires successful native decoding. Existing
image admission limits apply: 4 MiB encoded bytes, 8192 pixels per axis and
16 million pixels per image. `canInsertImage()` reads cached caret/lifecycle
state without reading bytes or validating the whole document.

Insertion accepts the editor's normalized default document followed by ordinary
body typing, plus a narrow package grammar. Tables, auxiliary stories, style
references, fields, controls, tracked changes and a target paragraph already
containing an image refuse unchanged. Other plain body paragraphs may contain
supported inline pictures. A validated insertion commits only when its immediate
serialized package is at most 16 MiB and passes the existing admission and engine
ZIP reader. This bound applies to that committed revision; later edits and the
generic save policy are separate.

Options accept `expectedRevision`, an authentic retained `selection`, and a
native `AbortSignal`. Insertion retains the original document, revision and
caret through preparation; stale or released leases do not fall back to a live
caret, including A-to-B-to-A reselection. Before live dispatch cancellation can
refuse unchanged. After commit the returned success remains truthful even if a
subscriber replaces or destroys the editor. UI completion feedback and focus
are guarded by the original owner. During `activity: 'inserting-image'`, methods
that change selection, focus, package or save refuse `busy`; snapshots and pure
availability remain readable. No URL, preview, clipboard or drop insertion is
provided.
