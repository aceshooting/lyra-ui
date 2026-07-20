---
"@aceshooting/lyra-ui": patch
---

Fix `lr-code-block`/`lr-code-block-core`'s shiki dark-theme override only activating on the OS-level
`prefers-color-scheme` media query -- a consumer who sets `--lr-theme-color-*` explicitly, without the
OS itself being in dark mode, now correctly gets the dark shiki syntax theme too, matching every other
`--lr-color-*` token's consumer-overrides-first resolution.
