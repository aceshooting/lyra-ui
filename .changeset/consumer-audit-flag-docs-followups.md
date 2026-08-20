---
"@aceshooting/lyra-ui": patch
---

Four documentation gaps reported against 11.1.0 by a real-world consumer audit:

- **`<lr-flag>` sizing.** The host sizes from `font-size` (`block-size: 1em`, `inline-size` derived
  via `aspect-ratio`), never documented anywhere. Setting `width`/`inline-size` directly makes both
  axes definite, which defeats `aspect-ratio` and squashes the image instead of scaling it. Now
  documented on the class JSDoc and in `llms/media.md`.
- **`<lr-flag>` bulk rendering.** Nothing pointed a consumer rendering many flags at once (a country
  table, a locale picker) at `@aceshooting/lyra-flags`'s existing `flagUrls()` — one call resolving
  every flag, instead of each `<lr-flag>` instance independently calling `flagUrl()`. Now
  cross-linked from the class JSDoc and `llms/media.md`, alongside the new per-tier peer-resolver
  entry points (see the paired `@aceshooting/lyra-flags` changeset).
- **`accessibleLabel`'s two conventions.** Most components alias it directly onto native
  `aria-label`; a minority (e.g. `lr-callout`, `lr-table`) that separately compute an internal
  accessible name expose it through a bespoke `accessible-label` attribute instead, so a host
  `aria-label` can still override it. Both are individually correct, but nothing stated the split,
  so `accessible-label="…"` on an `aria-label`-only component was a silent no-op. Now documented in
  `llms/shared.md`'s accessibility contract section.
- **Shadow-scoped resolved tokens.** The quick-start theming snippet (README and `llms/shared.md`)
  never warned that the resolved `--lr-color-*`/`--lr-space-*`/`--lr-radius`/`--lr-shadow-*`/
  `--lr-font-*` layer is declared only on each `lr-*` element's own shadow `:host` — unreachable
  from plain application CSS or a consumer's own custom elements. The deeper explanation already
  existed in "Where an override actually reaches"; it's now also stated up front, at the first
  theming snippet.
