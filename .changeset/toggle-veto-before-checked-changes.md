---
"@aceshooting/lyra-ui": minor
---

A cancelable toggle request on `<lr-checkbox>`, `<lr-switch>` and `<lr-checkbox-group>`, fired
before `checked` changes — a refused toggle now leaves the control exactly as the user found it,
instead of flipping and snapping back.

- `<lr-checkbox>` gains `lr-checkbox-toggle-request` and `<lr-switch>` gains
  `lr-switch-toggle-request`. Both are cancelable, carry `detail: { checked }` describing the state
  the control *would* take, and fire on every user path (click, Space, `<lr-switch>`'s logical
  arrow keys, and the host `click()` activation each forwards) *before* the control writes
  anything. `preventDefault()` keeps the current state: `checked`, `aria-checked` and the `checked`
  custom state never move at all, and none of `input`/`lr-input`/`change`/`lr-change` fire. A
  listener may instead answer by assigning `checked` itself during the dispatch, which suppresses
  the built-in write the same way — including when it assigns the value the control already held,
  which a before/after value comparison cannot detect. Neither event fires for a programmatic
  `.checked` assignment, a form reset, a session-state restore, or while the control is disabled.
- `<lr-checkbox-group>` translates an owned checkbox's request into its own cancelable
  `lr-checkbox-group-toggle-request`, `detail: { value, previousValue, option }` — the group value
  that would result, the value as it stands, and the `<lr-checkbox>` the user acted on. That is
  what lets a host refuse "uncheck the last remaining option" (`detail.value.length === 0`) with no
  flicker: the option never flips, so there is nothing to revert. The child's own request is
  consumed at the group boundary and republished under the group's name, exactly as the group
  already translates a child's `input`/`change`/`lr-change`. Assigning the group's `value` from a
  listener resolves the request the same way `preventDefault()` does.
- `<lr-tool-select-dialog>` now raises its own cancelable `lr-change` proposal from those requests
  rather than from the composed controls' settled `lr-change`. Preventing that proposal previously
  let the built-in checkbox or switch flip and then wrote it back; it now never flips. The
  composed controls' request events stop at the dialog's boundary, as their native and prefixed
  input/change events already did.
- Nothing listening for the new events behaves byte-identically to before: a request nobody cancels
  commits and then fires the same events, in the same order, as today.
