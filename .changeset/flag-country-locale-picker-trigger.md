---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-locale-picker>`'s trigger button never rendering a flag for the currently selected
locale — `showFlags` only ever affected the open listbox's rows, so a consumer relying on the
default `show-flags` still saw a text-only trigger (e.g. "English") with no flag until the
dropdown was opened. The trigger now renders the same `<lr-flag>` (new `trigger-flag` part,
honoring a `country` catalog override exactly like the row does) that the matching row shows.
