---
'@aceshooting/lyra-ui': patch
---

Fix three rendering and accessibility defects.

- `lr-terminal` and `lr-notebook-viewer`: an unterminated escape string (OSC, DCS, APC, PM or SOS) no longer swallows the rest of the output. A string now ends at BEL, CAN, SUB or the next ESC, and `ESC \` still terminates it.
- `lr-color-picker`: `hsl()` and `hsla()` values resolve to the same 8-bit channels the browser computes, so `hsl(0, 100%, 95%)` formats as `#ffe6e6` (it was `#ffe5e5`). Hex, `rgb()` and `hsv()` input are unchanged.
- `lr-eval-run`: the live region now announces examples that become `queued`, `collecting` or take an application-defined status ("{label}: {status}"); they were silent before.
