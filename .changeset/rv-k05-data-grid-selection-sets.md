---
"@aceshooting/lyra-ui": patch
---
lr-data-grid: selection and expansion membership checks are now constant-time per row, so select-all, shift-range selection, group selection and renders with thousands of selected rows no longer stall (selecting 10,000 rows previously took seconds).
