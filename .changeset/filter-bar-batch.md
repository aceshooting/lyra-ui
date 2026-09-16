---
"@aceshooting/lyra-ui": minor
---

Five `<lr-filter-bar>` fixes.

An unset `'select'` or single `'combobox'` filter bound `''`, which those controls treat as a
committed unmatched value, so every page load showed their "not in catalog" treatment instead of the
declared placeholder. Unset now binds absent. The date branch deliberately keeps `''`, having no
catalog to mismatch against.

`activeFiltersDisplay` (`all` | `changed` | `hidden`, default `all`) controls the active-filter chip
row. It was unconditional, and a filter resting at its `defaultValue` counted as active — so a bar
whose default narrows the view claimed the user had narrowed it. `changed` lists only what the user
actually changed. The default reproduces today exactly.

The `'checkbox-menu'` trigger gains the disclosure caret its neighbours have, which also start-aligns
its content instead of centring a bold sentence in a stretched field, and its label and caret parts
are forwarded under the `filter-control-*` scheme.

A lean registration entry lets a bar pay only for the filter types it declares. The real cost was
that `filter-bar.class.ts` bare-imported eleven composed control modules it never referenced; those
are gone, so the class module is genuinely side-effect-free and the default entry still registers
everything for existing consumers.

The composed combobox tag's remove button is now forwarded, so a consumer re-skinning filter tags as
pills can style the control inside them instead of leaving library defaults in a custom pill.
