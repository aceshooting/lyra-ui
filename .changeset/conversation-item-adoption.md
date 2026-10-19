---
'@aceshooting/lyra-ui': patch
---

Moving an `lr-conversation-item` (for example inside `lr-thread-list`) into another document or iframe before it has rendered no longer throws from `adoptedCallback`. The same guard now protects every component that mirrors an authored `aria-describedby` onto its inner control (`lr-image-viewer`, `lr-map`, `lr-lightbox`, `lr-textarea`, `lr-input` and others).
