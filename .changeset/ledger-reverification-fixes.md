---
"@aceshooting/lyra-ui": minor
---

Fixed gaps found during a full re-verification pass over previously-completed work:

- `lyra-menu`'s type-ahead navigation now excludes `hidden`/`aria-hidden` items (it already
  excluded `disabled` ones), matching the Arrow/Home/End roving-focus navigation it sits next to.
- The root barrel (`src/lyra.ts`) now re-exports 13 component event-map types that were previously
  unreachable from the package root even though their owning classes were exported: `LyraChip`,
  `LyraChipGroup`, `LyraCitationBadge`, `LyraCopyButton`, `LyraDiffView`, `LyraFileInput`,
  `LyraHeatmap`, `LyraLiteChart`, `LyraMediaCard`, `LyraSelect`, `LyraSourceCard`, `LyraSplit`, and
  `LyraTimeRange`'s `*EventMap` types are now all importable from `@aceshooting/lyra-ui`.
