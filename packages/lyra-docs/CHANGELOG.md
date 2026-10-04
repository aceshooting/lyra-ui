# @aceshooting/lyra-docs

## 0.2.0

### Minor Changes

- f6b2c82: Open many more real Word documents. Admission now accepts HTTP links, the Word template reference, linked pictures (shown as placeholders), embedded fonts, OLE objects and chart packages, Office `mso-*` processing instructions in custom XML, Info-ZIP Unicode paths that match the entry name, EMF/WMF pictures, and thumbnails or pictures with trailing bytes. The input ceiling rises from 4 MiB to 16 MiB to match the export ceiling, so saved documents always reopen. Inserted JPEG photos keep their pixels but drop EXIF/XMP camera metadata instead of being refused.
- c92a233: Paint Word bar, column, line and area charts from the document's own cached values with `<lr-lite-chart>`, in Office's series colors, over the engine's chart placeholder; other chart kinds keep the placeholder and every chart part is preserved on save. Also: a composition abandoned by focus loss no longer keeps commands refused, open failures now name size, external-content or unsupported-content refusals, older Word picture outlines qualify for image editing, and a stale save receipt releases its bytes on the next edit.
- f6b2c82: Add strikethrough, superscript, subscript, clear formatting, highlight, indent and outdent, line spacing and page break to the editor and session API. Text color is now a Word-style panel with standard swatches, Automatic, and an inline custom picker whose trigger shows the last applied color, replacing the picker that applied black when the hue moved first. Engine overlays such as the retained selection now line up with the text instead of sitting one line above it.
- 27456ab: Resize a selected image by dragging its frame handles, and keep contextual image and table actions in compact icon buttons so a selected picture no longer makes the toolbar scroll.

  Pictures written by Word (effect extents, aspect locks, extension lists and similar markup) and pictures in plain table cells can now be resized, described and deleted. A new blank document starts clean, and replacing an untouched or emptied blank page no longer asks to discard changes.
- c92a233: Add page zoom: a status-bar select and a reflected `zoom` property (`fit` or a factor from 0.25 to 4). `fit` follows the available width, so phones no longer scroll a full-size page sideways. Toolbar tooltips no longer cover their own open panels, so Escape closes the panel at the first press.

### Patch Changes

- Updated dependencies [c92a233]
  - @aceshooting/lyra-ui@25.6.3

## 0.1.1

### Patch Changes

- c7bd8bd: Publish the first public experimental DOCX editor companion. It provides `<lr-docx-editor>` and `createDocxSession` for local DOCX editing, bounded text, table, and image actions, and explicit save receipts with host acknowledgement. The document engine remains an optional, lazy-loaded peer. See the README for supported inputs and limits; general Word compatibility is not promised.
- Updated dependencies [1e317df]
- Updated dependencies [f0864be]
- Updated dependencies [a0caec2]
  - @aceshooting/lyra-ui@25.6.2

## 0.1.0

Unpublished development baseline for the experimental `<lr-docx-editor>` component and
`createDocxSession` API. The supported inputs and actions are described in the README;
general Word compatibility is not promised.
