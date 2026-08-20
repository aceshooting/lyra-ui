---
"@aceshooting/lyra-ui": minor
---

Completed the date-preset story across the three components that share it.

`<lr-date-input>` now mirrors the nested picker's `appliedPreset` as a read-only getter. 11.0.0 added
`presets` to `<lr-date-picker>`; 11.1.0 then separately forwarded `presets` to `<lr-date-input>` and
added `appliedPreset` to the picker — but never joined the two halves, so the readback landed on the
component that does not need it and the component that does could set presets and not read the
result. `appliedPreset`'s own documentation describes the dashboard time filter ("'Last 7 days' must
still mean the last 7 days after tomorrow's reload"), and that shape is the compact
text-field-plus-popover input, not the inline calendar.

There was no workaround. The nested picker lives in the input's shadow root with no documented
readback path: `input`/`change` are deliberately native events and carry no detail, and every
alternative the docs already reject applied — matching `value` back against the preset list is "the
mapping table `presets` exists to delete" and is ambiguous (Today and This month coincide on the
1st), while reaching for `[part='preset-button'][data-active]` depends on private structure and on
the popover having been opened at least once.

The mirror is the input's own field rather than a shadow-root lookup, so it is correct (`undefined`)
when the popover has never been opened. It carries both halves of the picker's contract — set before
`commit()`, so a consumer reading it inside their own `change` handler sees the causing preset, and
cleared on a hand-pick — plus three clear paths the picker cannot see because typing, clearing and
resetting never reach it: a typed commit that actually changes the value (deliberately not a no-op
re-commit, which would otherwise silently drop the preset), `clear()`, and `formResetCallback()`.

`<lr-filter-bar>` can now pass `presets` on its `date-range` filter and reports the resolved preset
on the `lr-input` detail as `appliedPreset`. The bar already composed `<lr-date-input>` and already
forwarded that control's `min`/`max`, but had no path at all for `presets` — so the quick-range row
and the component built for the same dashboard shape could not be combined. `type: 'custom'` was a
poor substitute: hand-rendering the control plus a full adapter to set one property, and forfeiting
the built-in date-range chip localization the docs themselves flag as non-trivial.

`presets` is declared on the `date-range` definition only, not the shared base: a preset names two
dates and the picker ignores the list outside range mode, so putting it on `'date'` would type-check
a guaranteed-inert field.
