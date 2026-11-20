---
'@aceshooting/lyra-ui': major
---

- **Breaking:** `<lr-geojson-viewer>` no longer fires `lr-render-error` when the optional `maplibre-gl` peer is missing, and `<lr-notebook-viewer>` no longer fires it when DOMPurify is missing or fails. Both keep the fallback visible and report the condition only through `lr-viewer-diagnostic` (`fatal: false`). Migration: hosts that reacted to `lr-render-error` for these cases listen to `lr-viewer-diagnostic` and branch on `detail.diagnostic.code` (`geojson-map-unavailable`, `notebook-sanitizer-unavailable`). `lr-render-error` now means the viewer failed.
- `<lr-notebook-viewer>` reports an HTML or SVG output over the passive-markup limits as one `notebook-output-too-large` diagnostic per load instead of one `lr-render-error` per output.
- `<lr-document-preview>` and `<lr-svg-viewer>` region-highlight targets and actions expose the active highlight through `aria-current`, and the targets drop their redundant `role="button"`.
- `document-viewer-kinds.js` now registers GeoJSON lazily through the new `geojson-view/geojson-viewer-register.js` entry, so `.geojson` files no longer fall back to a download.
- `<lr-ebook-viewer>` cancels the body of a superseded or failed EPUB response instead of leaving the connection open.
- `<lr-archive-viewer>` no longer re-renders on every scroll event once its list is bound, and no longer scans every entry to find the active search match.
- `<lr-notebook-viewer>`'s load-failure block drops the inline-start danger bar that no other viewer draws.
