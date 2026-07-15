---
"@aceshooting/lyra-ui": major
---

**Breaking:** the outer, externally-overridable tier of the design-token chain no longer lives in
Web Awesome's `--wa-*` namespace — it moved to lyra's own `--lyra-theme-*` namespace (e.g.
`--wa-color-brand-fill-loud` → `--lyra-theme-color-brand-fill-loud`). Any consumer retheming
components by setting `--wa-*` custom properties at an ancestor element must rename those
properties to `--lyra-theme-*`; the two-tier override mechanism itself (set one property at any
ancestor to retheme every component) is unchanged. This removes lyra-ui's remaining live runtime
CSS coupling to Web Awesome.
