---
"@aceshooting/lyra-ui": patch
---

Internal only: adds three new `src/internal/` modules (`slugger.ts`, `cell-range.ts`,
`viewer-search.ts`) and five new localization keys (`viewerSearchMatchCount(Plural)`,
`viewerSearchNoMatches`, `viewerSearchActiveMatch`, `viewerHighlightLabel`) used by upcoming
per-viewer search/anchor/highlight support. No consumer-visible behavior change on its own.
