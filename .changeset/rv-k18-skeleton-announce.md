---
"@aceshooting/lyra-ui": major
---
lr-skeleton: `announce` now announces its label through the shared polite live region (like lr-callout and lr-empty) instead of adding a host `role="status"` and hidden shadow text. Migration: remove any styling or tests that relied on the host `role="status"` or the `.sr-only` label inside the shadow root; the announced text is unchanged.
