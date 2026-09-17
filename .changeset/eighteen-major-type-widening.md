---
"@aceshooting/lyra-ui": major
---

**Major only because several exported TypeScript unions and maps gained members. No runtime
behaviour changes, no attribute or event was removed or renamed, and no default moved.** If you do
not perform exhaustive type-level matching over the members listed below, this release is a
drop-in upgrade and you can stop reading here.

The public-API gate classifies widening an exported union as breaking, and it is right to: a
consumer with an exhaustive `switch` over one of these, or a mapped type keyed by one, stops
compiling until the new member is handled. Nothing else about them changed.

**`lr-filter-bar`**
- `LyraFilterBarControlType` gains `'chip'`.
- `LyraFilterBarFilterDefinition` gains `LyraFilterBarChipDefinition`.
- `LyraFilterBarDefinitionValue<D>` gains an arm resolving a chip filter to the full
  `LyraFilterBarFieldValue`, exactly as `'custom'` already does. Every other `D` resolves as before.

An exhaustive `switch (definition.type)` over a filter schema now needs a `'chip'` case, and a
`Record<LyraFilterBarControlType, T>` needs a `chip` key.

**`lr-map`**
- `LyraMapLegendEntry` gains an optional `value` category key.
- `LyraMapEventMap` gains `'lr-map-legend-toggle'`.
- New exported `LyraMapLegendToggleDetail`.

A `Record<keyof LyraMapEventMap, T>` needs the new key. `LyraMapLegendEntry` is only widened by an
optional property, so constructing one is unaffected; only code that enumerates its keys is.

**`lr-virtual-list`**
- New `rowProjection` property and `row-projection` attribute, new `projectedRows` getter, new
  exported `LyraVirtualListRowProjection`, and two exported constants,
  `VIRTUAL_LIST_ROW_ATTRIBUTE` and `VIRTUAL_LIST_STICKY_ATTRIBUTE`.

**Generated framework declarations.** `./custom-elements-jsx`, `./vue` and `./svelte` are
regenerated from the manifest, so the prop types for the components above widen accordingly. This
is the bulk of the gate's reported diff and needs no action.

**Migration:** add the new members to any exhaustive union handling; otherwise upgrade directly.
