---
"@aceshooting/lyra-ui": major
---

Every built-in icon-only action now composes a real `<lr-icon-button>` instead of re-deriving its
CSS.

Seven controls each carried their own hand-rolled copy of the same thing: a bare `<button>` with its
own background, radius, hover/press mix, focus ring, disabled dimming and `--lr-icon-button-size`
floor. They drifted — different radii, different hover fills, two of them with no press state that
matched their hover. They now render `<lr-icon-button>`, so all of that comes from one component
and one token contract, and setting `--lr-icon-button-background` (or `-color`, `-radius`,
`-border`, and their `-hover`/`-active` variants) on an ancestor reaches every one of them exactly
as it reaches a standalone icon button. Each component keeps its own resting/hover opinion as the
FALLBACK arm of those tokens, so an ancestor override wins rather than being shadowed.

**Migration — internal part targets moved one shadow boundary deeper.** The old part name still
resolves to a node, but that node is now the composed `<lr-icon-button>` host, which owns the
accessible name, the activation API and the part names while the *painted* surface is its internal
control. A rule that set `background`/`border`/`padding`/`outline` through the old part must move to
the newly forwarded control part, or (better) to the token:

| Component | Old target | Now |
|---|---|---|
| `<lr-copy-button>` | `::part(base)` / `::part(button)` | `::part(base__control)` |
| `<lr-dialog>` (and `<lr-drawer>`, which inherits it) | `::part(close-button)` / `::part(close-button__base)` | `::part(close-button__control)` |
| `<lr-reorder-item>` | `::part(move-up-button)` / `::part(move-down-button)` | `::part(move-up-button__control)` / `::part(move-down-button__control)` |
| `<lr-message-actions>` | `::part(regenerate-button)` / `::part(edit-button)` | `::part(regenerate-button__control)` / `::part(edit-button__control)` |
| `<lr-attachment-trigger>` | `::part(trigger)` / `::part(menu-trigger)` | `::part(trigger__control)` / `::part(menu-trigger__control)` |
| `<lr-code-block>`, `<lr-code-block-core>` | `::part(copy-button)` | `::part(copy-button__control)` |
| `<lr-callout>` | `::part(close-button)` | `::part(close-button__control)` |

Concretely, a consumer rule that used to paint the dialog's close button:

```css
/* BEFORE 16.0.0 -- silently paints nothing now: the node it selects is the
   <lr-icon-button> host, and the background belongs to the control inside it. */
lr-dialog::part(close-button) {
  background: var(--brand-050);
  border-radius: 4px;
}

/* AFTER, option 1 -- the forwarded control part. Same specificity, same file. */
lr-dialog::part(close-button__control) {
  background: var(--brand-050);
  border-radius: 4px;
}

/* AFTER, option 2 (preferred) -- the token contract, which also gives you the
   hover/press states the hand-rolled rule had to restate, and reaches every
   composed icon action in the subtree at once. */
lr-dialog {
  --lr-icon-button-background: var(--brand-050);
  --lr-icon-button-radius: 4px;
}
```

Layout, placement and the accessible name did NOT move: the old part still selects the node that
carries `aria-label`, `part=`, the click target and the grid/flex placement, so a rule that only
sets `margin`, `grid-column`, `order` or `display` keeps working untouched. In JavaScript,
`shadowRoot.querySelector('[part~="close-button"]')` still returns the control you want to
`.click()` or `.focus()` — both are forwarded — but its `localName` is now `lr-icon-button`, and
reading a painted value off it (`getComputedStyle(node).backgroundColor`) needs
`node.shadowRoot.querySelector('[part~="button"]')`.

**Not affected by this change.** Other icon-sized built-in buttons deliberately stay native
`<button>`s in 16.0.0, so every rule you already wrote against them still applies: `<lr-alert>`,
`<lr-toast-item>`, `<lr-lightbox>` and `<lr-tool-result-dialog>` close buttons; `<lr-chip>`,
`<lr-tag>`, `<lr-attachment-chip>` and `<lr-token-input>` remove buttons; `<lr-json-viewer>`,
`<lr-diff-view>` and `<lr-terminal>` copy/download buttons; and every disclosure toggle, including
`<lr-code-block>`'s own `::part(toggle)` and `<lr-chat-message>`'s `::part(collapse-button)`.
`<lr-chat-message>`'s `::part(retry-button)` is a labelled, bordered control rather than an
icon-only action and is likewise unchanged.

`<lr-code-block>`'s copy control additionally carries `copy-button-text` or `copy-button-icon` for
its active appearance, so `::part(copy-button)` written as an exact-value selector in your own
tooling must become a token match.

Alongside the composition:

- **`<lr-attachment-trigger>` gains `appearance` and `size`,** which it had neither of.
  `appearance` is the library's shared `accent`/`filled`/`outlined`/`filled-outlined`/`plain`
  vocabulary, defaulting to `plain` — byte-identical to the treatment it shipped before. `size` is
  the shared six-step ladder (accepting the `small`/`medium`/`large` spellings too) and scales the
  glyph; the tappable box deliberately stays on the `--lr-icon-button-size` accessibility floor at
  every tier, because the ladder's tightest steps resolve below WCAG 2.5.8's minimum.
- **`<lr-code-block>`/`<lr-code-block-core>` gain `copy-appearance` and a `header-actions` slot.**
  `copy-appearance="icon"` swaps the copy control's visible label for a compact glyph and promotes
  the same localized Copy/Copied/failure string to its accessible name; `'text'` (the default) is
  unchanged. `header-actions` takes extra controls at the trailing end of the header row, and its
  content alone is enough to render the header — appending or removing such a child at any time
  brings the header into existence or retires it, with no property write needed. Its
  `::part(header-actions)` wrapper carries the `hidden` attribute (and computes to
  `display: none`) whenever nothing is assigned, so an empty slot contributes no header gap; a
  consumer rule that sets `display` on that part must qualify itself with `:not([hidden])`.
- **`<lr-icon-button>` gains two capabilities the composition needed,** both useful standalone:
  `aria-labelledby` on the host is resolved onto the internal control through
  `ariaLabelledByElements` (an idref cannot cross a shadow boundary; the reflected element
  reference can), and `getToolbarActions()` contributes the button as one logical action to
  `<lr-message-actions>` and any other `LyraToolbarAction` toolbar. Without the latter a
  roving-tabindex owner had no way to manage an icon button at all: writing `tabindex` on a
  custom-element host neither adds nor removes its shadow-internal button's tab stop, so a slotted
  icon button either stayed permanently tabbable or dropped out of the toolbar's stop list.
  A public `control` accessor returns that internal element for the same idref-projection reason
  `<lr-virtual-list>` exposes `scrollContainer`.
- **`<lr-icon-button>`'s internal control now sets `font: inherit`.** Slotted content inherits
  through the flattened tree, so an `<svg width="1em">` slotted into an icon button was taking the
  native button's UA font-size (13.33px at a 16px root) rather than the surrounding text's — every
  `em`-sized slotted glyph silently rendered smaller than intended.
- **`<lr-reorder-list>`'s Ctrl/Cmd+Arrow move.** Its "did this key press come from a consumer's own
  nested control?" test exempted only a native `<button>` in the row's own shadow root, so composing
  the move controls would have made every move key press look like it came from consumer content
  and be discarded. It now exempts anything the row rendered itself, which is the property it
  actually meant: consumer content arrives through a slot and is never in that root.
- **`<lr-drawer>` now registers `<lr-icon-button>`.** It extends `<lr-dialog>` and therefore
  inherits its close control; a consumer importing only `drawer.js` would otherwise have rendered
  an inert, never-upgrading element.
