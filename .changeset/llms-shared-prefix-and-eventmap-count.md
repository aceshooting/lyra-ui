---
"@aceshooting/lyra-ui": patch
---

Fix two factual errors in the shipped agent-facing reference (`llms/shared.md`, and the
`llms.txt`/`llms-full.txt`/`llms/` artifacts generated from it): the internals section stated
`LYRA_PREFIX = 'lyra'` when the constant is `'lr'` — on the same line that correctly showed
`tag(name)` producing `` `lr-${name}` `` — and claimed a hardcoded count of 127 `Lyra*EventMap`
types when there are now 181. The count is no longer stated as a number, so it cannot drift again.
