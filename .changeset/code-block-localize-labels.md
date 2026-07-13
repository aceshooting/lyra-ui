---
"@aceshooting/lyra-ui": minor
---

`lyra-code-block`'s collapse-toggle, copy-button, and code-region aria-labels now route entirely
through `this.localize()` instead of concatenating a localized verb with a hardcoded English suffix
("code"/"to clipboard"/"Code"). Default English output is unchanged.
