---
"@aceshooting/lyra-ui": minor
---

Add `lyra-message-feedback`: thumbs up/down for one assistant message, with an optional inline
detail step (multi-select reason chips + a free-text comment) that opens as a disclosure directly
below the thumbs rather than a floating overlay. Fires `lyra-change` on every rating toggle and
`lyra-submit` (`{ value, reasonIds, comment }`) from the panel's submit button; stores nothing
itself — a host persists the rating and may reflect a previously-recorded one back via `value` +
`disabled`. Re-activating the pressed thumb clears the rating unless its own detail panel is open,
in which case that click re-opens the panel with any surviving draft instead.
