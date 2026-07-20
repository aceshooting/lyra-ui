---
"@aceshooting/lyra-ui": minor
---

`lr-phone-input`: rebuild the country selector's closed state and add an opt-in `flags` API.

The old closed control was the bare native `<select>` showing each option's full
`"Country name (+code)"` text: long localized names clipped under the UA chevron (the trigger was
capped at 45% of the field), the calling code appeared twice (inside the option text and again in
`calling-code`), and the popup fell back to UA colors (a white panel in dark themes). The native
`<select>` is kept — its popup, localized full country names, keyboard type-ahead, and native
mobile pickers are irreplaceable and fully accessible — but it is now stretched invisibly over a
compact decorative trigger:

- New closed state: selected alpha-2 code (localized "Select" placeholder when no countries exist)
  plus the shared design-system chevron, with a pointer cursor, a hover tint, and an inner
  focus-visible ring so keyboard focus on the selector is distinguishable from focus on the
  telephone input. No more clipping and no duplicated calling code.
- Popup options now pin `--lr-color-surface`/`--lr-color-text` so the open list follows the theme
  in dark mode.
- New `flags` boolean attribute renders the selected country's flag in the trigger as
  `<lr-flag variant="compact" aria-label="">` (decorative — the select already announces the
  country). The `<lr-flag>` definition is registered lazily on first use, so nothing flag-related
  is bundled while `flags` stays off; flag artwork keeps the standalone `<lr-flag>` contract
  (install optional `@aceshooting/lyra-flags` + import
  `components/media/flag/flag-peer.js` once). Without it the trigger simply omits the image.
- New CSS parts: `country` (selector region), `country-trigger`, `flag`, `country-code`
  (`data-placeholder` when empty), `expand-icon`. Existing parts are unchanged in name, but
  `country-select` is now the invisible overlay — a consumer rule that painted its text/background
  should target `country-trigger`/`country-code` instead.
