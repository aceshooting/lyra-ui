---
"@aceshooting/lyra-ui": minor
---

Sweep for `<lr-thread-list>`'s own now-fixed defect (a suppressed native search-cancel glyph with
no replacement affordance) across the rest of the library.

- `<lr-command-palette>`: the built-in search field's native `::-webkit-search-cancel-button` was
  suppressed with nothing replacing it. A `part="clear-button"` icon button now renders next to
  `[part="input"]` once it has a value, with a localized `this.localize('clear')` accessible name.
  Clicking it clears the field, re-runs the same active-row bookkeeping typing already triggers,
  and returns focus to the input.
- `<lr-data-grid>`: both the toolbar's global `[part="search"]` field and the per-column
  `[part="filter-panel"]` search field suppressed their native cancel glyph the same way. Each now
  gets a matching clear button (`part="search-clear"` and `part="filter-panel-clear"`), rendered
  only while the respective field has a value; clicking one clears just that field, fires the
  existing `lr-filter-change` for the column filter, and returns focus to the field. `[part="search"]`
  is now wrapped in a new `part="search-wrapper"` row so the input can shrink to make room for its
  clear button; the input's own visible styling (border, background, radius) is unchanged.
- `<lr-table>`: the `[part="filter"]` row-filter field had the identical gap. A new
  `part="filter-clear"` button, rendered only while `filterText` is non-empty, clears the field,
  fires the existing `lr-filter-change`, and returns focus to the field.
- `<lr-emoji-picker>`: the `[part="search"]` field had the identical gap. A new `part="search-clear"`
  button, rendered only while the query is non-empty, clears the field and returns focus to it.
  `[part="search"]` is now wrapped in a new `part="search-wrapper"` row for the same reason as
  `<lr-data-grid>` above.

All four reuse the shared `this.localize('clear')` string and the shared `--lr-icon-button-size`
hit-area floor, matching `<lr-thread-list>`'s and `<lr-input>`'s own clear-button vocabulary.

Every other native-search-input-with-a-suppressed-clear-affordance already found by
`grep -rl "search-cancel-button" src/components` (`<lr-eval-dataset>`, `<lr-tool-select-dialog>`,
`<lr-node-palette>`, `<lr-input>`, `<lr-thread-list>`) already renders its own replacement clear
control; no further action needed there.

No "fully controlled property whose built-in interaction visibly does nothing without a host
listener" defect matching `<lr-thread-list>`'s former `collapsedGroupIds` gap was found elsewhere.
`<lr-dashboard-grid>`'s `layout`, `<lr-branch-picker>`'s `index`, `<lr-conversation-item>`'s
`label`, `<lr-stepper>`'s per-step `current` state, `<lr-graph>`'s `selectedNodeIds`/
`selectedLinkIds`, and `<lr-eval-result>`'s `selectedRunId`/`baselineRunId` are all controlled the
same way, but each is a deliberate design choice with a stated precedent (mirroring
`<lr-pagination>`'s server-friendly `page`, `<lr-table>`'s/`<lr-flow-canvas>`'s controlled layout
contract, or `<lr-chat-message>`'s persistence-gated retry convention) rather than an oversight:
in every case, self-applying the change without the host-supplied content it depends on (different
branch content, a collision-resolved layout, a persisted rename, an unambiguous next step state, or
a loaded comparison run) would render an incoherent intermediate state, unlike
`collapsedGroupIds`, whose self-management needed no external data at all.
