---
"@aceshooting/lyra-ui": minor
---

`<lr-flag>`: accept ISO 3166-1 alpha-3 country codes, and render a neutral fallback for codes that
cannot resolve.

Two related consumer reports.

**Alpha-3.** `country` took alpha-2 only, while public statistical sources — World Bank, UN, IMF and
most open-data portals — key country records on alpha-3, so every consumer plotting country-level
data shipped and maintained its own ~249-row conversion table purely to satisfy this component.
`country` now accepts either: length alone disambiguates the two code spaces, so no format hint or
new API is needed. The 249 officially-assigned mappings are packed as a ~1.2 KB fixed-width string
and expanded into a lookup lazily on the first alpha-3 use, so an alpha-2-only app never pays for
them. Withdrawn and user-assigned codes deliberately do **not** map to a successor state — a
dissolved federation has no current flag, so it takes the unresolved path below.

**Unresolved ≠ error.** An unresolvable code rendered localized error text into `[part="error"]` and
reflected `data-error`. That is right for a genuine mistake, but historical and longitudinal
datasets legitimately contain states with no current ISO code, and in a table or card grid those
rows want a neutral placeholder occupying the same footprint, not wording that reads to a user as a
bug. Styling `[part="error"]` could not fix it, because the localized string is contained text
rather than substitutable content.

- A new `fallback` slot renders in place of the flag for an unresolvable code, and a `fallback`
  property takes a placeholder image URL (rendered as `[part="fallback-image"]`) when no slot
  content is supplied.
- The host now reflects `data-unresolved` separately from `data-error`, so the two cases can be
  styled apart.

Both additive: a resolvable code renders exactly as before, covered by an explicit inert-by-default
test.
