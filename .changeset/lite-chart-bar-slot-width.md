---
"@aceshooting/lyra-ui": minor
---

`lr-lite-chart` gains `barSlotWidth` (attribute `bar-slot-width`): a fixed per-category slot width for the default `layout="fit"`, so bars can share an external column pitch (such as a sibling `lr-heatmap`'s cell pitch) without switching to `layout="scroll"`, overflowing the host, or shifting under `dir="rtl"`. `barX` still overrides each category's x-origin; `layout="scroll"` keeps using `barWidth`. Sparse category ticks — for example one month name every few weeks, with the other ticks blanked or empty — now use the room of their empty neighbors before ellipsizing, in both layouts, while ticks with labelled neighbors are ellipsized exactly as before.
