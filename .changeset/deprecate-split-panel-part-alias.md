---
"@aceshooting/lyra-ui": minor
---

`lr-split-panel`'s `split-panel` CSS part is deprecated in favour of `base`, which sits on the same wrapper, with removal no earlier than 23.0.0. `::part(split-panel)` keeps matching until then; as a stylesheet selector it logs no runtime warning, so migrate `::part(split-panel)` rules to `::part(base)`. Neither `wa-split-panel` nor `sl-split-panel` publishes a wrapper part, so no mirrored name changes.
