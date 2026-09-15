---
"@aceshooting/lyra-ui": minor
---

New `<lr-drop-zone>` component, plus `<lr-file-input>` aggregate limits and a non-retaining picker
mode.

- `<lr-drop-zone>`: a drag-and-drop region wrapper with no file input of its own. Wrap it around an
  arbitrary region — a chat composer, a whole conversation viewport, a panel far larger than any
  single control — to make that entire region a file-drop target: it owns the drag-session state,
  renders a themeable drag-over overlay, applies `accept`/size/count limits, and emits the same
  `lr-files` event shape `<lr-file-input>` does. Compose `<lr-file-input>` (or any other focusable
  content) inside it when the region also needs a click-to-browse affordance.
- `<lr-file-input>` gains `maxFiles`/`max-files` and `maxTotalSize`/`max-total-size`, mirroring
  `maxFileSize`'s existing rejection-UI shape and invalid-override fail-safe fallback (new reasons
  `'maxFiles'`/`'maxTotalSize'` on `LyraFileInputRejectedFile`).
- `<lr-file-input>` gains an opt-in `nonRetaining`/`non-retaining` mode: an accepted selection still
  fires `lr-files`/`input`/`change`, but is never written to `files` or rendered as a built-in row —
  for a host that persists files elsewhere and renders its own list. A new `valuePresent`/
  `value-present` property lets that host signal required validity externally.
- `<lr-file-input>`'s `lr-files` event is now typed as `LyraFileInputFilesEvent`, so
  `event.target`/`event.currentTarget` read as `LyraFileInput` without a cast.
- The drag-session mechanics (nested-depth tracking, accept/reject preview, folder traversal)
  `<lr-file-input>` already had are now shared internal implementation, reused verbatim by
  `<lr-drop-zone>` rather than reimplemented.
