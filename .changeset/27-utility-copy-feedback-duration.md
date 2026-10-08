---
'@aceshooting/lyra-ui': major
---

Every copy control now shows its copied/failed feedback for the same 1500 ms (`lr-copy-button`, `lr-diff-view`, `lr-json-viewer`, `lr-stack-trace`, code blocks and the markdown code header). Breaking: `lr-copy-button`'s `feedbackDuration` default changes from `1000` to `1500`; set `feedback-duration="1000"` to keep the old timing.
