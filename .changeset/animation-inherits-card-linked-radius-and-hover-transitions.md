---
"@aceshooting/lyra-ui": patch
---

Five bug fixes across `<lr-animation>`, `<lr-card>`, `<lr-segmented>`, `<lr-tree-item>`, and
`<lr-locale-picker>`.

- `<lr-animation>`: the host declared no `color`/`font` alongside its `display: contents`, so it
  inherited the library's base default text color/font instead of the ambient color/font of
  whatever it is slotted into. Bare, unstyled slotted content (exactly what this component's own
  stories use) therefore rendered in the library default color inside a dark card or a coloured
  alert instead of blending in. The host is now `color: inherit; font: inherit;`, matching how
  `<lr-tab>` was fixed for the identical mechanism.
- `<lr-card>`: with `href` set, `[part="base"]` becomes an absolutely-positioned empty
  stretched-link overlay behind the real, visibly clipped content in `.linked-content`. Both
  independently repeated `var(--border-radius, var(--lr-radius))`, so a consumer overriding
  `::part(base) { border-radius: … }` directly (rather than through the documented
  `--border-radius` hook) reshaped only the invisible overlay, producing mismatched corners
  between the card's visible chrome and its content clip. Both now read a single
  `--_lr-card-radius` token; the linked overlay's declaration is pinned with `!important` (the one
  case that still outranks an outer `::part()` rule) so it can never drift from
  `.linked-content`'s again. The `--border-radius` hook is unaffected and still reshapes both
  identically. Non-linked cards are untouched — `::part(base)` continues to work normally there,
  since there is no `.linked-content` twin to fall out of sync with.
- `<lr-segmented>`, `<lr-tree-item>`, `<lr-locale-picker>`: the interactive segment/item/toggle/
  trigger/option surfaces changed `background`/`color` on `:hover`/`:active` with no `transition`
  declared anywhere in the file, so their paint snapped while `<lr-button>`/`<lr-copy-button>`/
  `<lr-icon-button>` ease. Each now declares
  `transition: background-color var(--lr-transition-fast)` (plus `color` for `<lr-segmented>`'s
  segment, which also recolors on hover/active). No component-local
  `prefers-reduced-motion` block is needed: `tokens.styles.ts` already flattens
  `--lr-transition-fast` to `0.001ms` and applies a blanket `transition-duration: 0.001ms` across
  the whole shadow tree under reduced motion.
