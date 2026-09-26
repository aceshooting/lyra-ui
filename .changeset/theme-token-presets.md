---
"@aceshooting/lyra-ui": minor
---

Theme runtime: `setLyraTheme()` and theme presets accept a validated, per-mode `tokens` map of `--lr-theme-*` inputs (persisted, applied by the no-flash bootstrap, and contrast-floored against the same token families the static contrast gate checks). `@aceshooting/lyra-ui/theme/presets/shadcn.js` ships the shadcn look as a runtime preset generated from `themes/shadcn.css`; it changes only the look and leaves mode, accent and surface alone. Accent and surface colours, and component CSS length/colour/inset properties, with an unclosed parenthesis or quote (for example `rgb(0 0 0`) are now rejected instead of being written in a form that corrupts the rest of the element's inline `style` when it is re-parsed. The `lyraThemeBootstrap` / `theme-bootstrap.js` bytes change: regenerate any pinned CSP hash for the inline or external bootstrap.
