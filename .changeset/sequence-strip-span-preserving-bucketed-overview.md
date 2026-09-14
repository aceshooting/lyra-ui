---
"@aceshooting/lyra-ui": major
---

`<lr-sequence-strip>` now summarises past its render cap instead of stretching a window across it,
and `<lr-span-waterfall>`/`<lr-trace-tree>` stop rescaling their time axis to a truncated trace.

- **`<lr-sequence-strip>` renders differently above 200 items.** It previously mounted a 200-item
  window around the roving stop and let those cells stretch to the strip's full width, so a
  600-item sequence drew as if it were 200 items — the visible span was a third of the real one and
  nothing on screen said so. Each cell is now a contiguous **range** of items, painted by that
  range's dominant category (a tie goes to the category appearing earliest in the range) and marked
  when any item inside it sets `marker`. The 200 cells always tile the whole sequence, so the strip
  covers the full span at full width and scrolling horizontally is never needed. At or below 200
  items nothing changes: every cell is still exactly one item.
- **Keyboard, ARIA and selection address ranges, not items.** ArrowLeft/ArrowRight and Home/End
  step one range at a time (still direction-aware under RTL), `aria-posinset`/`aria-setsize` count
  ranges, and the cell whose range contains `selectedIndex` carries `aria-current="true"` and
  `data-selected`. Activating a range — by click or Enter/Space — emits `lr-item-activate` for that
  range's **first** item, so a playback consumer receives a real sequence index it can scrub from.
  The event's `detail` shape is unchanged.
- **Migration.** `[part="window-range"]` is gone; it disclosed a projection window this component
  no longer has. `[part="bucket-summary"]` replaces it on the same spot below the strip, reading
  "600 items in 200 ranges" (localized). If you styled `::part(window-range)`, rename the selector.
  Each cell also gains `data-range-start` / `data-range-end` (zero-based, inclusive item indices),
  and code that read a cell's `data-index` as an item index must read those instead — above the cap
  `data-index` is the range's position, not an item's. Two localization keys are new:
  `sequenceStripBucketLabel` (`"{label}, items {start} to {end}"`) and `sequenceStripBucketSummary`
  (`"{items} items in {ranges} ranges"`); the generated list `aria-label` gains the second one as a
  trailing clause so assistive technology learns the strip is showing ranges.
- **`<lr-span-waterfall>` and `<lr-trace-tree>`: bars no longer stretch when a trace is truncated.**
  Both cap rendering at 500 spans and keep the earliest ones, but both then measured the time axis
  from just those survivors — so on a 10-second trace whose tail was truncated, a 1-second span drew
  at 100% track width with nothing to indicate the distortion. The axis and every duration bar now
  scale to the whole trace, measured before the cap is applied. The row cap, its localized notice,
  and the row projection itself are unchanged. **Type change:** the exported `LyraSpanProjection`
  gained a required `extentEndMs: number` (trace-relative ms, the greatest span end measured before
  the 500-span cap), so TypeScript code that constructs that shape by hand — a test double, or a
  wrapper that re-projects spans — must now supply it.
