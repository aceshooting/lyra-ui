---
'@aceshooting/lyra-ui': patch
---

Share inherited-attribute observation across locale, motion, and theme watchers, and use one composed-tree parent walk for focus and overlays. Progress, spinner, card, and known-date accessible-text observers use a shared lifecycle controller that ignores ancestor style changes when visibility is unchanged.
