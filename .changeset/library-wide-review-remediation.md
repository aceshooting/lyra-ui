---
"@aceshooting/lyra-ui": major
---

Library-wide consistency release: fixes across all 285 components, plus five deliberate public
API changes.

Most of this release extends earlier single-component fixes to every structurally identical
sibling, so behaviour that was already correct on one element is now correct across the family.

### Breaking changes

**`<lr-responsive-panel>`: `variant` is now `shape`.** The property and its reflected attribute are
renamed, and the exported type `LyraResponsivePanelVariant` becomes `LyraResponsivePanelShape`. Its
values (`'fullscreen' | 'bottom-sheet'`) are unchanged. `variant` in this library is the shared
semantic-tone vocabulary (`neutral`/`brand`/`success`/`warning`/`danger`) that `<lr-button>`,
`<lr-badge>` and others use; this control's `variant` described a presentation shape instead, so it
was overloading a shared name with a different member set. Migration: rename the attribute and
property, and the type import if you use it.

**`<lr-chart>` (and every chart subclass): `legendMode` now defaults to `'auto'`.** Previously
`'dataset'`. `'auto'` resolves to `'datum'` on pie, doughnut and polar-area charts and to
`'dataset'` everywhere else. A single-dataset slice chart previously rendered one aggregate legend
row swatched with only the first slice's colour, leaving the remaining slice colours unidentified;
it now labels every slice. Pass `legend-mode="dataset"` to keep the old behaviour.

**`<lr-chart>`: `annotations` and `hiddenDatasets` are now clone-owned frozen snapshots.**
Assignment stores a bounded frozen copy, matching the contract `<lr-box-plot>` and
`<lr-lite-chart>` already had for the same-named properties. The getter returns a different
reference than the one assigned, and an in-place mutation now throws a `TypeError` instead of
silently doing nothing. Migration: reassign a new array (`el.annotations = [...el.annotations, next]`)
rather than mutating in place — code that was already working had to do this anyway, because Lit's
reference-equality change detection never observed the in-place mutation.

**`<lr-tool-param-form>`: a number/integer field's `control` part is now `<lr-number-input>`.** It
was a raw `<input type="number">` whose native spin buttons were hidden with no replacement
affordance. The documented contract (`.value`, `.errors`, `lr-input`, `lr-validity-change`,
`lr-invalid`, and the `control`/`field` part names) is unchanged. Migration only affects CSS or DOM
queries written specifically against the control being a native `<input>`.

**`<lr-tool-result-dialog>`: `lr-maximize-change` now fires before the state changes, and is
cancelable.** It previously fired after `el.maximized` already reflected the new value. Migration: a
handler reading `el.maximized` synchronously should read `event.detail.maximized` instead.

### Accessibility

- `<lr-icon-button>` now forwards `aria-pressed` and `aria-current` to its internal semantic control,
  matching the fix `<lr-button>` received. An icon-only toggle previously left the attribute inert on
  the host, so assistive technology announced no pressed or current state at all.
- A host-authored `aria-describedby` is now merged into the internal control's own
  `aria-describedby` on the components that were dropping it, so an external description association
  reaches the element that owns the role.
- Computed accessible names are no longer written back as an empty `aria-label`, which suppressed the
  native text fallback rather than deferring to it.
- `<lr-heatmap>` announces a keyboard range selection after the selection is extended, so the added
  cell is actually confirmed, and no longer overrides an author's deliberate `aria-label=""`.
- `<lr-card>`'s activation control gets a localized fallback name when its content has no text of its
  own, so an image-only or chart tile is never an unnamed button.

### Correctness

- Property setters that clamped or validated against a sibling property no longer depend on
  assignment order. Lit assigns template bindings in source order, so `.value` bound before its
  domain properties could silently normalise to a different value; `<lr-data-grid>` and
  `<lr-flow-canvas>` could lose an initial selection entirely this way.
- Components composing `<lr-virtual-list>` now pass stable collections, so an unrelated re-render no
  longer clears measured row heights and forces a full offset recompute — visible as a sticky-header
  height snap on `<lr-thread-list>`.
- Generated chart dataset defaults now defer to authored `config` beyond bar charts, so an explicit
  `borderWidth`/`borderRadius`/`pointRadius` of `0` is honoured. At dense geometry a generated
  transparent stroke could consume a thin bar entirely and paint nothing.
- `<lr-chart>`'s spoken value now honours `valueFormatter`, so a keyboard or screen-reader user hears
  the same formatted value sighted users see.
- `getElementById` on a `renderRoot` typed `HTMLElement | ShadowRoot` is replaced with `querySelector`.

### New public surface

`<lr-data-grid>` gains `selectionMode` (aligning its vocabulary with `<lr-table>`) and a cancelable
`lr-sort-request`; `<lr-menu-item>` and `<lr-dropdown-item>` gain the full `href`/`target`/`rel`/
`download` link surface with a non-removable `noopener noreferrer` guard whenever `target` is set;
`<lr-box-plot>` gains the eighteen-token palette and border/radius hooks its sibling chart types
already had; `<lr-message-parts>` gains `maxRenderedParts`; `<lr-subagent-panel>` and
`<lr-flow-minimap>` gain the `compact`/`frame` density escape hatches their siblings had;
`<lr-document-compare>` gains `max-height`; `<lr-alert>` gains close-button hover/active tokens;
`<lr-export-button>` gains a `trigger-error` part so an export failure is visible and announced.

### Tooling

- The manifest no longer drops a subclass's property type override, which was publishing the base
  class's type plus a false `inheritedFrom` — and flowing that wrong type into the generated React,
  Vue and Svelte declarations.
- `<lr-histogram>`'s derived `labels`/`datasets` are published as read-only. They were absent from
  the manifest entirely, so assigning them type-checked against the inherited writable signature and
  silently did nothing.
- The attribute-polarity migration gate now checks the real shipped surfaces. It previously iterated
  a hand-maintained rename list that contained no polarity-bearing pairs at all, so it could not
  reject an inverted rename — the quietest possible parity break, since the migrated markup still
  parses and the component behaves the other way round.
- Optional-peer install coverage in the packed-consumer check goes from one peer to eleven, and every
  remaining peer now needs a written reason or the check fails.
- `scripts/test.sh` keeps its lane logs when a run fails, instead of deleting the directory whose
  path it just printed.
