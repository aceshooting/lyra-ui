---
"@aceshooting/lyra-ui": patch
---

Fix several rendering and correctness bugs.

- `<lr-chart>`: a `valueFormatter` no longer corrupts the **category** axis. Formatted indices
  (`"0"`, `"1"`, `"2"`) were rendering in place of the category labels, because the tick callback was
  wired to every axis rather than only the value axes.
- `<lr-diff-view>`: normalize CRLF and lone-CR line endings, so a Windows-authored file no longer
  diffs as entirely changed.
- `<lr-app-rail>`: anchor the resizer to `:host`, pin `overflow-x`, and free fixed-position popups
  that were being clipped by the rail.
- `<lr-button>`: collapse empty start/end adornment wrappers, which were reserving visible space for
  slots with nothing in them.
- `<lr-swatch-picker>`: keep the selected glow on gemstone swatches.
