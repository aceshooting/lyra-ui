---
'@aceshooting/lyra-ui': patch
---

- `lr-archive-viewer` no longer shows the "File"/"Folder" text beside every entry; it stays available to assistive technology through the new `entry-kind` part.
- `lr-notebook-viewer` hides the sanitized-output loading text, labels stderr streams for assistive technology, and no longer loads remote images from markdown cells.
- `lr-notebook-viewer` keeps nested markdown link activations from reaching the host.
- `lr-notebook-viewer`, `lr-archive-viewer` and `lr-xml-viewer` keep active and highlighted rows visible under forced colors.
- `lr-csv-viewer`, `lr-dataset-viewer` and `lr-spreadsheet-viewer` resume loading when moved in the DOM while a request is in flight.
- `lr-calendar-viewer`, `lr-email-viewer`, `lr-svg-viewer` and `lr-geojson-viewer` scroll bodies are keyboard focusable while they overflow.
- `lr-csv-viewer`, `lr-spreadsheet-viewer`, `lr-dataset-viewer`, `lr-archive-viewer` and `lr-notebook-viewer` cap one scroll container at `max-height` and shrink to short content instead of nesting a second scrollbar.
- `lr-xml-viewer` paints highlights and active matches in source mode, keeps XML syntax left-to-right under RTL, styles the partial-search notice and reports no clipboard failure after it was disconnected.
- `lr-geojson-viewer` bounds and scrolls its metadata block, and `lr-html-viewer` and `lr-email-viewer` scroll wide content instead of clipping it.
- `lr-calendar-viewer`, `lr-contact-viewer` and `lr-email-viewer` isolate caller text from the surrounding direction.
- `lr-notebook-viewer` searches error outputs and ANSI-styled text, shrinks image outputs to the cell and parses JSON outputs once.
- `lr-calendar-viewer`, `lr-dataset-viewer` and `lr-email-viewer` report a missing parser before downloading the document body.
- `lr-model-viewer` keeps focus after a lost context disables the focused control; `lr-include` reports the loaded source in `lr-load`.
- `lr-spreadsheet-viewer` shows small numbers without rounding them to zero.
