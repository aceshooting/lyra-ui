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
`paragraphStyles()`, `fontFamilies()`, `find(query, options)`,
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

| Parts | Purpose |
| --- | --- |
| `base`, `toolbar`, `file-actions`, `format-actions` | Editor surface and toolbar groups |
| `new-button`, `open-button`, `save-button`, `format-button`, `file-input` | File and formatting controls; `format-button` identifies its command with `data-command` |
| `confirm`, `discard-button`, `keep-button` | Dirty-document replacement confirmation |
| `editing-tools`, `paragraph-style`, `alignment-actions`, `list-actions`, `edit-button` | Paragraph and text formatting controls; `edit-button` identifies its action with `data-edit` |
| `font-family`, `font-size`, `text-color`, `color-auto`, `color-state` | Font and text-color controls; `color-state` reports when the engine cannot expose the current text color |
| `link-popover`, `link-trigger`, `link-fields`, `link-href`, `link-text`, `link-actions`, `link-apply`, `link-remove`, `link-cancel` | Hyperlink editor and actions |
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
  | { type: 'remove-link' };
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

`can()` validates the actual proposed edit, including that a paragraph style
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
