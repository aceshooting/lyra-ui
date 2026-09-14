---
"@aceshooting/lyra-ui": minor
---

Every field-shaped form control now publishes the same surface quartet — resting fill, resting
border, hover border and a shared focus halo — so retinting a field no longer means a `::part()`
rule per control per state. Purely additive: with nothing set, every control renders exactly as it
did before.

`<lr-select>` gains `--lr-select-trigger-fill`, `--lr-select-trigger-border-color` and
`--lr-select-trigger-hover-border-color`. The first two are read by **every** appearance, each
falling back to that appearance's own default (`--lr-color-surface-raised` for
`filled`/`filled-outlined`, `transparent` for `plain`, `--lr-color-brand` for `accent`), so one
value retints the trigger whichever treatment it is wearing — a hook wired only into the resting
rule would have been dead for five of the six. The hover hook falls back to the resting border, so
an unset control's hovered edge does not move, exactly as before.

`<lr-locale-picker>` gains the matching `--lr-locale-picker-trigger-fill`,
`-trigger-border-color` and `-trigger-hover-border-color`, and its trigger now eases its border
colour alongside its background instead of easing one and snapping the other.

`<lr-combobox>`'s trigger fill and border were private properties with no public arm; they are now
`--lr-combobox-fill` and `--lr-combobox-border-color`. Its focused edge — the state the listbox
opens in — was a hardcoded brand border and is now `--lr-combobox-open-border-color` (default
`var(--lr-color-brand)`).

The same gap existed on four siblings and is closed with them. `<lr-date-input>`'s resting row gains
`--lr-date-input-fill` and `--lr-date-input-border-color` (its radius has always been public).
`<lr-file-input>`'s resting dropzone gains `--lr-file-input-dropzone-fill`,
`--lr-file-input-dropzone-border-color` and `--lr-file-input-dropzone-hover-border-color` — until
now only its drag accept/reject tints were themeable, and the state the dropzone spends most of its
life in was not. `<lr-phone-input>` and `<lr-token-input>` gain `--lr-phone-input-fill`/
`--lr-phone-input-border-color` and `--lr-token-input-fill`/`--lr-token-input-border-color`; both
already published a focused-border hook, and both still win over the resting pair, as does each
control's invalid state.

`--lr-form-control-focus-shadow` (default `none`) is one halo for all of them:
`<lr-input>`, `<lr-textarea>`, `<lr-select>`, `<lr-combobox>`, `<lr-locale-picker>`,
`<lr-date-input>`, `<lr-file-input>`, `<lr-phone-input>`, `<lr-token-input>` and `<lr-time-input>`
each paint it as a `box-shadow` while focused (or open). `<lr-otp-input>` is the one field-shaped
control left out: its focused segment already draws its own focus ring with `box-shadow`, and a
shared `box-shadow` declaration would replace that ring rather than sit outside it.
It is strictly additive — the focus outline and the focused/open border are the accessibility
answer to focus and are never replaced by it — and, like the rest of the set, it is read through an
inline fallback and never declared on `:host`, so one declaration on `:root`, or on any ancestor to
scope it to a subtree, reaches every field inside it.
