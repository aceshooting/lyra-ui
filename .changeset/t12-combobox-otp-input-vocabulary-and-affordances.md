---
'@aceshooting/lyra-ui': minor
---

`lr-combobox` and `lr-otp-input` now clamp an unsupported `appearance` value to their documented default instead of silently reflecting it unstyled. `lr-combobox` gains a public `loading` property, mirroring `lr-select`'s, so a committed value can show a loading placeholder instead of the "not in catalog" badge while its `<lr-option>` catalog is still mounting asynchronously with no `source` involved, and a new `readonly` property that locks the committed value (still focusable, still submitted with the form) while blocking the popup and all typed or picked edits. In `lr-combobox` `multiple` mode, removing one tag for a duplicate-valued selection (including via Backspace) now removes only that occurrence instead of every occurrence sharing the same value. `lr-otp-input`'s horizontally-scrolling segment row now shows a measured edge fade once it actually overflows, matching `lr-tab-group`/`lr-segmented`/`lr-stepper`.
