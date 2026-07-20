---
"@aceshooting/lyra-ui": minor
---

Fill the sized-control cssprop gaps for `lr-date-input`, `lr-pagination`, `lr-known-date`,
`lr-chip`, `lr-avatar`, and `lr-avatar-group`, matching the per-tier theming surface
`lr-input`/`lr-select`/`lr-combobox` already expose.

- **`lr-avatar` / `lr-avatar-group` (visible bug fix):** the initials fallback and the "+N"
  overflow badge were painted at a fixed `--lr-font-size-sm` at every `size`, so initials did not
  scale with the avatar circle. They now scale via new per-tier `--lr-avatar-font-size` and
  `--lr-avatar-group-badge-font-size` knobs (`sm`/`md`/`lg`). The `md` default is unchanged, so
  existing avatars render identically.
- **`lr-date-input`:** adds a per-tier `--lr-date-input-control-min-height` floor and an exact-height
  `--lr-date-input-control-height` hatch on the input row (it previously had neither). The calendar
  toggle keeps its own 24x24 touch target even when the height hatch pins a shorter row.
- **`lr-known-date`:** adds a per-tier `--lr-known-date-field-min-height` floor and an exact-height
  `--lr-known-date-field-height` hatch on each field input.
- **`lr-chip`:** the interactive tap-target floor is now the per-tier `--lr-chip-min-height` (was a
  single hardcoded `1.5rem` shared by every tier), and a new `--lr-chip-height` hatch pins an exact
  height. Interactive chips keep the 24px WCAG 2.2 SC 2.5.8 minimum at every tier; a `--lr-chip-height`
  below that is for non-interactive chips only.
- **`lr-pagination`:** the nav buttons' and page input's inner padding is now the
  `--lr-pagination-control-padding` knob (was a hardcoded `var(--lr-space-xs)`), kept uniform across
  tiers so current rendering is unchanged.

All new knobs default to today's exact values, so unset consumers render byte-identical at every
tier (the `lr-avatar` `sm`/`lg` font-size fix is the sole deliberate exception).
