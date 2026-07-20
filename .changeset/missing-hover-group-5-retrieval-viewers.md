---
"@aceshooting/lyra-ui": patch
---

Add missing `:hover` to six components (`lr-retrieval-results`, `lr-pdf-viewer`, `lr-ebook-viewer`,
`lr-pptx-viewer`, `lr-email-viewer`, `lr-dataset-viewer`) whose interactive controls already had
`cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse users.
