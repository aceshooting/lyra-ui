---
"@aceshooting/lyra-ui": patch
---

Hide the anchor-announcement live region in `<lr-include>` and `<lr-pptx-viewer>`.

Both viewers render the shared anchor-target mixin's `role="status"` live region, which the mixin
marks up with `class="sr-only"`, but neither component's shadow stylesheet defined that class. The
region therefore laid out as an ordinary block, so the first anchor jump (or a failed one) painted
its localized announcement — "Jumped to highlighted passage." / "Passage not found in this
document." — as visible body text: beside the transcluded fragment for `<lr-include>`, and as an
extra row under the fidelity notice for `<lr-pptx-viewer>`. The announcement is now visually hidden
and screen-reader-only, matching every other viewer that adopts the same mixin.
