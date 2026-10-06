---
"@aceshooting/lyra-ui": major
---
lr-table: a table whose filter excludes every row now says "No matches" (localized `noMatches`, as lr-data-grid does) instead of "No data". Migration: if you override the filtered-to-empty heading through `.strings`, set `noMatches` instead of `noData`; `emptyHeading` still overrides both states.
