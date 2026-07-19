---
"@aceshooting/lyra-ui": minor
---

`<lr-diff-view>` gains a `contextLines` property: collapses a run of unchanged lines longer than
`2 * contextLines` behind a single localized fold marker reporting how many lines it hides, keeping
only `contextLines` lines of context immediately before/after each change (leading/trailing runs
keep only their nearest `contextLines` lines) — the same context-window convention `git diff -U<n>`
uses. Default `undefined` renders every line unconditionally, exactly as before this property
existed. Works identically in both `unified` and `split` layout.
