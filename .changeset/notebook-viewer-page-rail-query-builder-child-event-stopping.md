---
"@aceshooting/lyra-ui": patch
---

Fix partial child-event stopping in three components whose nested `<lr-virtual-list>`/child
controls only had some of their bubbling events stopped at the host boundary:

- `<lr-notebook-viewer>` and `<lr-page-rail>` each already stopped the nested `<lr-virtual-list>`'s
  `lr-visible-range-changed` event from leaking past the host, but left its `lr-scroll` event (and,
  for `<lr-page-rail>`, its `lr-load-more` event too) undocumented and free to bubble straight
  through. Both are now stopped the same way, mirroring the existing `lr-visible-range-changed`
  handling.
- `<lr-query-builder>`'s add/remove condition buttons called `addCondition()`/`removeCondition()`
  directly from their `@click` handlers, bypassing the `consumeChildEvent()` helper every other
  handler in the component consistently uses to stop the raw composed child event before emitting
  the component's own wrapper event. The two buttons now route through `consumeChildEvent()` like
  the rest of the file.

`retrieval-results.class.ts` and `tool-select-dialog.class.ts` were also audited for the same
inconsistent-stopping pattern; both already stop every child event consistently, so neither needed
a change.
