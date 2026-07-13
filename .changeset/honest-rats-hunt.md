---
"@aceshooting/lyra-ui": minor
---

`lyra-segmented` gains a `label` property giving its `role="radiogroup"` root an accessible name.
When unset, a plain `aria-label` attribute on the host element is honored as a fallback, matching
`lyra-slider`'s existing `label`/`aria-label` convention. Previously the radiogroup had no way to
receive an accessible name at all.

