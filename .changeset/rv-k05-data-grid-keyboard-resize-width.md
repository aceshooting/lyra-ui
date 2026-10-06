---
"@aceshooting/lyra-ui": patch
---
lr-data-grid: keyboard column resizing of an auto-sized column now starts from its rendered width instead of a 7rem estimate (the first ArrowRight no longer collapses a 300px column to about 122px), and the separator's `aria-valuenow`/`aria-valuetext` report the rendered width.
