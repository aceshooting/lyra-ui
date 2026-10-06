---
"@aceshooting/lyra-ui": patch
---
Focus-trapping overlays (`lr-dialog`, `lr-drawer`, `lr-command-palette` and the other modal surfaces) keep Tab in step with the browser: from a focused heading or error summary inside the panel, Tab and Shift+Tab continue to the neighbouring control instead of jumping to the first or last one; an `aria-disabled` control or content below the fold under `content-visibility: auto` at the panel edge is reached before Tab wraps; and the trap keeps wrapping while a tooltip or listbox is open above it.
