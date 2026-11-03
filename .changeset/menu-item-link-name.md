---
'@aceshooting/lyra-ui': patch
---

An `lr-menu-item` or `lr-dropdown-item` with a safe `href` now names its internal `<a part="base">` link. The anchor previously had no accessible name, because its visible label sits inside the decorative label wrapper, so axe reported `link-name`. The anchor now carries the row's name as its `aria-label`: a non-empty host `aria-label` wins, otherwise the visible label, and the name follows label edits. Native `href`, `target`, `rel`, `download` and modifier-click behavior are unchanged.
