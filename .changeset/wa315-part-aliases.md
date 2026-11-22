---
'@aceshooting/lyra-ui': minor
---

Part-name parity with the current upstream manifest, added alongside the existing names:
`lr-tag` exposes `remove-button__button`, `lr-tab-group` exposes `scroll-button__button`,
`lr-toast-item` exposes `progress-ring__progress-ring`, and `lr-tree-item` exposes
`checkbox__checkbox` and `spinner__spinner`. Each is a second token on the node that already
carried the corresponding `__base` part, so existing selectors keep matching.
