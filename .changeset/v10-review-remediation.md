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
`<lr-date-picker>`/`<lr-date-input>` already use. The type is now exactly
`'auto' | 'sun' | … | 'sat'`: the bare `0`–`6` integer form is gone rather than kept as a second
spelling, so there is one way to express a week start instead of two that had to be sanitized and
wrapped against each other. Replace `first-day-of-week="1"` with `first-day-of-week="mon"` to keep
the old rendering. There is no `wa-calendar`, so no upstream parity is affected.

**`<lr-progress-ring>` gains `show-value`, defaulting to `false`.** A determinate ring rendered its
percentage unconditionally, with no way to suppress it short of slotting replacement content — while
its sibling `<lr-progress-bar>` has had opt-in `show-value` all along, and the reference has always
claimed the two share "the same value contract". They now actually do. Add `show-value` to keep the
percentage. `aria-valuetext` still carries it either way, so the accessible value is unchanged.

**`<lr-media-card>`'s `alt` becomes optional, so a decorative image is expressible.** It was
`alt: string = ''`, and the render read `this.alt || this.filename || <localized generic>` — so an
explicit `alt=""` was indistinguishable from an absent one and came out as `alt="Image attachment"`.
There was no way to mark the image decorative, which is the one thing `alt=""` means in HTML. The
type is now `alt?: string` and the render uses `??`, matching `<lr-image-viewer>` and
`<lr-document-preview>`, which already documented that contract. Omitting `alt` is unchanged; only
the value read back from an unset property differs (`''` becomes `undefined`), so a consumer
comparing `el.alt === ''` should read `el.alt ?? ''`. The nested `<video controls>` label
deliberately does NOT follow: an empty `alt` there would leave an interactive player with no
accessible name, and "decorative" is not a state a media control can be in.

**`<lr-attachment-chip>`'s `lr-preview-request` is no longer cancelable.** It was advertised as a
veto point, but the chip never read `defaultPrevented` and owns no preview default action to
cancel — its own docs say it "never registers or owns a viewer/overlay" — so `preventDefault()` was
a no-op. The flag is removed rather than left as a promise the component cannot keep.

### Event vocabulary: one name per event

Several events had two spellings. 10.0.0 keeps the canonical name and **removes the old one
outright** rather than shipping a deprecated alias into a library that has no released consumers
yet — a dual-emit alias is a permanent tax paid to protect users who do not exist.

Rename the listener; the detail object is unchanged in every case.

| Removed | Use instead | On |
|---|---|---|
| `lr-entity-activate` | `lr-entity-select` | `<lr-entity-card>`, `<lr-entity-chip>`, `<lr-neighbor-list>` |
| `lr-visible-range-changed` | `lr-visible-range-change` | `<lr-virtual-list>` |
| `lr-run-select` | `lr-run-change` | `<lr-rag-eval-dashboard>` |
| `lr-dialog-close` | `lr-close` | `<lr-dialog>`, `<lr-drawer>` |

`lr-visible-range-changed` was the only past-tense `-changed` spelling among 58 `-change`-family
events, so a convention-driven listener silently missed it — on a component embedded in ten viewers.

Two deliberate non-removals. `<lr-community-card>` and `<lr-path-strip>` keep `lr-entity-activate`:
it is their only name and never was an alias. `<lr-accordion>` keeps `lr-expand`/`lr-collapse`,
which mirror `wa-accordion`'s real event names — removing them would have broken upstream parity
rather than tidied it. `lr-citation-badge` was also left alone: `lr-citation-select` is an
established *container*-level event with a richer `{ citation }` detail that containers translate
its `{ sourceId, index }` into, so unifying there would have delivered two shapes under one name.

### Interaction, focus and visibility corrections

A sweep with a CSS-specificity analyzer found rules that were supposed to win losing to another rule
in the same shadow stylesheet, so their declarations never applied. The code read correctly and the
tests were green; only a rendered probe showed the difference.

- **The keyboard highlight is visible on the selected row again** in `<lr-select>`, `<lr-combobox>`,
  `<lr-model-select>` and `<lr-voice-picker>`. Each had `[aria-selected="true"]` written after the
  active-descendant rule at equal specificity, so arrow-keying onto the already-selected option
  produced no visible highlight at all.
- **`appearance="filled"` has a focus indicator again** on `<lr-combobox>` and `<lr-date-input>`.
  Both had none: the appearance rule out-ranked `:focus-within`, and the only `outline` in the focus
  rule was `solid transparent`. Both now express appearance as private custom properties, so no
  `[part]` rule can out-rank another and the failure mode is structurally impossible.
- **Pointer feedback restored** where a state rule or a resting rule was swallowing it:
  `<lr-code-block>`'s line-gutter button (neither hover nor press, ever), `<lr-pagination>`'s page
  input, `<lr-table>`'s sticky sortable header, `<lr-time-range>`'s active preset,
  `<lr-agent-trace>`'s active handoff, `<lr-compare-panel>`'s cast vote, `<lr-flow-canvas>`'s
  selected edge, `<lr-conversation-item>`'s open session, `<lr-option>`, `<lr-entity-chip>` and
  `<lr-approval-queue>`.
- **Focus rings restored** on `<lr-calendar>`'s today cell, `<lr-sequence-strip>`'s selected cell,
  `<lr-embedding-explorer>`'s selected point, and `<lr-dashboard-grid>`/`<lr-flow-canvas>` cells in a
  collision or drop state.
- **`hidden` works again** where the component's own stylesheet was defeating the UA default:
  `<lr-flag>` painted a full-size broken image beside its skeleton while loading, `<lr-video>` kept
  the controls play button both painted and focusable behind a poster, and nine components let a
  consumer's `hidden` slotted child stay visible.
- **Disabled controls look disabled**: `<lr-entity-chip>` and `<lr-approval-queue>` rendered their
  disabled buttons pixel-identical to enabled ones, with a pointer cursor and full hover feedback.
- **`<lr-random-content>` actually hides** the candidates it is not showing; its rotation was
  previously observable only to assistive technology.
- **`<lr-video>` keeps captions** for a `<track>` with no `kind` attribute, whose HTML missing-value
  default is `subtitles`.

### Additive

- **`lr-search-change` detail is consistent again.** `<lr-terminal>` and `<lr-av-player>` now emit
  the canonical `LyraSearchChangeDetail` including `matchCountExact`, which 18 of 21 emitters already
  did. This matters most on `<lr-terminal>`, which truncates at 10,000 matches and previously had no
  way to signal that its count was a lower bound. `<lr-knowledge-graph-explorer>`'s detail is now exactly
  `{ query, matchCount, matchCountExact }` — `searchQuery` is replaced by the canonical `query`
  rather than carried beside it; it deliberately has no `activeIndex`, being a live node filter
  rather than a cursor-based search. (The `searchQuery` *property* is unaffected.)
- **`<lr-token-input>` can veto all three mutations.** `lr-add` and `lr-token-edit` are now
  cancelable, matching `lr-remove`, which already was. A vetoed add keeps the typed draft so the user
  can correct it; a vetoed edit leaves the inline editor open with the edited text intact.
- **`<lr-dialog>`'s close event is `lr-close`** (`DialogCloseReason` detail, cancelable);
  `<lr-drawer>` inherits it. See the removal table above.
- **`<lr-accordion>` also emits a cancelable `lr-toggle-request`** (`{ collapsed, item }`) alongside
  its upstream-mirroring `lr-expand`/`lr-collapse`, matching the convention
  `<lr-code-block>`/`<lr-chat-message>` use. `preventDefault()` on either vetoes the transition.
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
