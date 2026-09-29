---
'@aceshooting/lyra-ui': major
---

Remove the eligible v22 compatibility APIs after their supported v23 transition period. Use granular component registration and class imports, the independent style APIs, and the `lyra-v21` and `lyra-v22` migration profiles when upgrading. Upstream-mirrored aliases and saved style-preference readers remain supported.

Consolidate component implementations and behavioral tests, refresh library documentation, and qualify styling, localization, package costs and representative compositions for the new release.

Data grids resolve themed row heights once per measurement pass, reducing repeated layout work for large and expanded tree views while preserving live theme changes. Emoji-picker tests wait for the documented color transition before checking the settled state.
