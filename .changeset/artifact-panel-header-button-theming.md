---
"@aceshooting/lyra-ui": patch
---

Fix `lr-artifact-panel`'s restore/copy/download header buttons rendering fully raw browser chrome
(zero CSS at all) while the adjacent header buttons in the same row are fully themed, and give
view-button its own hover/focus-visible to match its version-previous/version-next siblings.
