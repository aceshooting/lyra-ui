---
"@aceshooting/lyra-ui": minor
---

Add `lyra-compare-panel`: side-by-side A/B output comparison with a winner vote (LMSYS-arena /
LangSmith-pairwise style) — two slotted panes (`a`/`b`), an optional shared `prompt` header, a
`role="group"` vote bar (better-A / better-B / tie / both-bad, the last two individually
hideable), and optional proportional `syncScroll` between panes. No hotkeys (slotted content may
contain inputs); casting a vote announces through an internal live region.
