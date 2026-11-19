---
'@aceshooting/lyra-ui': patch
---

Document viewers: highlight layer and page rail keep Alt/Ctrl/Meta, IME and auto-repeat keys for the browser, page rail restarts digit type-ahead after an impossible prefix and announces typed jumps with `lr-page-select`; the highlight layer draws the active highlight apart from a hovered one and holds a lasting reduced-motion flash cue; `lr-pptx-viewer` also emits `lr-page-change`, reports a renderer `AbortError` while still current, and composes the shared viewer frame; `lr-document-compare` reports one `lr-anchor-result` side by side and names panes apart when versions share a name; `lr-document-preview` shows an error for an image that fails to load, isolates caller text direction, and makes overflowing bodies keyboard scrollable; `lr-document-viewer` keeps its rendered content when moved and its body is keyboard scrollable; `lr-docx-viewer` ignores a click that ends a text selection and retries peers that failed to load; `lr-ebook-viewer` clears the previous book's location on a new `src`, titles chapter iframes, fills a definite-height host and exposes highlight tokens; `lr-pdf-viewer` reuses extracted page text across searches, names each page's highlight layer, announces page navigation, re-localizes page errors, centers page errors under RTL and resolves a cancelled thumbnail render instead of rejecting.

Document viewers, continued: `lr-docx-viewer`, `lr-pdf-viewer`, `lr-pptx-viewer` and `lr-document-preview` release the unread body of a failed or superseded response; `lr-document-compare` gains `active-highlight-id`, `context-lines` and `languageLoaders`, and its `max-height` now also caps the diff view; `lr-document-viewer` gains `active-highlight-id` for its fallback preview; `lr-ebook-viewer` announces the chapter reached with the previous/next buttons; `lr-docx-viewer` highlight actions and the `lr-document-preview` download link share the chrome of their sibling viewers.

- Document previews keep separated region controls on the image, move overlapping controls to a list, and preserve focus when the layout changes.
- Region action lists leave modified and IME-composing arrow keys to the browser.
- Disabled chapter and slide buttons keep their resting appearance. PDF, EPUB and PowerPoint pagers share the `--lr-viewer-pager-button-hover-bg` theme hook.
- PowerPoint previews release unread responses if the renderer fails to load.
- PDF viewers report failures from the current text layer, including an unexpected `AbortError`.
- DOCX text highlights respect reduced-motion and forced-color preferences, and highlight actions inherit the viewer font.

- DOCX previews reuse the shared highlight painter and heading navigation. EPUB and PowerPoint loader builds omit their test hooks.
