---
"@aceshooting/lyra-ui": minor
---

`<lr-date-picker>` gains `presets`, a quick-range button row for the dashboard time-filter shape
(Today / Last 7 days / Last 30 days / This month / All time).

The pieces for this existed but were split across two components that each held half the contract:
the date components had the calendar, locale and range logic but no preset affordance, while
`<lr-time-range>` had exactly the wanted preset API but is a two-handle numeric brush with no date
logic, so a caller had to map a time axis onto `[min, max]` themselves and got no calendar. Building
it by hand meant a ~260-line control plus its own preset/custom state machine.

`LyraDateRangePreset` is deliberately the same `label`/`start`/`end` shape as `TimeRangePreset`, so
the library has one preset vocabulary rather than two — only the unit differs (ISO `YYYY-MM-DD`
instead of numbers). Range mode only; unset renders nothing. Applying a preset commits through the
same path a two-click selection uses, so ISO serialization, `min`/`max` clamping and the
`input`-then-`change` pair are identical. A reversed preset normalizes, and a malformed one is
ignored rather than clearing the value, so a bad entry in a config-driven list never reads as "the
user picked nothing". New `presets` and `preset-button` CSS parts.
