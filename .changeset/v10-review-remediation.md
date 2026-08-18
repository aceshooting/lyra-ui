---
"@aceshooting/lyra-ui": major
---

**10.0.0.** A set of public-contract corrections that need a major boundary, plus a larger set of
additive fixes. Breaking items first; each one states what to change if you relied on the old
behavior.

### Breaking

**`<lr-calendar>` derives the week start from the locale.** `firstDayOfWeek` defaulted to a
hardcoded `1` (Monday) and never consulted the locale — while the very same component already
threaded `effectiveLocale` through its weekday *label* formatting. Measured, same `en-US` page:
`<lr-calendar>` rendered `Mon Tue Wed…` while `<lr-date-picker>` rendered `Sun Mon Tue…`. The
default is now `'auto'`, resolved through the same `resolveFirstDayOfWeek()` contract
`<lr-date-picker>`/`<lr-date-input>` already use. The type widens to
`number | 'auto' | 'sun' | … | 'sat'`, so an existing `first-day-of-week="1"` keeps working
unchanged; pass `1` explicitly to keep the old rendering. There is no `wa-calendar`, so no upstream
parity is affected.

**`<lr-progress-ring>` gains `show-value`, defaulting to `false`.** A determinate ring rendered its
percentage unconditionally, with no way to suppress it short of slotting replacement content — while
its sibling `<lr-progress-bar>` has had opt-in `show-value` all along, and the reference has always
claimed the two share "the same value contract". They now actually do. Add `show-value` to keep the
percentage. `aria-valuetext` still carries it either way, so the accessible value is unchanged.

**`<lr-attachment-chip>`'s `lr-preview-request` is no longer cancelable.** It was advertised as a
veto point, but the chip never read `defaultPrevented` and owns no preview default action to
cancel — its own docs say it "never registers or owns a viewer/overlay" — so `preventDefault()` was
a no-op. The flag is removed rather than left as a promise the component cannot keep.

### Event vocabulary: canonical names, aliases retained

Each renamed event now fires **both** names from the same gesture with an identical detail object.
The old name is deprecated with removal not before 11.0.0, so nothing breaks in 10.0.0.

- `<lr-entity-card>`, `<lr-entity-chip>`, `<lr-neighbor-list>`: `lr-entity-select` is canonical;
  `lr-entity-activate` is the alias. (`lr-citation-badge` was deliberately left alone —
  `lr-citation-select` is an established *container*-level event with a richer `{ citation }` detail
  that containers translate its `{ sourceId, index }` into, so unifying there would have delivered
  two different shapes under one name.)
- `<lr-virtual-list>`: `lr-visible-range-change` is canonical; `lr-visible-range-changed` is the
  alias. It was the only past-tense `-changed` spelling among 58 `-change`-family events, so a
  convention-driven listener silently missed it — on a component embedded in eight-plus viewers.
- `<lr-rag-eval-dashboard>`: `lr-run-change` is canonical; `lr-run-select` is the alias. Three
  identically-shaped filter clicks were spelled with two different verbs.

### Additive

- **`lr-search-change` detail is consistent again.** `<lr-terminal>` and `<lr-av-player>` now emit
  the canonical `LyraSearchChangeDetail` including `matchCountExact`, which 18 of 21 emitters already
  did. This matters most on `<lr-terminal>`, which truncates at 10,000 matches and previously had no
  way to signal that its count was a lower bound. `<lr-knowledge-graph-explorer>` adds `query`
  (alongside its retained `searchQuery`) plus `matchCount`/`matchCountExact`; it deliberately carries
  no `activeIndex`, being a live node filter rather than a cursor-based search.
- **`<lr-token-input>` can veto all three mutations.** `lr-add` and `lr-token-edit` are now
  cancelable, matching `lr-remove`, which already was. A vetoed add keeps the typed draft so the user
  can correct it; a vetoed edit leaves the inline editor open with the edited text intact.
- **`<lr-dialog>` also emits `lr-close`** with the identical `DialogCloseReason` detail, alongside the
  retained `lr-dialog-close`. `preventDefault()` on either vetoes. `<lr-drawer>` inherits it.
- **`<lr-accordion>` also emits a cancelable `lr-toggle-request`** (`{ collapsed, item }`) alongside
  `lr-expand`/`lr-collapse`, matching the convention `<lr-code-block>`/`<lr-chat-message>` use.
  `preventDefault()` on either vetoes the transition.
- **`<lr-popover>` gains `disabled`.** Both `<lr-tooltip>` and its own subclass `<lr-dropdown>` had
  it; the base did not. `<lr-dropdown>` now inherits it, with byte-identical behavior.
- **`<lr-table>` emits `lr-selection-change`** when a `selectionMode` flip to `'single'` coerces a
  multi-row selection down to one key — previously a silent mutation a host mirroring the event could
  not see.
- **`<lr-command-palette>` re-emits `focus`/`blur`** from its search input; native ones neither bubble
  nor cross the shadow boundary.
- **`PptxViewerAdapter` and friends are importable.** `pptx-loader.js` had no `package.json#exports`
  entry despite the reference documenting the import, so it failed with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. A new check now requires every helper module to be classified
  public or internal, closing the same class that stranded `archive-viewer-register.js` in 9.0.0.
- **`PlaceSync`** is re-exported from `dropdown.class.js`, and ~13 constituent types are re-exported
  from the composite components whose public properties use them.
- **`<lr-knowledge-graph-explorer>` no longer announces on mount.** A preset `search-query` fired its
  live region before any user action.
