---
"@aceshooting/lyra-ui": minor
---

Nine single-select controls gain one shared `lr-activate` event, a notification that fires on every
user activation of an option — including re-picking the one that is already selected.

Every change event in the library is change-only: it fires when, and only when, the value moves.
That left a whole class of intent unobservable. Re-picking the current option is a real user action
— "run that report again", "reload that panel", "re-fetch this page" — and these components
reported it nowhere. A host could half-cover the pointer case by listening for `click` (the shadow
button's click is composed, so it does escape), but the click retargets to the host and names no
option, and keyboard activation produces no click at all: Home on an already-first selection, End
on an already-last one, or an arrow key at a bound all activate an option and emitted nothing.

| Component | `detail.value` | Silent change event it complements |
| --- | --- | --- |
| `<lr-segmented>` | the segment's `value` | `lr-change` |
| `<lr-swatch-picker>` | the swatch's `value` | `lr-change` |
| `<lr-select>` | the activated option's `value` | `change` / `lr-change` |
| `<lr-combobox>` | the activated row's `value` | `change` / `lr-change` |
| `<lr-rating>` | the committed rating (number) | `change` / `lr-change` |
| `<lr-pagination>` | the requested page (number) | `lr-page-change` |
| `<lr-tab-group>` | the activated tab's panel name | `lr-tab-show` |
| `<lr-widget>` | the activated view's `viewId` | `lr-view-change` |
| `<lr-knowledge-base-admin>` | the activated tab | `lr-tab-change` |

One name rather than nine, so a host learns the contract once. Each component keeps its own precise
`detail` type, so `LyraSelectEventMap['lr-activate']` stays exact while a document-level listener
sees a single `lr-activate`.

- Bubbling and composed, so a host outside the shadow tree receives it without piercing the shadow
  boundary.
- Not cancelable. It reports that the user picked an option; it does not gate anything, and nothing
  in any of these components branches on it. Where the component already has a cancelable proposal
  (`lr-before-page-change`, `lr-view-request`), that proposal remains the veto point and a vetoed
  activation emits no `lr-activate` at all.
- A disabled/unavailable option still activates nothing — no event fires for it.
- When an activation does move the value, the component's own change events are emitted first, so a
  listener reading the value from any of them sees the settled state.
- Programmatic assignment is never an activation. Writing `value`, `page`, `active`, `activeViewId`
  or `activeTab` from the host, and `<lr-tab-group>`'s `show()` method, fire nothing.

Composites that already contain their children's raw events contain this one too, so no component
starts emitting an event it never documented. All eleven: `lr-condition-builder`,
`lr-graph-query-builder`, `lr-rubric-form`, `lr-retrieval-search`, `lr-entity-dossier`,
`lr-spreadsheet-viewer`, `lr-table`, `lr-drilldown-panel`, `lr-filter-bar`, `lr-document-library` and
`lr-tool-param-form` swallow the `lr-activate` of the
`lr-select`/`lr-combobox`/`lr-segmented`/`lr-tab-group`/`lr-pagination` they compose, exactly as they
already swallow its `lr-change`/`lr-tab-show`/`lr-page-change`.

Purely additive: every existing event's timing, detail and silence-on-re-pick are unchanged, so an
application that listens only for the change events behaves exactly as before.
