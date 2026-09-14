---
"@aceshooting/lyra-ui": patch
---

`<lr-timeline orientation="horizontal">` is now reachable by keyboard while its strip actually
overflows.

Timeline items are deliberately passive — no roving tabindex, no per-event selection — so a
horizontal timeline is a scroll container with nothing tabbable inside it. Its `[part='base']`
carried `tabindex="-1"`, which is focusable only by script, so every event that had scrolled past
the edge was pointer-only content: a keyboard user could neither reach the strip nor scroll it.

`[part='base']` now rises to `tabindex="0"` while (and only while) a `horizontal` strip genuinely
overflows, with a `::part(base):focus-visible` ring drawn from the shared focus-ring tokens. A
strip that fits, and the `vertical` default — whose rules never give that box a scrolling axis at
all — return to `tabindex="-1"` exactly as before, so a timeline that has nothing to scroll costs a
keyboard user nothing. Nothing else about the component changes: the items stay passive, cluster
markers remain the only activatable controls, and the edge-fade mask is unaffected.
