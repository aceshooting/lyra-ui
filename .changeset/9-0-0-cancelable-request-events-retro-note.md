---
"@aceshooting/lyra-ui": patch
---

Document four cancelable pre-mutation events added in 9.0.0 with no changelog entry:
`<lr-dock-panel>`'s `lr-collapse-request`, `<lr-widget>`'s `lr-fullscreen-request` and
`lr-view-request`, and `<lr-page>`'s `lr-nav-toggle`.

9.0.0 added a consistent propose-then-commit event pair to several components that previously
only fired a single post-commit notification: a new cancelable `*-request` event fires first with
the proposed next state, and a consumer's `preventDefault()` on it now vetoes the change before
the existing non-cancelable `*-change` event fires. `<lr-dock-panel>` gained `lr-collapse-request`
alongside its existing `lr-collapse-change`; `<lr-widget>` gained `lr-fullscreen-request` and
`lr-view-request` alongside `lr-fullscreen-change`/`lr-view-change`; `<lr-page>` gained
`lr-nav-toggle`, its first event of any kind. All four are genuine new opt-in public API — a
consumer can now veto a collapse, fullscreen, view, or nav-open mutation before it commits — but
none were called out in the 9.0.0 changelog entry, unlike the many other opt-in additions from the
same release that are individually documented by name.
