---
'@aceshooting/lyra-ui': major
---

`lr-combobox` and `lr-date-input` now support the full shared `LyraAppearance` vocabulary
(`accent`/`filled`/`outlined`/`filled-outlined`/`plain`) on their `appearance` property, matching
`<lr-select>`'s trigger. `accent` paints the loud brand fill with on-brand text, and `plain` drops
both the fill and the border; previously both values parsed and reflected but silently rendered
identically to `outlined`, with no warning. A genuinely unsupported value (a typo, or any other
string outside the five-member set) still clamps to the documented `'outlined'` default and the
reflected attribute is still repaired.

MIGRATION: A TypeScript consumer with an exhaustive `switch`/`assertNever` over
`lr-combobox`'s or `lr-date-input`'s previously 3-member `appearance` type must add `'accent'`
and `'plain'` cases (or a `default` branch). No HTML/attribute migration is needed:
`appearance="accent"` and `appearance="plain"` were previously accepted syntactically and
silently downgraded to `outlined`; they now render as designed instead of being a documented
no-op.

Before:
```html
<!-- silently rendered identically to appearance="outlined" -->
<lr-combobox appearance="accent">…</lr-combobox>
<lr-date-input appearance="plain"></lr-date-input>
```

After:
```html
<!-- renders the loud brand-filled / chromeless treatment, matching lr-select -->
<lr-combobox appearance="accent">…</lr-combobox>
<lr-date-input appearance="plain"></lr-date-input>
```
