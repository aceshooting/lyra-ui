---
"@aceshooting/lyra-ui": patch
---

Components that derive an accessible name from slotted content read computed style about half as often while they observe it. Each rebind now reuses the composed-ancestor readings its own text walk already took for the ancestor visibility baselines, instead of a second `getComputedStyle()` pass over every ancestor, and a mutation batch reads each element once however many records it carries. Behaviour is unchanged.
