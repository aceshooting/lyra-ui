# @aceshooting/lyra-docs

`@aceshooting/lyra-docs` is a private, experimental companion package for the
native Lyra DOCX editor. It uses the public `@docx-editor.dev/core@2.24.0`
engine as an optional peer. Existing document viewers, including
`<lr-docx-viewer>`, remain in `@aceshooting/lyra-ui`.

The editor supports opening local DOCX files or caller-provided bytes, a blank
document, a small set of editing commands, and explicit save receipts. This
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
`@docx-editor.dev/core` is an exact `2.24.0` peer dependency and development
dependency; consumers may omit it until they use the editor.

## Custom element

The initial toolbar has **New**, **Open**, and **Save**, plus **Bold**,
**Italic**, **Underline**, **Undo**, and **Redo**. The host owns saved bytes and
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

The component's localizable messages use these keys through Lyra's inherited
`strings` property: `docxEditorLabel`, `docxEditorNew`, `docxEditorOpen`,
`docxEditorSave`, `docxEditorBold`, `docxEditorItalic`, `docxEditorUnderline`,
`docxEditorUndo`, `docxEditorRedo`, `docxEditorUntitled`, `docxEditorIdle`,
`docxEditorOpening`, `docxEditorReady`, `docxEditorUnsaved`,
`docxEditorSaving`, `docxEditorError`, `docxEditorDisconnected`,
`docxEditorShortcut`, `docxEditorDiscardQuestion`, `docxEditorDiscard`, and
`docxEditorKeep`.

Press **Alt+F10** to move focus from the document to the toolbar. The arrow keys
move between enabled formatting controls (with RTL-aware direction); **Home**
and **End** move to the first and last control. **Escape** closes the dirty
replacement prompt or returns focus from the toolbar to the document.

### Events

| Event | Detail and behavior |
| --- | --- |
| `lr-before-open` | Cancelable; emitted before replacing a dirty document. Call `preventDefault()` to veto a programmatic New or Open. |
| `lr-ready` | The opened document revision. |
| `lr-change` | The current snapshot, or `null` after disconnect. It never includes document bytes. |
| `lr-selection-change` | Selection kind and version. |
| `lr-error` | A normalized refusal code without document contents or engine error text. |
| `lr-save` | Explicit save receipt, including the bytes that the host must persist. |

New and Open from the toolbar show an in-editor confirmation when the current
document is dirty. Programmatic `newDocument()` and `open()` do not show that
confirmation; use the cancelable `lr-before-open` event to apply a host policy.

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
| `document` | Scrollable document surface |
| `error`, `status`, `filename`, `state` | Error, file name, and editor state |

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
`open()` accepts a blank source or DOCX bytes. `can()` reports whether a command
is available; `execute()` runs one of the five supported commands. Use
`retainSelection()` when host controls need to preserve an editor selection
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
checks cover Chromium, Firefox, and WebKit.
Performance runs record a fixed fixture and environment for comparison; they
do not support a general speed claim.

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
```

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
