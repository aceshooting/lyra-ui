---
"@aceshooting/lyra-ui": minor
---

Picker family: a label-only option mode for `<lr-locale-picker>`, and published width/height
geometry on `<lr-model-select>` and `<lr-voice-picker>`.

- **`<lr-locale-picker>` gains `optionDisplay: 'label' | 'label-tag'`** (attribute
  `option-display`, default `'label-tag'` — today's two-line row). Under `'label'` the row renders
  the locale's label alone and the `option-tag` element is **omitted from the DOM**, not hidden with
  CSS: a visually hidden tag would still join the row's accessible name and would still be matched
  by a consumer's `::part(option-tag)` rule, so hiding is not omitting. Selection, flags, the
  trigger and every other option part are unchanged in both modes, and leaving the property unset
  paints exactly as before.
- **`<lr-model-select>`'s 24rem host width ceiling is now `--lr-model-select-max-inline-size`**,
  defaulting to that same `var(--lr-size-24rem)`. The cap was kept rather than dropped to match
  `<lr-select>`'s uncapped host, because a model row usually sits in a settings card or composer
  toolbar where an uncapped control stretches across the whole container; publishing it means a
  full-width row is now one declaration (`--lr-model-select-max-inline-size: none`) instead of a
  `::part`/descendant override. The token is read as a `var()` fallback and never declared on
  `:host`, so a value set on an ancestor theme wrapper still reaches the control.
- **`--lr-model-select-trigger-height` pins an exact trigger height.** The existing
  `--lr-model-select-trigger-min-height` remains a floor; the new name floors *and* caps the
  trigger (and the free-text combobox), so the picker can pixel-match a sibling field in the same
  toolbar row. It takes precedence over the floor, mirroring `<lr-select>`'s identical pair.
- **`<lr-voice-picker>` had the same two gaps and gets the same treatment.**
  `--lr-voice-picker-max-inline-size` publishes its identical 24rem
  ceiling, and `--lr-voice-picker-trigger-min-height` / `--lr-voice-picker-trigger-height` replace a
  hard-wired `min-block-size: var(--lr-form-control-height)`. To be precise about what changed: the
  old values were always *overridable* — `trigger` is a documented part, and a normal
  `lr-voice-picker::part(trigger) { min-block-size: … }` rule in the outer tree outranks a shadow
  rule, just as `lr-model-select { max-inline-size: none }` has always outranked a `:host` rule.
  What they were not is *themeable*: every override had to name a part or a tag and be written at
  the element, so it could not be set once on a theme wrapper or `:root` and inherited, and it
  could not be expressed in the same `--lr-*` vocabulary as the rest of the component. That is the
  win here — one inherited custom property in place of a per-element `::part`/descendant rule.
  Defaults are byte-identical to what shipped.
- **`<lr-voice-picker>`'s preview action now follows `--lr-voice-picker-trigger-height` too.** The
  action sits in the same flex row as the trigger under `align-items: stretch`, and stretch does
  not apply to an item with a definite cross size — so pinning the field left a short, top-aligned
  square beside a taller field. It now reads the same name, with its WCAG hit-area floor kept
  below the hook so a short pin cannot shrink the target.
- **Three more components carried the identical un-themeable shape and are fixed in the same
  change**: `<lr-menu>`'s host and submenu surfaces publish
  `--lr-menu-max-inline-size` / `--lr-menu-min-inline-size` (the floor moves with the ceiling, so a
  cap below 10rem is no longer silently ignored; the viewport clamp and container allocation stay
  outside the hook, so no value can make a menu overflow), `<lr-model-settings-panel>`'s card cap
  publishes `--lr-model-settings-panel-max-inline-size`, and `<lr-time-input>` gains the
  `--lr-time-input-control-min-height` / `--lr-time-input-control-height` pair that `<lr-input>`
  and `<lr-date-input>` already had. `<lr-model-settings-panel>` also stops reaching past its
  nested select with a descendant `max-inline-size: none` and sets
  `--lr-model-select-max-inline-size: none` on its `model-row` part instead, which leaves that
  documented part as a re-cap point the old rule made unreachable.

Also recorded, with no behaviour change: the picker family deliberately does **not** adopt
`<lr-select>`/`<lr-combobox>`'s corrected "an empty string is a candidate value" contract, and the
reasoning now lives next to the code, with a characterization test pinning it. A catalog row's `id` must be a nonblank string, so `''` can never name a row in
`<lr-model-select>`/`<lr-voice-picker>`; a BCP-47 tag always has a primary language subtag, so `''`
can never name a locale row either. In all three, `''` stays the single documented "nothing
committed" sentinel that the placeholder, the preview and the `valueMissing` constraint are built
on. `<lr-locale-picker>` likewise keeps falling back to a derived endonym for a value with no
matching row rather than adopting the "not in catalog" badge: with `locales` unset its catalog
tracks the live locale registry, so a value restored from a profile is routinely
legitimate-but-not-yet-listed, and badging it would be the same false alarm `<lr-combobox>`
suppresses while an async `source` fetch is still in flight.
