---
'@aceshooting/lyra-ui': minor
---

`lr-alert`, `lr-callout`, `lr-chip`, `lr-badge` and `lr-tag` now accept one shared `variant` set (`neutral`, `brand`, `primary`, `success`, `warning`, `danger`); `primary` is an alias of `brand` everywhere and each component keeps its own fallback for unsupported values. `lr-chip` gains `with-remove` (alias of `removable`) and `lr-tag` gains `disabled`, which disables its remove button and suppresses `lr-remove`. `lr-progress-bar` now exposes `indicator` and `indicatorOffset` like `lr-progress-ring`. `lr-mutation-observer` delivers records queued before an option change instead of dropping them. `lr-widget` reads its `label` slot presence from the shared slot-presence controller.
