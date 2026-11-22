---
'@aceshooting/lyra-ui': patch
---

Fix `lr-tab-group` dropping its server-selected `active` tab during hydration and falling back to the first tab. Neither the server render nor the hydrating first update can see the tabs yet, so neither of them now repairs `active`.
