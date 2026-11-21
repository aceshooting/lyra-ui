---
'@aceshooting/lyra-ui': patch
---

- `lr-chart`: a chart fed `preparedData` no longer reads the legacy `datasets` input while building its tooltip configuration.
- `lr-badge`: the host `aria-label` and `aria-labelledby` attributes are documented in the manifest and editor data.
- `lr-help` and `lr-style-panel` are classified as static-safe for server rendering.
- Size ceilings follow reviewed measurements: `lr-style-panel` brings the segmented, select, slider and swatch-picker controls it composes into the utility barrel (247,422 gzip bytes). The forms, media and overlays barrels, `lyra.js`, `theme.js`, and the standalone button, combobox and gauge entries grew by 68 to 2,284 gzip bytes each; the combobox initial route measures 39,227 marginal gzip bytes. Each exceeded ceiling advances only to the next 64-byte boundary. The unpacked package ceiling advances to 23,555,328 bytes, 0.5% above the 23,438,128-byte measurement.
