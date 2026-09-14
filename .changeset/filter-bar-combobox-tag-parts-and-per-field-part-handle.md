---
"@aceshooting/lyra-ui": minor
---

Two `<lr-filter-bar>` gaps closed, both byte-identical to today's rendering when unset.

- **The composed combobox's chip parts are now forwarded.** `<lr-filter-bar>` re-exports each
  built-in control's shadow surface under `filter-control-*` aliases, but the combobox alias list
  omitted `tag`/`tag-label`/`tags` even though `<lr-combobox>` exposes all three publicly
  (`tag-label` is documented with a `--tag-max-size` cap). Because `::part()` pierces exactly one
  shadow boundary, a consumer had no selector reaching a `multiple` combobox filter's
  selected-value chips through the bar — they stayed capped at that control's own default and
  could not be widened or restyled. `filter-control-tags`/`filter-control-tag`/
  `filter-control-tag-label` now forward `tags`/`tag`/`tag-label`, following the existing
  `filter-control-*` naming exactly.
- **Every filter field now carries its own `field-<filterId>` part token, alongside the shared
  `field` token.** `[part="field"]` previously gave every field the same
  `--lr-filter-bar-field-basis`, so a `multiple` combobox holding several chips got no more room
  than a narrow single-select, and `::part(field)` could not be qualified to pick out one field —
  `::part(field)[data-id]`-style compounds are invalid and silently match nothing (only
  pseudo-classes may follow `::part()`). Each field wrapper's `part` attribute is now
  `"field field-<filterId>"` (for example `part="field field-status"`), so
  `lr-filter-bar::part(field-status) { flex: 2 1 20rem; }` targets exactly that field and can set
  any layout property, not just a width; `::part(field)` rules continue to match every field
  unchanged. `filterId` is consumer-supplied and `part` is a space-separated token list like
  `class`, so an id containing whitespace (or any other character that would need escaping) could
  otherwise fabricate an unrelated second token — in the worst case, one colliding with a real
  part name such as `active-filters`. The `field-<filterId>` token is therefore included only when
  `filterId` reads as a plain CSS ident (ASCII letters/digits/`-`/`_`, starting with a letter); an
  id that doesn't renders `field` alone, exactly as before this part existed.
