---
"@aceshooting/lyra-ui": minor
---

`<lr-select>`: new `sync` property, closing the shared anchored-surface sizing vocabulary
`<lr-popup>`, `<lr-popover>`, `<lr-dropdown>` and `<lr-combobox>` already spell. It takes the same
`'width' | 'height' | 'both'` type (`PlaceSync`), the same unset default, and is wired through the
same `place()` option, so `sync="width"` copies the rendered trigger width onto the listbox: a
full-width select with short option labels no longer opens a listbox visibly narrower than, and
floating centred under, its own trigger. Changes reposition an already-open listbox without closing
it, and unsetting it releases the inline width the positioner wrote.

With `sync` unset the listbox renders exactly as before -- `inline-size: max-content` between
`--lr-size-12rem` and `min(--lr-popover-viewport-clamp, --lr-size-28rem)`. A synced listbox is
capped on `--lr-positioner-available-inline-size` alone, adopting the corrected clamp rather than
the viewport-clamp shortfall it would otherwise have inherited, so it matches its trigger at any
width while the measured available space still keeps it on screen.
