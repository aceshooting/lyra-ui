---
'@aceshooting/lyra-ui': major
---

Give component view events their own names, so a delegated listener never receives an unrelated
component's view change under the shared `lr-view-change` name.

- **Breaking:** `lr-artifact-panel` emits `lr-artifact-view-change-request` and
  `lr-artifact-view-change` in place of `lr-view-change-request` and `lr-view-change`. The details
  are unchanged (`{ view, previousView }` and `{ view }`).
- **Breaking:** `lr-graph` emits `lr-graph-view-change` in place of `lr-view-change` for a toolbar
  view switch, and `lr-knowledge-graph-explorer` lets that event bubble out under the same new
  name. The detail is unchanged (`{ view }`).
- **Breaking:** `lr-widget` emits `lr-widget-view-request` and `lr-widget-view-change` in place of
  `lr-view-request` and `lr-view-change`. The details are unchanged (`{ viewId }`).
- `lr-date-picker` keeps `lr-view-change` (`{ view, date }`), the name its Web Awesome counterpart
  uses.

Migration: rename each listener or framework binding on these tags, for example
`@lr-view-change` on `<lr-widget>` becomes `@lr-widget-view-change`. Detail reads and
`preventDefault()` calls stay as they are.

Also in this release:

- The collapsed overflow button of `lr-chip-group` and the overflow badge of `lr-avatar-group` now
  start their accessible name with the visible text, so speech-input users can name what they see
  ("+2 Show 2 more" instead of "Show 2 more").
