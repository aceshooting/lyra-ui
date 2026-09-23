---
'@aceshooting/lyra-ui': patch
---

Fix `lr-archive-viewer` so that when a ZIP archive contains two entries sharing the same path, search navigation and its active-row highlighting (`aria-current`) now follow the true active occurrence instead of always landing on the first same-named entry. The public fragment-anchor `id` syntax is unchanged and its documented behavior for a duplicate-named entry (resolving to the first central-directory occurrence) is now explicit in the component's JSDoc and `llms/viewers.md`.
