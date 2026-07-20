---
"@aceshooting/lyra-ui": patch
---

Fix `lr-trace-tree`'s active-row secondary text falling below the WCAG AA 4.5:1 contrast floor. The
active (`activeSpanId`) row paints `--lr-color-brand-quiet`, against which `--lr-color-text-quiet`
lands at ~4.25:1 — so `detail`, `duration`, `tokens-in`, `tokens-out`, `cost` and the `pending`
status label were all failing while the row was active, even though every one of them passes
comfortably against the plain row background. Those parts now render at full-strength
`--lr-color-text` once the row is active (15.3:1 in light mode, 11.2:1 in dark), the same fix
`lr-conversation-item` already carries for the identical bug. Darkening the active tint instead
would have made it worse: every failing foreground is dark text.

This changes default rendering on the active row, which is intended — the previous default was a
real accessibility failure. The new `--lr-trace-tree-row-active-color` custom property retunes it;
it pairs with `--lr-trace-tree-row-active-bg`, and a consumer setting that to a dark tint in light
mode should set both, because the defaults assume the active background stays on the same side of
the lightness midpoint as the ambient surface.
