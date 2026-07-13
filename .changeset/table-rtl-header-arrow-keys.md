---
"@aceshooting/lyra-ui": patch
---

`lyra-table`'s header-cell ArrowLeft/ArrowRight roving-tabindex navigation now derives its RTL
check through the shared `isRtl()` helper instead of a duplicated inline `getComputedStyle`
check, and gains test coverage confirming ArrowRight/ArrowLeft already swap correctly under
`dir="rtl"` (a native `<table>` mirrors column visual order under RTL on its own) while
ArrowUp/ArrowDown row navigation is unaffected. No behavior change.
