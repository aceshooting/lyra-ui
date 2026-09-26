## Breaking changes in 10.0.0

**Breaking (event rename, v10):** `lr-dialog`'s close event is now spelled `lr-close`, and
`lr-dialog-close` is removed; `lr-drawer`, which inherits the whole dialog lifecycle, loses it too.
The detail (`DialogCloseReason`), the cancelability, and the position in the `lr-hide` → close →
`lr-after-hide` sequence are all unchanged — only the name moved, onto the plain spelling
`lr-tool-select-dialog` and the rest of the library already use. The old name is removed outright
rather than dual-emitted, because the library has no released consumers and an alias is a permanent
tax paid to protect users who do not exist. Rename the listener. **Breaking (default change, v10):**
`lr-progress-ring` gains `showValue`/`show-value`, defaulting to `false`, so a determinate ring no
longer renders its percentage unless asked. It used to render it unconditionally with no way to
suppress it short of slotting replacement content, while sibling `lr-progress-bar` has had an opt-in
`show-value` all along and this reference has always claimed the two share the same value contract;
they now actually do. Add `show-value` to keep the percentage. The accessible value is unchanged
either way — `aria-valuetext` still carries the locale-formatted percentage — and slotted replacement
content still projects with or without the attribute. **Breaking (removal, v10):** `confirm()`'s
deprecated `tone` option is removed from `ConfirmOptions`; use `variant` (same `'neutral' | 'danger'`
values, same `'neutral'` default). It was documented as a one-major back-compat alias and `variant`
already won whenever both were set, so only a caller passing `tone` alone is affected. **New,
additive, non-breaking:** `lr-popover` gains `disabled` — both `lr-tooltip` and `lr-popover`'s own
subclass `lr-dropdown` had it and the base did not; `lr-dropdown` now inherits it with byte-identical
behavior.

Also corrected in 10.0.0 — not breaking, but visible. `lr-alert` really hides a base that is queued
behind the visible toast window (it renders that base `hidden` and `inert`; `inert` is
platform-enforced, but `hidden` was doing nothing), and `lr-badge` and `lr-chip` honor a consumer's
`hidden` slotted adornment. In each case the component's own author-origin `display` declaration was
beating the UA stylesheet's `[hidden] { display: none }` regardless of specificity.

## Breaking changes in 9.0.0

**Breaking (type-only, v9):** `lr-toast`'s exported `ToastPlacement`, `ToastCreateOptions`, and
`ToastOverflowDetail` are renamed to `LyraToastPlacement`, `LyraToastCreateOptions`, and
`LyraToastOverflowDetail`; `lr-toast-item`'s exported `ToastVariant` and `ToastSize` are renamed to
`LyraToastVariant` and `LyraToastSize`. Update any `import type { ToastPlacement, ... }` to the
`Lyra*`-prefixed names — no runtime/markup change, TypeScript imports only. **Breaking (type-only,
v9):** `lr-progress-bar`'s exported `ProgressVariant` is renamed to `LyraProgressVariant`. **Breaking
(removal, v9):** the deprecated `ToastOptions` alias of `LyraToastOptions`, exported from the
`toast()` helper module, is removed — it was Lyra's own convenience-API type, not a `wa-toast` DOM
member, so no upstream mirror is affected; use `LyraToastOptions` (unchanged, was already the
canonical name). **Breaking (type-only, v9):** `lr-skeleton`'s exported `SkeletonEffect` is renamed to
`LyraSkeletonEffect`. **Breaking (type-only, v9):** `lr-spinner`'s exported `SpinnerLabelPlacement` is
renamed to `LyraSpinnerLabelPlacement`. **New, additive, non-breaking:** `lr-progress-ring` gains a
`variant` property/attribute (`LyraProgressVariant`, default `'brand'`, reflected), matching sibling
`lr-progress-bar`'s semantic-palette vocabulary (`neutral`/`brand`/`success`/`warning`/`danger`), plus
a new `--lr-progress-ring-indicator-variant-color` CSS custom property (palette slot, same override
precedence as `lr-progress-bar`'s `--lr-progress-indicator-variant-color`).

## The shared overlay lifecycle

`lr-dialog`, `lr-drawer`, `lr-popover`, `lr-dropdown` and `lr-tooltip` all open and close over the
page, and as of 8.0.0 they do it through one contract. Each component's own section below documents
what it _adds_ to that contract, not a private variant of it. `lr-context-menu` emits the same four
events with the same timing and cancelability; the differences are noted below.

**One way to open, one way to close.** All five expose `show()`, `hide()` and a reflected `open`
boolean, and all three drive the same code path: `el.show()` is indistinguishable from
`el.open = true`, and `el.hide()` from `el.open = false`. The property, the reflected attribute and
the two methods can therefore never disagree, and each method is a no-op when the overlay is already
in the requested state. `lr-dialog` and `lr-drawer` keep `close(reason)` alongside — `hide()` plus
the reason string that `lr-close` carries.

**Four events, and where the veto sits.**

| Event           | Cancelable | Fires                                              |
| --------------- | ---------- | -------------------------------------------------- |
| `lr-show`       | yes        | before the overlay opens                           |
| `lr-after-show` | no         | once the enter animation has finished              |
| `lr-hide`       | yes        | before the overlay closes, on every dismissal path |
| `lr-after-hide` | no         | once the exit animation has finished               |

> **These four names are not overlay-instance-scoped — filter by target.** Overlay-family
> descendants emit the same bubbling, composed lifecycle events, so a listener on an
> `<lr-dialog>` also receives (for example) a nested popover's or tooltip's event. This applies to
> both pre-events and both `lr-after-*` events. When the handler is intended only for the element
> it is attached to, start with `if (event.target !== event.currentTarget) return;`.

Both pre-events fire **before** the state changes, so `el.open` read inside an `lr-show`/`lr-hide`
handler is still the _old_ value, and `preventDefault()` cancels the transition rather than undoing
it: a vetoed `lr-show` leaves the overlay closed for the trigger interaction, `show()` and
`open = true` alike; a vetoed `lr-hide` leaves it open for Escape, light dismiss, the close button,
`hide()` and `open = false` alike. The two `lr-after-*` events are never cancelable, and none of the
four fires for markup that renders open from the start. The generic popover/dropdown/tooltip events
carry no detail; dialog/drawer `lr-hide` carries `{ source: Element }`. That is the
timing `wa-show`/`wa-hide` always had, so a mechanical `wa-*` → `lr-*` rename now maps all four names
with matching timing _and_ matching cancelability — which also means Lyra 7.x code that read
`el.open` inside an `lr-show`/`lr-hide` handler, or treated the pair as purely informational, was
relying on the opposite polarity and has to be re-read.

`lr-context-menu` differs in three ways: its `lr-show` carries `LyraContextMenuShowDetail`; it has
no `open` setter and no `show()` (a context menu needs a point, so it opens through a gesture or
`showAt()`); and a close that a new gesture interrupts emits no `lr-after-hide`.

`lr-dialog` and `lr-drawer` also expose cancelable `lr-initial-focus` and `lr-request-close` veto
points, documented in their sections. Their cancelable `lr-close` fires **after** `lr-hide` and
before `lr-after-hide`; it carries the close reason as `detail: DialogCloseReason`. Vetoing
`lr-hide` stops it from firing at all, and `preventDefault()` on `lr-close` itself also vetoes the
close. The same name is already used by the `lr-tool-select-dialog`/`lr-tool-result-dialog`/
`lr-tool-approval-dialog` trio, which mirrors this identical detail shape, so one listener covers
all of them. `lr-drawer` inherits `lr-close` unchanged.

> **`lr-close` is not a dialog-scoped name — filter by target.** Nine components in this library
> emit `lr-close`, several of them commonly nested *inside* a dialog: `<lr-callout>` (an inline
> notice above a form), `<lr-tab>`/`<lr-tab-group>`, `<lr-command-palette>`,
> `<lr-document-viewer>`, `<lr-responsive-panel>`, and the three tool dialogs. Library events bubble
> and are composed, so a listener bound directly on `<lr-dialog>` **also receives a descendant's
> close** — a closable callout inside a dialog would otherwise dismiss the whole dialog. The details
> differ too (`<lr-callout>` and `<lr-tab>` carry none, where the dialog carries a
> `DialogCloseReason`), so a handler reading `event.detail.reason` throws on a foreign one. It is
> latent rather than broken-on-arrival, because a callout or tab only emits once it is given a close
> affordance — which is what makes it a bad failure mode: it shows up later and presents as the
> dialog dismissing itself. Guard on the target, the way `<lr-document-viewer>` already does
> internally:
>
> ```js
> dialog.addEventListener('lr-close', (event) => {
>   if (event.target !== event.currentTarget) return; // a descendant's close, not this dialog's
>   // ...
> });
> ```


**The top layer.** An open `lr-dialog` or modal `lr-drawer` is promoted into the browser **top layer**
(through `popover="manual"`) rather than stacked with `z-index`. It therefore escapes every ancestor
stacking context and every ancestor `overflow` clip: a `transform`ed parent, an `isolation: isolate`
wrapper or a `z-index: 2147483647` sticky header can no longer paint over it or crop it, which no
`z-index` value alone can guarantee. If you raised `--lr-layer-modal` to win one of those fights,
that override no longer decides anything for their modal instances and can be dropped — the token
still resolves the `z-index` in their stylesheet, but only as the fallback for a user agent without
popover support. A `contained` drawer is deliberately nonmodal and is not promoted. The token keeps
doing real work everywhere else it is used: `lr-popover`, `lr-dropdown` and `lr-tooltip` are not
promoted unless trapped (below), and otherwise go on stacking at `--lr-overlay-stack-index`,
falling back to `--lr-layer-popover`.

**Anchored overlays and the top layer.** An anchored overlay that resolves the `fixed` strategy
(dropdowns, popovers, tooltips, selects, comboboxes, date/time inputs, colour pickers, submenus,
context menus, navigation-menu panels, chips' and badges' popovers, `lr-popup strategy="fixed"`,
and `lr-selection-toolbar`) is promoted into the browser top layer only while it is **trapped**: when
a `transform`ed, `filter`ed, `contain`ed (or `will-change: transform`, `content-visibility`,
`offset-path`, `transform-style: preserve-3d`) ancestor would otherwise become its containing block
and clip it. It then opens at full size, positioned against the viewport, in left-to-right and
right-to-left documents, without moving any DOM node, so slots, styling, ARIA relationships and
events are unchanged. The check is repeated on every placement update, so an ancestor that becomes
transformed while the overlay is open (a hover lift, an animation wrapper) is handled too. A
promoted instance no longer stacks at `--lr-overlay-stack-index`/`--lr-layer-popover` while open:
it paints above everything outside the top layer, including toasts. A promoted overlay whose
trigger scrolls out of its scroller is hidden until the trigger returns. An overlay that is not
trapped keeps the z-index layering above. Promotion needs the native Popover API; a popover
polyfill does not count, and without it (older Firefox and Safari releases in the support window)
such an ancestor still contains and clips the overlay, except inside `lr-virtual-list` rows (see
`lr-virtual-list`). Overlays opened inside `lr-pan-zoom` content align with their trigger and render
at UI scale with either strategy. The full-viewport modal surfaces that are not anchored overlays
(`lr-command-palette`, `lr-lightbox`, the tool approval/result/select dialogs, a fullscreen
`lr-widget`, the `lr-responsive-panel` overlay and `lr-tour`'s spotlight) still stack with
`z-index`: do not place them under a transformed, filtered or contained ancestor.

**Initial focus.** An `[autofocus]` element anywhere in the slotted content takes focus when the
overlay opens — including one inside a slotted custom element's own open shadow root, so
`<lr-input autofocus>` behaves like `<input autofocus>`. With nothing marked, a modal (`lr-dialog`,
modal `lr-drawer`) prefers the first focusable body control and otherwise focuses the panel itself,
so the default close button never wins merely because it appears first in shadow DOM. A non-modal
`lr-popover` or `lr-dropdown` deliberately leaves focus on the trigger.

**Arrows and external anchors.** `lr-popover`, `lr-dropdown`, `lr-tooltip` and the low-level
`lr-popup` share one anchoring vocabulary, all of it new in 8.0.0 (`lr-popup` itself is new in
8.0.0).

- `arrow` (boolean, reflected) renders an arrow pointing at the anchor, exposed as the `arrow` CSS
  part. It defaults to `true` on popover/tooltip and `false` on dropdown/popup; `without-arrow`
  suppresses the true-default surfaces. The part's attribute also carries the **resolved side** as
  a second token — `arrow-top`, `arrow-bottom`, `arrow-left`, `arrow-right` — so
  `::part(arrow arrow-top)` styles one side. `::part(arrow)[data-side]` and
  `::part(arrow) .inner` are invalid selectors that silently never match; the state is in the part
  name.
- `arrow-placement` (`anchor` | `start` | `end` | `center`, default `anchor`) — `anchor` tracks the
  anchor's centre, `center` pins the arrow to the middle of the popup's edge wherever the anchor is,
  and `start`/`end` pin it `arrow-padding` from one _logical_ end of that edge. On a top/bottom
  placement those two ends are the inline ones, so they swap under RTL; on a left/right placement
  they are the block ends, which do not.
- `arrow-padding` (number of px) keeps the arrow that far from the popup's corners. It defaults to
  `10` on the low-level popup and `0` on the three policy overlays.
- `--arrow-size` is the mapped size custom property and its value is **half** the square's width —
  the rendered arrow is twice it in both axes. Retained fallbacks are `--lr-overlay-arrow-size` on
  `lr-popover`/`lr-dropdown`, `--lr-tooltip-arrow-size` on `lr-tooltip`, and
  `--lr-popup-arrow-size` on `lr-popup`; they default to `var(--lr-size-0-375rem)`.
- `skidding` (number of px, default `0`) offsets the popup _along_ the anchor's edge — the
  cross-axis counterpart to `distance`.
- `for` (string, reflected) anchors the popup to an element it does not contain, by id. The id is
  resolved in the overlay's **own root**, so it works inside a shadow tree where a plain idref could
  not cross the boundary. On popover/tooltip, a slotted trigger wins interaction and ARIA ownership;
  only when no trigger is slotted does a live HTML `for` target own both. Direct `.anchor` is always
  positioning-only. A `showAt()` virtual anchor wins positioning and has no DOM interaction/ARIA
  owner while active.

---

## `lr-toast` / `lr-toast-item` / `toast()`

Stacking toast/notification region. Mirrors `<wa-toast>`/`<wa-toast-item>` under `lr-`.

### `lr-toast`

A placement-specific region. The imperative helper maintains one region for each
`ownerDocument` + `placement` pair; manually authored regions remain independent.

**Properties:**

- `placement: LyraToastPlacement = 'top-end'` (reflected) — one of `'top-start'|'top-center'|'top-end'|
'bottom-start'|'bottom-center'|'bottom-end'`. Every placement resolves inside one logical usable
  rectangle whose four edges are the greater of `--lr-space-l` and the matching safe-area token.
  Start/end follow direction, center placements use that rectangle's midpoint even when the inline
  safe-area insets are asymmetric, and an oversized stack is capped to its usable inline size.

**Methods:** `create(options: LyraToastOptions): Promise<LyraToastItem>` is the canonical form;
`create(message: string, options?: LyraToastCreateOptions)` remains as a compatibility overload.
`LyraToastOptions` contains `message`, optional `placement`, `ownerDocument`, `variant`, `duration`,
`size`, `withIcon`, `icon`, and `action`; `LyraToastCreateOptions` omits `message` and `placement`.
`icon` accepts text, a DOM node, a Lit template, or a target-document factory returning one of
those. Strings are always text, never HTML; cross-document nodes are imported into the region's
document. `action` creates a native button from `{ label, onClick }`. The options' `ownerDocument`,
and `placement`, when supplied directly to a region, must match that region. Calling `create()`
while the region is detached rejects immediately instead of leaving a render-dependent promise pending. `size` accepts
the canonical `2xs`/`xs`/`s`/`m`/`l`/`xl` values plus `small`/`medium`/`large`; either spelling is
preserved by the created item's getter and reflected attribute.

**Live members:** `stack: HTMLElement | null` returns the rendered `[part="stack"]` element, or
`null` before the render root is populated. Its identity remains stable across ordinary updates and
reconnection.

The region keeps exactly three items active. Later items enter a hidden, inert FIFO queue capped at
twenty; their show lifecycle and auto-dismiss timer do not start until promotion. Removing an active
item promotes the oldest queued item. A visible standalone item moved into a full region is
deactivated and timer-paused without replaying `lr-show`, then resumes from its remaining duration
when promoted; its progress ring resumes at the same elapsed fraction as that JavaScript countdown.
The visible stack is safe-area bounded and vertically scrollable, so all three active items and their
controls remain keyboard-reachable even with long localized content.

**Events:** `lr-toast-overflow` (noncancelable, `detail: { count: number }`) reports how many oldest
queued items were discarded when admission exceeded the twenty-item queue. Losses in one synchronous
burst coalesce into one event and one localized polite announcement; `create()` retains its existing
promise/result contract.

**Slots:** default (`<lr-toast-item>` children)

**CSS parts:** `stack`

**CSS custom states:** `visible` while at least one `lr-toast-item` is present in the region.

**Themeable custom properties:** `--lr-toast-gap` (default `var(--lr-space-s)`),
`--lr-toast-width` (default `var(--lr-size-28rem)`) — set directly on the `<lr-toast>` element.
The mapped `--gap` and `--width` names are compatibility aliases for those two Lyra-prefixed
properties; an explicitly set Lyra-prefixed property continues to take precedence.
Every `<lr-toast-item>` property below is also documented on the region, because custom properties
inherit into the items slotted inside it: one declaration on `<lr-toast>` retunes the whole stack.

**Optional peer deps:** none.

### `lr-toast-item`

A single notification.

**Properties:**

- `duration: number = 5000` (ms; `Infinity` or `<= 0` disables auto-dismiss)
- `size: '2xs'|'xs'|'s'|'m'|'l'|'xl'|'small'|'medium'|'large' = 'm'` (reflected — drives both `--lr-toast-padding` and the
  toast's own font-size through a private effective-size mapping, from a compact `2xs` up to a roomier `xl`;
  valid property and attribute writes round-trip without changing spelling)
- `variant: 'brand'|'success'|'warning'|'danger'|'neutral' = 'neutral'` (reflected)
- `withIcon: boolean = false` (attribute `with-icon`)

**Methods:** `async hide(): Promise<void>` — plays the hide animation, then removes itself from the
DOM. `toastItemElement: HTMLElement | null` exposes the live `[part="toast-item"]` surface (or
`null` before rendering) and remains the same node across ordinary updates/reconnection.

**Events:** `lr-show`, `lr-after-show`, `lr-hide`, `lr-after-hide`. `lr-show` and `lr-hide` are the
cancelable before-transition veto points. The item stays hidden and inert throughout `lr-show`;
vetoing its initial request releases it from the region without an after-event or timer. Re-entering
the same show/hide request from its own before-event coalesces onto that request, so the outer veto
remains authoritative and the lifecycle event fires once. Vetoing an auto-dismiss expiry leaves the
item visible and restarts the full current normalized `duration`; repeated vetoes retry at that same
interval. Vetoing a manual `hide()` leaves any active countdown at its current elapsed position. An
accepted show or hide interrupted by disconnection resumes after reconnection and emits its matching
`lr-after-*` event exactly once; no terminal event fires while the item is detached.

**Slots:** default (message), `icon`

**CSS parts:** `toast-item`, `accent`, `icon`, `content`, `close-button`, `close-icon`,
`close-icon__svg`, `progress-ring`, `progress-ring__base`, `progress-ring__indicator`,
`progress-ring__label`, `progress-ring__track`. The progress-ring tree is rendered for a finite,
positive auto-dismiss duration and surrounds the close glyph; its indicator pauses alongside the
auto-dismiss timer on hover or focus.

**Themeable custom properties:** `--lr-toast-accent-width` (default `var(--lr-size-4px)`),
`--lr-toast-show-duration`/`--lr-toast-hide-duration`
(`var(--lr-transition-base, 180ms ease-out)` — the show/hide lifecycle reads the resolved computed
transition duration and uses it for its completion fallback), `--lr-toast-padding`
(`var(--lr-space-m)`) and `--lr-toast-font-size` (`var(--lr-font-size-m)`) — their private defaults
follow `size`, from a compact `2xs` up to a roomier `xl` — and `--lr-toast-accent-color` (default
`var(--lr-color-border)`, with a private default that follows `variant` to that variant's loud
fill). Inherited or direct public values remain authoritative across every size and variant.

`--lr-toast-item-gap` (default `var(--lr-space-s)`) controls the gap between the item's icon,
message, and close action; `--lr-toast-item-radius` (default `var(--lr-radius)`) controls the item
surface and accent-bar start corners. They are deliberately separate from `--lr-toast-gap`, which
continues to control only the region's stack spacing.

The close button's four inherited state hooks are `--lr-toast-close-button-hover-bg` (default
`transparent`), `--lr-toast-close-button-hover-color` (default `var(--lr-color-text)`),
`--lr-toast-close-button-active-bg` (default `color-mix(in oklab, transparent,
var(--lr-color-mix-partner) var(--lr-color-mix-active))`), and
`--lr-toast-close-button-active-color` (default `var(--lr-color-text)`). Each is an inline fallback
at the relevant state, so setting one on the item or an ancestor rethemes only that close-button
state rather than the item surface, other close states, or the region stack.

The mapped names `--accent-width`, `--show-duration`, `--hide-duration`, and `--padding` alias their
respective Lyra-prefixed properties. Setting the Lyra-prefixed form explicitly wins over its alias.

**Optional peer deps:** none.

Once a non-vetoed toast starts showing, its normalized message is appended to Lyra's pre-mounted,
shared light-DOM announcement sink: assertive for `danger`/`warning`, polite otherwise. Changing a
visible toast between those urgency levels announces that message at the new urgency. The visible
item and stack themselves remain ordinary content, so an icon, action, and close button never become
part of an atomic live announcement. Auto-dismiss timer **pauses** on `pointerenter`/`focusin`, **resumes**
on `pointerleave`/`focusout`, with real elapsed-time bookkeeping (WCAG 2.2.1 timing-adjustable) —
hover and focus are tracked as independent pause reasons, so releasing only one (e.g. the pointer
leaves while focus remains, or vice versa) keeps the timer paused until _neither_ holds it anymore.
A `duration` change while the timer is actively counting down reschedules it immediately against
the new value instead of waiting for the next pause/resume cycle. A vetoed timer expiry restarts
that full normalized value; if hover/focus or a disconnect begins during the veto event, the retry
stays paused and starts from the full value only after the item resumes/reconnects.
Accessible message extraction follows same-root `aria-labelledby` references and observes their
targets, lookup roots, and every open shadow root actually traversed for text, including targets
outside the toast subtree. Traversal is bounded; when a ceiling is reached, the announcement carries
an explicit ellipsis and the close action uses the localized truncated-context template instead of
silently treating the bounded prefix as whole. If no prefix fits before a ceiling, both surfaces use
the localized `toastContentIncomplete` fallback so the missing content remains explicit.

### `toast()`

From the `toaster` controller — the ergonomic entry point, no manual `<lr-toast>` mounting
needed:

```ts
import { toast } from "@aceshooting/lyra-ui/components/overlays/toast/toaster.js";

toast("Saved");
toast({
  message: "Deleted",
  variant: "danger",
  icon: (ownerDocument) => ownerDocument.createTextNode("!"),
  action: {
    label: "Undo",
    onClick: (item) => {
      /*...*/
    },
  },
});
```

`toast(input: LyraToastOptions | string): ToastHandle`, where
`ToastHandle = { item: Promise<LyraToastItem>; dismiss: () => void }`. The canonical options are
shared byte-for-byte with the region's object-form `create()`, including `ownerDocument`, safe icon
payloads/factories, actions, and the long `small`/`medium`/`large` size aliases. It lazily mounts
(and re-mounts if removed) **one singleton `<lr-toast>` region per distinct `ownerDocument` and
`placement`** on that document's body — a call targeting one placement/document never relocates
toasts already showing in another. A foreign document must have the toast elements registered in
its own custom-element registry; otherwise the returned `item` promise rejects explicitly.

```html
<script type="module">
  import { toast } from "@aceshooting/lyra-ui/components/overlays/toast/toaster.js";
  document
    .getElementById("save-btn")
    .addEventListener("click", () => toast("Saved!"));
</script>
```

**Known gotchas:**

- the stack and each visible item have no live-region role. Their normalized message is appended as
  one child of a shared non-atomic light-DOM sink at the variant's urgency; icon, action, and close
  controls remain outside that sink. Later meaningful message changes add only the changed normalized
  message, and appending an action does not re-announce it.
- the close button's accessible name is derived from the toast's own message text (the first 40
  grapheme clusters when it must be shortened, falling back to bare `"Close"` only when the toast
  has no text content and extraction completed) rather than a bare `"Close"` on every instance — useful when several toasts
  are stacked and a screen-reader or switch-access user needs to tell their close buttons apart
  without activating one first. On a legacy engine without `Intl.Segmenter`, it retains the whole
  label rather than splitting a grapheme. The localized `closeWithTruncatedContext` template owns
  truncation punctuation and word order. Rich non-interactive message markup contributes its text,
  named-slot/icon and actionable content do not, and live message text mutations or reassignment
  update the name through nested forwarding slots. Hidden, inert, CSS-hidden and `aria-hidden`
  message branches are excluded. Same-root external `aria-labelledby` targets and the open shadow
  roots traversed for their text remain synchronized across reconnect, replacement, and adoption.
  A bounded traversal prefix is explicitly marked as incomplete; if no prefix is available, the
  localized `toastContentIncomplete` fallback keeps both the announcement and close name truthful.
  Observation, animation frames, elapsed-time clocks and completion/auto-dismiss timers follow the
  item's owner window after iframe adoption and cancel through the same window that scheduled them.
- pause/resume-on-hover/focus (the component's main accessibility differentiator), including the
  independent-hover-vs-focus pause reasons above, now has regression test coverage.
- `hide()` is idempotent (a second call while already hiding is a no-op) and `[part="close-button"]`
  gets `aria-disabled="true"` once hiding starts, so a stray extra click/Enter during the hide
  animation can't re-enter it. A disconnect during that animation pauses completion; reconnecting
  the same item resumes it and emits/removes exactly once.
- When the focused close/action control's toast finishes hiding, focus moves to an adjacent toast's
  close control, or back to the connected element that held focus before the toast when no adjacent
  item remains.
- Prefer the `toast()` helper over manually creating `<lr-toast>`/`<lr-toast-item>` — it already
  handles the singleton-region and remount-if-removed logic. The helper and `lr-alert.toast()` never
  fall back to an unbounded unknown region in an owner document where the controller is unregistered;
  unavailable alert requests are removed and their existing `Promise<void>` settles.

---

## `lr-empty`

First-party "no data" state (no Web Awesome equivalent).

Removing `heading` or `description` safely omits that text; explicit empty values remain empty and
later values restore the corresponding content.

**Properties:**

- `heading: string = ''`
- `headingLevel: LyraHeadingLevel = '3'` (attribute `heading-level`, reflected) — `1`–`6` expose
  either the string heading or rich `heading` slot at that semantic level; invalid untyped values
  retain level 3, while `none` keeps the visible text without heading semantics
- `description: string = ''`
- `compact: boolean = false` (reflected) — tighter, left-aligned rendering (less padding, a lighter
  heading weight) for use inside a constrained space like a widget body or table cell, instead of
  the centered/spacious full-page default
- `announce: boolean = false` (reflected) — announces the heading and description this empty state
  already carries when it first mounts, through the same shared light-DOM polite sink later changes
  use. Set it where the empty state replaces a result set the user just asked for; leave it unset
  for an empty state that is part of the page being loaded. See the first "Known gotchas" bullet

**Events:** none.

**Slots:** default (icon/illustration), `heading` (rich heading content, overrides the `heading`
attribute), `description` (rich description content, overrides the `description` attribute),
`actions` (buttons/links below the description)

**CSS parts:** `base`, `icon`, `heading`, `description`, `actions`

**Themeable custom properties:** `--lr-empty-compact-align` (compact mode only; defaults preserve
the existing `flex-start` cross-axis and `start` text alignment, and `center` centers both),
`--lr-empty-compact-padding` (default `--lr-space-xs` — padding used in compact mode),
`--lr-empty-compact-gap` (default `--lr-space-2xs` — gap between the icon, heading, and description
in compact mode; the non-compact layout's gap stays the plain shared `--lr-space-s` token, not
independently themeable), `--lr-empty-compact-font-size` (compact mode only; unset by default with
**no fallback value** — the compact heading keeps its ordinary inherited font size until a
consumer explicitly sets this token), plus shared tokens (`--lr-space-xs/-s/-l`,
`--lr-color-text-quiet/-border/-text`).

**Optional peer deps:** none.

```html
<lr-empty
  heading="No results"
  heading-level="2"
  description="Try a different search."
>
  <svg slot="" ...></svg>
  <!-- default slot: any icon/illustration -->
  <div slot="actions"><button>Clear filters</button></div>
</lr-empty>
<lr-empty
  compact
  heading="No results"
  description="Try a different search."
  style="--lr-empty-compact-align: center"
></lr-empty>
```

**Known gotchas:**

- Initial content and reconnect state—including property changes made while detached—stay silent
  unless `announce` is set, which announces the heading/description present at first mount once,
  through the same sink and the same exclusions as a later change. `announce` is read once, so a
  later reconnection or adoption stages the existing content again rather than replaying it.
  Later meaningful heading and description changes are appended to Lyra's shared light-DOM polite
  announcement sink. Default-slot illustrations, action-slot controls, nested hidden/inert/
  `aria-hidden="true"` content, updates under a hidden/CSS-hidden composed ancestor, and mutations
  that leave the accessible text unchanged are excluded;
  a `visibility:hidden|collapse` wrapper suppresses its own text but not a descendant that restores
  `visibility:visible`;
  nested forwarding slots contribute their flattened assigned heading/description text instead of
  fallback content, and later assignment plus assigned-node text/style/visibility changes are
  observed without turning initial distribution into a live update;
  a host `aria-label` names the host but does not replace that visible update text;
  the shadow `[part="base"]` remains ordinary visible content rather than a shadow-root live region.
  Remove any host `role="status"`/`role="alert"` hand-added before `announce` existed once it is
  set — otherwise the initial text is announced twice, through the native role and again through
  the shared sink.
- Note: correctly works around the classic `:empty`-pseudo-class trap (a wrapper with a `<slot>`
  inside can never match `:empty`) by tracking real flattened slot content in JS, including a bare
  non-whitespace text node such as an emoji as default icon content —
  `lr-table` reuses this component for its own empty-rows state, and `lr-stat` (below) now uses
  the same JS-tracked-slot-state pattern for its own icon/caption wrappers.

---

## `lr-skeleton`

Loading placeholder mirroring the Web Awesome/Shoelace skeleton surface under the `lr-` prefix,
with `text`/`circle`/`rect` geometry and opt-in `pulse`/`sheen` effects.

**Properties:**

- `shape: 'text'|'circle'|'rect' = 'text'` (reflected) — the canonical geometry vocabulary;
  exported as `LyraSkeletonShape`. The former `variant` property/attribute and `SkeletonVariant`
  type are removed in v9; use `shape` and `LyraSkeletonShape`.
- `effect: 'pulse'|'sheen'|'none' = 'none'` (not reflected; the live value is exposed as
  `data-effect` on `[part="base"]`) — animation is opt-in. **Changed in
  8.0.0:** the Lyra default was `pulse`; set `effect="pulse"` to preserve that motion explicitly.
- `width?: string`
- `height?: string`
- `label?: string` — accessible name used when `announce` is set (rendered as visually-hidden text
  inside `[part="base"]`). Only absence uses the localized loading default; every explicit caller
  value—including `label="Loading…"` and `label=""`—is preserved literally. Prefer a description
  of what's actually loading, e.g. `label="Loading chart"`.
- `announce: boolean = false` (reflected) — opt one meaningful placeholder into `role="status"`
  and localized hidden text. The false default preserves the decorative bare Web Awesome/Shoelace
  skeleton contract and prevents repeated placeholders from producing duplicate announcements.
  An author-supplied host role remains authoritative; the component adds and removes the status
  role only when it owns that opt-in role.

**Events:** none.

**Slots:** none.

**CSS parts:** `base` and `indicator` are aliases on the same placeholder/animation surface.

**Themeable custom properties:** `--lr-skeleton-w`, `--lr-skeleton-h` (set/cleared by the
`width`/`height` properties; defaults `100%` / `var(--lr-size-1em)`),
`--lr-skeleton-color` (default `var(--lr-color-neutral-fill-normal)`), `--lr-skeleton-sheen-color` (default
`var(--lr-color-surface)`), `--lr-skeleton-border-radius` (default `var(--lr-radius)` for text and
rectangle shapes); upstream `--color`, `--sheen-color`, and `--border-radius` feed those same
values. The shared `--lr-transition-ambient` (default `1.8s ease-in-out`) controls the pulse/sheen
timing.

**Optional peer deps:** none.

```html
<lr-skeleton
  shape="circle"
  effect="pulse"
  width="3rem"
  height="3rem"
></lr-skeleton>
<lr-skeleton
  announce
  shape="text"
  effect="sheen"
  label="Loading name"
></lr-skeleton>
```

**Known gotchas:**

- Bare skeletons are decorative. In a repeated layout, set `announce` only on one meaningful
  placeholder or provide one parent status; leave every other child unannounced.
- no `lines`/`count` shorthand for "N lines of skeleton text" — stamp out N elements
  yourself.
- Respects `prefers-reduced-motion` (both effects) — safe to leave as-is for that concern.

---

## `lr-drawer`

A modal panel anchored to one logical edge of the viewport. `LyraDrawer` extends `LyraDialog`, so it
inherits the entire dialog contract unchanged: focus trapping, Escape and opt-in backdrop dismissal,
document scroll locking, browser **top-layer** promotion, overlay stacking, accessible naming, the
`show()`/`hide()`/`close()` methods and the whole
`lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide`/`lr-close` lifecycle. `contained` switches
to an absolute, nonmodal panel inside the nearest containing block; only that mode, `placement`, and
the slide animation are its own.

**Properties:**

- `open: boolean = false` (attribute `open`, reflected) — assigning it runs the same lifecycle as
  `show()`/`hide()`, so the property, the reflected attribute and the two methods can never disagree
- `placement: 'start'|'end'|'top'|'bottom' = 'end'` (attribute `placement`, reflected). **Changed in
  8.0.0:** the default used to be `start`. `end` is what `wa-drawer` does, so a mechanical
  `wa-drawer` → `lr-drawer` rename no longer silently slides the panel in from the other edge.
- `contained: boolean = false` (attribute `contained`, reflected) — position within the nearest
  containing block without a backdrop, page inerting, focus trap, scroll lock, top-layer
  promotion, or global Escape ownership
- `heading?: string`, `label: string`, `accessibleLabel: string = ''` (attribute
  `accessible-label`), `closable: boolean = true`, `noHeader: boolean = false` (attribute
  `no-header`, Shoelace's spelling, reflected), `withoutHeader: boolean = false` (attribute
  `without-header`, Web Awesome's spelling, reflected; neither is deprecated),
  `withFooter: boolean = false` (attribute `with-footer`, reflected; SSR hint), and
  `lightDismiss: boolean = false` (attribute `light-dismiss`) — inherited dialog naming, chrome and
  dismissal options. A plain `aria-label` attribute on the host is honored too, inherited unchanged
  from `lr-dialog`: it is the strongest naming override, by attribute presence including an
  explicitly empty value, ahead of `accessible-label` and any slotted heading.
- `headingLevel: LyraHeadingLevel = '3'` (attribute `heading-level`, reflected) — semantic level of
  the generated title, from `1` through `6`, or `none` for visual-only title text. A direct slotted
  heading retains its own native level.
- `size: LyraSize = 'm'` (reflected) — inherited unchanged from `lr-dialog`; caps the panel's
  `max-inline-size` on the same six-step ladder for `start`/`end` placements (`top`/`bottom` are
  unaffected, since those axes are already unconditionally `100%`). At the `m` default the 32rem
  cap exceeds the panel's own 24rem default inline size, so it stays a no-op unless set. Distinct
  from the drawer-specific `--size` CSS custom property below, which maps to this same panel's own
  `inline-size`/`block-size` for the active axis.

**Methods:** `show(): Promise<void>`, `hide(): Promise<void>`,
`close(reason?: DialogCloseReason): Promise<void>` — inherited unchanged from `lr-dialog`; each
promise settles after the matching `lr-after-*` event.

**Events:** `lr-show` (cancelable), `lr-after-show`, `lr-hide` (cancelable), `lr-after-hide`, and
`lr-initial-focus` (cancelable), `lr-request-close` (cancelable, detail source), and `lr-close`
(`detail: DialogCloseReason`, cancelable) — all inherited unchanged from
`lr-dialog`; see that section for details and veto rules. `lr-after-show` /
`lr-after-hide` fire once the slide animation has finished, so they are deferred by roughly one
animation compared with the state flip. **`lr-close` is not drawer-scoped, same as on `lr-dialog`:**
several components nested inside a drawer (`lr-callout`, `lr-tab`/`lr-tab-group`, the tool dialogs,
and so on) emit the same bubbling, composed `lr-close` name, so a listener bound on `<lr-drawer>`
also receives a descendant's close. Guard with
`if (event.target !== event.currentTarget) return;` before reading `event.detail`, which those
descendants either omit or shape differently from `DialogCloseReason`.

**Animation registry:** the panel uses placement-specific names:
`drawer.showStart`/`drawer.hideStart`, `drawer.showEnd`/`drawer.hideEnd`,
`drawer.showTop`/`drawer.hideTop`, and `drawer.showBottom`/`drawer.hideBottom`. The backdrop uses
`drawer.overlay.show`/`drawer.overlay.hide`. Per-element overrides are RTL-aware through
`rtlKeyframes`; passing `null` disables interpolation while retaining the inherited event/promise
lifecycle.

**Slots:** default (drawer body), `label` (rich header content), `header-actions` (extra header
controls, rendered before the built-in close button), `footer` — all inherited from `lr-dialog`.

**CSS parts:** `base`; `backdrop overlay`; `panel dialog`; `header`; `heading title label`;
`header-actions`; `close-button close-button__base`; `close-button__control`; `body`; `footer`.
Names grouped together are aliases on the same functional node; `close-button__control` is the
composed `<lr-icon-button>`'s own native `<button>`, inherited from `lr-dialog` as of 16.0.0.

**Migrating a pre-16.0.0 `::part()` rule.** This component's icon-only action is a composed
`<lr-icon-button>`, so the part naming that action now names the composed child's HOST, which
paints nothing. A `border`, `background` or `border-radius` set on it is silently dead — only
`color` still appears to work, because it inherits, which makes such a rule look half-alive rather
than broken. Set `--lr-icon-button-background`/`-color`/`-border`/`-radius` (and their
`-hover`/`-active` variants) on this element or an ancestor instead: the composed control reads
those public tokens ahead of any default this component supplies. For SIZE use
`--lr-theme-icon-button-size`, not `--lr-icon-button-size` — every `LyraElement` re-declares the
latter on its own `:host`, so it never reaches a composed child (see `llms/tokens.md`).

**Themeable custom properties:** mapped `--size` controls the active axis. For start/end drawers,
the inherited `--width` and `--lr-dialog-width` remain compatibility fallbacks when neither
`--size` nor `--lr-drawer-width` is set, and `--lr-dialog-max-width` remains an effective cap,
falling back to the `size` property's own tier value (see Properties above) when unset.
The other mapped/inherited aliases are `--backdrop-filter`, `--spacing`, `--header-spacing`, `--body-spacing`,
`--footer-spacing`, `--show-duration`, and `--hide-duration`. Lyra compatibility tokens remain:
`--lr-drawer-width` (default `--lr-size-24rem`; used by
`placement="start"|"end"`, capped at `100%`), `--lr-drawer-height` (default `--lr-size-24rem`;
used by `placement="top"|"bottom"`), `--lr-drawer-enter-x` / `--lr-drawer-enter-y` (the panel's
slide translate offset, used for both the enter and the exit keyframes — `-x` for start/end, `-y`
for top/bottom; both default to `±var(--lr-size-1rem)` and are set per `placement`, with `-x`
explicitly flipped under `:dir(rtl)` since `translateX` is physical. Override to lengthen/shorten
the slide). It also inherits every `<lr-dialog>` token — `--lr-dialog-overlay-color`,
`--lr-dialog-backdrop-filter`, `--lr-dialog-width`, `--lr-dialog-max-width`, `--lr-dialog-spacing`,
`--lr-dialog-spacing-block`, `--lr-dialog-panel-duration` and `--lr-dialog-backdrop-duration` —
since `LyraDrawer` extends `LyraDialog`, including the shared overlay-surface family the panel
paints from: `--lr-overlay-surface`, `--lr-overlay-border`, `--lr-overlay-radius` and
`--lr-overlay-shadow-modal`. The drawer's own `[part~="panel"]` rule squares the corners and steps
the elevation down to `var(--lr-shadow-l)` — three of its edges are flush with the viewport — so on
this tag `--lr-overlay-radius` and `--lr-overlay-shadow-modal` are overridden and only the fill and
edge colour take effect. `--lr-dialog-height` is deliberately **not** among the
inherited tokens above: `<lr-drawer>`'s own `[part~="panel"]` rule unconditionally sets its own
`block-size` for every placement (`100%` for `start`/`end`, a `--lr-drawer-height`-driven `min()`
for `top`/`bottom`), which always wins the cascade over `<lr-dialog>`'s `--lr-dialog-height`-driven
rule regardless of value, so the property has no effect on `<lr-drawer>`. `<lr-drawer>` also opts
out of `<lr-dialog>`'s inherited `[part="body"]` growth: on `<lr-dialog>` that rule only fills the
panel once `--lr-dialog-height` is set (otherwise the panel is content-sized, so the rule is a
no-op); a drawer's panel is unconditionally a definite size for every placement, so without this
override `body` would always stretch and push `footer` to the panel's far edge. `<lr-drawer>`'s own
`[part="body"]` rule restores the natural content size instead, so `footer` follows immediately
after a short body exactly as it did before `--lr-dialog-height` existed. The drawer's own
size/width/height tokens take precedence
for its panel, and only the animation _name_ is overridden, so `--lr-dialog-panel-duration` retunes the
slide too and the reduced-motion flattening of the shared `--lr-duration-*` tokens still reaches it.

```html
<lr-drawer open placement="end" heading="Filters" closable>
  <button slot="header-actions" type="button">Reset</button>
  <lr-checkbox label="Only active"></lr-checkbox>
  <div slot="footer"><button type="button">Apply</button></div>
</lr-drawer>
```

---

## `lr-dialog` / `confirm()`

General-purpose modal/overlay plus a promise-based confirmation helper built on top of it.

Removing `label` safely omits its fallback title. Open dialog and drawer names follow supported name
and exclusion attribute changes on direct unslotted headings, while host naming retains precedence;
nested and `slot=""` headings remain outside automatic discovery.

### `lr-dialog`

A modal/overlay: `role="dialog"`, focus-trapped while open, dismissible via Escape or (opt-in) a
backdrop click, and scroll-locks the document for as long as it's open. Mapped chrome is present by
default: `label` renders as a visible title and `closable` renders a localized close button.
`closable="false"` plus either header-suppression spelling support custom chrome: `no-header` is
Shoelace's name and `without-header` is Web Awesome's. Both are current upstream spellings, both are
read, and neither is deprecated.

**Properties:**

- `open: boolean = false` (reflected) — **changed in 8.0.0:** `lr-dialog` now also has a
  `show()`/`hide()` pair, and assigning `open` runs exactly the same lifecycle as calling them, so
  the property, the reflected attribute and the two methods can never disagree. `el.open = false`
  therefore emits the full close lifecycle and can be vetoed, where it used to be a silent state
  flip. Markup that renders open from the start (`<lr-dialog open>`) emits nothing.
- `label: string = ''` — mapped visible title. The richer `label` slot wins over it.
- `headingLevel: LyraHeadingLevel = '3'` (attribute `heading-level`, reflected) — `1`–`6` expose
  the generated visible title (string property or rich `label` slot) at that semantic level;
  invalid untyped values retain level 3, while `none` keeps visual title text without heading
  semantics. A direct light-DOM heading retains its own native/ARIA level.
- `accessibleLabel: string = ''` (attribute `accessible-label`) — explicit accessible-only name;
  unlike `label`, it never renders visible text
- `heading?: string` — legacy visible-title fallback, after the `label` slot and `label` property;
  it has no effect when a direct light-DOM heading already supplies custom chrome
- `closable: boolean = true` (attribute `closable`, reflected) — renders the localized close (X)
  button. This true-default boolean parses `closable="false"`; removing the attribute also restores
  the default.
- `noHeader: boolean = false` (attribute `no-header`, reflected) — Shoelace's spelling
  (`sl-dialog`'s `no-header`), which suppresses the entire header row
- `withoutHeader: boolean = false` (attribute `without-header`, reflected) — **new in 8.0.0.**
  Web Awesome's spelling (`wa-dialog`'s `without-header`) for the same header suppression. Both
  names are current upstream spellings, both are read, and neither is deprecated or removable
- `withFooter: boolean = false` (attribute `with-footer`, reflected) — keeps the footer wrapper
  rendered as an SSR/hydration presence hint even before assigned slot content is observable
- `size: LyraSize = 'm'` (reflected) — `'2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' |
  'large'`. Panel-width tier, on the shared six-step ladder: `20rem` (`2xs`), `24rem` (`xs`), `28rem`
  (`s`/`small`), `32rem` (`m`/`medium`, unchanged from before this property existed), `38rem`
  (`l`/`large`), `48rem` (`xl`) — each value feeds `--lr-dialog-max-width`'s private default. An
  explicit `--lr-dialog-width`/`--lr-dialog-max-width` still wins over every tier.
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — opt in to a backdrop click closing
  the dialog; Escape and explicit `close()`/`hide()` calls remain available. **Changed in 8.0.0:**
  this was previously spelled `no-light-dismiss`, an opt-_out_ whose default left backdrop dismissal
  on. The polarity now matches `wa-dialog` exactly, so a mechanical rename no longer flips what the
  markup does.
- `modal: LyraDialogModalController` (writable, property only) — `activateExternal()` temporarily
  yields focus/Escape ownership to a third-party modal; balanced `deactivateExternal()` resumes it
  without changing `open`

A plain host `aria-label` is the strongest naming override. It changes naming only: mapped title
chrome remains visible. The fallback order appears below.

**Methods:**

- `show(): Promise<void>` — opens the dialog and resolves after `lr-after-show`; no-op/veto returns
  an already-resolved promise
- `hide(): Promise<void>` — identical to `close('api')`, resolving after `lr-after-hide`
- `close(reason: DialogCloseReason = 'api'): Promise<void>` — closes the dialog, returns focus to
  whatever had it right before opening, and resolves after `lr-after-hide`. The return is attempted
  as the close begins and, if that attempt could not land (a host commonly hides its own opener
  while the dialog is open and re-shows it in response to `lr-hide`, `lr-close` or
  `lr-after-hide`), again once the exit animation has finished and one animation frame has passed.
  That second pass only acts while focus is still inside the dialog or has fallen to `<body>` —
  focus moved elsewhere in the meantime is never taken back — and when the opener still cannot take
  focus, focus is left where it is. `lr-drawer` inherits the same behavior.
  `DialogCloseReason = 'escape' | 'backdrop' | 'close-button' | 'api' | 'unmount' | string` —
  `'escape'`/`'backdrop'` are emitted by the dialog's own built-in dismiss triggers;
  `'close-button'` by the built-in header close button (rendered when `closable` is set); `'api'`
  covers `close()` with no argument, `hide()`, and `open = false`; `'unmount'` is emitted
  automatically if the dialog is removed from the DOM while still `open` by anything other than its
  own `close()` (a consumer's own cleanup code, a parent re-render that drops it); any other string
  is whatever a caller passes (e.g. a footer Cancel button calling `dlg.close('cancel')`, or
  `confirm()`'s own `'confirm'`/`'cancel'`).

**Events:**

- `lr-show` — cancelable pre-open veto
- `lr-after-show` — opening animation finished
- `lr-hide` — cancelable pre-close veto; detail is `{ source: Element }`, the host or built-in
  affordance that requested the transition
- `lr-after-hide` — closing animation finished
- `lr-initial-focus` — cancelable immediately before the first automatic focus movement. A
  CSS-hidden dialog defers it until rendered; reconnecting the same open activation does not repeat
  it.
- `lr-request-close` — cancelable request from a built-in affordance; detail source is
  `'close-button' | 'keyboard' | 'overlay'`. Veto stops the close lifecycle. Direct `close()` and
  `hide()` calls do not emit this request event.
- `lr-close` — cancelable, with `detail: DialogCloseReason`; emitted after `lr-hide`. The same name
  is already used by `<lr-tool-select-dialog>`, `<lr-tool-result-dialog>`, and
  `<lr-tool-approval-dialog>`, whose own docs describe an identical detail shape, so one listener
  covers all of them. A listener calling `preventDefault()` vetoes the close. Also fired (with
  reason `'unmount'`, non-cancelable there) when the dialog is removed from the DOM while still
  open. **But the name is not dialog-scoped.** Nine components in this library emit `lr-close`,
  several of them commonly nested *inside* a dialog: `<lr-callout>`, `<lr-tab>`/`<lr-tab-group>`,
  `<lr-command-palette>`, `<lr-document-viewer>`, `<lr-responsive-panel>`, and the three tool
  dialogs (`<lr-tool-select-dialog>`, `<lr-tool-result-dialog>`, `<lr-tool-approval-dialog>`).
  Library events bubble and are composed, so a listener bound directly on
  `<lr-dialog>` also receives a descendant's close — a closable callout or tab inside a dialog would
  otherwise dismiss the whole dialog. Guard on the target, the way `<lr-document-viewer>` already
  does internally:

  ```js
  dialog.addEventListener('lr-close', (event) => {
    if (event.target !== event.currentTarget) return; // a descendant's close, not this dialog's
    // ...
  });
  ```

The two `lr-after-*` events are never cancelable.

The open sequence is `lr-show` → `lr-initial-focus` (when focus would move) → `lr-after-show`; the
direct close sequence is `lr-hide` → `lr-close` → `lr-after-hide`.
A built-in dismissal prepends `lr-request-close`. **Both state pre-events fire _before_ the state changes**, so reading
`el.open` inside an `lr-show`/`lr-hide` handler returns the _old_ value — this is the polarity
`wa-show`/`wa-hide` already had, and the opposite of what Lyra 7.x's own `lr-show`/`lr-hide` did on
`lr-popover`/`lr-dropdown`. The `wa-*` → `lr-*` migration table treats the rename as mechanical, and
as of 8.0.0 that is finally true for these four names: `wa-show`/`wa-after-show`/`wa-hide`/
`wa-after-hide` map to `lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide` with matching timing and
matching cancelability. Code written against Lyra 7.x that read `el.open` in a handler, or assumed
the events were informational rather than vetoable, has to be re-read.

`lr-after-show`/`lr-after-hide` settle after the public registry animations `dialog.show` /
`dialog.hide` (panel) and `dialog.overlay.show` / `dialog.overlay.hide` (backdrop). Per-element
registrations win over page defaults; keyframes-only overrides retain the token-derived duration
and easing. Under `prefers-reduced-motion: reduce`, registry timing flattens to zero while the end
frame and lifecycle remain intact. Passing `null` skips native interpolation but still emits the
matching after-event before the method promise resolves. Because dialogs now animate on close too,
`lr-after-hide` is normally deferred by roughly one animation. A removal while open emits
`lr-hide`, `lr-close` (reason `'unmount'`) and `lr-after-hide` in that
order, none of them cancelable, since the element is already gone.

**Stacking and the top layer:** an open dialog is promoted into the browser **top layer** (via
`popover="manual"`), new in 8.0.0. That means it escapes every ancestor stacking context and every
ancestor `overflow` clip: a `transform`ed parent, an `isolation: isolate` wrapper or a
`z-index: 2147483647` sticky header can no longer render on top of it or crop it, which no `z-index`
value alone can guarantee. The `z-index` in the stylesheet remains only as the fallback for a user
agent without popover support, and `popover="manual"` is deliberate — light dismiss and Escape stay
this component's own contract rather than the user agent's, where an `auto` popover would close on
the user agent's terms instead. What a consumer sees: the host gains a `popover="manual"` attribute
while open (component-owned bookkeeping — don't set or remove it), any `z-index` you were fighting
with becomes irrelevant, and the panel is no longer clipped by an ancestor's `overflow: hidden`.
Beyond that, the dialog participates in the shared per-document overlay stack: only the topmost
overlay receives Escape, Tab trapping, or backdrop dismissal, while overlays beneath stay open until
the top one closes.

**Slots:** default (the dialog body), `label` (rich header content — an element, markup, anything;
rendered inside `[part="heading"]` and used as the panel's accessible name, winning over the
plain-string `label` and legacy `heading` properties), `header-actions` (extra header controls,
rendered in the header row _before_
the built-in close button), `footer` (action buttons, rendered in a bottom row, hidden entirely when
empty). The `label` and `header-actions` slots are new in 8.0.0.

**CSS parts:** `base`; `backdrop overlay`; `panel dialog`; `header`; `heading title label`;
`header-actions`; `close-button close-button__base`; `close-button__control`; `body`; `footer`.
Names grouped together are additive aliases on the same functional node, so a mapped
`::part(title)` rule styles the same visible title as Lyra's `::part(heading)`.
`close-button__control` is the composed `<lr-icon-button>`'s own native `<button>`: as of 16.0.0 the
close button IS an `<lr-icon-button>`, so `close-button`/`close-button__base` name that host and the
painted surface sits one boundary deeper. `<lr-drawer>` inherits this control and now registers
`<lr-icon-button>` itself.

**The body is keyboard-reachable while it overflows.** `[part="body"]` is the element that scrolls,
so it carries `tabindex="0"` **only while its content actually overflows** — a dialog whose
content is nothing but prose, a table, or a rendered document used to
be scrollable with a mouse and completely unreachable from the keyboard, because a scroll container
with no focusable child is not a stop of its own. A short body keeps `tabindex="-1"` and never
becomes a gratuitous stop. Resize and content changes update the body's tabindex as its overflow
changes; `<lr-drawer>` uses the same behavior.

It takes focus like any other stop, so it styles like one: `::part(body):focus-visible` draws the
standard `--lr-focus-ring-*` ring, inset (`outline-offset` is negative) because the body is flush
with the panel edges, where an outset ring would be clipped or would collide with the header rule.
Restyle it through `::part(body)` as usual; do not remove the outline without replacing it.

It never steals initial focus from real content: an `[autofocus]` element wins, then the first
focusable control _inside_ the body, and the body itself is used only when there is nothing else to
focus. So a dialog full of form controls behaves exactly as before, and a dialog full of text is now
scrollable with the arrow keys, Page Up/Down and Home/End once Tab reaches it.

**Migrating a pre-16.0.0 `::part()` rule.** This component's icon-only action is a composed
`<lr-icon-button>`, so the part naming that action now names the composed child's HOST, which
paints nothing. A `border`, `background` or `border-radius` set on it is silently dead — only
`color` still appears to work, because it inherits, which makes such a rule look half-alive rather
than broken. Set `--lr-icon-button-background`/`-color`/`-border`/`-radius` (and their
`-hover`/`-active` variants) on this element or an ancestor instead: the composed control reads
those public tokens ahead of any default this component supplies. For SIZE use
`--lr-theme-icon-button-size`, not `--lr-icon-button-size` — every `LyraElement` re-declares the
latter on its own `:host`, so it never reaches a composed child (see `llms/tokens.md`).

**Border reaches the composed close control the same way background/color/radius do.** This
component paints no resting border of its own, so it relays no `--_lr-icon-button-border-default`
into the close control's private fallback tier — but that absence is not a gap. The public
`--lr-icon-button-border` (and its `-hover`/`-active` variants) is the FIRST arm of the token
chain, resolved by ordinary custom-property inheritance regardless of whether this component
relays a default for that same property, so setting it on this element or an ancestor reaches the
close control exactly as the background/color/radius tokens do. A component with no resting
border simply has no default to relay, which is different from border theming being broken. Size
remains the one exception that does not cross this way: use `--lr-theme-icon-button-size`, never
`--lr-icon-button-size`, as noted above.

**Themeable custom properties:** mapped aliases are `--backdrop-filter`, `--width`, `--spacing`,
`--header-spacing`, `--body-spacing`, `--footer-spacing`, `--show-duration`, and
`--hide-duration`. The individual region properties override `--spacing`; mapped properties in
turn fall back to the retained Lyra tokens: `--lr-dialog-overlay-color` (default
`var(--lr-color-overlay)` —
the backdrop scrim color), `--lr-dialog-backdrop-filter` (default `none` — a `backdrop-filter` on
the scrim, e.g. `blur(3px)`, for a frosted-glass treatment over the page behind it),
`--lr-dialog-width` (default `auto` — the panel shrink-wraps to content; set it for an assertive
width instead), `--lr-dialog-max-width` (default `var(--lr-dialog-width, var(--_lr-dialog-max-width))`
— the panel's max-inline-size cap, applied as
`min(var(--lr-dialog-max-width, var(--lr-dialog-width, var(--_lr-dialog-max-width))), 100%)`, where
the private `--_lr-dialog-max-width` is the `size` property's own tier value (`32rem` at the `m`
default, unchanged); when
`--lr-dialog-width` is set but `--lr-dialog-max-width` is left at its default, the cap falls back to
the requested width itself — not the tier default — so an assertive width isn't silently clipped;
the viewport is still a hard limit either way), `--lr-dialog-height` (default `auto` — the panel
shrink-wraps to content on the block axis, same as before this property existed; always capped at
`100%`, i.e. the viewport, like every other panel dimension). With it set, `[part="body"]`'s own
`flex: 1 1 auto` is what actually gives slotted content a definite, fillable block size:
`[part="header"]` and `[part="footer"]` keep their natural size and only `[part="body"]` grows or
shrinks into the remaining space, matching `--lr-dialog-width`'s pairing with `--lr-dialog-max-width`
on the other axis. `--lr-dialog-spacing` (default `var(--lr-space-l)` —
the padding inside `[part="body"]` and the _inline_ padding of the header and footer rows),
`--lr-dialog-spacing-block` (default `var(--lr-space-m)` — the _block_ padding of the header and
footer rows, which are tighter than the body by default), `--lr-dialog-panel-duration` (default
`var(--lr-duration-base)` — the panel's enter/exit animation duration) and
`--lr-dialog-backdrop-duration` (default `var(--lr-duration-fast)` — the backdrop's fade duration).
The panel paints from the **shared overlay-surface family** (16.0.0), not from the page-surface
tokens this entry previously named: `--lr-overlay-surface` (default `var(--lr-color-surface-overlay)`
— the panel fill), `--lr-overlay-border` (default `var(--lr-color-border-subtle)` — the panel edge and the
header's and footer's dividing rules), `--lr-overlay-radius` (default `var(--lr-radius)` — the panel
corner and the close button's) and `--lr-overlay-shadow-modal` (default `var(--lr-shadow-xl)` — the
panel's elevation). None is declared on `:host`, so one declaration on `:root` (or on any ancestor,
to scope it) retints the dialog together with every popup opened from it. The modal tier is a
separate name from `--lr-overlay-shadow-anchored`, which anchored popups read, so raising popups
never raises dialogs.

Otherwise the shared tokens the panel and its chrome read include the `--lr-size-20rem` /
`-24rem` / `-28rem` / `-32rem` / `-38rem` / `-48rem` width ladder behind `size`, `--lr-space-l`,
`--lr-space-m`, `--lr-space-s` and `--lr-space-xs` (spacing defaults), the `--lr-safe-area-*` insets
on the fixed frame, `--lr-color-overlay` (the scrim default), `--lr-color-text-quiet`,
`--lr-color-brand` and `--lr-color-brand-quiet` with `--lr-color-mix-partner`/`--lr-color-mix-active`
(the close button's foreground and its hover/pressed fills), `--lr-border-width-thin`,
`--lr-icon-button-size` (the close button's hit-area floor), `--lr-focus-ring-width`,
`--lr-focus-ring-color`, `--lr-focus-ring-offset`, `--lr-font-weight-semibold`,
`--lr-transition-fast`, and `--lr-layer-modal` behind `--lr-overlay-stack-index`. Earlier revisions
of this entry instead named `--lr-color-surface`, a bare `--lr-shadow` and `--lr-easing-standard`:
none of the three has ever been part of a declaration in `dialog.styles.ts`, and the panel's real
fill and elevation are the overlay-family tokens above, eased through `--lr-transition-fast` (itself
derived from `--lr-duration-fast` and `--lr-easing-standard`, which is where that last name came
from).

**Optional peer deps:** none.

```html
<lr-dialog id="dlg" heading-level="2" closable>
  <span slot="label">Delete item?</span>
  <button slot="header-actions" type="button">Help</button>
  <p>This cannot be undone.</p>
  <div slot="footer">
    <button id="cancel" type="button">Cancel</button>
    <button id="confirm" type="button">Delete</button>
  </div>
</lr-dialog>
<script type="module">
  import "@aceshooting/lyra-ui/components/overlays/dialog/dialog.js";

  const dlg = document.getElementById("dlg");
  // Listeners first: `lr-show` is emitted synchronously inside show().
  dlg.addEventListener("lr-show", () =>
    console.log("opening; el.open is still", dlg.open)
  );
  dlg.addEventListener("lr-after-show", () =>
    console.log("enter animation done")
  );
  dlg.addEventListener("lr-close", (e) =>
    console.log("closed:", e.detail)
  );
  dlg.addEventListener("lr-after-hide", () =>
    console.log("exit animation done")
  );
  document
    .getElementById("cancel")
    .addEventListener("click", () => dlg.close("cancel"));
  await dlg.show(); // identical state change to dlg.open = true; settles after lr-after-show
</script>
```

A dialog with no chrome of Lyra's own, animating faster and blurring the page behind it:

```html
<lr-dialog
  without-header
  accessible-label="Preview"
  light-dismiss
  style="--lr-dialog-backdrop-filter: blur(4px); --lr-dialog-panel-duration: 120ms;
         --lr-dialog-backdrop-duration: 80ms; --lr-dialog-spacing: 0"
>
  <img src="/poster.jpg" alt="Poster" />
</lr-dialog>
```

Accessible naming and visible title are separate. Naming precedence is: (1) host `aria-label`, by
attribute presence including an explicitly empty value, (2) `accessible-label`, (3) the copied text
of an unslotted direct light-DOM heading, then (4) the shadow-owned visible title wrapper.
Visible-title precedence is the rich `label` slot, then the mapped `label` property, then legacy
`heading`. The direct-heading case copies text because an IDREF cannot cross from the panel's shadow
tree to a light-DOM heading; the mapped title wrapper can use `aria-labelledby` because it lives in
the same shadow root. `no-header`/`without-header` removes the mapped title, so custom-chrome dialogs
should provide a direct heading, `accessible-label`, or host `aria-label`.

**Known gotchas:**

- `role="dialog"`/`aria-modal="true"` are only present on `[part="panel"]` while `open` is `true` —
  inspecting closed markup won't show them.
- An `[autofocus]` element anywhere in the slotted content takes initial focus instead of the first
  focusable element, including one inside a slotted custom element's own open shadow root — so
  `<lr-input autofocus>` behaves like `<input autofocus>`. With nothing marked, the first focusable
  element still wins, unchanged.
- `lr-initial-focus` is the veto point for Lyra's automatic focus move. It fires once per logical
  open, only when the rendered panel is ready to receive focus; canceling it does not disable the
  trap or later focus return.
- The host gains a `popover="manual"` attribute the first time it opens and keeps it from then on —
  only top-layer membership (`:popover-open`) tracks `open`, not the attribute — and carries
  `data-closing` for exactly as long as the exit animation runs (pointer events are dead for that
  window, so a dismissing dialog can't swallow a click meant for the page underneath). Both are
  component-owned bookkeeping — don't set or remove them.
- Heading detection observes child, subtree, and character-data changes, so mutating an
  already-slotted direct heading's text updates the copied panel `aria-label` live.
- Only _unslotted direct_ children are scanned for a heading — one nested several layers deep,
  inside a slotted custom element's own shadow root, or carrying a `slot` attribute, is left to the
  consumer to label explicitly via `label` or the `label` slot.
- A reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if `open` was still `true` across the
  move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no update in between, so
  `willUpdate()` alone wouldn't otherwise notice.
- Tab-trap focus order follows the default (body) slot, then the `footer` slot — the same order the
  flattened tree already tabs through — and is resolved shadow-piercingly, so a slotted custom
  element's real focusable target inside its own shadow root is found even though the host tag
  itself isn't a native focusable element.

### `confirm()`

A drop-in async replacement for `window.confirm()`, built on `<lr-dialog>`.

```ts
import { confirm } from "@aceshooting/lyra-ui/components/overlays/dialog/confirm.js";

const ok = await confirm({
  title: "Delete conversation?",
  description: "This cannot be undone.",
  confirmLabel: "Delete",
  variant: "danger",
});
if (ok) deleteConversation();
```

`confirm(options: ConfirmOptions): Promise<boolean>` where
`ConfirmOptions = { title: string; description?: string; confirmLabel?: string /* = 'Confirm' */; cancelLabel?: string /* = 'Cancel' */; variant?: 'neutral' | 'danger' /* = 'neutral' */ }`.

Resolves `true` only when the confirm button is pressed — Escape, a backdrop click, and the cancel
button all resolve `false`. It sets `lightDismiss = true` on its transient dialog explicitly, so the
backdrop-click branch survives 8.0.0's flip of that property's own default to `false`. Mounts a
transient `<lr-dialog>` on `document.body` for the duration
of the call and removes it once settled, rather than reusing a persistent page-level region
(contrast `lr-toast`'s `toaster.ts`). Concurrent calls are distinct dialogs in the shared overlay
stack, each tied to its own returned promise. `title` becomes a direct light-DOM `<h2>`, which per `<lr-dialog>`'s
own heading-detection also drives the dialog's accessible name; `description`, if provided, becomes
a direct light-DOM `<p>`. `variant: 'danger'` fills the confirm button with `--lr-color-danger`
instead of `--lr-color-brand`, for destructive actions. The deprecated `tone` option that preceded
`variant` was removed in 10.0.0. Confirm/cancel actions deliberately use native
inline-styled `<button>` elements so this helper does not register or import the broader button
component; every color value is still a `--lr-*` token reference, never a raw literal. They carry the same interaction
states as every other control in the library: a hover/pressed fill mixed toward
`--lr-color-mix-partner` by `--lr-color-mix-hover`/`--lr-color-mix-active`, and a
`--lr-focus-ring-width`/`--lr-focus-ring-color`/`--lr-focus-ring-offset` `:focus-visible` ring. An
inline `style` attribute cannot express a pseudo-class, so those rules ship in a small `<style>`
element mounted inside the transient dialog (and removed with it), targeting the buttons through
their `data-lr-confirm-action` attribute.

**Known gotchas:**

- Every dismissal path (confirm button, cancel button, Escape, backdrop click) funnels through
  `<lr-dialog>`'s own `close()`/`lr-close` event, so there is exactly one place that
  resolves the promise and tears the dialog down — a consumer never needs to (and shouldn't) call
  `.remove()` itself. Because the close event is cancelable, `confirm()` waits through the full
  dispatch and remains pending/mounted when a listener calls `preventDefault()`.
- The neutral confirm button pairs `--lr-color-on-brand` with `--lr-color-brand`; the danger
  variant pairs `--lr-color-on-danger` with `--lr-color-danger`. Each of those resolves through its
  variant's row of the semantic grid (`--lr-color-<variant>-fill-loud` /
  `--lr-color-<variant>-on-loud`), which in turn reads the matching `--lr-theme-color-*` hook and
  falls back to the shared neutral ramp — so retheming the grid retints the confirm button with no
  `::part()` rule, in light and dark alike.
- Importing `confirm` is side-effect free and does not register `<lr-dialog>`. Invoking the helper
  synchronously registers exactly the dialog class it creates before mounting the transient
  element; consumers do not need a separate registration import for helper-created dialogs.

---

## `lr-chip` / `lr-chip-group`

A small, content-agnostic surface for a short label: a tag, an active-filter/scope indicator, etc.
Distinct from `<lr-attachment-chip>` (specifically file-shaped, with a thumbnail/size/upload-
progress) — this pair carries no domain assumptions at all. `<lr-chip>` is a controlled component:
clicking its remove (×) button only fires `lr-remove` — the chip never removes itself from the DOM
on its own interaction, the same contract `<lr-attachment-chip>`/`<lr-conversation-item>`
already follow.

Collapsed groups reapply `max-visible` when assigned children are replaced or reordered at the same
count, preserving authored hidden/inert state and releasing departed visibility leases.

**Two breaks in 8.0.0.** `tone` is now `variant`, with no alias — one concept, one spelling,
library-wide. And a chip is **no longer a pill by default**: `--lr-chip-radius` used to be
`var(--lr-radius-pill)` unconditionally, is now `var(--lr-radius)` (a rounded rectangle), and the
fully-rounded treatment moved behind the new opt-in `pill` boolean. Existing markup keeps its corner
radius only if you add `pill`, or set `--lr-chip-radius: var(--lr-radius-pill)` once at the app
level. `<lr-badge>`/`<lr-tag>` made the identical shape change, with the identical `pill` opt-in.

**Two breaks in 9.0.0.** The chip's leading adornment slot and CSS part are now `start`, matching
the library-wide adornment vocabulary; migrate `slot="icon"` to `slot="start"` and
`::part(icon)` to `::part(start)`. Also, `toggleable` is now the sole toggle-mode opt-in:
`selected` represents only current pressed state, so add `toggleable` anywhere that previously
relied on `<lr-chip selected>` to create an action.

### `lr-chip`

**Properties:**

- `size: '3xs' | '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'`
  (reflected) — standard visual-density scale for typography, padding, gap, and icon size; `m`
  preserves the original chip dimensions. The `small`/`medium`/`large` spellings are exact aliases
  of `s`/`m`/`l` and round-trip unchanged. Unsupported attributes and untyped property writes
  normalize to reflected `m`.
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected) —
  **renamed from `tone` in 8.0.0, with no alias** (see above). `<lr-badge>`, `<lr-callout>` and
  `<lr-toast-item>` all already spelled it `variant`. It tints the whole surface using the
  loud-color-on-quiet-tint convention: background is the
  variant's quiet fill, text/icon its loud fill, both read from the shared semantic grid. `neutral`
  deliberately opts out of that grid and falls back to a plain bordered-surface look. Unsupported
  attributes and untyped property writes normalize to reflected `neutral`.
- `removable: boolean = false` (reflected — shows the remove (×) button)
- `disabled: boolean = false` (reflected) — disables the active native toggle/remove control,
  blocks focus and activation, and suppresses selection/removal requests without mutating state
- `pill: boolean = false` (reflected) — **new in 8.0.0.** Fully-rounded ends instead of the default
  rounded rectangle; the same property `<lr-badge>`/`<lr-tag>` carry. Since it defaults to `false`,
  `pill="false"` is not a way to switch it off — remove the attribute, or assign `.pill = false`.
- `selected: boolean = false` (reflected) — current pressed value. It does not opt into interaction
  or selected styling by itself; set `toggleable` independently. Once toggle mode is active, a
  separate native `[part='toggle-button']` owns focus, Enter/Space/click
  activation, and explicit `"true"`/`"false"` `aria-pressed`; `[part='base']` remains a container
  and the visible default-slot label is inert and aria-hidden. Activation proposes the opposite
  value through the cancelable `lr-chip-select` event and mutates `selected` only when that event is
  not prevented.
  Has no toggle effect when combined with `removable`, where the remove button is the sole control.
- `toggleable: boolean = false` (reflected) — sole opt-in into the toggle/pressed interactive mode,
  independent of `selected`'s current value. Pair it with `selected` for an initially pressed chip;
  leave `selected` unset for an initially unpressed chip.
  For a pressed-state button in control chrome (with `appearance`, the size ladder and a grouped
  single tab stop) rather than filter-pill chrome, use `lr-toggle` / `lr-toggle-group`.
- `value?: string` — opaque consumer bookkeeping value, never read, validated, or rendered by this
  component itself, only ever echoed back verbatim (including `undefined` if never set) in
  `lr-remove`'s detail
- `wrap: boolean = false` (reflected) — wraps `[part='label']` onto multiple lines instead of
  ellipsis-truncating it to one line. `false` (the default) reproduces the chip's original
  single-line, ellipsis-truncated label exactly. Matches `<lr-suggestion-chips>`'s identical `wrap`
  opt-in.

**Events:** `lr-remove` (`detail: { value }` — the remove (×) button was activated via click or
Enter/Space while focused; only rendered/reachable while `removable`), `lr-chip-select`
(`detail: { value, selected }` — cancelable; fired from the native toggle button on click or
Enter/Space with the proposed next state when toggle mode is active and `removable` is not set.
Calling `preventDefault()` keeps the current `selected` state unchanged)

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the active internal control
(toggle or remove button); a disabled control refuses focus/click, and a passive chip's `click()`
retains ordinary host behavior.

When `removable`, `toggleable`, or `disabled` replaces a focused control, focus follows to the
equivalent new chip control when one exists, otherwise to the nearest available composed action.
Synchronous controlled removal receives the same repair, and a newer external focus destination is
never overridden.

**Slots:** default (the chip's label content; its flattened subtree is inert and aria-hidden in
toggle mode, so move links/buttons outside a toggleable chip), `start` (optional decorative leading
adornment such as an icon or status dot; its flattened subtree stays visible but is always inert
and aria-hidden, and nothing is reserved for it — no extra gap — when left empty), `end` (optional trailing content,
typically an icon, placed after the label and before the toggle/remove button; nothing is reserved
for it — no extra gap — when left empty, mirroring `<lr-badge>`'s identical `end` slot). `end`
remains ordinary consumer content in passive/removable mode, but its flattened subtree becomes
inert and aria-hidden beneath the full-surface toggle.

Toggle/remove action names follow the default slot's live visible accessible text through nested
forwarding slots and assigned-node replacement; decorative `start` content never leaks into them.
Hidden, inert, CSS-hidden and `aria-hidden` label branches are excluded. When a host `aria-label`
is present—including `aria-label=""`—the host becomes the one aggregate `role="group"` owner;
that label is not copied onto the nested action. The toggle/remove button instead keeps its
purpose-specific name from visible label text or the localized `select`/`remove` fallback, so the
host and action never expose duplicate names.

**CSS parts:** `base` (the pill's root container), `start` (inert, aria-hidden wrapper around the
decorative `start` slot; hidden entirely while empty), `label` (wrapper around the default slot,
inert and aria-hidden in toggle mode), `end` (wrapper around the `end` slot; hidden entirely while
empty and inert plus aria-hidden in toggle mode, the same `end` csspart name `<lr-badge>` uses),
`toggle-button` (the real native toggle control, rendered over the label in toggle mode),
`remove-button` (the remove (×) affordance, only rendered while `removable`)

The toggle control's accessible name comes from the chip's default-slot text. A start-only
toggleable chip (a colour swatch standing in for a chart series, a bare status dot) falls back to
the localized `select` message rather than shipping an unnamed focusable button—the same generic
fallback the remove button makes to `remove`. A host name, when supplied, remains on the aggregate
group as described above.

**Themeable custom properties:** `--lr-chip-accent`, `--lr-chip-bg`, `--lr-chip-border`
(component-local trio whose private defaults change per `variant` rather than repeating
background/color/border per part per variant; default `var(--lr-color-text)` /
`var(--lr-color-surface)` / `var(--lr-color-border)` —
mirrors the same accent/bg/border vocabulary `<lr-tool-call-chip>`/`<lr-attachment-chip>` use. One
rule covers all four non-neutral variants, because the shared variants sheet has already re-pointed
`--lr-color-fill-loud`/`--lr-color-fill-quiet` at the active variant's row of the semantic grid —
the chip reads those generic slots and never names a variant, and sets its border `transparent`),
`--lr-chip-pressed-border` (border color while pressed/selected — falls back to
`--lr-chip-accent`), `--lr-chip-pressed-bg` (background color while pressed/selected — falls
back to `--lr-chip-bg`; a selected chip's hover/press wash mixes from it, an unselected toggleable
chip's from `--lr-chip-bg`), the density quintet `--lr-chip-font-size`, `--lr-chip-padding-block`,
`--lr-chip-padding-inline`, `--lr-chip-gap`, `--lr-chip-icon-size` (all five have private defaults
that follow each `size`, so setting one on the element or a theme ancestor remains authoritative; the
`m` defaults are `--lr-font-size-sm` / `--lr-size-0-25rem` / `--lr-space-s` / `--lr-space-xs` /
`--lr-font-size-sm`), the height pair `--lr-chip-min-height` / `--lr-chip-height` (below),
`--lr-chip-radius` (default `var(--lr-radius)`; `pill` changes its private default to
`var(--lr-radius-pill)`) — the
corner radius of both `[part='base']` and `[part='remove-button']`, kept in sync so retuning one
retunes both, retunable without a `::part()` rule, and unlike the density quintet above it does not
vary by `size`; the same `--lr-button-radius` pattern —
plus shared tokens (`--lr-space-xs`, `--lr-space-s`,
`--lr-color-fill-loud`/`-fill-quiet`, `--lr-color-surface`, `--lr-color-border`, `--lr-color-text`,
`--lr-color-mix-active`,
`--lr-icon-button-size`, `--lr-focus-ring-width`, `--lr-focus-ring-color`,
`--lr-focus-ring-offset`, `--lr-transition-fast`).

**Chip height — a floor and an exact cap:**

- `--lr-chip-min-height` (default `--lr-size-1-5rem`) controls the component-density floor for
  **every interactive chip**—toggleable and removable alike. The final used block size is also
  floored by the shared `--lr-icon-button-size` target in both modes, while `l`/`xl` raise the
  density default. A passive display chip takes no floor from this at all. The interactive base is
  likewise allocated at least the shared target width, so its absolute toggle action cannot escape
  into an adjacent control.
- `--lr-chip-height` pins an **exact** height on `[part='base']` — interactive and passive chips
  alike — so a row of chips can line up with a sibling control of a known height. It is
  **undeclared by default**, which is what keeps the per-tier floor alive: `auto` is a valid
  declared value that would win over the `var()` fallback arm and make `--lr-chip-min-height` dead
  code, so never set it to `auto` — remove the declaration instead. Because the component never
  declares it, it can be set inline, from an ancestor, or from an outer-tree rule.
  On an interactive chip, a value below the shared target size controls only the painted density;
  the owned action allocation still expands to the target floor and cannot overlap adjacent
  controls.

**Optional peer deps:** none.

```html
<lr-chip
  toggleable
  selected
  style="--lr-chip-bg: var(--lr-color-surface); --lr-chip-pressed-bg: var(--lr-color-warning-quiet)"
>
  Priority filter
</lr-chip>
```

### `lr-chip-group`

A flex-wrap container for a set of `<lr-chip>` children — plain light-DOM composition, direct
children are the chips (the same shape `<lr-multi-split>`'s panels / `<lr-source-list>`'s cards take,
no `.items` array prop).

**Properties:**

- `accessibleLabel: string = ''` (attribute `aria-label`) — accessible name for the group,
  forwarded to `[part='base']`, which carries `role='group'` whenever a name is supplied. Supply
  one for any chip row that means something as a set (a filter row, a tag list); without it the
  container stays roleless, because an unnamed group role adds verbosity without information.
  A host `aria-label` does **not** reach a shadow root on its own — this property is what makes it
  reach `[part='base']`, the element that owns the role. Mirrors how `lr-radio-group` and
  `lr-segmented` name their own `radiogroup`.
- `maxVisible?: number` (attribute `max-visible`) — maximum number of assigned children shown before
  the rest collapse behind a "+N" indicator; flattened slot-forwarded children count the same as
  direct children. Author-hidden or inert children do not consume capacity or inflate the hidden
  count. Unset means no limit.

**Events:** `lr-overflow-toggle` (`detail: { expanded }` — the overflow indicator was activated,
revealing or re-collapsing the excess children; fires only from that click, i.e. only when
`max-visible` is actually causing an overflow state — never as a side effect of `max-visible`/
children changing on their own)

When collapse, `max-visible`, or controlled child removal hides the focused chip action, focus moves
to the nearest enabled visible chip control, then the overflow disclosure, then the stable group
base. Focus already moved outside the group is preserved.

**Slots:** default (`<lr-chip>` elements, or any content, though the chip pairing is the intended
usage)

**CSS parts:** `base` (the flex-wrap container, holds both the slot and the overflow indicator),
`overflow-indicator` (the "+N" / "Show less" toggle button; only rendered while `max-visible` is
actively causing an overflow—a locally-styled pill, not an instantiated real `<lr-chip>`, with the
shared minimum hit area in both axes)

**Themeable custom properties:** `--lr-chip-group-gap` (default `var(--lr-space-xs)`) — the gap
between `[part='base']`'s wrapped children (chips and the overflow indicator alike); previously
hardcoded. `--lr-chip-group-overflow-expanded-color` (default
`var(--lr-color-text)`) — text color of `[part="overflow-indicator"]` while expanded
(`aria-expanded="true"`). `--lr-chip-group-overflow-expanded-border-style` (default `solid`) —
that same expanded indicator's border style; its resting border deliberately remains dashed, so a
theme can retune the open affordance without losing the collapsed treatment. Both are state hooks:
inline `var()` fallbacks at the point of use, never `:host` declarations, so they can be set on the
element _or on any ancestor_. They exist because
`::part(overflow-indicator)[aria-expanded='true']` is invalid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so retinting or reshaping only the expanded state otherwise meant
re-pointing shared tokens. Left unset, rendering is unchanged. Otherwise shared tokens
(`--lr-space-xs`, `--lr-space-s`,
`--lr-color-border`, `--lr-color-surface`, `--lr-color-text-quiet`, `--lr-color-text`,
`--lr-color-brand`, `--lr-focus-ring-width`, `--lr-focus-ring-color`,
`--lr-focus-ring-offset`, `--lr-transition-fast`).

**Optional peer deps:** none.

```html
<lr-chip-group max-visible="3">
  <lr-chip removable value="draft">Draft</lr-chip>
  <lr-chip variant="success" removable value="reviewed">Reviewed</lr-chip>
  <lr-chip variant="warning">Needs input</lr-chip>
  <lr-chip variant="danger" pill>Blocked</lr-chip>
</lr-chip-group>
<script type="module">
  const group = document.querySelector("lr-chip-group");
  group.addEventListener("lr-overflow-toggle", (e) =>
    console.log(e.detail.expanded)
  );
  group
    .querySelectorAll("lr-chip")
    .forEach((chip) =>
      chip.addEventListener("lr-remove", (e) => console.log(e.detail.value))
    );
</script>
```

Since CSS alone can't parameterize `:nth-child` on a runtime prop, `<lr-chip-group>` reaches
directly into the light DOM and sets each excess child's own `hidden` property once `max-visible` is
exceeded — the same approach `<lr-multi-split>` uses to set each panel's inline `flex`/`order`, rather
than a stylesheet-only solution. It observes live author changes to each managed child's `hidden`
and `inert` state, uses real `hidden` attributes for arbitrary HTML/SVG elements, and restores the
latest author-owned value when ownership ends or the group disconnects; reconnecting reapplies the
current collapsed state. Forwarded-slot reconciliation is deferred without scheduling a reactive
write from `firstUpdated()`.

**Known gotchas:**

- `<lr-chip>`'s accessible remove-button label ("Remove {text}") is computed only from the default
  slot's own text content — text living inside the (decorative) `start` slot doesn't leak into it.
- `<lr-chip-group>` silently un-expands (`expanded` resets to `false`, with no event firing) if a
  consumer raises `max-visible` past the current child count while already expanded — only an actual
  click on the overflow indicator fires `lr-overflow-toggle`.
- `<lr-chip-group>`'s overflow indicator is its own locally-styled pill, not an instantiated
  `<lr-chip>` in its shadow DOM — don't expect `<lr-chip>`'s CSS parts or custom properties to
  reach it.

---

## `lr-kbd`

A small chip representing a keyboard shortcut, rendering the platform-appropriate glyph for
cross-platform modifier keys (⌘ on macOS, "Ctrl" elsewhere) from a single platform-neutral `keys`
string. First-party invention (no Web Awesome equivalent).

Removing `keys` safely clears the shortcut. Unknown tokens, including `constructor` and `__proto__`,
render and name themselves verbatim; recognized modifiers keep their localized labels.

**Properties:**

- `keys: string = ''` — a `+`-separated sequence of tokens, e.g. `"mod+k"` or `"mod+shift+p"`.
  Recognized modifier tokens: `mod` (platform-neutral primary modifier — ⌘/"Command" on macOS,
  "Ctrl"/"Control" elsewhere), `alt` (⌥/"Option" on macOS, "Alt" elsewhere), `shift` (⇧/"Shift"
  always), `ctrl`/`control` (always the literal Control key, distinct from `mod`, for a shortcut
  that's specifically Ctrl even on macOS). Anything else falls through to a small built-in map of
  friendly labels (`enter` → `↵`/"Enter", `esc`/`escape` → "Esc"/"Escape", `tab`, `space`,
  `backspace` → `⌫`/"Backspace", `delete` → "Del"/"Delete", `home`, `end`, `pageup` → "PgUp"/"Page
  Up", `pagedown` → "PgDn"/"Page Down", the four `arrowup`/`arrowdown`/`arrowleft`/`arrowright` →
  arrow glyphs, `plus`/`minus` → literal "+"/"−" as an escape hatch since `+` is the token
  delimiter and can't appear as a literal token itself), or, failing that, renders as typed
  (single letters/digits upper-cased).
- `platform: 'auto'|'mac'|'windows'|'linux' = 'auto'` (reflected) — `auto` detects the current
  runtime once; an explicit value makes SSR, screenshots, documentation, and tests deterministic.
- `effectivePlatform: 'mac'|'windows'|'linux'` (read-only) — the concrete platform currently used.
  It is serialized as `data-effective-platform` on `[part="base"]`; hydration adopts a server's
  serialized auto choice instead of re-sniffing and replacing its key caps in another realm.

**Exported types/functions (also directly usable standalone):** `KbdKeyLabel { visual: string;
word: string }` — one resolved token's rendered glyph and spelled-out word; `KbdLocalize = (key:
string, fallback: string) => string`.
`shortcutTokenLabel(rawToken: string, isMac: boolean, localize?: KbdLocalize): KbdKeyLabel`
resolves a single token, parameterized on `isMac` so both platform branches are unit-testable
without spoofing `navigator`; the optional callback localizes spoken key names.
`parseShortcut(keys: string, isMac: boolean, localize?: KbdLocalize): KbdKeyLabel[]` splits and
resolves a full `keys` string with the same optional localization callback.

**Events:** none — purely presentational.

**Slots:** default — an escape hatch for fully custom key-cap content (e.g. an icon instead of a
text glyph). When it has any real (non-whitespace) content, it replaces the `keys`-driven rendering
entirely and this component stops _computing_ its own `aria-label` from `keys`, leaving the slotted
content to carry its own accessible name. A host-supplied `aria-label` in custom mode is forwarded
to `[part="base"]` together with `role="img"`; without one, the wrapper adds no image role and
leaves the slotted content's own semantics exposed. A host `aria-label` wins by attribute presence,
including an explicitly empty value; the computed shortcut name applies only when that attribute is
absent.

**CSS parts:** `base` (the chip root), `key` (one per rendered token).

**Themeable custom properties:** shared tokens only — `--lr-space-xs`, `--lr-color-surface`/
`-border-subtle`/`-text`/`-text-quiet`, `--lr-radius`, `--lr-font`.

**Optional peer deps:** none.

```html
<lr-kbd keys="mod+k"></lr-kbd>
<lr-kbd keys="mod+shift+p"></lr-kbd>
<lr-kbd keys="esc"></lr-kbd>
```

Automatic platform detection (computed once at module scope, not per-instance/per-render, since a
page's platform never changes mid-session) prefers `navigator.userAgentData` (Client Hints, so far
Chromium-only) when available, falling back through `navigator.platform` (long-deprecated) and
finally a `navigator.userAgent` substring check. A server without `navigator` uses `linux`; its
serialized effective value is retained by hydration. Set `platform` explicitly whenever the
rendered documentation should target a different platform.
The rendered chip carries `role="img"` with a single spelled-out `aria-label` (e.g. "Command+K")
rather than exposing each glyph/`+`-separator as separate accessible-tree text, since the individual
pieces aren't real words and would read worse piecemeal than as one label — glyphs like ⌘/⇧/⌥ are
not reliably announced by every screen reader/platform combination, which is exactly why the
spelled-out word form exists at all. An empty `keys` with no explicit `aria-label` override and no
slotted content renders nothing visible and is marked `aria-hidden="true"` (no `role="img"`) instead
of exposing a nameless image element — `role`/`aria-hidden` are both derived from the same
computed-label value so the two can never disagree.

---

## `lr-popup`

The low-level anchored-positioning primitive `lr-popover`, `lr-dropdown` and `lr-tooltip` are built
on. Mirrors `wa-popup` / `sl-popup`. **New in 8.0.0** — the positioning logic already existed as an
internal module, but a migrating consumer had no public element to rename `wa-popup`/`sl-popup` to
and had to reimplement it by hand.

It positions its default slot against an anchor and keeps the two aligned through scroll, resize and
layout change — and does nothing else. **No dismiss behaviour, no focus management, no ARIA
relationship, no trigger semantics.** Those are policy, and each of the three overlays above layers
its own. Reach for `lr-popup` when you need a floating surface the library does not already ship (an
anchored inline editor, a custom autocomplete list); if you find yourself adding light dismiss and
focus return on top of it, use `lr-popover` instead.

**Anchoring**, in precedence order: legacy `virtualAnchor` (an arbitrary rect — a canvas hit, chart
datum, or selection range), mapped `anchor` (an `Element`, same-root id string, or Floating UI
virtual element), `for` (a same-root id), then the first element assigned to the `anchor` slot. A
disconnected element or dangling id falls through to the next source. Id insertion, removal,
replacement and transfer, plus direct and forwarded slot changes, are tracked live.

**Properties:**

- `active: boolean = false` (reflected) — requests positioning and paint. It remains the caller's
  intent when an anchor is temporarily unavailable; the popup and optional hover bridge stay
  hidden and non-interactive until the currently resolved anchor has completed placement.
- `anchor: Element | string | VirtualAnchor | null = null`, `for: string = ''` (reflected), and
  `virtualAnchor` (property only) — the non-slot anchors, in the precedence order above. For a
  plain virtual rect, omitted `width`/`height` default to zero, negative dimensions clamp to zero,
  and any non-finite coordinate or dimension makes that highest-priority rect inert so it cannot
  corrupt layout or paint stale popup chrome.
- `placement: Placement = 'top'` (reflected) — the full Floating UI vocabulary, mirrored
  under RTL. The shared positioner's physical coordinates remain authoritative in either
  direction, so RTL never stretches a fixed-width popup against an opposite logical inset.
- `strategy: 'absolute' | 'fixed' = 'absolute'` (reflected) — the CSS positioning scheme. `fixed`
  positions relative to the viewport; under a transformed, filtered or contained ancestor the popup
  is promoted into the browser top layer where the native Popover API exists, and otherwise that
  ancestor establishes its containing block and may clip it. `absolute` positions relative to its
  containing block and scrolls with its containing content.
- `distance: number = 0` — offset from the anchor along the placement axis, in px
- `skidding: number = 0` — offset along the anchor's edge, in px
- `flip: boolean = false` (not reflected), with `flipFallbackPlacements: string = ''` (attribute
  `flip-fallback-placements` — a
  space-delimited placement list `flip` tries in order instead of just the opposite side;
  unrecognized entries are dropped rather than forwarded), `flipFallbackStrategy: 'best-fit' |
'initial' | 'initial-placement' = 'best-fit'` (attribute `flip-fallback-strategy` — what `flip` settles on
  when no candidate fits: the least-overflowing one, or `placement` as written),
  `flipBoundary: PlaceBoundary | null = null` (property only — element(s) to measure overflow
  against instead of the popup's clipping ancestors) and `flipPadding: number = 0` (attribute
  `flip-padding`)
- `boundary: 'viewport' | 'scroll' = 'viewport'` (not reflected) — shared overflow boundary for flip,
  shift, and auto-size; each middleware-specific boundary below overrides it independently
- `shift: boolean = false` (not reflected), with
  `shiftBoundary: PlaceBoundary | null = null` (property only) and
  `shiftPadding: number = 0` (attribute `shift-padding`)
- `padding: number = 0` — boundary padding kept clear by `shift` and by the available-size
  measurement
- `autoSize: 'horizontal' | 'vertical' | 'both' | null = null` (attribute `auto-size`), with
  `autoSizeBoundary: PlaceBoundary | null = null` (property only) and
  `autoSizePadding: number = 0` (attribute `auto-size-padding`). The popup is _always_ capped by the
  available space it publishes as `--lr-positioner-available-inline-size` /
  `--lr-positioner-available-block-size`; `auto-size` re-measures the named axes against
  `auto-size-boundary`/`auto-size-padding` instead of the shared `padding`, so it narrows or widens
  that cap rather than introducing one. An unrecognized value is inert rather than half-applied.
- `sync: 'width' | 'height' | 'both' | null = null` — copies the anchor's inline size, block size,
  or both onto the popup. An unrecognized value is inert, for the same reason.
- `hoverBridge: boolean = false` (attribute `hover-bridge`, not reflected) — renders an invisible quad
  across the `distance` gap, so a pointer travelling between anchor and popup never leaves both at
  once. Purely geometric: this element owns no hover policy of its own, the component built on top
  reads the hover.
- `arrow: boolean = false` (not reflected), `arrowPlacement: 'anchor'|'start'|'end'|'center' = 'anchor'`
  (attribute `arrow-placement`) and `arrowPadding: number = 10` (attribute `arrow-padding`) — the
  shared arrow trio described at the top of this family

The aligned v8 defaults above are source-contract exact. To preserve the previous Lyra-shaped
geometry explicitly, use `placement="bottom-start" strategy="fixed" distance="4" flip shift`;
origin-aware migration rewrites emit those tokens instead of relying on changed defaults.

`popup: HTMLElement` is the positioned, shadow-owned popup node. Its setter exists for the writable
WA/SL public TypeScript contract, but assignments are intentionally ignored: replacing that node
would disconnect positioning, animation, and the documented CSS parts. Read it to animate or style
the live internal node.

**Methods:** `reposition()` — recompute now. Rarely needed, since the popup already tracks scroll,
resize, layout and live DOM-anchor identity changes; useful after moving a virtual anchor
imperatively.

**Events:** `lr-reposition` — `detail: { placement }`, the placement actually used after `flip`.

**Slots:** `anchor` (the element to position against), default (the floating content).

**CSS parts:** `anchor`, `popup`, `arrow`, and `hover-bridge` (the invisible quad, rendered only
while `hover-bridge` is set). `popup` carries the **resolved side** as a second part token
(`top`/`bottom`/`left`/`right`), so `::part(popup bottom)` styles one side —
`::part(popup)[data-side]` would silently never match. `arrow` carries its own resolved side the
same way (`arrow-top`, `arrow-bottom`, `arrow-left`, `arrow-right`).

**Themeable custom properties:** mapped `--arrow-size`, `--arrow-color`, `--popup-border-width`,
`--show-duration`, and `--hide-duration`; retained `--lr-popup-arrow-size` is the arrow-size
fallback. Read-only `--auto-size-available-width` / `--auto-size-available-height` mirror the
positioner's available dimensions. Shared tokens cover stacking, raised surface, and border.

The popup also receives `--lr-positioner-available-inline-size` / `--lr-positioner-available-block-size`
from the shared positioner and caps its dimensions to the measured available space.

```html
<lr-popup active arrow placement="top" distance="8">
  <button slot="anchor">Anchor</button>
  <div class="panel">Positioned content</div>
</lr-popup>
```

---

## `lr-popover`

A click-triggered, light-dismiss floating surface positioned with the shared Floating UI positioner.

An open lr-popover repositions when its effective host or inherited text direction changes,
preserving open state without emitting lifecycle events.

**First-interaction registration.** A performance-sensitive navigation shell can keep a native
`<details>` disclosure working before JavaScript, then load only the granular popover registration
when that fallback first opens. The interaction that starts an async import is not replayed after
the custom element upgrades, so finish the handoff explicitly with `show()`:

```html
<details id="account-fallback">
  <summary>Account</summary>
  <nav aria-label="Account"><a href="/profile">Profile</a></nav>
</details>
<lr-popover id="account-popover" popup-role="none" hidden>
  <button slot="trigger">Account</button>
  <nav aria-label="Account"><a href="/profile">Profile</a></nav>
</lr-popover>
<script type="module">
  const fallback = document.querySelector("#account-fallback");
  const popover = document.querySelector("#account-popover");
  let registration;
  fallback.addEventListener("toggle", async () => {
    if (!fallback.open || !popover.hidden) return;
    registration ??= import(
      "@aceshooting/lyra-ui/components/overlays/overlay/popover.js"
    ).catch((error) => {
      registration = undefined; // let a later interaction retry
      throw error;
    });
    await registration;
    await customElements.whenDefined("lr-popover");
    fallback.hidden = true;
    popover.hidden = false;
    await popover.show();
  });
</script>
```

This keeps the fallback's markup and semantics in the initial document. The registration, Lyra
base, nonmodal stack, and first-open positioning runtime remain outside that initial module graph.
If the import fails, leave the native disclosure visible and usable.

**Properties:**

- `open: boolean = false` (reflected) — assigning it runs the same `lr-show`/`lr-hide` lifecycle as
  `show()`/`hide()`, so the property, the reflected attribute and the two methods can never disagree
- `placement: Placement = 'top'` (reflected) — the full Floating UI vocabulary, mirrored
  under RTL
- `positioningStrategy: PlaceStrategy = 'fixed'` (attribute `positioning-strategy`, reflected) — CSS
  positioning scheme the popup is laid out with, `'absolute' | 'fixed'`. The one property
  `<lr-popover>`, `<lr-dropdown>`, `<lr-select>`, `<lr-tooltip>` and `<lr-color-picker>` all spell
  the same way; each keeps its own default, so setting nothing changes nothing. An unsupported value
  resolves back to that default. This property always reports the instance's own authored value (or
  its mirrored default) — see the cascading `--lr-positioning-strategy` custom property below for a
  theme-level way to change the *rendered* strategy of every instance that sets neither. `fixed`
  escapes transformed, filtered or contained ancestors by promoting the popup into the browser top
  layer where the native Popover API exists; otherwise, as before, such an ancestor contains and
  clips it (see **Anchored overlays and the top layer**).
- `trigger: string = 'click'` — a _space-separated_ list of `click` (the shipped behaviour),
  `hover`, `focus` and `manual`, spelled exactly the way `<lr-tooltip>`'s `trigger` is, so
  `trigger="hover focus"` means the same thing on both. `LyraPopoverTrigger` is the type of one
  keyword. The two transient modes open after `showDelay`, close after `hideDelay` once the
  interaction ends, never move focus into the surface they opened themselves, and stay open while
  focus rests anywhere inside it. `focus` means keyboard focus: the focused element must match
  `:focus-visible` and the last input must not have been a pointer press, so pointer, touch and
  scripted focus that follows them do not open it; call `show()` for scripted reveals. A click on
  the trigger pins a transient surface open; the next click releases the pin and closes it. A click
  that opens a *closed* transient surface opens it pinned like click mode, including pulling
  `[autofocus]` (and, for `lr-dropdown`, focusing the active menu item); a click on a surface hover
  already opened only pins it. Migrating from `wa-popover`/`wa-dropdown`/`sl-dropdown`: the same
  keyboard-focus narrowing as `lr-tooltip` applies. `manual` refuses every interaction, leaves the surface to `show()`/`hide()`/`open`,
  and wins over any keyword beside it. Unrecognized tokens are dropped and the property reads back
  as the canonical list; unlike `<lr-tooltip>`, a list left with no recognized keyword resolves to
  `'click'` rather than to manual, so a typo can never strand a popover's content behind `show()`.
  Both the slotted trigger and a `for=`-resolved external trigger honour every keyword.
- `showDelay: number = 0` (attribute `show-delay`) — ms before a `hover`/`focus` interaction opens
  the popover.
- `hideDelay: number = 0` (attribute `hide-delay`) — ms before the interaction ending closes it; the
  grace period that lets a pointer cross the gap to the popup.
- `hoverBridge: boolean = false` (attribute `hover-bridge`, reflected) — clips an invisible
  `[part='hover-bridge']` quad across the `distance` gap while a `hover` popover is open, so a
  pointer travelling between trigger and popup never leaves both at once.
- `distance: number = 8` — anchor-offset distance in px (Floating UI's main-axis `offset()`). May
  legitimately be negative to overlap the trigger; a non-finite value falls back to the default.
- `skidding: number = 0` — offset _along_ the anchor's edge, in px (Floating UI's cross-axis
  offset). New in 8.0.0.
- `for: string = ''` (reflected) — id of an element resolved in this element's own root. It is the
  positioning source behind a direct `.anchor`; when it resolves to a live HTML element and no
  trigger is slotted, it also owns click and generated ARIA. A slotted trigger wins interaction/ARIA
  ownership even when positioning uses `for`, and a `showAt()` virtual anchor wins positioning while
  suppressing every DOM interaction owner.
  Assigning `null` is the mapped setter-only clearing spelling: it removes the attribute and the
  getter continues to return `''`
- `anchor: Element | null = null` (property only) — positioning-only direct anchor, taking priority
  over `for` and the interaction owner but never receiving click listeners or generated ARIA; a
  `showAt()` virtual anchor still wins
- `arrow: boolean = true` (reflected) — render an arrow pointing at the anchor; the true-default
  converter accepts `arrow="false"`
- `withoutArrow: boolean = false` (attribute `without-arrow`, reflected) — positive mapped spelling
  for suppressing the default arrow
- `arrowPlacement: 'anchor'|'start'|'end'|'center' = 'anchor'` (attribute `arrow-placement`) —
  `anchor` tracks the anchor's centre; `start`/`end` pin the arrow `arrow-padding` from one logical
  end of the edge (the two ends are the inline ones on a top/bottom placement, so they swap under
  RTL; on a left/right placement they are the block ends, which do not); `center` pins it to the
  middle of the edge regardless of where the anchor is
- `arrowPadding: number = 0` (attribute `arrow-padding`) — keeps the arrow this many px from the
  popup's corners
- `accessibleLabel: string = ''` (attribute **`aria-label`**) — names the popup. An authored host
  attribute wins by presence, including `aria-label=""`; only when it is absent does the property
  or localized "Popover" ("Menu" when `popupRole` is `menu`) fallback apply
- `popupRole: 'dialog'|'menu'|'none' = 'dialog'` (attribute `popup-role`). `none` (new in 11.0.0)
  renders **no** `role` and no generated `aria-label` on the popup surface, and leaves
  `aria-haspopup` off the trigger, so slotted content owns its own semantics and accessible name.
  Unsupported attribute values and untyped property writes normalize to `dialog` before any role
  or trigger ARIA is rendered.
  It exists for the WAI-ARIA **disclosure navigation** pattern: a flyout of links is not an
  application action menu (`menu` announces "menu, menu item" and expects `menuitem` children) and
  is not an interruptive surface (`dialog`). The `aria-expanded`/`aria-controls` wiring that pattern
  requires is unchanged, as are light dismiss, Escape, focus return, and positioning:

  ```html
  <lr-popover popup-role="none">
    <button slot="trigger">Products</button>
    <nav aria-label="Products">
      <ul><li><a href="/overview">Overview</a></li><li><a href="/pricing">Pricing</a></li></ul>
    </nav>
  </lr-popover>
  ```

  Note there is deliberately no `aria-haspopup="none"` — that is an invalid attribute value, not a
  neutral one, and axe reports it as a critical violation. `lr-dropdown` still pins `popupRole` to
  `menu`; the escape hatch lives on the general-purpose primitive.
  For a whole bar of such flyouts — coordinated so one opens at a time, sharing one panel region,
  with arrow keys between triggers and an optional collapsed layout — use `lr-navigation-menu`
  (documented in `layout.md`) instead of several popovers.
- `disabled: boolean = false` (reflected, new in 10.0.0) — prevents opening the popover; pointer,
  keyboard, and programmatic `show()`/`open = true` are all refused while set. Becoming disabled also
  closes an already-open popover, and initial `disabled` plus `open` normalizes closed in either
  attribute order. `lr-dropdown` now inherits this from `lr-popover` rather than declaring its own;
  its consumer-facing behavior is unchanged

To preserve the previous Lyra-shaped defaults explicitly, use
`placement="bottom-start" distance="4" without-arrow`; origin-aware migration emits those tokens.

The slotted trigger receives `aria-haspopup`, `aria-expanded`, and `aria-controls`. With no slotted
trigger, a live HTML `for` target receives the identical ownership contract. A wrapper/custom
trigger's composed descendant that actually receives focus receives the same semantics and becomes
the focus-return target. The component supplies the real popup to the shared relationship owner;
because current browsers reject a light-DOM reference into a private shadow tree, that inward edge
is exposed as the public `lr-popover` host. Target insertion, removal, replacement, `id` changes,
and late custom-element upgrade are tracked live. Authored relationship tokens compose, generated
whole-value attributes stay authoritative while owned, and exact late-authored baselines return
when ownership moves or disconnects.
An enabled, non-inert light-DOM descendant with `data-popover="close"` requests its closest owning
popover to close when activated. Disabled/`aria-disabled` actions are inert, and a nested popover
consumes its own action so the same click never closes an ancestor.
**Methods:** `show(): Promise<void>` opens the popover programmatically — identical to
`el.open = true`, including the veto point — and resolves after `lr-after-show`. A no-op or vetoed
transition returns an already-resolved promise.
`showAt(rect: { x, y, width?, height?, contextElement? }, options?: { returnFocusTo?:
HTMLElement })` opens the popover anchored to an arbitrary rectangle instead of any DOM anchor —
for a graph node, a canvas pixel, a chart datum, or any other non-DOM location
(`width`/`height` default to `0`, a point). Escape and light-dismiss return focus to
`options.returnFocusTo` when supplied, or skip focus-return entirely otherwise, since a virtual
anchor has no `.focus()`. The virtual anchor has no DOM node of its own for `autoUpdate()` to
track ancestor scroll/resize against — pass `rect.contextElement` (a real, still-connected element
near the virtual point) when one is available to give it something to observe; otherwise, or when
the anchor point moves on its own (e.g. a graph pan/zoom tick), re-call `showAt()` with fresh
coordinates to re-anchor — the popover stays open across such a call. A popover that never calls
`showAt()` behaves exactly as before. Non-finite coordinates or dimensions are a no-op and leave
the current open/anchor state unchanged. While virtual anchoring is active, no slotted/`for` DOM
element owns click or generated ARIA.
`hide(options?: { focusTrigger?: boolean }): Promise<void>` programmatically closes the popover and
resolves after `lr-after-hide`; pass
`{ focusTrigger: false }` to opt out of focus restoration. By default, `hide()`, Escape, light
dismiss, and a bare `el.open = false` all return focus to the slotted/`for` owner's real composed
focus target, or to a virtual anchor's explicit `returnFocusTo`; a virtual anchor with no return
target closes without moving focus. No-op when already closed.
**Events:** `lr-show` (cancelable), `lr-after-show`, `lr-hide` (cancelable), `lr-after-hide` — none
carries a detail, and the two `lr-after-*` events are never cancelable. Neither pair fires for
markup that renders open from the start, nor when only `placement`/`distance` change on an
already-open popover.

Removing the sole connected direct anchor or sole interaction anchor from an open popover is
structural teardown: it force-closes even if an `lr-hide` listener would veto an ordinary close. If
a live slotted/`for` positioning fallback remains, the popover rebinds to it and stays open instead.

Public DOM-anchored `lr-popover` instances form a same-root singleton. A later ordinary `show()`
first requests the existing peer's cancelable close and remains closed if that peer vetoes. Initial
open markup stays lifecycle-silent: after the hydration-safe first-render boundary, the
later-connected instance wins and the earlier peer closes structurally without a veto or lifecycle
event. `lr-dropdown`, `showAt()` virtual surfaces, and popovers in separate document/shadow roots
remain independent. Re-entering the same `show()` or `hide()` request from its own before-event
coalesces onto one transition promise and emits the lifecycle once.

**Breaking in 8.0.0:** `lr-show`/`lr-hide` now fire _before_ the state changes and are cancelable —
`preventDefault()` on `lr-show` leaves the popover closed for the trigger click, `show()` and
`open = true` alike, and on `lr-hide` keeps it open for every dismissal path (Escape, light dismiss,
`hide()`, `open = false`). Reading `el.open` inside such a handler therefore returns the _old_
value; in 7.x these events fired after the fact and were purely informational. That is exactly the
timing `wa-show`/`wa-hide` always had, so the `wa-*` → `lr-*` migration table's "mechanical rename"
promise now holds for these names too — which also means 7.x Lyra code that read `el.open` in the
handler was relying on the _opposite_ polarity and must be re-read. `lr-after-show`/`lr-after-hide`
are new in 8.0.0 and settle after the public `popover.show` / `popover.hide` registry animation.
Per-element overrides win over page defaults; keyframes-only overrides retain the popup's
`--show-duration` / `--hide-duration` and shared easing. Reduced motion flattens timing to zero, and
a `null` registration skips interpolation, but neither path skips the after-event or its
method-promise settlement.

**Slots:** `trigger` (the interactive element that toggles the popover), default (popover content;
an enabled, non-inert descendant with `data-popover="close"` closes its nearest owning popover).

**CSS parts:** `trigger`; `popup dialog popup__popup`; `content body`;
`arrow popup__arrow` (rendered unless suppressed); and `hover-bridge` (the invisible quad, rendered
only while a `hover` popover with `hover-bridge` set is open). Names grouped together are aliases on
the same node. The arrow's part attribute also carries the **resolved side** as a second token — `arrow-top`,
`arrow-bottom`, `arrow-left`, `arrow-right` — so `::part(arrow arrow-top)` styles one side.
`::part(arrow)[data-side]` and `::part(arrow) .inner` are invalid selectors that silently never
match; the state is in the part name.

**Themeable custom properties:** mapped `--max-width`, `--arrow-size`, `--show-duration`, and
`--hide-duration`, with retained `--lr-overlay-max-inline-size` and `--lr-overlay-arrow-size`
fallbacks. Arrow size is half the square's width. Rendering the arrow switches `[part~="popup"]` to
`overflow: visible` so it is not clipped, moving the scroll container onto `[part~="content"]`.

The popup and its arrow paint from the **shared overlay-surface family** (16.0.0):
`--lr-overlay-surface` (default `var(--lr-color-surface-overlay)`), `--lr-overlay-border` (default
`var(--lr-color-border-subtle)`), `--lr-overlay-radius` (default `var(--lr-radius)`) and
`--lr-overlay-shadow-anchored` (default `var(--lr-shadow-m)`). The arrow takes the fill and the
edge but never the radius — its corners are already cut by its clip path. None of the four is
declared on `:host`, so a single declaration on `:root` retints every floating surface in the
application, and the same declaration on one component's own ancestor scopes the retint to that
subtree. `--lr-overlay-shadow-anchored` is deliberately a different name from the modal tier
`--lr-overlay-shadow-modal` that `lr-dialog`/`lr-drawer` read, so raising popups never raises
dialogs.

**Edge tier.** The `var(--lr-color-border-subtle)` edge default is the decorative tier, shared by
every floating panel — popover, dropdown and menu, detail and preview cards, the selection
toolbar, the dialog panel. A panel's outline is not what identifies a control (WCAG 2.2 SC 1.4.11):
the panel itself is not operable, the anchored shadow lifts it off the page, and every item inside
identifies itself, so a theme may set `--lr-theme-color-surface-border-subtle` below 3:1 for a
hairline edge. Popups that belong to a form control — the listboxes of `lr-select`,
`lr-combobox`, `lr-locale-picker`, `lr-model-select`, `lr-voice-picker` and `lr-mention-popover`,
and the `lr-color-picker` and `lr-time-input` panels — instead default to the control tier,
`var(--lr-color-border)`, keeping the 3:1 boundary of the field they open from. A consumer
`--lr-overlay-border` wins on both kinds. While the subtle input is unset the two tiers resolve to
the same colour.

**`--lr-positioning-strategy` (16.0.0)** — a cascading `absolute`/`fixed` override for
`positioningStrategy`, read from computed style each time the popup is (re)positioned (open, or a
placement/anchor change while open — never per animation frame). Setting nothing anywhere leaves
every default exactly as before. Precedence: an explicit `positioning-strategy`/`hoist` on the
instance always wins; otherwise this inherited custom property; otherwise `fixed` inside
`lr-virtual-list` rows and `lr-flow-canvas` nodes; otherwise the component's own mirrored default. Because it is a plain cascading custom property, one declaration on `:root`, a
theme, or a single clipping ancestor (an `overflow: hidden` card or a scroller) changes every unset
overlay beneath it — no need to author `positioning-strategy`/`hoist` on each instance individually,
or to remember it on every new one:

```html
<lr-card style="--lr-positioning-strategy: fixed; overflow: hidden">
  <lr-dropdown>
    <button slot="trigger">Actions</button>
    <lr-dropdown-item>Rename</lr-dropdown-item>
  </lr-dropdown>
</lr-card>
```

`<lr-popover>`, `<lr-dropdown>`, `<lr-select>`, `<lr-tooltip>` and `<lr-color-picker>` all honor it.

```html
<lr-popover
  arrow
  arrow-placement="center"
  placement="bottom"
  distance="8"
  skidding="12"
>
  <button slot="trigger" type="button">Details</button>
  <p>Anchored content.</p>
</lr-popover>
<script type="module">
  import "@aceshooting/lyra-ui/components/overlays/overlay/popover.js";

  const popover = document.querySelector("lr-popover");
  let ready = false;
  popover.addEventListener("lr-show", (event) => {
    // vetoes the open; popover.open is still false inside this handler
    if (!ready) event.preventDefault();
  });
  popover.addEventListener("lr-after-show", () => console.log("fully open"));
</script>
```

## `lr-tooltip`

A tooltip for a consumer-owned trigger, positioned with the shared Floating UI positioner. Which
interactions open it is configurable as of 8.0.0; by default it is still hover and focus. Focus
means keyboard focus; see `trigger`.

An open lr-tooltip repositions when its effective host or inherited text direction changes,
preserving open state without emitting lifecycle events.

Removing `content` safely omits tooltip fallback text while preserving `null` property readback;
later text renders normally.

**Properties:**

- `open: boolean = false` (reflected) — assigning it runs the same lifecycle as `show()`/`hide()`.
  Assigning `false` also cancels a delayed open that has not fired yet, even when the tooltip is
  already closed, so a pending timer can't reopen it behind the caller's back.
- `trigger: string = 'hover focus'` — **new in 8.0.0.** A _space-separated_ list of `hover`,
  `focus`, `click` and `manual`. `focus` means keyboard focus: the focused element must match
  `:focus-visible` and the last input must not have been a pointer press. Pointer, touch and
  scripted focus that follows them do not open it, but any focus inside the trigger still wires its
  description; use `show()` for scripted reveals. This narrows `wa-tooltip`/`sl-tooltip` focus
  activation deliberately, following the WAI-ARIA tooltip pattern, and the check reads the control
  that actually holds focus, including one inside a shadow-root trigger. Migrating from
  `wa-tooltip`/`sl-tooltip`: focus activation is narrowed to keyboard focus. If you removed `focus`
  from `trigger` to stop pointer or programmatic pops, restore the default; call `show()` for
  scripted reveals. `manual` (or an empty list)
  leaves the tooltip entirely under programmatic control. Note the name collision: this string
  property and the `trigger` _slot_ are different things — the slot holds the element, this property
  says which of its interactions count.
- `manual: boolean = false` — equivalent to including `manual` in `trigger`; kept because it reads
  better on a tooltip that is only ever driven from script
- `showDelay: number = 150` (attribute `show-delay`) and `hideDelay: number = 0` (attribute
  `hide-delay`) — **breaking in 8.0.0:** the single `delay` property is gone, split into these two
  independent milliseconds values, so a tooltip can linger after the pointer leaves without also
  being slow to appear. `showDelay` keeps the old `delay` default of 150ms; `hideDelay` defaults to
  `0`, so leaving the trigger now closes the tooltip at once, where 7.x's single `delay` also held
  it open for 150ms first. A non-finite value falls back to the default; a negative one clamps to
  `0` (immediate) and an oversized one to the largest delay `setTimeout` can represent, so neither
  can hang the tooltip open.
- `placement: Placement = 'top'` (reflected) — the full Floating UI vocabulary, mirrored under RTL
- `distance: number = 8` — anchor-offset distance in px; identical semantics to
  `<lr-popover>.distance` (both wrap the same `place()`/`offset()` middleware)
- `skidding: number = 0` — offset along the anchor's edge, in px. New in 8.0.0.
- `for: string = ''` (reflected) — id of an element in this tooltip's own root. It positions behind
  a direct `.anchor`; when it resolves to a live HTML element and no trigger is slotted, it also owns
  the configured interaction listeners and `aria-describedby`. A slotted trigger wins interaction
  and ARIA ownership. Assigning `null` clears the attribute to the canonical `''` read value; the
  getter itself remains non-nullable
- `anchor: Element | null = null` (property only) — positioning-only direct anchor, taking priority
  over `for` and the active interaction owner without receiving listeners or generated ARIA
- `disabled: boolean = false` (reflected) — prevents both interaction and programmatic opening;
  setting it while open closes the tooltip
- `hoist: boolean = false` (reflected) — switches the mapped absolute positioning default to fixed
- `positioningStrategy: PlaceStrategy = 'absolute'` (attribute `positioning-strategy`, reflected) —
  see `<lr-popover>`. `hoist: boolean = false` is its retained exact alias
  (`hoist` ⇔ `positioning-strategy="fixed"`); writing either spelling updates the other, so the two
  attributes can never disagree. Prefer `positioning-strategy` in new code. It also honors the
  cascading `--lr-positioning-strategy` custom property `<lr-popover>` documents, ahead of this
  mirrored `absolute` default, when neither spelling is authored on the instance.
- `arrow: boolean = true` (reflected), `withoutArrow: boolean = false` (attribute `without-arrow`,
  reflected), `arrowPlacement: 'anchor'|'start'|'end'|'center' = 'anchor'`
  (attribute `arrow-placement`) and `arrowPadding: number = 0` (attribute `arrow-padding`) — the
  same arrow trio `<lr-popover>` documents (`llms/components/lr-popover.md`), new in 8.0.0
- `content: string = ''` — plain-text tooltip content, used when nothing is slotted
- `accessibleLabel: string = ''` (attribute **`aria-label`**) — a host `aria-label` wins by
  attribute presence, including an explicitly empty value. When the attribute is absent, an
  actionable popup with no property label uses the localized `popover` string.

To preserve the previous Lyra-shaped visual defaults explicitly, use `distance="6" without-arrow`;
origin-aware migration emits those tokens.

**Methods:**

- `show(): Promise<void>` — open immediately, bypassing `show-delay` and interaction policy, then
  resolve after `lr-after-show`
- `hide(): Promise<void>` — close immediately, bypassing `hide-delay`, then resolve after
  `lr-after-hide`
- `showAt(rect: { x, y, width?, height?, contextElement? }, options?: { returnFocusTo?: HTMLElement })`
  — same virtual-anchor contract as `lr-popover.showAt()` (`llms/components/lr-popover.md`)
  (anchors to an arbitrary rectangle
  instead of any DOM anchor, `width`/`height` default to `0`, `contextElement` gives
  `autoUpdate()` something to observe, Escape returns focus to `options.returnFocusTo` or skips
  focus-return, re-call with fresh coordinates to re-anchor a moving point). Opens immediately,
  bypassing `show-delay`/`trigger`/`manual` (all are interaction-debounce concerns for a slotted
  trigger, not a deliberate programmatic call); while active it removes every DOM interaction/ARIA
  owner. Close it with `hide()` or `open = false`. Non-finite coordinates or dimensions are a no-op.

**Events:** `lr-show` (cancelable), `lr-after-show`, `lr-hide` (cancelable), `lr-after-hide` — the
same four-event contract, timing and veto semantics `<lr-popover>` documents
(`llms/components/lr-popover.md`), and all four are
new to this component in 8.0.0. A vetoed `lr-show` leaves the tooltip closed whether the delay
elapsed, `show()` was called, or `open` was assigned.

Tooltip motion resolves `tooltip.show` / `tooltip.hide` through the public animation registry.
The same per-element/global precedence, RTL keyframe selection, token-timing fallback,
reduced-motion flattening, and null-disable lifecycle rules documented for `lr-popover` apply.

**Slots:** both mapped shapes are supported, plus a Lyra-original addition. `trigger` (the
highest-priority interaction/ARIA owner, mirroring `<lr-popover>`'s own `trigger` slot) is not a
Web Awesome shape: `wa-tooltip` has only its single unnamed default slot for tooltip content, and
its own anchor mechanism is the `for` attribute plus the unrelated `trigger` activation-mode
attribute documented above. Shoelace uses the default slot for the trigger and `slot="content"`
(or the `content` property) for tooltip content. A named `trigger` slot always selects that shape;
without one, an explicit content source (`slot="content"` or the `content` property) makes the
default slot unambiguously the trigger, matching Shoelace.

**CSS parts:** `popup base tooltip base__popup` are aliases on the same wrapper; `trigger`; `body`;
and `arrow base__arrow` (rendered unless suppressed). The arrow also carries the resolved side —
`arrow-top`, `arrow-bottom`, `arrow-left`, or `arrow-right`.

**Themeable custom properties:** mapped `--max-width`, `--show-delay`, `--hide-delay`, and
`--arrow-size`; retained `--lr-tooltip-max-inline-size`, `--lr-tooltip-background`,
`--lr-tooltip-color`, and `--lr-tooltip-arrow-size` remain fallbacks. A tooltip popup has no inner
scroll wrapper to move overflow onto, so its default arrow trades internal scrolling for a visible
arrow — use `<lr-popover>` when a floating surface needs both.

`--lr-overlay-surface`, `--lr-overlay-border` and `--lr-overlay-radius` are listed on this tag
because its rules live in the stylesheet module `lr-popover` also composes, but a tooltip bubble is
a **deliberate exclusion** from the overlay-surface family: it is a high-contrast label, not a
panel, so it keeps painting from `--lr-tooltip-background`/`--lr-tooltip-color`, draws no border,
and keeps the tighter `var(--lr-radius-xs)` corner. Setting any of the three changes nothing here.

`--lr-positioning-strategy` (16.0.0) is not excluded: the tooltip honors the same cascading
`absolute`/`fixed` override `<lr-popover>` documents (`llms/components/lr-popover.md`), ahead of
its own mirrored `absolute`
default, when neither `positioning-strategy` nor `hoist` is authored on the instance.

```html
<lr-tooltip
  trigger="hover focus click"
  show-delay="0"
  hide-delay="400"
  arrow
  placement="right"
>
  Copied to clipboard
  <button slot="trigger" type="button">Copy</button>
</lr-tooltip>

<!-- Shoelace-compatible shape: default trigger, named content. -->
<lr-tooltip content="Save your changes">
  <button type="button">Save</button>
</lr-tooltip>
```

While open, and whenever focus is inside the trigger (when `focus` is among the active keywords),
trigger `aria-describedby` points to a hidden text proxy in the tooltip's light DOM,
not the shadow-private popup. Native triggers resolve that ID directly. A description is only
announced on the node that actually holds focus, so when the trigger is a custom element the same
proxy is applied to the first focusable descendant as well — across slots and nested open shadow
roots — which covers `lr-select`, `lr-switch`, `lr-chip` and any consumer-authored wrapper, not
just the components that forward their own host `aria-describedby`. A descendant in the same tree
receives the serialized ID; one inside a shadow root is linked through `ariaDescribedByElements`,
whose explicit element-reference assignment intentionally leaves that control's serialized
`aria-describedby` value empty in supporting browsers. Existing author-provided descriptions —
including a control's own internal hint/error text — are merged while described and restored once
the tooltip is neither open nor focused, when the trigger is replaced, or when the tooltip
disconnects. Late author writes remain the
release baseline while Lyra's active description stays composed into the owned value.

With no slotted trigger, a live HTML `for` target receives those same interactions and description;
target insertion, removal, replacement and `id` changes are tracked without requiring reinsertion.
Removing the sole connected direct or interaction anchor force-closes despite an `lr-hide` veto,
while a live slotted/`for` positioning fallback is rebound and keeps the tooltip open.

Plain content keeps `role="tooltip"`. If actionable content appears anywhere in the assigned
default-slot subtree — including native links/form/media controls, authored sequential focus stops,
explicit ARIA widget roles, or content inside a nested custom element's open shadow root — the popup
promotes to a named `role="dialog"` and remains open while pointer or focus is within it. Escape
from either the trigger or popup closes it; Escape from popup content returns focus to the trigger's
real composed focus target. Bubbling `focusin`/`focusout` keeps the tooltip open when focus moves
within a wrapper trigger or between interactive popup controls.
The content scan follows the live composed assignment through forwarding slots. Reassignment,
external descendant text/actionability changes, and relevant composed-ancestor visibility changes
update both the hidden description proxy and popup role; when a forwarding slot becomes genuinely
unassigned, its own fallback content is restored. This classification also runs while the popup is
closed, without treating the popup's internal closed-state visibility as consumer-hidden content.
Image alternatives and `aria-labelledby` references contribute their accessible text; referenced
targets outside the tooltip subtree are observed too, so a sibling label's live text mutation
updates the proxy. Text, actionability, and observer enrollment share bounded, cycle-safe composed
traversal; content beyond the traversal ceiling fails closed instead of recursing without bound.
While open, rootless custom-element content receives a bounded initialization grace period for an
upgrade or newly attached open shadow root; later observable content mutations start a fresh
grace period. This catches normal lazy initialization without scheduling perpetual animation-frame
work for a legitimate custom element that intentionally has no shadow root. Content and trigger
observers plus delayed show/hide timers are bound to the tooltip's current owner window; disconnect
or cross-document adoption cancels the old realm, and reconnect creates fresh observers. Use
`lr-popover` when click-to-open ownership is desired.

**`showAt()` composed with `lr-graph`** — anchoring a popover to a clicked graph node. Note:
`lr-graph.getNodePosition()` and the `lr-node-click` event's `{ x, y }` are in the graph's own
_local drawing space_ (pre pan/zoom), not viewport pixels, so they can't be passed to `showAt()`
directly. For `renderer="svg"` (the default), read the clicked node's own rendered element instead,
whose `getBoundingClientRect()` is already viewport-relative; for `renderer="canvas"` (no per-node
DOM element), use the click event's own `clientX`/`clientY`.

```js
const graph = document.querySelector("lr-graph");
const detail = document.querySelector("lr-popover"); // no slotted trigger needed for showAt()

graph.addEventListener("click", (event) => {
  const nodeEl = event
    .composedPath()
    .find((el) => el instanceof Element && el.matches('[part="node"]'));
  if (!nodeEl) return; // clicked empty canvas/background, not a node
  const rect = nodeEl.getBoundingClientRect();
  detail.showAt({
    x: rect.left + rect.width / 2,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  });
});
```

## `lr-dropdown`

The complete mapped action-menu component. The public element remains a Popover-style trigger plus
positioned popup shell; the shell is presentation-only, and its contained `lr-menu` is the sole
menu role/name owner. That menu provides the same interaction engine as standalone `lr-menu`, so
direct `lr-dropdown-item`/`lr-menu-item` children get roving focus, disabled skipping, type-ahead,
nested submenu keyboard/pointer intent, and focus return without a second public popup. A
consumer-supplied `lr-menu` in the default slot becomes that contained engine instead of being
wrapped in another menu. This supports both Web Awesome's direct-item shape and Shoelace's
consumer-menu shape.

The inner menu list owns scrolling within the popup's height limit, keeping a consumer menu's
header and footer visible. The outer `popup` and `content` parts allow overflow so nested submenus
remain clickable outside the parent menu in every supported browser. This works with either
submenu authoring shape, with or without `hoist` or an arrow; no overflow override is required.
When the resolved strategy is `fixed` (from `positioning-strategy="fixed"`, `hoist`, an inherited
`--lr-positioning-strategy: fixed`, or the `fixed` default inside `lr-virtual-list` rows, so
`lr-thread-list` row actions, and `lr-flow-canvas` nodes) and a transformed, filtered or contained
ancestor would trap it, an open popup is promoted to the browser's top layer where the native
Popover API exists (see **Anchored overlays and the top layer**). A dropdown in a short virtual
list therefore opens at full size below its row. The popup stays promoted through its hide
transition and returns to its ordinary shadow-tree stacking context once it settles closed; a
submenu nested in a promoted menu is promoted above it. An untrapped fixed dropdown keeps the
z-index layering.

An open lr-dropdown repositions when its effective host or inherited text direction changes,
preserving open state without emitting lifecycle events.

**Direct mapped items.** `<lr-dropdown-item>` is the Web Awesome-compatible name for the same row
implementation as `<lr-menu-item>`. Direct mapped items receive this dropdown's `size` and use its
contained roving-focus, type-ahead, disabled-skipping, selection, and submenu controller; a
consumer-supplied `<lr-menu>` uses that controller directly. This preserves both Web Awesome's
direct-item composition and Shoelace's consumer-menu composition. The canonical item properties,
methods, events, slots, parts, and theme variables are documented in the layout-family
`lr-menu` / `lr-menu-item` section.
The trigger always receives `aria-haspopup="menu"`. `popupRole` is narrowed to the invariant
`'menu'`; assigning another runtime value or authoring another `popup-role` value normalizes it
back to `menu` and never puts a dialog/menu role on the outer positioning shell. This matches Web
Awesome's fixed inner menu role and Shoelace's consumer-menu ownership rather than exposing a
Lyra-only role switch.

ArrowDown opens and focuses the first enabled item; ArrowUp opens and focuses the last enabled
item, whether the interaction owner is slotted or resolved through `for`.
The inherited `data-popover="close"` descendant action is also supported and follows the same
disabled/inert and nearest-owner rules described for `lr-popover`.

The generated menu uses the dropdown's presence-sensitive host `aria-label`, `accessibleLabel`, or
localized "Menu" fallback. A consumer-supplied menu keeps its own naming precedence: its host
`aria-label` (including an explicit empty value), then an explicit nondefault `label`, then the
dropdown fallback. Its `header` and `footer` slots remain rendered outside the inner
`role="menu"` list while contained, including after live slot changes; Tab can therefore reach
their controls without putting arbitrary content inside the menu role. An open dropdown stays open
when Tab moves focus out of it; `lr-context-menu` deliberately differs and closes when Tab leaves
its surface.

**Properties:**

- `open: boolean = false` (reflected), `placement: Placement = 'bottom-start'`,
  `distance: number = 0`, `skidding: number = 0`, and `for: string = ''` — the same positioning
  vocabulary as `lr-popover`, except the mapped dropdown sits flush against its trigger by default.
  An explicit distance still wins, and generic `lr-popover` keeps its own default of `8`.
- `size: LyraSize = 'm'` (reflected) — propagated to directly owned mapped items. Accepts the
  six-step Lyra ladder and `small`/`medium`/`large` aliases.
- `disabled: boolean = false` (reflected) — prevents pointer/keyboard/programmatic opening and
  dismisses an already-open dropdown when enabled. Initial `disabled` plus `open` markup or
  pre-upgrade property writes normalize closed regardless of assignment/attribute order.
- `stayOpenOnSelect: boolean = false` (attribute `stay-open-on-select`, reflected) — suppresses the
  default selection close for direct and nested selections.
- `hoist: boolean = false` (reflected) — uses viewport-fixed positioning; otherwise the popup uses
  the containing-block (`absolute`) strategy.
- `sync?: 'width'|'height'|'both'` (reflected) — copies the trigger dimension(s) onto the popup.
- `positioningStrategy: PlaceStrategy = 'absolute'` (attribute `positioning-strategy`, reflected) —
  see `<lr-popover>`. `hoist: boolean = false` is its retained exact alias
  (`hoist` ⇔ `positioning-strategy="fixed"`); writing either spelling updates the other, so the two
  attributes can never disagree. Prefer `positioning-strategy` in new code. `<lr-dropdown>` also
  inherits `<lr-popover>`'s `trigger`/`showDelay`/`hideDelay`/`hoverBridge`, and honors the
  cascading `--lr-positioning-strategy` custom property ahead of this mirrored `absolute` default
  when neither spelling is authored on the instance.
- `containingElement?: HTMLElement` (property only) — an external element that counts as inside for
  light-dismiss handling.
- `arrow`, `withoutArrow` (`without-arrow`), `arrowPlacement`, `arrowPadding`, and `accessibleLabel`
  (`aria-label`) are retained from `lr-popover` for existing Lyra consumers.
- `popupRole: 'menu'` (attribute `popup-role`) is the narrowed inherited surface. Dropdowns cannot
  be changed into dialogs; use `lr-popover popup-role="dialog"` for arbitrary dialog-like content.

**Methods:** `show(): Promise<void>` and
`hide(options?: { focusTrigger?: boolean }): Promise<void>` use the same cancelable before-events,
after-events, focus return, and settlement rules as `lr-popover`. `reposition(): void` immediately
recomputes placement after an imperative anchor/layout change. `focusOnTrigger(options?): void`
focuses the first assigned trigger, and `getMenu(): LyraMenu | null` returns the live generated or
consumer-supplied contained menu engine. `showAt()` remains available for Lyra's virtual-anchor
compatibility surface.

While a consumer-supplied menu is contained, the dropdown snapshots every integration field it owns
(`dropdownOpen`, owner/contained/role flags, stay-open policy, and size). Removing/swapping that menu or
disconnecting the dropdown restores the exact author values, so reuse outside this dropdown does
not retain hidden parent policy.

**Events:** `lr-select` is the single mapped selection path: cancelable, bubbling/composed, with
`detail: { item }` carrying the activated element. Preventing it keeps the complete submenu chain
open; `stay-open-on-select` applies the same default suppression declaratively. Nested selection is
not translated or re-emitted at each level, so a listener on `lr-dropdown` receives exactly one
event. `lr-show` (cancelable), `lr-after-show`, `lr-hide` (cancelable), and `lr-after-hide` retain
the Popover lifecycle; none fires for initial open markup.

Dropdown motion resolves `dropdown.show` / `dropdown.hide` through the public animation registry;
it retains the dropdown's `--show-duration` / `--hide-duration` defaults when an override supplies
only keyframes. Passing `null` disables motion without skipping the after-event or promise.

**Slots:** `trigger`; default (`lr-dropdown-item`/`lr-menu-item` rows, or one consumer-supplied
`lr-menu`; that menu may use its own `header`/`footer` regions). **CSS parts:** `trigger`;
`popup dialog popup__popup base base__popup panel` (all six tokens on the neutral positioned
popup, preserving the popover, Web Awesome and Shoelace wrapper names on the same node); `menu`
(the contained semantic/controller owner); `content body`; the retained optional
`arrow popup__arrow` token set; and the inherited `hover-bridge` — the invisible quad the positioner
clips across the `distance` gap between trigger and popup, rendered only while a `hover`-triggered
dropdown with `hover-bridge` set is open, so a pointer travelling from the trigger to the popup
never leaves both at once and the surface does not close underneath it. It paints nothing by
default; style it only to debug the travel region.

**Themeable custom properties:** `--show-duration` and `--hide-duration` (both default
`var(--lr-transition-fast)`), mapped `--max-width` and `--arrow-size`, plus retained
`--lr-overlay-max-inline-size` and `--lr-overlay-arrow-size` fallbacks. The popup surface is
`lr-popover`'s, so the whole overlay-surface family reaches it unchanged: `--lr-overlay-surface`,
`--lr-overlay-border`, `--lr-overlay-radius`, `--lr-overlay-shadow-anchored`, and the cascading
`--lr-positioning-strategy` override documented on `<lr-popover>`
(`llms/components/lr-popover.md`).

```html
<lr-dropdown aria-label="File actions" size="small">
  <button slot="trigger">Actions</button>
  <lr-dropdown-item value="rename"
    ><span slot="details">⌘R</span>Rename</lr-dropdown-item
  >
  <lr-dropdown-item>
    Share
    <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
    <lr-dropdown-item slot="submenu" value="link">Copy link</lr-dropdown-item>
  </lr-dropdown-item>
  <lr-dropdown-item value="delete" variant="danger">Delete</lr-dropdown-item>
</lr-dropdown>
<script type="module">
  document
    .querySelector("lr-dropdown")
    .addEventListener("lr-select", (event) => {
      console.log(event.detail.item.value);
    });
</script>
```

## `lr-context-menu`

Turns any slotted region into a context-menu target. Each of these gestures opens the library's
menu engine exactly once: a platform `contextmenu` (right-click, or Ctrl+click on macOS), a touch or
pen press-and-hold, and Shift+F10 or the ContextMenu key while focus is inside the region. A pointer
gesture opens the menu just beside the pointer (never under it); a keyboard gesture opens it below
the focused element. It flips at the viewport edges, and mirrors under RTL. There is no Web
Awesome or Shoelace counterpart; the behaviour follows the WAI-ARIA menu pattern.

The menu content is exactly what `lr-dropdown` takes, so every row type composes unchanged:
`lr-menu-item` / `lr-dropdown-item` rows (with `type="checkbox"`, `type="radio" group="…"`,
`details` shortcut text, `variant="danger"`, `disabled` and `submenu` children), `lr-menu-label`,
`<hr>` separators, or one consumer `<lr-menu>` with its `header` / `footer`. Import
`lr-menu-label` and `lr-dropdown-item` yourself, as for `lr-dropdown`.

```html
<script type="module">
  import '@aceshooting/lyra-ui/components/overlays/context-menu/context-menu.js';
  import '@aceshooting/lyra-ui/components/layout/menu/menu-label.js';
</script>

<lr-context-menu label="File actions">
  <div slot="trigger" class="file-card" tabindex="0">report.pdf</div>
  <lr-menu-label>Edit</lr-menu-label>
  <lr-menu-item value="copy">Copy<span slot="details">Ctrl+C</span></lr-menu-item>
  <lr-menu-item value="wrap" type="checkbox" checked>Wrap lines</lr-menu-item>
  <hr />
  <lr-menu-item value="list" type="radio" group="view" checked>List</lr-menu-item>
  <lr-menu-item value="grid" type="radio" group="view">Grid</lr-menu-item>
  <lr-menu-item value="share">
    Share
    <lr-menu-item slot="submenu" value="email">Email</lr-menu-item>
    <lr-menu-item slot="submenu" value="link">Copy link</lr-menu-item>
  </lr-menu-item>
  <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
</lr-context-menu>
```

**Properties:**

- `label?: string` — accessible name of the generated menu. Name precedence: a consumer
  `<lr-menu>`'s own `aria-label`, then its `label`; then a host `aria-label` on
  `lr-context-menu`; then `label`; then the localized "Menu" (`menuLabel`, resolved with this
  host's `.strings` / `lang`). An empty host `aria-label` and an empty `label` behave exactly like
  unset, so the menu is never left unnamed. It is an accessible-name override, not form chrome.
- `disabled: boolean = false` (reflected) — no gesture opens the menu, native events stay
  un-prevented (so an enclosing region, or the platform menu, handles them), and a pending
  press-and-hold is cancelled. Becoming disabled while open closes the menu through a cancelable
  `lr-hide`.
- `size: LyraSize = 'm'` (reflected) — propagated to the directly owned rows.
- `open: boolean` — **read-only**. `true` from the moment the menu opens until a close commits, so
  it still reads `true` inside `lr-hide` handlers. A context menu needs a point, so there is no
  `open` setter and no argument-less `show()`: open it with a gesture or `showAt()`.

**Methods:**

- `showAt(point: LyraContextMenuPoint, options?: { returnFocusTo?: HTMLElement }): void` — opens
  at a viewport point (`{ x, y, contextElement? }`), emitting a cancelable `lr-show` with
  `source: 'programmatic'`. Focus returns to `options.returnFocusTo` when supplied; otherwise to the
  element focused at call time **only if** it lies inside this region or inside `contextElement`;
  otherwise nowhere. **When opening from a control outside the region** (a toolbar "more" button,
  a map), pass `returnFocusTo`. `contextElement` is watched, so scrolling it away or removing it
  closes the menu. Called while open, it silently re-anchors the menu (no lifecycle events) and
  keeps the original return target unless a new one is passed. Non-finite coordinates, a disabled
  instance and a disconnected host are ignored.
- `hide(options?: { focusTrigger?: boolean }): Promise<void>` — closes and resolves after
  `lr-after-hide` (or once a new open supersedes the close). `focusTrigger: false` skips focus
  return. A no-op when closed.

Every event below bubbles and is composed.

**Events:**

| Event | Detail | Cancelable | Fires |
|---|---|---|---|
| `lr-show` | `LyraContextMenuShowDetail` | **yes** | synchronously inside the gesture, only when the menu is closed |
| `lr-after-show` | `null` | no | after placement and the enter animation |
| `lr-hide` | `null` | yes | before closing, on every dismissal path except host removal; a veto keeps the menu open |
| `lr-after-hide` | `null` | no | after the exit animation; **not** delivered for an interrupted close |
| `lr-select` | `{ item }` | yes | the menu's own event bubbling through; preventing it keeps the menu open |

```ts
type LyraContextMenuSource = 'pointer' | 'long-press' | 'keyboard' | 'programmatic';
interface LyraContextMenuShowDetail {
  readonly source: LyraContextMenuSource;
  readonly target: Element | null;   // innermost element; pierces open shadow roots
  readonly path: readonly Element[]; // composed path, target up to the region element; frozen
  readonly clientX: number;          // viewport point the menu is anchored to
  readonly clientY: number;
  readonly originalEvent: Event | null; // contextmenu / keydown / starting pointerdown; null for showAt()
}
```

`source` is `'long-press'` for a press-and-hold and for a native `contextmenu` whose `pointerType`
is `'touch'`; a native `contextmenu` whose point lies outside its target (keyboard or assistive
technology synthesised) is element-anchored and reports `'keyboard'`. The detail, and its `path`
array, are frozen; `target`, `originalEvent` and each `path` entry keep their identity.

**The veto contract.** `lr-show` is a real veto: preventing it keeps the menu closed and leaves
the native `contextmenu` / `keydown` **un-prevented**, so the platform's own menu appears, and it
claims the gesture so no enclosing region asks. This is the opposite polarity from `lr-data-grid`'s
`lr-cell-contextmenu`, where preventing the event *suppresses* the native menu: here preventing
`lr-show` *allows* it. **iOS exception:** the region carries a static
`-webkit-touch-callout: none` so a press-and-hold can open the menu; a vetoed press-and-hold on
iOS therefore brings back no link or image callout unless you opt that element back in (recipe
below).

**Interrupted close.** A new gesture while the menu is open (a right-click or press-and-hold
elsewhere in the region) closes it and reopens it at the new point. That cycle emits `lr-hide` and
then the next `lr-show`, with **no** `lr-after-hide` between them; do not pair them one-to-one.

**Closing and focus.** Escape (topmost overlay only), activating an item, an outside pointer,
`disabled`, and `hide()` close the menu. Escape, activation and `hide()` return focus to the
captured target: an element focused inside the region when the gesture arrived (a right-click
that focused the clicked control, or the element Shift+F10 was pressed on), `showAt()`'s
`returnFocusTo`, or an element inside its `contextElement`; a press-and-hold that left focus on an
unrelated control elsewhere returns nowhere, so no virtual keyboard reopens and nothing scrolls. An
outside pointer lets the pointer keep its own focus. **Tab or Shift+Tab out of the menu closes it
without moving focus back**; this deliberately differs from `lr-dropdown`, which stays open when
focus tabs away. Tab still moves between a consumer `lr-menu`'s header / footer controls and the
rows without closing. Scrolling or a viewport resize that moves the anchor by more than 2 px, or
removing the anchor, closes the menu (once, even if `lr-hide` is vetoed); focus then returns
without scrolling, and only if it was inside the menu. Layout shift, the anchor's own resize and
transforms (a hover lift, a press spring-back) never close it. The removal check observes the
anchor's box, so an anchor with no box of its own (an inline text run, `display: contents`) is
not noticed until the next scroll.

**Keyboard.** In the region, Shift+F10 or the ContextMenu key (no Ctrl / Alt / Meta) opens the
menu below the focused element and focuses the first enabled row; while open it silently
re-anchors. Every other key is untouched. In the open menu the `lr-menu` engine applies: arrows,
Home / End, type-ahead, Enter / Space, submenu keys that mirror under RTL, and Escape (innermost
submenu first). Shift+F10 / ContextMenu inside the menu is swallowed.

**Nesting and surfaces.** With nested regions the innermost **enabled** region wins; a disabled
inner region lets the gesture reach the outer one, and a vetoed inner one blocks it. A gesture
that starts inside an open menu, or inside an open `lr-dropdown` / `lr-popover` surface placed in
the region, never opens a second menu (a gesture on such a dropdown's slotted trigger is handled
normally). Right-clicks on rows, labels, separators and popup padding are prevented, so no native
menu appears on top of the custom one; an editable header / footer field keeps its native menu.

**Slots:** `trigger` — the region: any number of elements; every gesture that starts inside them,
including inside their open shadow roots, is considered. Default — the menu content above. **Rows
must be direct children** of `lr-context-menu` (or of the consumer `<lr-menu>`): a wrapper element
around rows silently removes them from keyboard navigation and selection.

**CSS parts:** `popup` — the positioned menu surface; `content` — its padding wrapper. **Custom
state:** `:state(open)` while open, for example
`lr-context-menu:state(open) [slot='trigger'] { outline: 2px solid var(--lr-color-brand); }`.
The host and its region wrapper are `display: contents`, so the region lays out in the host's
parent; set `lr-context-menu { display: block }` to get a box.

**Themeable custom properties** (inherited into the composed surface; set them on
`lr-context-menu` or any ancestor): `--max-width`
(`var(--lr-overlay-max-inline-size, var(--lr-size-20rem))`), `--lr-overlay-surface`
(`var(--lr-color-surface-overlay)`), `--lr-overlay-border` (`var(--lr-color-border-subtle)`),
`--lr-overlay-radius` (`var(--lr-radius)`), `--lr-overlay-shadow-anchored` (`var(--lr-shadow-m)`),
`--lr-overlay-max-inline-size` (`var(--lr-size-20rem)`), and `--show-duration` / `--hide-duration`
(`var(--lr-transition-fast)`). Row styling uses the `--lr-menu-item-*` properties on your rows.
The popup always uses fixed positioning (the anchor is a viewport point), so the cascading
`--lr-positioning-strategy` is not consulted. Like `lr-dropdown`, it is promoted to the top layer
only when a transformed, filtered or contained ancestor (such as an `lr-virtual-list` row) would
trap it; otherwise it stacks like `lr-dropdown` (`--lr-overlay-stack-index`). Motion uses the `dropdown.show` /
`dropdown.hide` registry entries, flattened under `prefers-reduced-motion`; overriding those
entries also affects context menus.

**Accessibility.** The region gets no role or ARIA (there is no trigger control). For Shift+F10 to
be reachable the region must contain a focusable element, or give one slotted element
`tabindex="0"`. Offer every critical action through another visible path as well. The menu
exposes `role="menu"` and the usual row roles; focus entering it announces it, so no live region
is used.

**shadcn Context Menu mapping:**

| shadcn part | Lyra composition |
|---|---|
| Item | `lr-menu-item` / `lr-dropdown-item` |
| CheckboxItem | the same with `type="checkbox"` |
| RadioGroup / RadioItem | the same with `type="radio" group="…"` (the `group` attribute replaces the wrapper) |
| Label | `lr-menu-label` |
| Separator | `<hr>` |
| Group | **no wrapper element**: place the rows directly and delimit the group with `lr-menu-label` and / or `<hr>` |
| Shortcut | `<span slot="details">` on the row, plus your own `aria-keyshortcuts` |
| Sub / SubTrigger / SubContent | a row with `slot="submenu"` children, or `<lr-menu slot="submenu">` |
| destructive item | `variant="danger"` |
| disabled item | `disabled` |

**Recipe — per-target items.** Fill or filter the rows synchronously inside `lr-show`, reading the
gesture's `path`. `target` can sit inside a component's shadow root (a right-click on an
`lr-button` reports the button's internal element), where `target.closest()` stops at the shadow
boundary, so search `path` instead:

```html
<lr-context-menu id="rows">
  <div slot="trigger">
    <div data-id="7"><lr-button>Invoice 7</lr-button></div>
    <div data-id="8"><lr-button>Invoice 8</lr-button></div>
  </div>
  <lr-menu-item value="open">Open</lr-menu-item>
  <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
</lr-context-menu>
<script type="module">
  const menu = document.querySelector('#rows');
  let rowId;
  menu.addEventListener('lr-show', (event) => {
    const row = event.detail.path.find((el) => el.matches('[data-id]'));
    if (!row) return event.preventDefault(); // not on a row: keep the platform menu
    rowId = row.getAttribute('data-id');
  });
  menu.addEventListener('lr-select', (event) => {
    console.log(event.detail.item.value, rowId);
  });
</script>
```

**Recipe — native menu for editable targets.** The component does not exempt text fields in the
region automatically. Veto `lr-show` for them so the platform menu (paste, spelling) appears:

```js
menu.addEventListener('lr-show', (event) => {
  const target = event.detail.target;
  if (target?.matches('input, textarea, [contenteditable]') || target?.isContentEditable) {
    event.preventDefault();
  }
});
```

**Recipe — iOS callout.** To keep the native link / image callout on specific elements, opt them
back in and veto `lr-show` for the same targets:

```css
lr-context-menu a[href],
lr-context-menu img {
  -webkit-touch-callout: default;
}
```

**Recipe — maps and canvases.** `lr-map`'s map peer prevents `contextmenu` for right-drag rotation
(and whenever the map itself listens for `contextmenu`), and the component ignores an event that
is already prevented, so a region over a map never opens on its own. Open it from the map's own
event instead, registered after `lr-map-load` (`mapEl.map` is `undefined` until then):

```js
mapEl.addEventListener('lr-map-load', () => {
  mapEl.map.on('contextmenu', (e) => {
    menu.showAt(
      { x: e.originalEvent.clientX, y: e.originalEvent.clientY, contextElement: mapEl },
      { returnFocusTo: mapEl },
    );
  });
});
```

The same pattern fits a `<canvas>`: call `showAt()` from its own `contextmenu` handler (and
`preventDefault()` there).

**Recipe — composing with `lr-data-grid`.** Wrap the grid in the region and leave
`lr-cell-contextmenu` **un-prevented** (a prevented native event is ignored here). For a
right-click and for Shift+F10 the grid's `lr-cell-contextmenu` arrives **before** `lr-show`, so
store its `rowKey` and read it in `lr-show`. For the ContextMenu key the grid only emits
`lr-cell-contextmenu` from the platform's follow-up `contextmenu`, which arrives **after**
`lr-show` and not on every OS; update the rows again in `lr-cell-contextmenu` when the menu is
already open (rows changed while open are repaired by the engine), or fall back to
`selectedRowKeys`.

**Limitations.** Gestures inside `<iframe>` content belong to the frame's document and are never
seen. A scroller inside a closed shadow root is not observed by the anchor watcher. Two copies of
the library on one page arbitrate an opened gesture through `defaultPrevented` and open surfaces by
tag name, but a veto only claims the gesture within one copy.

## `lr-spinner`

An indeterminate busy indicator with a localized, deliberately non-live `role="progressbar"`
name. Mounting ordinary loading UI therefore does not create a false status announcement.

**Properties:** `labelPlacement: 'none' | 'after' = 'none'` (attribute `label-placement`, reflected)
and `accessibleLabel: string | null = null` (attribute **`aria-label`**, not `accessible-label`) —
names `[part="base"]`'s `role="progressbar"`; unset falls back to the localized "Loading…".

**Events:** none.

**Slots:** default — optional label text. `label-placement="after"` renders it inline next to the
indicator and its visible accessible text becomes the progressbar name unless `aria-label`
overrides it. Hidden, inert, `display:none`, `content-visibility:hidden`, and `aria-hidden`
descendants are excluded from that name. A `visibility:hidden|collapse` wrapper suppresses its own
text while a descendant that restores `visibility:visible` remains part of the name.
These rules and live mutation tracking cross nested forwarding slots, including assigned-node
replacement; no wrapper re-render is required.
`'none'` (the default) applies the native `hidden` state to the label wrapper, removing it from both
rendering and the accessibility tree; the progressbar then uses `aria-label` or the localized
"Loading…" fallback.

**CSS parts:** `base` and `spinner` are aliases on the same indeterminate `role="progressbar"`
outer wrapper (no `aria-valuenow` and no live-region semantics);
`spinner-indicator` is the animated `aria-hidden` ring, and `label` is the default-slot wrapper.

**Themeable custom properties:** `--lr-spinner-size` (default `var(--lr-size-1-25rem)` — both
dimensions), `--lr-spinner-track-width` (default `var(--lr-border-width-medium)` — ring thickness),
`--lr-spinner-duration` (default `var(--lr-transition-ambient)` — the duration _and_ easing of one
full rotation; the animation is dropped entirely under `prefers-reduced-motion: reduce`). The ring
colors come from `--lr-color-brand`/`-brand-quiet`. Upstream aliases are `--track-width`,
`--track-color`, `--indicator-color`, and `--speed`.

## `lr-progress-bar`

A determinate or indeterminate progress bar with an independently visible label and optional
formatted percentage.

**Properties:** `value` (reflected), `max`, `indeterminate`, `variant`, `showValue` (`show-value`), and
`label` (mapped accessible-name property), plus `accessibleLabel` (`accessible-label`) — the
retained Lyra compatibility spelling for this component. It is not a library-wide attribute:
spinner, rating, and tooltip expose their explicit host name through `aria-label`. Host
`aria-label` has highest precedence here too. Also
`size: LyraSize = 'm'` (reflected) — `'2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' |
'large'`. Track/indicator thickness tier, on the shared six-step ladder: `0.25rem` (`2xs`),
`0.375rem` (`xs`), `0.625rem` (`s`/`small`), `1rem` (`m`/`medium`, unchanged from before this
property existed), `1.25rem` (`l`/`large`), `1.5rem` (`xl`) — each value feeds
`--lr-progress-track-height`'s private default. An explicit `--lr-progress-track-height` (or the
upstream `--track-height`/`--height` aliases) still wins over every tier.

The rendered progressbar exposes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` when
determinate. Slotted label content is always visible and names the progressbar unless an explicit
label overrides it; `show-value` controls only whether the locale-formatted percentage is appended.
Live label mutations and reassignment stay synchronized through nested forwarding slots. Hidden,
inert, CSS-hidden and `aria-hidden` branches do not name the role; a visible descendant can restore
text suppressed only by an ancestor's `visibility:hidden|collapse`. Host `aria-label` precedence is
presence-based, so an explicitly empty value remains empty rather than invoking a fallback.

**Slots:** default — label content; `label` — compatibility alias for the default slot.
**CSS parts:** `base` and `progress-bar` are aliases on the same progressbar; `track`, `indicator`,
`label`.
**Themeable custom properties:** `--lr-progress-track-height` (default
`var(--lr-progress-height, var(--_lr-progress-track-height))`; `--lr-progress-height` is the legacy
fallback, and the private `--_lr-progress-track-height` is the `size` property's own tier value,
`1rem` at the `m` default, unchanged),
`--lr-progress-track-color` (default `var(--lr-color-brand-quiet)`),
`--lr-progress-track-radius` (default `var(--lr-radius-pill)`; `indicator`'s `border-radius:
inherit` picks up the same value, so retuning the track retunes both without a
`::part(track)`/`::part(indicator)` rule),
`--lr-progress-indicator-color` (default `var(--lr-progress-indicator-variant-color)`), and
`--lr-progress-label-color` (default `var(--lr-color-text)`). Upstream aliases are `--height` and
`--track-height`, plus `--track-color`, `--indicator-color`, and `--label-color`.

`--lr-progress-indicator-variant-color` is the palette slot the active `variant` feeds: it resolves
to that variant's loud fill from the shared semantic grid (`var(--lr-color-fill-loud)`), falling back
to `var(--lr-color-brand)` on an element that has not updated yet. It sits _inside_
`--lr-progress-indicator-color` and the upstream `--indicator-color` alias in the fallback chain, so
setting either of those still wins outright and the indicator renders exactly as it did before
`variant` support existed. Set the variant-color slot instead when you want to retheme one semantic
tone while leaving the rest of the grid alone.

**Additional API surface:**

- `--lr-progress-duration` — Indeterminate sweep timing. Default: `var(--lr-transition-ambient)`.

## `lr-progress-ring`

A circular progress indicator with the same value contract as `lr-progress-bar`.

**Properties:** `value: number = 0` (reflected), `max: number = 100`, `indeterminate: boolean = false`
(reflected), `variant: LyraProgressVariant = 'brand'` (reflected, added in 9.0.0 — matches sibling
`lr-progress-bar`'s semantic-palette vocabulary: `neutral`/`brand`/`success`/`warning`/`danger`),
`showValue: boolean = false` (attribute `show-value`),
`label: string = ''` (the mapped accessible-name property), and
`accessibleLabel: string = ''` (attribute `accessible-label`; a Lyra compatibility
accessible-name spelling retained by this progress component, while several sibling components use
`aria-label` directly). Also
`size: LyraSize = 'm'` (reflected) — `'2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' |
'large'`. Outer diameter tier, on the shared six-step ladder: `1.25rem` (`2xs`), `1.75rem` (`xs`),
`2.25rem` (`s`/`small`), `2.5rem` (`m`/`medium`, unchanged from before this property existed),
`3rem` (`l`/`large`), `3.5rem` (`xl`) — each value feeds `--lr-progress-ring-size`'s private
default. An explicit `--lr-progress-ring-size` (or the upstream `--size` alias) still wins over
every tier. Matching sibling `lr-progress-bar`'s own `size`, this ladder scales exactly one
dimension — `--lr-progress-ring-track-width`/`--lr-progress-ring-indicator-width` and the center
label's font size are untouched by it. Host
`aria-label` takes precedence; otherwise the name falls back to `label`, `accessibleLabel`, the
visible default- or `label`-slot text when supplied, then the localized "Progress".
Non-finite/out-of-range `value`/`max` are normalized (`max <= 0` falls
back to `100`, `value` clamps to `[0, max]`) rather than producing NaN geometry.
**Slots:** default — replaces the built-in center label, which otherwise renders the rounded
percentage **only when `show-value` is set** (and nothing at all while `indeterminate`); `label` —
named alias for center content, matching `lr-progress-bar`.
**Breaking in 10.0.0:** a determinate ring used to render its percentage unconditionally, with no way
to suppress it short of slotting replacement content. It now gains `showValue`/`show-value` defaulting
to `false`, exactly matching `lr-progress-bar` — which is what "the same value contract as
`lr-progress-bar`" above has always claimed but did not deliver. Add `show-value` to keep the
percentage. `aria-valuetext` still carries it regardless, mirroring `lr-progress-bar`'s own
independence there, so the accessible value is unaffected.
Its accessible text uses the same visibility filtering, forwarding-slot mutation/reassignment
tracking, and explicit-empty host-label precedence as `lr-progress-bar`.
**Live members:** `indicator: SVGCircleElement | null` returns the rendered indicator circle (or
`null` before rendering). `indicatorOffset: number` returns the normalized stroke offset used for
that circle, including the indeterminate value. The indicator node remains stable across ordinary
value updates and reconnection while the offset updates live.
**CSS parts:** `base` and `progress-ring` are aliases on the same progressbar; `track`, `indicator`,
`label`.
**Themeable custom properties:** `--lr-progress-ring-size` (default
`var(--size, var(--_lr-progress-ring-size))`; `--size` is the upstream alias, and the private
`--_lr-progress-ring-size` is the `size` property's own tier value, `2.5rem` at the `m` default,
unchanged — the ring's inline and block size), `--lr-progress-ring-track-width` (default
`var(--lr-theme-progress-ring-track-width, var(--lr-size-4px))` — a dedicated, opt-in theme hook, set
on `:root` or any ancestor to retune this ring specifically; it stays unset, and `4px` applies, whether
or not `theme.css` is imported, unlike the widely-shared `--lr-theme-border-width-thick` this used to
bridge directly, which `theme.css` declares at `3px`),
`--lr-progress-ring-track-color` (default `var(--lr-color-brand-quiet)`),
`--lr-progress-ring-indicator-width` (defaulting to the track width),
`--lr-progress-ring-indicator-color` (default
`var(--lr-progress-ring-indicator-variant-color)`, so the active `variant` supplies the color),
`--lr-progress-ring-indicator-variant-color` (added in 9.0.0, same override precedence as
`lr-progress-bar`'s `--lr-progress-indicator-variant-color` — the palette slot `variant` resolves
into),
`--lr-progress-ring-indicator-transition-duration` (default `var(--lr-transition-base)`), and
`--lr-progress-duration` (default
`var(--lr-transition-ambient)` — the indeterminate spin period, the same token and the same default
as `lr-progress-bar`'s sweep, so it flattens under `prefers-reduced-motion: reduce` with the rest of
the ambient motion).
Upstream aliases are `--size`, `--track-width`, `--track-color`, `--indicator-width`,
`--indicator-color`, and `--indicator-transition-duration`.

## `lr-badge` and `lr-tag`

Compact status labels. `LyraTag` extends `LyraBadge`, so the two share one visual contract; `lr-tag`
adds tag semantics and an optional remove affordance. Both are static text by default, matching the
mirrored upstreams and avoiding repeated announcements when a category badge is re-rendered.
Authors can opt a genuinely changing badge into live semantics with `role="status"`; that and every
other author-supplied role remain authoritative across updates, hydration, and reconnect.

**Visual break in 8.0.0 — a badge is no longer a pill by default.** Both components used to render
fully-rounded ends unconditionally. `--lr-badge-radius` now defaults to `var(--lr-radius)` (a rounded
rectangle) and the pill treatment moved behind the new opt-in `pill` boolean. Existing markup keeps
its corner radius only if you add `pill`, or set `--lr-badge-radius: var(--lr-radius-pill)` once at
the app level.

**Properties** (all are declared by `lr-badge` and inherited by `lr-tag`; `lr-tag` adds the
`variant="text"` spelling plus `withRemove` / `removable`):

- `variant: 'neutral' | 'brand' | 'primary' | 'success' | 'warning' | 'danger' = 'neutral'`
  (reflected) — the semantic palette. `primary` renders through the same brand palette while
  remaining `primary` on property reads, selectors, serialization and reflection. `lr-tag`
  additionally accepts and preserves `text`, rendering the neutral plain treatment.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'` (reflected) — the same visual-density scale
  `<lr-chip>` uses, for typography/padding/minimum block size; `m` preserves the original badge
  dimensions. Both short and long upstream spellings round-trip verbatim while resolving to the
  same private effective size for rendering.
- `appearance: 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'filled-outlined'`
  (reflected) — **new in 8.0.0.** The second visual axis: `variant` picks the palette, `appearance`
  decides how much of it lands on the fill, the border and the text. `filled-outlined` (the default)
  is quiet tint + loud border + loud text, i.e. exactly the pre-8.0.0 treatment; `filled` drops the
  border, `outlined` drops the fill, `accent` fills solidly with on-loud text, and `plain` drops both
  fill and border while keeping the label color. The border-less appearances use a `transparent`
  border rather than `none`, so switching appearance never changes the badge's layout box.
- `pill: boolean = false` (reflected) — **new in 8.0.0.** Fully-rounded ends instead of the default
  rounded rectangle; see the visual break above. Since it defaults to `false`, `pill="false"` is not
  a way to switch it off — remove the attribute, or assign `.pill = false`.
- `attention: 'none' | 'pulse' | 'bounce' = 'none'` (reflected) — **new in 8.0.0.** An opt-in,
  infinitely-looping attention animation for a badge that has to be noticed: `pulse` draws an
  expanding ring, `bounce` hops the surface vertically (block-direction, so it needs no RTL
  mirroring). Both stop outright — not merely shorten — under `prefers-reduced-motion: reduce`.
  The default does not materialize an attribute; an explicit `attention="none"` is authoritative
  and suppresses the `pulse` shorthand.
- `pulse: boolean = false` (reflected) — upstream-compatible shorthand for the pulse attention
  treatment while the `attention` attribute is omitted. Any explicit attention value wins. Lyra's
  intentional `variant="neutral"` and `appearance="filled-outlined"` defaults remain unchanged
  because the two pinned upstreams disagree on both defaults.
- `withRemove: boolean = false` (attribute `with-remove`, reflected) — **`lr-tag` only, new in
  8.0.0.** Renders the remove affordance. `lr-badge` never renders one, even if the attribute is
  present on the markup.
- `removable: boolean = false` (attribute `removable`) — **`lr-tag` only.** Shoelace-compatible
  alias for `withRemove`; reading either property reports the shared state. Either authored
  attribute keeps removal enabled until both are absent. Assigning `false` through either property
  clears both attributes, while assigning `true` reflects that property's own spelling.

**Events:** `lr-remove` — noncancelable, no detail, bubbles and composes. Emitted by `lr-tag` only (a
badge emits nothing at all) when the remove button is activated by click or by Enter/Space while
focused; it is a real native `<button>`, so both come for free. Only rendered, and therefore only
fired, while `withRemove` / `removable` is set, and the event's `target` is the tag itself.

Like `<lr-chip>`, a removable `lr-tag` is controlled: activation only announces the request. The
tag remains connected even if a listener calls `preventDefault()` (the event is not cancelable),
and the consumer removes it by updating the collection that rendered it.

If that controlled listener synchronously removes the focused tag, or a direct property write
removes its action, focus moves to the nearest available composed action. Focus explicitly moved by
the listener is preserved.

For a removable tag, `focus(options?)`, `blur()`, and `click()` delegate to its native remove
button. A plain tag's `click()` retains native `HTMLElement.click()` behavior and dispatches one
host `click`; its `focus()` has no delegated target. Setting `withRemove` / `removable` false
revokes remove-button focus and activation synchronously before the outgoing button is rerendered,
so same-task `click()` uses the plain host behavior instead of firing `lr-remove`. `blur()` remains
available during that same-task window so it can release the stale focused button; after render
there is no owner to blur.

**Slots:** default (the label), `start` (content before the label, typically an icon) and `end`
(content after it) — both new in 8.0.0. Each wrapper collapses entirely (`display: none`, so no
stray gap) while its slot is empty, and is seeded from the light-DOM children before the first
render so declarative content never flashes hidden for a frame. Mark purely decorative slotted
content `aria-hidden`.

**CSS parts:** `base` and `badge` are aliases on the same badge/tag surface; `start` and `end` (the slot wrappers, hidden entirely
while empty), `content` (the wrapper around the default slot — this is the part that truncates with
an ellipsis, deliberately not `base`, so the tag's oversized remove hit target can overhang the
compact surface without being clipped), and `remove-button` (`lr-tag` only, rendered only while
`withRemove` / `removable`). The button also carries Shoelace's `remove-button__base` alias, so
either part name styles the same native button.

**Themeable custom properties.** Three layers, so a consumer can retune one without restating the
others. Public hooks are consumed through private use-site defaults instead of being redeclared on
the host, so values set directly or inherited from a theme ancestor both win. The same contract
reaches `lr-tag` unchanged.

_Overrides_ — undeclared by default, so they still inherit from a consumer's own ancestor rule, and
win over whatever `variant`/`appearance` resolved: `--lr-badge-background` (falls back to
`--lr-badge-fill`), `--lr-badge-border` (falls back to `--lr-badge-stroke`), `--lr-badge-color`
(falls back to `--lr-badge-text`).

_Palette — what `variant` chooses_ (new in 8.0.0): `--lr-badge-tint` (private default
`var(--lr-color-surface)`, the quiet fill; each non-neutral variant changes that private default to
`var(--lr-color-fill-quiet)`, which the shared variants sheet has already re-pointed at that
variant's row of the semantic grid), `--lr-badge-solid` (private default
`var(--lr-color-fill-loud)`, the loud fill used by `appearance="accent"`), `--lr-badge-edge`
(private default `var(--lr-color-border-subtle)`, the border color), `--lr-badge-ink` (private default
`var(--lr-color-text)`, the text color) and
`--lr-badge-on-solid` (default `var(--lr-color-on-loud)`, the text color that stays legible on
`--lr-badge-solid`). An inherited or direct public palette value remains authoritative. Neutral is
the only variant whose border and text colors differ, which is why `-edge` and `-ink` are separate
slots rather than one loud color.

_Surface — what `appearance` routes onto the box_ (new in 8.0.0): `--lr-badge-fill` (default
`var(--lr-badge-tint)`), `--lr-badge-stroke` (default `var(--lr-badge-edge)`) and `--lr-badge-text`
(default `var(--lr-badge-ink)`). Set one of these to retune a single appearance without touching the
palette.

_Density and shape:_ `--lr-badge-font-size` (default `var(--lr-font-size-sm)`),
`--lr-badge-padding-inline` (default `var(--lr-space-s)`) and `--lr-badge-min-height` (default
`var(--lr-size-1-25rem)`) — the trio each private effective-size rule rewrites to that step's font size,
inline padding and minimum block size; the `m` defaults above exactly reproduce the pre-`size` fixed
badge treatment. `--lr-badge-gap` (default `var(--lr-space-2xs)`, new in 8.0.0) is the space between
the `start` slot, the label and the `end` slot — it collapses on its own when a wrapper is empty,
because the empty wrapper is `display: none` rather than zero-width. `--lr-badge-radius` (default
`var(--lr-radius)`; `pill` raises it to `var(--lr-radius-pill)`) is `[part='base']`'s corner radius,
retunable without a `::part(base)` rule and, unlike the density trio, does not vary by `size` — the
same `--lr-button-radius` pattern.

_Attention_ (all new in 8.0.0): `--lr-badge-attention-duration` (default
`var(--lr-duration-ambient)` — one cycle of the animation), `--lr-badge-attention-easing` (default
`var(--lr-easing-emphasized)` — kept a separate token from the duration so the `animation` shorthand
expands to exactly one timing function), `--lr-badge-pulse-color` (default
`color-mix(in srgb, currentColor 40%, transparent)` — the expanding ring's color; upstream alias
`--pulse-color`),
`--lr-badge-pulse-spread` (default `var(--lr-size-0-25rem)` — how far the ring expands) and
`--lr-badge-bounce-distance` (default `var(--lr-size-0-1875rem)` — the hop's peak travel).

_`lr-tag`'s own two_ (new in 8.0.0): `--lr-tag-remove-radius` (default `var(--lr-badge-radius)`, so
retuning the tag's corner retunes the remove button's with it) and
`--lr-tag-remove-hover-background` (default `color-mix(in srgb, currentColor 16%, transparent)` —
the remove button's `:hover` fill).

**Known gotchas:**

- The remove button's hit target meets the shared `--lr-icon-button-size` minimum in both axes while
  the visible glyph stays compact. Its full allocation participates in layout with no negative
  margins, so adjacent compact tags retain disjoint targets.
- Its accessible name is computed from the default slot's own text ("Remove {label}", localized;
  bare "Remove" for a label-less tag) and re-derived live when that text changes. Text inside the
  decorative `start`/`end` slots never leaks into it. Visible accessible text, forwarding-slot
  reassignment and external assigned-node mutations stay synchronized; hidden/inert/CSS-hidden/
  `aria-hidden` branches are excluded. A host `aria-label`, including an explicit empty value,
  names a single aggregate `role="group"`; it is not copied to the nested action. The remove button
  retains its purpose-specific visible-label/localized-fallback name.
- `appearance` and `variant` are orthogonal: `appearance="plain"` on `variant="danger"` still reads
  as danger, because the palette is chosen before the surface routing.

```html
<lr-badge variant="success" appearance="accent" pill size="s">
  <svg slot="start" aria-hidden="true" width="12" height="12">
    <!-- icon -->
  </svg>
  Live
</lr-badge>

<lr-tag variant="brand" appearance="outlined" with-remove>Design</lr-tag>
<script type="module">
  import "@aceshooting/lyra-ui/components/overlays/badge/badge.js";
  import "@aceshooting/lyra-ui/components/overlays/badge/tag.js";

  document.querySelector("lr-tag").addEventListener("lr-remove", (e) => {
    e.target.remove(); // in an app, update the backing collection instead
  });
</script>
```

## `lr-alert`

A closed-by-default alert that carries the pinned Shoelace alert surface under the `lr-` prefix,
plus one additive Lyra property (`size`) that is inert until you set it.
Use `lr-callout` for Lyra/Web Awesome's always-open inline callout contract; use `lr-alert`
when migrated markup relies on `open`, timed dismissal, countdown, or identity-preserving
`toast()` behavior.

**Properties:**

- `open: boolean = false` (reflected) — controls visibility. Initial `open` markup establishes
  state without a transition event; later property or attribute changes run the full lifecycle
  below.
- `closable: boolean = false` (reflected) — renders a localized close action.
- `size?: LyraSize` (reflected, unset by default) — density tier on the library's one size ladder:
  `'2xs'|'xs'|'s'|'m'|'l'|'xl'`, or the Web Awesome / Shoelace spellings `'small'|'medium'|'large'`,
  which are accepted as authored rather than rewritten to the short form. This is the one Lyra
  addition on top of the pinned Shoelace surface, and it is opt-in for that reason: unset, the panel
  keeps the padding it always had and the text size it inherits, so migrated markup renders
  unchanged. A tier scales the panel padding and text together and takes `lr-callout`'s values for
  both, so a tiered alert and a tiered callout of the same size line up in one column. Their
  **untiered** states are not interchangeable, deliberately: with no `size` this panel keeps a fixed
  gutter and inherits the ambient text size (its exact pre-ladder rendering), while an untiered
  `lr-callout` reads the ambient form-control slots and falls back to the shared `m` padding and
  `--lr-font-size-m`. Pinning a default tier here would resize every alert that shipped before this
  property existed. Two things deliberately do not vary by tier, also matching `lr-callout`: the gap
  separating icon, message and close action (it separates three boxes rather than setting density)
  and the leading icon glyph size (a status affordance bounded by the shared tappable-target token).
  The close action also keeps the shared tappable-target floor at every tier — a WCAG 2.5.8 minimum
  rather than a density knob — and its optical pull-out toward the panel edge is clamped to the
  tier's own gutter, so the two smallest tiers cannot push it through the panel's clipped border. An
  unsupported value normalizes to the omitted state and removes the attribute.
- `variant: 'primary' | 'success' | 'neutral' | 'warning' | 'danger' = 'primary'` (reflected) —
  `primary` resolves through Lyra's shared brand semantic tokens. Unsupported attributes and
  untyped property writes normalize to reflected `primary`.
- `duration: number = Infinity` — milliseconds before automatic dismissal. `Infinity` stays open;
  hover or focus pauses the timer, and leaving interaction restarts the full duration.
- `countdown: 'rtl' | 'ltr' | undefined` (reflected, unset by default) — adds a decorative visual
  bar that empties in the requested physical direction. Its motion is removed under
  `prefers-reduced-motion: reduce`. Unsupported attributes and untyped property writes normalize
  to the omitted state and remove the attribute.
- `role: string | null = 'alert'` (reflected) — the light-DOM semantic owner. The default is a
  reactive initial value, so SSR/no-JS output serializes it before `connectedCallback`; an authored
  alternate role such as `status` remains authoritative.

**Methods:** `show(): Promise<void>` and `hide(): Promise<void>` resolve after their respective
after-event. `toast(): Promise<void>` moves the same alert instance into Lyra's singleton logical
top-end toast region, shows it, and resolves after it hides and is removed. Keep the reference to
reuse the same identity with another `toast()` call. An alert adopted into another same-origin
document uses that document's toast region, timers, motion preference, and focus realm. If external
DOM reconciliation removes a toast without hiding it, the pending promise settles after that
disconnect proves lasting (a synchronous move into the toast region does not count), stale
listeners are released, and a later `toast()` starts a fresh lifecycle.
The region admits three active alerts and twenty hidden/inert queued alerts in FIFO order. An
already-open alert also becomes explicitly hidden and inert while queued; promotion preserves that
accepted state without replaying `lr-show`. If focus was inside that surface, queue admission repairs
it to an available adjacent control without overriding a newer external focus destination. An initial
`lr-show` veto removes and settles that toast attempt; a later `toast()` uses a fresh promise and can
retry. Re-entering `show()` or the same `open` request during the before-event coalesces, so an outer
veto cannot be bypassed by a nested request.
In an adopted document without an upgraded bounded toast controller, `toast()` fails closed by
removing the unavailable request and settling its unchanged `Promise<void>` rather than appending to
an unbounded fallback element. Region ownership is reasserted when an alert moves between stacks;
stale observations from its previous stack cannot change its active/queued state. A lasting region
disconnect discards managed work, so reconnecting that old region cannot resurrect an already-settled
alert toast.

**Events:** `lr-show`, `lr-after-show`, `lr-hide`, and `lr-after-hide` all bubble, compose, carry no
detail. `lr-show` and `lr-hide` are cancelable veto points; their `lr-after-*` counterparts are
noncancelable. A transition interrupted by the opposite state does not emit the stale after-event.
When an accepted hide removes the focused close action, focus moves to the nearest available
composed action. A veto keeps focus in place, and a listener-selected external destination wins.
An accepted show/hide interrupted by a same-task move resumes and emits exactly one matching
after-event before its method resolves. A lasting disconnect settles the method without emitting on
the detached node; reconnecting the same inline alert later resumes the pending terminal lifecycle
once. Toast-owned work instead settles and is discarded when its region disconnect proves lasting.

**Slots:** default message content; `icon` for an optional decorative leading icon whose flattened
subtree remains visible but is inert and aria-hidden.

**CSS parts:** `base`, `icon`, `message`, and `close-button` / `close-button__base` on the same
native close button. The pinned surface exposes no custom states, form association, native-event
relays, or delegated native methods.

**Themeable custom properties:** the close button's two state hooks are
`--lr-alert-close-hover-bg` (its `:hover` surface; default `color-mix(in oklab, transparent,
var(--lr-color-mix-partner) var(--lr-color-mix-hover))`) and `--lr-alert-close-active-bg` (its
`:active` surface, scoped independently from the hover property; default `color-mix(in oklab,
transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))`). Each is an inline fallback
at the relevant state, so setting one on the alert or an ancestor rethemes only that close-button
state.

By default the light-DOM `<lr-alert>` host owns `role="alert"`, so initially-open/static alerts and
alerts shown later expose one assertive, content-derived semantic surface without duplicating it in
a shadow or shared live region. The role is present in server output; an explicit authored role is
preserved. The optional icon wrapper remains visible, but its flattened subtree is inert
and `aria-hidden`; the close action remains independently accessible through Lyra's localized
`close` string. Layout uses logical properties, wraps unbroken content at 320px, and the toast path
reuses the existing Lyra toast layer instead of creating a second placement system.

```html
<lr-alert
  id="session-alert"
  closable
  duration="10000"
  countdown="rtl"
  variant="warning"
>
  <svg slot="icon" aria-hidden="true"><!-- warning icon --></svg>
  Your session will expire soon.
</lr-alert>
<button type="button" onclick="document.querySelector('#session-alert').show()">
  Show alert
</button>

<script type="module">
  import "@aceshooting/lyra-ui/components/overlays/alert/alert.js";

  const alert = document.querySelector("#session-alert");
  alert.addEventListener("lr-after-hide", () => console.log("Alert is hidden"));
</script>
```

## `lr-callout`

An inline status, warning, or error surface. Set `inline` for lightweight reactive form or mutation
errors without panel chrome.

**Properties:** `variant: 'neutral'|'brand'|'success'|'warning'|'danger' = 'brand'` (reflected when
explicit — an unset nested callout inherits its ancestor's semantic colour context without
materializing a `variant` attribute. Explicitly writing even the same-default `brand` materializes
the attribute and pins the local brand palette; removing the attribute restores contextual
inheritance),
`appearance: 'accent'|'filled'|'outlined'|'plain'|'filled-outlined'` (reflected, with no explicit
default — when set, controls how much of the active variant palette is spent on fill, border, and
text; leaving it unset preserves the established quiet-fill/loud-edge treatment),
`size: LyraSize = 'm'` (reflected when explicit — **new in 8.0.0**; visual density on the library's shared ladder,
accepting both spellings of the aliased tiers (`s`/`small`, `m`/`medium`, `l`/`large`) so markup migrated
from `wa-callout` needs no attribute rewrite. An unset nested callout inherits its ancestor's size
context; standalone fallback is `m`. Explicitly writing even the same-default `m` pins the local
medium mapping, and removing the attribute restores contextual inheritance), `heading: string = ''`,
`headingLevel: LyraHeadingLevel = '3'` (attribute `heading-level`, reflected; `1`–`6` expose the
property and rich-slot heading wrapper at that semantic level, invalid untyped values retain level
3, and `none` is the visual-only opt-out),
`closable: boolean = false` (reflected), `inline: boolean = false` (reflected),
`announce: boolean = false` (reflected — opts the callout into announcing the content it already
carries when it first mounts; see the announcement paragraph that closes this section),
`open: boolean = true`
(reflected as a presence attribute — `open="false"` is accepted in plain markup; `false` removes the
semantic content and hides the host surface), and `accessibleLabel: string = ''`
(`accessible-label`; used only when the host has no `aria-label` attribute). A host `aria-label`
has highest precedence by presence, including an explicitly empty value.

Every reflected closed set normalizes identically from markup and untyped JavaScript writes:
unsupported `variant`, `size`, and `heading-level` values become reflected `brand`, `m`, and `3`,
while an unsupported `appearance` becomes the omitted state.

**Events:** cancelable `lr-close` (no detail); the callout sets `open = false` after the event
unless a listener calls `preventDefault()`.
When accepted close or a direct `open = false` write removes the focused close action, focus moves
to the nearest available composed action. Vetoed close and newer external focus are preserved.

**Slots:** default message, `heading` (rendered alongside the `heading` property inside the
configured semantic heading wrapper), `icon`.

**CSS parts:** `base` (the transparent grid wrapper inside the host-owned surface), `icon`
(hidden while the `icon` slot is empty), `content`, `heading`,
`message` (wrapper around the default slot), `close-button` (the close control, always
at least `--lr-icon-button-size` in both the panel and `inline` treatments), `close-button__control`,
`close-icon` (the visible "×" glyph inside it — this is what shrinks under `inline`, so the hit
target never does).

As of 16.0.0 the close control is a composed `<lr-icon-button>`: `close-button` names that host —
it still owns the grid placement, the accessible name and the click/focus API — while
`close-button__control` is its own native `<button>`, where the background, radius, hover/press
fill, focus ring and hit-area floor are painted. A rule that sets `background`, `border`,
`padding` or `outline` through `::part(close-button)` must move to `::part(close-button__control)`
or, better, to the `--lr-icon-button-*` tokens, which reach it the same way they reach a standalone
icon button. Layout-only rules (`margin`, `grid-column`, `order`, `display`) keep working on
`close-button` untouched.

The surface chrome lives on the custom-element host, not inside `base`. Ordinary host
`background`, `border`, `border-radius`, `color`, `padding`, and `margin` declarations therefore
work directly and take normal author precedence. `inline` removes the host's border, background,
and padding.

**Migrating a pre-16.0.0 `::part()` rule.** This component's icon-only action is a composed
`<lr-icon-button>`, so the part naming that action now names the composed child's HOST, which
paints nothing. A `border`, `background` or `border-radius` set on it is silently dead — only
`color` still appears to work, because it inherits, which makes such a rule look half-alive rather
than broken. Set `--lr-icon-button-background`/`-color`/`-border`/`-radius` (and their
`-hover`/`-active` variants) on this element or an ancestor instead: the composed control reads
those public tokens ahead of any default this component supplies. For SIZE use
`--lr-theme-icon-button-size`, not `--lr-icon-button-size` — every `LyraElement` re-declares the
latter on its own `:host`, so it never reaches a composed child (see `llms/tokens.md`).

**Themeable custom properties:** `--lr-callout-background`, `--lr-callout-color`, and
`--lr-callout-border` read the inherited generic semantic quiet/loud slots, with brand quiet/loud
as their standalone fallback. An explicit `variant` maps all generic slots locally; leaving it
unset preserves an ancestor's mapping. Explicit `appearance` works with either source and uses the
same brand fallback when there is no surrounding context. Public callout hooks are consumed at use
sites through private defaults, so a value inherited from a theme ancestor has the same authority
as one set directly on the callout. `--lr-callout-close-hover-bg`
(default `var(--lr-color-brand-quiet)`) — the close button's `:hover` background, deliberately
decoupled from `--lr-callout-background` (which every explicit `variant`, including `neutral`,
retargets for the panel itself) so a consumer can retint the hover fill — e.g. to keep it visibly distinct from a
`variant="brand"` panel, which shares the same default token — without a collateral effect on the
panel background, and vice versa.

Three more, all new in 8.0.0: `--lr-callout-font-size` (private default
`var(--lr-form-control-font-size, var(--lr-font-size-m))` — the callout's text size; each explicit
`size` tier maps that private default from the shared ladder), `--lr-callout-padding` (private
default `var(--lr-form-control-padding-inline, var(--lr-space-m))` — the panel's padding on _both_
axes; each `size` tier changes that private default from the ladder's inline-padding knob, because
a panel's block rhythm is generous like a control's inline padding rather than tight like its block
padding, which only exists to fit text inside a fixed control height). The padding hook applies to
the panel treatment; `inline` intentionally forces host padding to zero. Inherited or direct public
font-size values remain authoritative in either treatment, while inherited/direct padding is
authoritative only for the panel.
`--lr-callout-gap` (default `var(--lr-space-s)` — the space between the icon, the
content and the close action. It deliberately does _not_ vary by `size`: it separates three adjacent
boxes rather than setting the panel's density, and shrinking it at the small tiers only crowds
them).

Initial content and initially distributed slots are silent. After that first render/slot
distribution settles, heading-property changes and direct or nested default/heading-slot additions,
removals, and text changes are appended to Lyra's shared light-DOM polite sink (`assertive` for
`danger`). An unset callout resolves that urgency from the nearest composed ancestor carrying an
explicit semantic `variant`, matching the palette it inherits without inspecting computed RGB.
Ancestor changes, removal, reconnect, and adoption are resolved live; an explicit local variant
pins both presentation and urgency. Announcement text is whitespace-normalized, honors meaningful `aria-label` values, and
excludes the icon/close chrome plus content hidden by `hidden`, `inert`, or `aria-hidden="true"` at
any nested level. `display:none`/`content-visibility:hidden` prune a branch; a
`visibility:hidden|collapse` wrapper suppresses its own text while a descendant that restores
`visibility:visible` remains exposed. Updates while the host or a composed ancestor is hidden also
stay silent. Nested forwarding slots expose their flattened assigned text instead of fallback
content, and later assignment plus assigned-node text/style/visibility mutations are observed.
Mutations that leave that accessible text unchanged are deduplicated. A nonempty host
`aria-label` (or `accessible-label` fallback) prefixes visible update text as context, with an
equality check preventing duplicate copy. The complete localized
`calloutAnnouncementWithContext: '{context}: {content}'` message owns both fields, their order, and
punctuation; override that key through `strings` rather than prejoining either field. An explicitly
empty host label still leaves visible heading/message text live.
`[part="base"]` is an ordinary wrapper, upgraded to a non-live `role="group"` only when it has an
accessible label. Initial connection, reconnection, adoption, and detached changes that settle
during staging stay silent; each connection acquires its owning document's shared sink.

Set `announce` when the callout is created in response to something the user just did — a save
failure, a validation result — and nothing else would read the message aloud. It announces the
content the callout already carries the first time it mounts, through the same path a later update
takes: assertive for `danger` (including a `danger` inherited from a composed ancestor) and polite
otherwise, the same `hidden`/`inert`/`aria-hidden`/CSS-hidden and hidden-ancestor exclusions, the
same flattened text through nested forwarding slots, and the same complete localized
`calloutAnnouncementWithContext` composition when the host carries a nonempty label. A closed
callout (`open="false"`) announces nothing. `announce` is read once, when the callout first mounts:
a later reconnection or adoption stages the existing content again rather than replaying the
announcement, and later content updates are announced whether or not it is set. Leave it unset for
a callout that is simply part of the page a user is arriving on — that text is already read in
document order, and announcing it again is noise. If a consumer previously hand-added a host
`role="status"`/`role="alert"` to work around the missing initial announcement, remove it once
`announce` is set: leaving both in place announces the same initial text twice, once through the
native role and once through the shared sink.

## `lr-rating`

A keyboard-accessible star rating control with slider semantics. It is a **form-associated control**
that lives in this family rather than in `components/forms/` — if you came looking for it among the
form controls, this is its section. Everything the "Form association" section says about `name`,
submission, validity and the `user-*` custom states applies to it.

Readonly transitions synchronize validity and `aria-invalid` in the same completed update. Form
reset restores the independent `default-value` rather than the live `value` attribute.

It is form-associated through `ElementInternals` directly rather than through the shared
`FormAssociated` mixin, because its `value` is a number and the mixin's contract assumes a plain
string — routing through it would force every consumer into string round-tripping for what is
natively a numeric score. The submitted entry is the clamped value stringified (`"0"` while
unrated), and `required` reports `valueMissing` until a rating above zero is set. The `value`
content attribute and IDL property both control the live score. `defaultValue` and its
`default-value` attribute independently own the reset target that `form.reset()` restores.

**Properties:** live `value: number = 0` (attribute `value`);
`defaultValue: number = 0` (attribute `default-value`, the current reset target); `customError: string |
null` (attribute `custom-error`); `max: number = 5`; `precision: number = 1`;
`readonly: boolean = false` (reflected), `disabled`, `required`, `name`,
`size: '2xs'|'xs'|'s'|'m'|'l'|'xl'|'small'|'medium'|'large' = 'm'` (reflected — changes the private
fallback behind `--lr-rating-size` from a type ramp rather than the shared control ladder, since a
rating has no control frame to size; an inherited or direct public size wins; the `m` default
reproduces the treatment this component had before `size` existed; valid long-form spellings
round-trip unchanged), plus two separate naming knobs:
`accessibleLabel: string = ''` (property) and `label: string = ''` (attribute
`label`). An authored host `aria-label` wins by attribute presence, including an explicitly empty
value. Without one, a non-empty external `<label for>` names the host; `accessibleLabel`, `label`,
then the localized name are the fallback order when no external label supplies text. Clicking an
associated external label focuses the host-owned slider without changing its value. Neither
property is visible label text, since a rating is a bare row of symbols with no field frame of its
own; wrap the element in your own layout for a labelled field, exactly as `<lr-slider>` does.

For the managed slider name only, an empty or whitespace-only `label` counts as absent and falls
through to localized `rating`; the raw `label` property still reads exactly as assigned. An
associated external label and an authored `aria-label`, including `aria-label=""`, keep their
existing precedence and are never replaced by that fallback.

**Static constructor API:** `LyraRating.validators` is the mirrored callable validator catalog.
Each access returns a fresh `LyraFormValidator<LyraRating>[]`; its entry observes
`required`/`disabled`/`readonly`/`value`/`max`, and `checkValidity(element)` projects the element's
current `ValidityState` into `{ isValid, message, invalidKeys }` without changing it.

```ts
import { LyraRating } from "@aceshooting/lyra-ui/components/overlays/rating/rating.js";

const rating = document.querySelector("lr-rating")!;
const result = LyraRating.validators[0].checkValidity(rating);
```

The host is the one focusable `role="slider"` owner and carries `tabindex`, its accessible name,
`aria-valuemin`/`aria-valuemax`/`aria-valuenow`/`aria-valuetext`, and explicit true/false disabled,
readonly and required states. The shadow star row is `aria-hidden` presentation only, so custom
host ARIA never creates a competing second slider.

Assigning `null` to `name` is accepted for mapped source compatibility; it removes the attribute and
clears to the canonical `''` read value rather than creating a nullable state.

`getSymbol?: (value: number, selected: boolean) => unknown` (property only, no attribute) — **new in
8.0.0.** Renders a consumer-supplied symbol per position instead of the built-in star. It is called
_twice per position_: once for the empty backdrop (`selected` false) and once for the overlay
clipped to that position's filled fraction (`selected` true), which is what keeps a fractional
`precision` rendering a partial fill. Return any Lit-renderable value; a plain string renders as
text, never as markup. Renderer output is decorative, inert, and pointer-transparent, so it cannot
become a second focus or action target; pointer and keyboard selection stay on the rating control.
Left unset, the built-in star outline/solid pair is unchanged.

**Events:**

- `change` — a native `Event` (bubbling, composed, non-cancelable, and carrying no `detail`) emitted
  when a user commits a genuinely new value. It fires immediately before `lr-change`; read the
  numeric score from `event.target.value`. Programmatic `value`/`defaultValue` writes, reset/state
  restore, and gestures that clamp to the current value are silent.
- `lr-change` — `detail: { value }`. The rating was committed to a new value. Not emitted when the
  clamped value is unchanged, nor on a programmatic `value` write. It fires immediately after the
  native `change` event for the same user commit.
- `lr-activate` — `detail: { value }`, the committed rating. Fired on **every** interactive commit
  (a click on a symbol, or an Arrow/Home/End key), whether or not the value actually moved.
  Bubbling, composed, not cancelable — it reports that the user committed a rating and gates
  nothing. Use it for the re-commit of the current rating that `lr-change` deliberately stays silent
  for; from the keyboard that case is otherwise unobservable, because End on an already-maximum
  rating, Home on an already-zero one, or an arrow key at either bound commits a rating and produces
  no click at all. When the commit _does_ move the value, `change` and `lr-change` are emitted
  first, so a listener reading `value` from any of the three sees the settled rating. A
  non-interactive (`readonly`/`disabled`) rating fires none of them.
- `lr-hover` — **new in 8.0.0.** `detail: { phase: 'start' | 'move' | 'end', value }`, where `value`
  is the rating that committing the current pointer position _would_ produce — enough to render a
  live description of what is being hovered without waiting for a click. Fires only while the rating
  is settable (neither `disabled`, fieldset-disabled, nor `readonly`). `start` also covers a pointer
  that reaches the symbols without a `pointerenter` the component saw; `end` fires on
  `pointerleave` **and** on `pointercancel` (a touch drag taken over by scrolling, palm rejection),
  so an interrupted gesture never leaves the preview frozen. A disconnect or a disablement drops the
  preview silently, with no `end` phase — that teardown wasn't user-driven.
- `focus` / `blur` — the host-owned slider's ordinary native focus transitions. Like native focus
  events, they do not bubble; listen on the rating itself (or use capture on an ancestor).
- `lr-invalid` — no detail; fired when a validity check finds the rating invalid.

**Methods:** `focus()`, `blur()` and `click()` operate on the host-owned slider and are gated while
disabled. `rating: HTMLElement | null` is the live presentational symbol row (the element carrying
the `rating`/`base` parts), or `null` before rendering; its identity remains stable across ordinary
updates and reconnection.
`getForm()` returns the browser-resolved owning form. `checkValidity()` and `reportValidity()`
behave as on a native form control — `reportValidity()`
additionally shows the browser's validation UI, and counts as interaction, so a failed submit is
what starts `user-invalid` matching. `setCustomValidity(message: string)` sets a consumer-supplied
rejection no client-side constraint can express ("you have already rated this item"): a non-empty
message raises `customError` and becomes `validationMessage`, so the control fails
`checkValidity()`, blocks submission and matches `:state(invalid)`. It is caller-supplied content,
so it is used verbatim and never localized. `setCustomValidity('')` clears it and restores the
control's _computed_ validity rather than forcing it valid — a `required` control that is still
unrated stays `valueMissing`. Like a native control, the custom error survives every intrinsic
recomputation in between (each `value`/`max`/`required` change re-runs validation) and a
`form.reset()`; `setCustomValidity('')` or `resetValidity()` clears it.

**Reset and state restore.** A live `value` or `value`-attribute write updates the current score;
later `defaultValue`/`default-value` mutations update the reset target without overwriting that
live score. `form.reset()` restores the current default, drops any
in-flight hover preview, and returns the control to pristine, so the `user-valid`/`user-invalid`
states stop matching even though a required-and-unrated control is still `invalid`. Browser session
restore (`formStateRestoreCallback`) reinstates the previously submitted numeric value; a
non-string restored state falls back to `0` rather than producing NaN geometry.

**Custom states:** `required`, `optional`, `valid`, `invalid`, `user-valid`, `user-invalid` —
`lr-rating:state(user-invalid)` is the one to paint red. Plain `invalid` matches a pristine
`required` rating that has never been set.

**CSS parts:** `base` (compatibility name for the presentational symbol row; use `rating`),
`rating` (the presentational symbol row; it is the same node as `base`), `star` (each rendered symbol), `star-fill` (the
filled overlay inside each symbol, clipped to that symbol's filled fraction — 0%, a partial
percentage under a fractional `precision`, or 100%).

**Themeable custom properties:** `--lr-rating-fill` (default `--lr-color-warning` — filled-symbol
color), `--lr-rating-empty-color` (default `--lr-color-border` — unfilled-symbol color, also
retained during hover preview), `--lr-rating-active-color` (default: the existing active mix of the
empty-symbol color — pressed-symbol color only), `--lr-rating-size` (default `--lr-font-size-xl` —
symbol size; its private default follows each `size` step while a public value wins), and
`--lr-rating-gap` (default
`--symbol-spacing`, then `--lr-space-xs` — gap between symbols). The mapped compatibility hooks
are `--symbol-color` (inactive symbols), `--symbol-color-active` (filled symbols), `--symbol-size`
(symbol size), and `--symbol-spacing` (the gap around symbols). The Lyra-prefixed color, size, and
gap names win if both a Lyra property and its compatibility alias are set. `--symbol-size` otherwise
feeds the active `size` step, while `--symbol-spacing` remains the fallback for
`--lr-rating-gap` before the shared `--lr-space-xs` default.

Pointer selection resolves the position within the clicked star and snaps upward to `precision`
(with the physical fraction mirrored under RTL), so half/quarter-star precision applies to pointer
input as well as keyboard/value updates. The host-owned slider's presentational symbol row keeps a
40×40px minimum activation area even for the degenerate `max=0`/`max=1` cases; larger ratings
naturally grow wider, while symbols may shrink within a narrow allocation instead of forcing the
host beyond its container.

```html
<lr-rating
  name="score"
  label="Overall rating"
  default-value="2"
  max="5"
  precision="0.5"
  size="l"
  style="--lr-rating-active-color: var(--lr-color-success); --lr-rating-gap: var(--lr-space-s); --symbol-color-active: var(--lr-color-success); --symbol-size: var(--lr-font-size-2xl)"
></lr-rating>
<p id="preview"></p>
<script type="module">
  import "@aceshooting/lyra-ui/components/overlays/rating/rating.js";

  const rating = document.querySelector("lr-rating");
  const preview = document.getElementById("preview");
  rating.getSymbol = (value, selected) => (selected ? "♥" : "♡");
  rating.addEventListener("lr-hover", (event) => {
    const { phase, value } = event.detail;
    preview.textContent = phase === "end" ? "" : `Rate ${value}`;
  });
  rating.addEventListener("change", (event) =>
    console.log("native commit", event.target.value)
  );
  rating.addEventListener("lr-change", (event) =>
    console.log("committed", event.detail.value)
  );
</script>
```

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-overlays-chip-chip-group-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/chip/chip-group.class.js`.
  `ChipGroupOverflowToggleDetail {
    expanded: boolean;
  }`

- **`components-overlays-chip-chip-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/chip/chip.class.js`.
  `ChipRemoveDetail {
    value?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/overlays/chip/chip.class.js`.
  `ChipSelectDetail {
    value?: string;
    selected: boolean;
  }`

- **`components-overlays-context-menu-context-menu-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/context-menu/context-menu.class.js`.
  `LyraContextMenuShowDetail {
    readonly source: LyraContextMenuSource;
    readonly target: Element | null;
    readonly path: readonly Element[];
    readonly clientX: number;
    readonly clientY: number;
    readonly originalEvent: Event | null;
  }`
  Import: `@aceshooting/lyra-ui/components/overlays/context-menu/context-menu.class.js`.
  `LyraContextMenuPoint {
    x: number;
    y: number;
    contextElement?: Element;
  }`

- **`components-overlays-dialog-confirm-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/dialog/confirm.js`.
  `confirm(options: ConfirmOptions): Promise<boolean>`
  Import: `@aceshooting/lyra-ui/components/overlays/dialog/confirm.js`.
  `ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'neutral' | 'danger';
  }`

- **`components-overlays-dialog-dialog-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/dialog/dialog.class.js`.
  `LyraDialogHideDetail {
    source: Element;
  }`
  Import: `@aceshooting/lyra-ui/components/overlays/dialog/dialog.class.js`.
  `LyraDialogModalController {
    activateExternal(): void;
    deactivateExternal(): void;
  }`
  Import: `@aceshooting/lyra-ui/components/overlays/dialog/dialog.class.js`.
  `LyraDialogRequestCloseDetail {
    source: LyraDialogRequestCloseSource;
  }`

- **`components-overlays-kbd-kbd-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/kbd/kbd.class.js`.
  `KbdKeyLabel {
    visual: string;
    word: string;
  }`
  Import: `@aceshooting/lyra-ui/components/overlays/kbd/kbd.class.js`.
  `parseShortcut(keys: string, isMac: boolean, localize?: KbdLocalize): KbdKeyLabel[]`
  Import: `@aceshooting/lyra-ui/components/overlays/kbd/kbd.class.js`.
  `shortcutTokenLabel(rawToken: string, isMac: boolean, localize?: KbdLocalize): KbdKeyLabel`

- **`components-overlays-toast-toast-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/toast/toast.class.js`.
  `LyraToastOptions {
    message: string;
    placement?: LyraToastPlacement;
    ownerDocument?: Document;
    variant?: LyraToastVariant;
    duration?: number;
    size?: LyraSize;
    withIcon?: boolean;
    icon?: LyraToastIcon;
    action?: {
      label: string;
      onClick: (item: LyraToastItem) => void;
    };
  }`
  Import: `@aceshooting/lyra-ui/components/overlays/toast/toast.class.js`.
  `LyraToastOverflowDetail {
    count: number;
  }`

- **`components-overlays-toast-toaster-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/overlays/toast/toaster.js`.
  `toast(input: LyraToastOptions | string): ToastHandle`
  Import: `@aceshooting/lyra-ui/components/overlays/toast/toaster.js`.
  `ToastHandle {
    item: Promise<LyraToastItem>;
    dismiss: () => void;
  }`
