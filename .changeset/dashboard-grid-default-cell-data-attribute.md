---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-dashboard-grid>`'s auto-created default `<lr-widget>` cell tripping the dev-mode
unknown-attribute diagnostic. The component marked its own library-created default cell with a
plain `cell-id` attribute — the same name used for the public, author-facing routing attribute a
consumer writes on their own light-DOM children (`<div cell-id="a">`), but `cell-id` isn't (and
shouldn't be) a real `<lr-widget>` property, since `lr-widget` is a general-purpose component with
no concept of dashboard-grid cells. The auto-created default cell now carries `data-cell-id`
instead — internal bookkeeping through the universally dev-mode-exempt `data-*` prefix, consistent
with the existing `data-dashboard-grid-default-cell` marker on the same element — while
author-authored content continues to use the public `cell-id` attribute unchanged.
