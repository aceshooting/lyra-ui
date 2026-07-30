---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-mcp-app>`'s remote `src` mode, which never loaded: binding `srcdoc` to an empty string
still produced a *present* `srcdoc=""` attribute, and the HTML spec's iframe processing branches on
that attribute's presence, so the frame navigated to `about:srcdoc` and ignored `src` entirely
(while still firing `lr-mcp-ready`). The same empty-string-vs-absent shape is fixed in
`<lr-av-player>` (a bare player painted a "Failed to load the media" alert before a `src` was set)
and `<lr-zoomable-frame>` (a rejected `src` rendered a broken-image glyph).

Validate consumer-supplied CSS lengths before they reach an inline style declaration list, so a
crafted value can no longer inject extra declarations: `<lr-stack-trace>`'s `max-height`,
`<lr-code-block>`/`<lr-code-block-core>`'s `max-height`, `<lr-table>`'s column
`width`/`minWidth`/`maxWidth`, and `<lr-browser-frame>`'s agent-supplied ping coordinates (which are
now also clamped to the documented 0-100 range instead of serializing `NaN`).
