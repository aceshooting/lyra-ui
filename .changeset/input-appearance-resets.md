---
"@aceshooting/lyra-ui": patch
---

Fix `lr-input` (and `lr-time-input`, which renders through the same template/stylesheet) keeping
native browser chrome in three cases: the search-cancel glyph only reset while `clearable` was set
(the common non-clearable case kept it), `type="number"` never resetting the spin-button, and
`type="time"` never touching its calendar-picker-indicator at all -- now restyled, not suppressed,
since it's the only mouse/touch affordance to open the native time picker.
