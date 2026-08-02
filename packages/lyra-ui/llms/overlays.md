## The shared overlay lifecycle

`lr-dialog`, `lr-drawer`, `lr-popover`, `lr-dropdown` and `lr-tooltip` all open and close over the
page, and as of 8.0.0 they do it through one contract. Each component's own section below documents
what it *adds* to that contract, not a private variant of it.

**One way to open, one way to close.** All five expose `show()`, `hide()` and a reflected `open`
boolean, and all three drive the same code path: `el.show()` is indistinguishable from
`el.open = true`, and `el.hide()` from `el.open = false`. The property, the reflected attribute and
the two methods can therefore never disagree, and each method is a no-op when the overlay is already
in the requested state. `lr-dialog` and `lr-drawer` keep `close(reason)` alongside — `hide()` plus
the reason string that `lr-dialog-close` carries.

**Four events, and where the veto sits.**

| Event | Cancelable | Fires |
| --- | --- | --- |
| `lr-show` | yes | before the overlay opens |
| `lr-after-show` | no | once the enter animation has finished |
| `lr-hide` | yes | before the overlay closes, on every dismissal path |
| `lr-after-hide` | no | once the exit animation has finished |

Both pre-events fire **before** the state changes, so `el.open` read inside an `lr-show`/`lr-hide`
handler is still the *old* value, and `preventDefault()` cancels the transition rather than undoing
it: a vetoed `lr-show` leaves the overlay closed for the trigger interaction, `show()` and
`open = true` alike; a vetoed `lr-hide` leaves it open for Escape, light dismiss, the close button,
`hide()` and `open = false` alike. The two `lr-after-*` events are never cancelable, and none of the
four fires for markup that renders open from the start. The generic popover/dropdown/tooltip events
carry no detail; dialog/drawer `lr-hide` carries `{ source: Element }`. That is the
timing `wa-show`/`wa-hide` always had, so a mechanical `wa-*` → `lr-*` rename now maps all four names
with matching timing *and* matching cancelability — which also means Lyra 7.x code that read
`el.open` inside an `lr-show`/`lr-hide` handler, or treated the pair as purely informational, was
relying on the opposite polarity and has to be re-read.

`lr-dialog` and `lr-drawer` also expose cancelable `lr-initial-focus` and `lr-request-close` veto
points, documented in their sections. Their cancelable `lr-dialog-close` fires **after** `lr-hide`
and before `lr-after-hide`; it carries the close reason. Vetoing `lr-hide` stops it from firing at
all.

**The top layer.** An open `lr-dialog` or modal `lr-drawer` is promoted into the browser **top layer**
(through `popover="manual"`) rather than stacked with `z-index`. It therefore escapes every ancestor
stacking context and every ancestor `overflow` clip: a `transform`ed parent, an `isolation: isolate`
wrapper or a `z-index: 2147483647` sticky header can no longer paint over it or crop it, which no
`z-index` value alone can guarantee. If you raised `--lr-layer-modal` to win one of those fights,
that override no longer decides anything for their modal instances and can be dropped — the token
still resolves the `z-index` in their stylesheet, but only as the fallback for a user agent without
popover support. A `contained` drawer is deliberately nonmodal and is not promoted. The token keeps
doing real work everywhere else it is used: `lr-popover`, `lr-dropdown` and `lr-tooltip` are *not*
promoted, and go on stacking at `--lr-overlay-stack-index`, falling back to `--lr-layer-popover`.

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
  and `start`/`end` pin it `arrow-padding` from one *logical* end of that edge. On a top/bottom
  placement those two ends are the inline ones, so they swap under RTL; on a left/right placement
  they are the block ends, which do not.
- `arrow-padding` (number of px) keeps the arrow that far from the popup's corners. It defaults to
  `10` on the low-level popup and `0` on the three policy overlays.
- `--arrow-size` is the mapped size custom property and its value is **half** the square's width —
  the rendered arrow is twice it in both axes. Retained fallbacks are `--lr-overlay-arrow-size` on
  `lr-popover`/`lr-dropdown`, `--lr-tooltip-arrow-size` on `lr-tooltip`, and
  `--lr-popup-arrow-size` on `lr-popup`; they default to `var(--lr-size-0-375rem)`.
- `skidding` (number of px, default `0`) offsets the popup *along* the anchor's edge — the
  cross-axis counterpart to `distance`.
- `for` (string, reflected) anchors the popup to an element it does not contain, by id. The id is
  resolved in the overlay's **own root**, so it works inside a shadow tree where a plain idref could
  not cross the boundary. The slotted `trigger` keeps owning the interaction and the ARIA
  relationship either way.

---

## `lr-toast` / `lr-toast-item` / `toast()`

Stacking toast/notification region. Mirrors `<wa-toast>`/`<wa-toast-item>` under `lr-`.

### `lr-toast`

One per page recommended — the region.

**Properties:**
- `placement: ToastPlacement = 'top-end'` (reflected) — one of `'top-start'|'top-center'|'top-end'|
  'bottom-start'|'bottom-center'|'bottom-end'`

**Methods:** `async create(message: string, options?: ToastCreateOptions): Promise<LyraToastItem>` —
`ToastCreateOptions = { variant?, duration?, size?, withIcon? }`. Its `size` accepts the canonical
`2xs`/`xs`/`s`/`m`/`l`/`xl` values plus `small`/`medium`/`large`; the created item's getter
normalizes the long aliases to `s`/`m`/`l`.

**Events:** none.

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
- `size: '2xs'|'xs'|'s'|'m'|'l'|'xl' = 'm'` (reflected — drives both `--lr-toast-padding` and the
  toast's own font-size via `:host([size=...])`, from a compact `2xs` up to a roomier `xl`;
  setters also accept `small`/`medium`/`large` and normalize reads to `s`/`m`/`l`)
- `variant: 'brand'|'success'|'warning'|'danger'|'neutral' = 'neutral'` (reflected)
- `withIcon: boolean = false` (attribute `with-icon`)

**Methods:** `async hide(): Promise<void>` — plays the hide animation, then removes itself from the
DOM.

**Events:** `lr-show`, `lr-after-show`, `lr-hide`, `lr-after-hide`

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
(`var(--lr-space-m)`), `--lr-toast-font-size` (`var(--lr-font-size-m)`) — both are auto-swapped per
`size`, from a compact `2xs` up to a roomier `xl` — `--lr-toast-accent-color` (default
`var(--lr-color-border)`, auto-swapped per `variant` to that variant's loud fill).
The mapped names `--accent-width`, `--show-duration`, `--hide-duration`, and `--padding` alias their
respective Lyra-prefixed properties. Setting the Lyra-prefixed form explicitly wins over its alias.

**Optional peer deps:** none.

`role` is chosen automatically per `variant`: `"alert"` for `danger`/`warning`, `"status"`
otherwise — re-evaluated on every `variant` change, not just at first render, so reassigning
`variant` to `danger`/`warning` after creation is announced as an interruption instead of keeping
its original, now-stale role. Auto-dismiss timer **pauses** on `pointerenter`/`focusin`, **resumes**
on `pointerleave`/`focusout`, with real elapsed-time bookkeeping (WCAG 2.2.1 timing-adjustable) —
hover and focus are tracked as independent pause reasons, so releasing only one (e.g. the pointer
leaves while focus remains, or vice versa) keeps the timer paused until *neither* holds it anymore.
A `duration` change while the timer is actively counting down reschedules it immediately against
the new value instead of waiting for the next pause/resume cycle.

### `toast()`

From the `toaster` controller — the ergonomic entry point, no manual `<lr-toast>` mounting
needed:

```ts
import { toast } from '@aceshooting/lyra-ui/components/overlays/toast/toaster.js';

toast('Saved');
toast({ message: 'Deleted', variant: 'danger', action: { label: 'Undo', onClick: (item) => {/*...*/} } });
```

`toast(input: ToastOptions | string): ToastHandle` where
`ToastOptions = ToastCreateOptions & { message: string; placement?: ToastPlacement; action?: { label: string; onClick: (item: LyraToastItem) => void } }`,
and `ToastHandle = { item: Promise<LyraToastItem>; dismiss: () => void }`. Because it extends
`ToastCreateOptions`, the helper accepts the same long `small`/`medium`/`large` size aliases and
normalizes the created item identically. It lazily mounts (and
re-mounts if removed) **one singleton `<lr-toast>` region per distinct `placement`** on
`document.body` — a `toast()` call targeting one placement never relocates toasts already showing
at another, since `placement` is a per-call option rather than a single global region's setting.

```html
<script type="module">
  import { toast } from '@aceshooting/lyra-ui/components/overlays/toast/toaster.js';
  document.getElementById('save-btn').addEventListener('click', () => toast('Saved!'));
</script>
```

**Known gotchas:**
- the stack itself has no live-region role; each `lr-toast-item` owns the single `status`/`alert`
  role appropriate to its current variant, avoiding nested live-region announcements.
- the close button's accessible name is derived from the toast's own message text (`"Close: <first
  40 chars>…"`, falling back to bare `"Close"` only when the toast has no text content) rather than
  a bare `"Close"` on every instance — useful when several toasts are stacked and a screen-reader or
  switch-access user needs to tell their close buttons apart without activating one first. Rich
  non-interactive message markup contributes its text, named-slot/icon and actionable content do
  not, and live message text mutations update the name.
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
  handles the singleton-region and remount-if-removed logic.

---

## `lr-empty`

First-party "no data" state (no Web Awesome equivalent).

**Properties:**
- `heading: string = ''`
- `description: string = ''`
- `compact: boolean = false` (reflected) — tighter, left-aligned rendering (less padding, a lighter
  heading weight) for use inside a constrained space like a widget body or table cell, instead of
  the centered/spacious full-page default

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
<lr-empty heading="No results" description="Try a different search.">
  <svg slot="" ...></svg> <!-- default slot: any icon/illustration -->
  <div slot="actions"><button>Clear filters</button></div>
</lr-empty>
<lr-empty compact heading="No results" description="Try a different search."
  style="--lr-empty-compact-align: center"></lr-empty>
```

**Known gotchas:**
- `[part="base"]` is `role="status" aria-live="polite"`, so a list/table transitioning to empty
  does announce to screen readers — no extra wiring needed on the host's part.
- Note: correctly works around the classic `:empty`-pseudo-class trap (a wrapper with a `<slot>`
  inside can never match `:empty`) by tracking real slot assignment in JS (`hasIcon`/`hasActions`) —
  `lr-table` reuses this component for its own empty-rows state, and `lr-stat` (below) now uses
  the same JS-tracked-slot-state pattern for its own icon/caption wrappers.

---

## `lr-skeleton`

Loading placeholder (`text`/`circle`/`rect` shapes, opt-in `pulse`/`sheen` effects).

**Properties:**
- `variant: 'text'|'circle'|'rect' = 'text'` (reflected)
- `effect: 'pulse'|'sheen'|'none' = 'none'` (reflected) — animation is opt-in. **Changed in
  8.0.0:** the Lyra default was `pulse`; set `effect="pulse"` to preserve that motion explicitly.
- `width?: string`
- `height?: string`
- `label: string = 'Loading…'` — accessible name for this instance's own `role="status"` (rendered as
  visually-hidden text inside `[part="base"]`); override with a description of what's actually
  loading, e.g. `label="Loading chart"`
- `announce: boolean = true` (reflected) — set false for decorative members of a skeleton group;
  removes the status role, live-region state, and visually hidden announcement while preserving
  the visual placeholder

**Events:** none.

**Slots:** none.

**CSS parts:** `base` and `indicator` are aliases on the same placeholder/animation surface.

**Themeable custom properties:** `--lr-skeleton-w`, `--lr-skeleton-h` (set/cleared by the
`width`/`height` properties; defaults `100%` / `var(--lr-size-1em)`),
`--lr-skeleton-color` (default `var(--lr-color-border)`), `--lr-skeleton-sheen-color` (default
`var(--lr-color-surface)`), `--lr-skeleton-border-radius` (default `var(--lr-radius)` for text and
rectangle shapes); upstream `--color`, `--sheen-color`, and `--border-radius` feed those same
values. The shared `--lr-transition-ambient` (default `1.8s ease-in-out`) controls the pulse/sheen
timing.

**Optional peer deps:** none.

```html
<lr-skeleton variant="circle" effect="pulse" width="3rem" height="3rem"></lr-skeleton>
<lr-skeleton variant="text" effect="sheen" label="Loading name"></lr-skeleton>
```

**Known gotchas:**
- Each instance announces by default. In a repeated skeleton layout, provide one parent status and
  set `announce="false"` on the decorative child placeholders to avoid duplicate announcements.
- no `lines`/`count` shorthand for "N lines of skeleton text" — stamp out N elements
  yourself.
- Respects `prefers-reduced-motion` (both effects) — safe to leave as-is for that concern.

---

## `lr-drawer`

A modal panel anchored to one logical edge of the viewport. `LyraDrawer` extends `LyraDialog`, so it
inherits the entire dialog contract unchanged: focus trapping, Escape and opt-in backdrop dismissal,
document scroll locking, browser **top-layer** promotion, overlay stacking, accessible naming, the
`show()`/`hide()`/`close()` methods and the whole
`lr-show`/`lr-after-show`/`lr-hide`/`lr-after-hide`/`lr-dialog-close` lifecycle. `contained` switches
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
  `no-header`, reflected), `withoutHeader: boolean = false` (legacy attribute `without-header`,
  reflected), `withFooter: boolean = false` (attribute `with-footer`, reflected; SSR hint), and
  `lightDismiss: boolean = false` (attribute `light-dismiss`) — inherited dialog naming, chrome and
  dismissal options. A plain `aria-label` attribute on the host is honored too, with the same
  wins-over-everything semantics documented under `lr-dialog` below.

**Methods:** `show(): Promise<void>`, `hide(): Promise<void>`,
`close(reason?: DialogCloseReason): Promise<void>` — inherited unchanged from `lr-dialog`; each
promise settles after the matching `lr-after-*` event.

**Events:** `lr-show` (cancelable), `lr-after-show`, `lr-hide` (cancelable), `lr-after-hide`, and
`lr-initial-focus` (cancelable), `lr-request-close` (cancelable, detail source), and
`lr-dialog-close` (`detail: DialogCloseReason`, cancelable) — all inherited unchanged from
`lr-dialog`; see that section for details and veto rules. `lr-after-show` /
`lr-after-hide` fire once the slide animation has finished, so they are deferred by roughly one
animation compared with the state flip.

**Animation registry:** the panel uses placement-specific names:
`drawer.showStart`/`drawer.hideStart`, `drawer.showEnd`/`drawer.hideEnd`,
`drawer.showTop`/`drawer.hideTop`, and `drawer.showBottom`/`drawer.hideBottom`. The backdrop uses
`drawer.overlay.show`/`drawer.overlay.hide`. Per-element overrides are RTL-aware through
`rtlKeyframes`; passing `null` disables interpolation while retaining the inherited event/promise
lifecycle.

**Slots:** default (drawer body), `label` (rich header content), `header-actions` (extra header
controls, rendered before the built-in close button), `footer` — all inherited from `lr-dialog`.

**CSS parts:** `base`; `backdrop overlay`; `panel dialog`; `header`; `heading title label`;
`header-actions`; `close-button close-button__base`; `body`; `footer`. Names grouped together are
aliases on the same functional node.

**Themeable custom properties:** mapped `--size` controls the active axis. Inherited `--width`
remains visible in the shared dialog surface, but drawer sizing deliberately shadows it with
`--size`. The other mapped/inherited aliases are `--backdrop-filter`, `--spacing`, `--header-spacing`, `--body-spacing`,
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
since `LyraDrawer` extends `LyraDialog`. The drawer's own width/height tokens take precedence for
its panel, and only the animation *name* is overridden, so `--lr-dialog-panel-duration` retunes the
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

### `lr-dialog`

A modal/overlay: `role="dialog"`, focus-trapped while open, dismissible via Escape or (opt-in) a
backdrop click, and scroll-locks the document for as long as it's open. Mapped chrome is present by
default: `label` renders as a visible title and `closable` renders a localized close button.
`closable="false"`, `no-header`, or the legacy `without-header` alias support custom chrome.

**Properties:**
- `open: boolean = false` (reflected) — **changed in 8.0.0:** `lr-dialog` now also has a
  `show()`/`hide()` pair, and assigning `open` runs exactly the same lifecycle as calling them, so
  the property, the reflected attribute and the two methods can never disagree. `el.open = false`
  therefore emits the full close lifecycle and can be vetoed, where it used to be a silent state
  flip. Markup that renders open from the start (`<lr-dialog open>`) emits nothing.
- `label: string = ''` — mapped visible title. The richer `label` slot wins over it.
- `accessibleLabel: string = ''` (attribute `accessible-label`) — explicit accessible-only name;
  unlike `label`, it never renders visible text
- `heading?: string` — legacy visible-title fallback, after the `label` slot and `label` property;
  it has no effect when a direct light-DOM heading already supplies custom chrome
- `closable: boolean = true` (attribute `closable`, reflected) — renders the localized close (X)
  button. This true-default boolean parses `closable="false"`; removing the attribute also restores
  the default.
- `noHeader: boolean = false` (attribute `no-header`, reflected) — Shoelace spelling that suppresses
  the entire header row
- `withoutHeader: boolean = false` (attribute `without-header`, reflected) — **new in 8.0.0.**
  Web Awesome/legacy spelling for the same header suppression
- `withFooter: boolean = false` (attribute `with-footer`, reflected) — keeps the footer wrapper
  rendered as an SSR/hydration presence hint even before assigned slot content is observable
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — opt in to a backdrop click closing
  the dialog; Escape and explicit `close()`/`hide()` calls remain available. **Changed in 8.0.0:**
  this was previously spelled `no-light-dismiss`, an opt-*out* whose default left backdrop dismissal
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
  whatever had it right before opening, and resolves after `lr-after-hide`.
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
- `lr-dialog-close` — cancelable, with `detail: DialogCloseReason`; emitted after `lr-hide`

The two `lr-after-*` events are never cancelable.

The open sequence is `lr-show` → `lr-initial-focus` (when focus would move) → `lr-after-show`; the
direct close sequence is `lr-hide` → `lr-dialog-close` → `lr-after-hide`. A built-in dismissal
prepends `lr-request-close`. **Both state pre-events fire *before* the state changes**, so reading
`el.open` inside an `lr-show`/`lr-hide` handler returns the *old* value — this is the polarity
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
`lr-hide`, `lr-dialog-close` (reason `'unmount'`) and `lr-after-hide` in that order, none of them
cancelable, since the element is already gone.

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
rendered in the header row *before*
the built-in close button), `footer` (action buttons, rendered in a bottom row, hidden entirely when
empty). The `label` and `header-actions` slots are new in 8.0.0.

**CSS parts:** `base`; `backdrop overlay`; `panel dialog`; `header`; `heading title label`;
`header-actions`; `close-button close-button__base`; `body`; `footer`. Names grouped together are
additive aliases on the same functional node, so a mapped `::part(title)` rule styles the same
visible title as Lyra's `::part(heading)`.

**The body is keyboard-reachable while it overflows.** `[part="body"]` is the element that scrolls,
so it carries `tabindex="-1"` and joins the focus order **only while its content actually
overflows** — a dialog whose content is nothing but prose, a table, or a rendered document used to
be scrollable with a mouse and completely unreachable from the keyboard, because a scroll container
with no focusable child is not a stop of its own. A short body never becomes a gratuitous stop.

It takes focus like any other stop, so it styles like one: `::part(body):focus-visible` draws the
standard `--lr-focus-ring-*` ring, inset (`outline-offset` is negative) because the body is flush
with the panel edges, where an outset ring would be clipped or would collide with the header rule.
Restyle it through `::part(body)` as usual; do not remove the outline without replacing it.

It never steals initial focus from real content: an `[autofocus]` element wins, then the first
focusable control *inside* the body, and the body itself is used only when there is nothing else to
focus. So a dialog full of form controls behaves exactly as before, and a dialog full of text is now
scrollable with the arrow keys, Page Up/Down and Home/End once Tab reaches it.

**Themeable custom properties:** mapped aliases are `--backdrop-filter`, `--width`, `--spacing`,
`--header-spacing`, `--body-spacing`, `--footer-spacing`, `--show-duration`, and
`--hide-duration`. The individual region properties override `--spacing`; mapped properties in
turn fall back to the retained Lyra tokens: `--lr-dialog-overlay-color` (default
`var(--lr-color-overlay)` —
the backdrop scrim color), `--lr-dialog-backdrop-filter` (default `none` — a `backdrop-filter` on
the scrim, e.g. `blur(3px)`, for a frosted-glass treatment over the page behind it),
`--lr-dialog-width` (default `auto` — the panel shrink-wraps to content; set it for an assertive
width instead), `--lr-dialog-max-width` (default `var(--lr-dialog-width, var(--lr-size-32rem))` —
the panel's max-inline-size cap, applied as
`min(var(--lr-dialog-max-width, var(--lr-dialog-width, var(--lr-size-32rem))), 100%)`; when
`--lr-dialog-width` is set but `--lr-dialog-max-width` is left at its default, the cap falls back to
the requested width itself — not the 32rem default — so an assertive width isn't silently clipped;
the viewport is still a hard limit either way), `--lr-dialog-spacing` (default `var(--lr-space-l)` —
the padding inside `[part="body"]` and the *inline* padding of the header and footer rows),
`--lr-dialog-spacing-block` (default `var(--lr-space-m)` — the *block* padding of the header and
footer rows, which are tighter than the body by default), `--lr-dialog-panel-duration` (default
`var(--lr-duration-base)` — the panel's enter/exit animation duration) and
`--lr-dialog-backdrop-duration` (default `var(--lr-duration-fast)` — the backdrop's fade duration).
Otherwise shared tokens include `--lr-space-l/-m/-s`, `--lr-color-surface/-border`, `--lr-radius`,
`--lr-shadow`, and `--lr-easing-standard`.

**Optional peer deps:** none.

```html
<lr-dialog id="dlg" closable>
  <span slot="label">Delete item?</span>
  <button slot="header-actions" type="button">Help</button>
  <p>This cannot be undone.</p>
  <div slot="footer">
    <button id="cancel" type="button">Cancel</button>
    <button id="confirm" type="button">Delete</button>
  </div>
</lr-dialog>
<script type="module">
  import '@aceshooting/lyra-ui/components/overlays/dialog/dialog.js';

  const dlg = document.getElementById('dlg');
  // Listeners first: `lr-show` is emitted synchronously inside show().
  dlg.addEventListener('lr-show', () => console.log('opening; el.open is still', dlg.open));
  dlg.addEventListener('lr-after-show', () => console.log('enter animation done'));
  dlg.addEventListener('lr-dialog-close', (e) => console.log('closed:', e.detail));
  dlg.addEventListener('lr-after-hide', () => console.log('exit animation done'));
  document.getElementById('cancel').addEventListener('click', () => dlg.close('cancel'));
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

Accessible naming and visible title are separate. Naming precedence is: (1) host `aria-label`, (2)
`accessible-label`, (3) the copied text of an unslotted direct light-DOM heading, then (4) the
shadow-owned visible title wrapper. Visible-title precedence is the rich `label` slot, then the
mapped `label` property, then legacy `heading`. The direct-heading case copies text because an IDREF
cannot cross from the panel's shadow tree to a light-DOM heading; the mapped title wrapper can use
`aria-labelledby` because it lives in the same shadow root. `no-header`/`without-header` removes the
mapped title, so custom-chrome dialogs should provide a direct heading, `accessible-label`, or host
`aria-label`.

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
- Only *unslotted direct* children are scanned for a heading — one nested several layers deep,
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
import { confirm } from '@aceshooting/lyra-ui/components/overlays/dialog/confirm.js';

const ok = await confirm({
  title: 'Delete conversation?',
  description: 'This cannot be undone.',
  confirmLabel: 'Delete',
  tone: 'danger',
});
if (ok) deleteConversation();
```

`confirm(options: ConfirmOptions): Promise<boolean>` where
`ConfirmOptions = { title: string; description?: string; confirmLabel?: string /* = 'Confirm' */; cancelLabel?: string /* = 'Cancel' */; tone?: 'neutral' | 'danger' /* = 'neutral' */ }`.

Resolves `true` only when the confirm button is pressed — Escape, a backdrop click, and the cancel
button all resolve `false`. It sets `lightDismiss = true` on its transient dialog explicitly, so the
backdrop-click branch survives 8.0.0's flip of that property's own default to `false`. Mounts a
transient `<lr-dialog>` on `document.body` for the duration
of the call and removes it once settled, rather than reusing a persistent page-level region
(contrast `lr-toast`'s `toaster.ts`): a confirmation modal has no stacking/queueing concerns —
only one is ever meant to be open at a time — so a mount-and-remove per call keeps its lifetime
trivially tied to the returned promise. `title` becomes a slotted `<h2>`, which per `<lr-dialog>`'s
own heading-detection also drives the dialog's accessible name; `description`, if provided, becomes
a slotted `<p>`. `tone: 'danger'` fills the confirm button with `--lr-color-danger` instead of
`--lr-color-brand`, for destructive actions. Confirm/cancel buttons are plain inline-styled
`<button>` elements (no shared button component exists in this library yet), but every color value
used is still a `--lr-*` token reference, never a raw literal.

**Known gotchas:**
- Every dismissal path (confirm button, cancel button, Escape, backdrop click) funnels through
  `<lr-dialog>`'s own `close()`/`lr-dialog-close` event, so there is exactly one place that
  resolves the promise and tears the dialog down — a consumer never needs to (and shouldn't) call
  `.remove()` itself. Because the close event is cancelable, `confirm()` waits through the full
  dispatch and remains pending/mounted when a listener calls `preventDefault()`.
- The neutral confirm button pairs `--lr-color-on-brand` with `--lr-color-brand`; the danger
  tone pairs `--lr-color-on-danger` with `--lr-color-danger`. Each of those resolves through its
  variant's row of the semantic grid (`--lr-color-<variant>-fill-loud` /
  `--lr-color-<variant>-on-loud`), which in turn reads the matching `--lr-theme-color-*` hook and
  falls back to the shared neutral ramp — so retheming the grid retints the confirm button with no
  `::part()` rule, in light and dark alike.
- Importing `confirm` alone is enough to register `<lr-dialog>` — `confirm.ts` imports
  `./dialog.js` for its side effect, so a consumer doesn't need a separate import for the dialog
  element.

---

## `lr-chip` / `lr-chip-group`

A small, content-agnostic surface for a short label: a tag, an active-filter/scope indicator, etc.
Distinct from `<lr-attachment-chip>` (specifically file-shaped, with a thumbnail/size/upload-
progress) — this pair carries no domain assumptions at all. `<lr-chip>` is a controlled component:
clicking its remove (×) button only fires `lr-remove` — the chip never removes itself from the DOM
on its own interaction, the same contract `<lr-attachment-chip>`/`<lr-conversation-item>`
already follow.

**Two breaks in 8.0.0.** `tone` is now `variant`, with no alias — one concept, one spelling,
library-wide. And a chip is **no longer a pill by default**: `--lr-chip-radius` used to be
`var(--lr-radius-pill)` unconditionally, is now `var(--lr-radius)` (a rounded rectangle), and the
fully-rounded treatment moved behind the new opt-in `pill` boolean. Existing markup keeps its corner
radius only if you add `pill`, or set `--lr-chip-radius: var(--lr-radius-pill)` once at the app
level. `<lr-badge>`/`<lr-tag>` made the identical shape change, with the identical `pill` opt-in.

### `lr-chip`

**Properties:**
- `size: '3xs' | '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — standard visual-density
  scale for typography, padding, gap, and icon size; `m` preserves the original chip dimensions
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected) —
  **renamed from `tone` in 8.0.0, with no alias** (see above). `<lr-badge>`, `<lr-callout>` and
  `<lr-toast-item>` all already spelled it `variant`. The exported `ChipTone` *type* name is kept
  alongside `ChipVariant`, so an existing `import type { ChipTone }` keeps resolving to the same five
  values. It tints the whole surface using the loud-color-on-quiet-tint convention: background is the
  variant's quiet fill, text/icon its loud fill, both read from the shared semantic grid. `neutral`
  deliberately opts out of that grid and falls back to a plain bordered-surface look.
- `removable: boolean = false` (reflected — shows the remove (×) button)
- `pill: boolean = false` (reflected) — **new in 8.0.0.** Fully-rounded ends instead of the default
  rounded rectangle; the same property `<lr-badge>`/`<lr-tag>` carry. Since it defaults to `false`,
  `pill="false"` is not a way to switch it off — remove the attribute, or assign `.pill = false`.
- `selected: boolean = false` (reflected) — current value for opt-in toggle/pressed mode. Once
  toggle mode is active, a separate native `[part='toggle-button']` owns focus, Enter/Space/click
  activation, and explicit `"true"`/`"false"` `aria-pressed`; `[part='base']` remains a container
  and the default-slot label is inert. Activation proposes the opposite value through the
  cancelable `lr-chip-select` event and mutates `selected` only when that event is not prevented.
  Has no toggle effect when combined with `removable`, where the remove button is the sole control.
  `false` (with `toggleable` also left at its default) reproduces the passive label-pill output.
- `toggleable: boolean = false` (reflected) — explicit opt-in into `selected`'s toggle/pressed
  interactive mode, independent of `selected`'s own current value. Setting `selected` to `true` at
  any point opts in automatically and keeps `toggleable` `true` from then on (enough for a chip that
  starts already pressed) — set `toggleable` directly instead for a chip that must be clickable from
  the outset while starting **unselected**, e.g. an initially-inactive category filter chip, since
  `selected`'s own default (`false`) can't otherwise be distinguished from "never opted in".
- `value?: string` — opaque consumer bookkeeping value, never read, validated, or rendered by this
  component itself, only ever echoed back verbatim (including `undefined` if never set) in
  `lr-remove`'s detail

**Events:** `lr-remove` (`detail: { value }` — the remove (×) button was activated via click or
Enter/Space while focused; only rendered/reachable while `removable`), `lr-chip-select`
(`detail: { value, selected }` — cancelable; fired from the native toggle button on click or
Enter/Space with the proposed next state when toggle mode is active and `removable` is not set.
Calling `preventDefault()` keeps the current `selected` state unchanged)

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the active internal control
(toggle or remove button); a passive chip's `click()` retains ordinary host behavior.

**Slots:** default (the chip's label content; inert in toggle mode, so move links/buttons outside a
toggleable chip), `icon` (optional leading icon or status dot; nothing reserved for it — no extra
gap — when left empty)

**CSS parts:** `base` (the pill's root container), `icon` (wrapper around the `icon` slot; hidden
entirely while empty), `label` (non-interactive wrapper around the default slot), `toggle-button`
(the real native toggle control, rendered over the label in toggle mode), `remove-button` (the
remove (×) affordance, only rendered while `removable`)

**Themeable custom properties:** `--lr-chip-accent`, `--lr-chip-bg`, `--lr-chip-border`
(component-local trio swapped per `variant` rather than repeating background/color/border per part
per variant; default `var(--lr-color-text)` / `var(--lr-color-surface)` / `var(--lr-color-border)` —
mirrors the same accent/bg/border vocabulary `<lr-tool-call-chip>`/`<lr-attachment-chip>` use. One
rule covers all four non-neutral variants, because the shared variants sheet has already re-pointed
`--lr-color-fill-loud`/`--lr-color-fill-quiet` at the active variant's row of the semantic grid —
the chip reads those generic slots and never names a variant, and sets its border `transparent`),
`--lr-chip-pressed-border` (border color while pressed/selected — falls back to
`--lr-chip-accent`), `--lr-chip-pressed-bg` (background color while pressed/selected — falls
back to `--lr-chip-bg`), the density quintet `--lr-chip-font-size`, `--lr-chip-padding-block`,
`--lr-chip-padding-inline`, `--lr-chip-gap`, `--lr-chip-icon-size` (all five are rewritten by each
`:host([size])` rule, so setting one directly on the element overrides that step of the scale; the
`m` defaults are `--lr-font-size-sm` / `--lr-size-0-25rem` / `--lr-space-s` / `--lr-space-xs` /
`--lr-font-size-sm`), the height pair `--lr-chip-min-height` / `--lr-chip-height` (below),
`--lr-chip-radius` (default `var(--lr-radius)`; `pill` raises it to `var(--lr-radius-pill)`) — the
corner radius of both `[part='base']` and `[part='remove-button']`, kept in sync so retuning one
retunes both, retunable without a `::part()` rule, and unlike the density quintet above it does not
vary by `size`; the same `--lr-button-radius` pattern —
plus shared tokens (`--lr-space-xs`, `--lr-space-s`,
`--lr-color-fill-loud`/`-fill-quiet`, `--lr-color-surface`, `--lr-color-border`, `--lr-color-text`,
`--lr-color-mix-active`,
`--lr-icon-button-size`, `--lr-focus-ring-width`, `--lr-focus-ring-color`,
`--lr-focus-ring-offset`, `--lr-transition-fast`).

**Chip height — a floor and an exact cap:**

- `--lr-chip-min-height` (default `--lr-size-1-5rem`) floors an **interactive** chip only — one in
  toggle mode or with `removable` set. `2xs`/`xs`/`s`/`m` all share that `1.5rem` value because it
  is the 24px WCAG 2.2 SC 2.5.8 target minimum and an interactive chip must never shrink below it;
  `l` and `xl` raise it to their own taller floors. A passive display chip takes no floor from
  this at all, and every default sits below the chip's own content-driven height, so the floor is
  invisible until you raise it.
- `--lr-chip-height` pins an **exact** height on `[part='base']` — interactive and passive chips
  alike — so a row of chips can line up with a sibling control of a known height. It is
  **undeclared by default**, which is what keeps the per-tier floor alive: `auto` is a valid
  declared value that would win over the `var()` fallback arm and make `--lr-chip-min-height` dead
  code, so never set it to `auto` — remove the declaration instead. Because the component never
  declares it, it can be set inline, from an ancestor, or from an outer-tree rule.
  **A value below 24px is for non-interactive display chips only**; pinning an interactive chip
  that short breaks its tap target.

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
children are the chips (the same shape `<lr-split>`'s panels / `<lr-source-list>`'s cards take,
no `.items` array prop).

**Properties:**
- `maxVisible?: number` (attribute `max-visible`) — maximum number of assigned children shown before
  the rest collapse behind a "+N" indicator; flattened slot-forwarded children count the same as
  direct children. Unset means no limit

**Events:** `lr-overflow-toggle` (`detail: { expanded }` — the overflow indicator was activated,
revealing or re-collapsing the excess children; fires only from that click, i.e. only when
`max-visible` is actually causing an overflow state — never as a side effect of `max-visible`/
children changing on their own)

**Slots:** default (`<lr-chip>` elements, or any content, though the chip pairing is the intended
usage)

**CSS parts:** `base` (the flex-wrap container, holds both the slot and the overflow indicator),
`overflow-indicator` (the "+N" / "Show less" toggle button; only rendered while `max-visible` is
actively causing an overflow — a locally-styled pill, not an instantiated real `<lr-chip>`)

**Themeable custom properties:** `--lr-chip-group-overflow-expanded-color` (default
`var(--lr-color-text)`) — text color of `[part="overflow-indicator"]` while expanded
(`aria-expanded="true"`). A state hook: an inline `var()` fallback at the point of use, never a
`:host` declaration, so it can be set on the element *or on any ancestor*. It exists because
`::part(overflow-indicator)[aria-expanded='true']` is invalid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so retinting only the expanded state otherwise meant re-pointing the
library-wide `--lr-color-text` token. Left unset, rendering is unchanged. Otherwise shared tokens
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
  const group = document.querySelector('lr-chip-group');
  group.addEventListener('lr-overflow-toggle', (e) => console.log(e.detail.expanded));
  group.querySelectorAll('lr-chip').forEach((chip) => chip.addEventListener('lr-remove', (e) => console.log(e.detail.value)));
</script>
```

Since CSS alone can't parameterize `:nth-child` on a runtime prop, `<lr-chip-group>` reaches
directly into the light DOM and sets each excess child's own `hidden` property once `max-visible` is
exceeded — the same approach `<lr-split>` uses to set each panel's inline `flex`/`order`, rather
than a stylesheet-only solution. It observes live author changes to each managed child's `hidden`
state and restores the latest author-owned value when ownership ends or the group disconnects;
reconnecting reapplies the current collapsed state.

**Known gotchas:**
- `<lr-chip>`'s accessible remove-button label ("Remove {text}") is computed only from the default
  slot's own text content — text living inside the (decorative) `icon` slot doesn't leak into it.
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
entirely and this component stops *computing* its own `aria-label` from `keys`, leaving the slotted
content to carry its own accessible name. A host-supplied `aria-label` in custom mode is forwarded
to `[part="base"]` together with `role="img"`; without one, the wrapper adds no image role and
leaves the slotted content's own semantics exposed.

**CSS parts:** `base` (the chip root), `key` (one per rendered token).

**Themeable custom properties:** shared tokens only — `--lr-space-xs`, `--lr-color-surface`/
`-border`/`-text`/`-text-quiet`, `--lr-radius`, `--lr-font`.

**Optional peer deps:** none.

```html
<lr-kbd keys="mod+k"></lr-kbd>
<lr-kbd keys="mod+shift+p"></lr-kbd>
<lr-kbd keys="esc"></lr-kbd>
```

Platform detection (`IS_MAC`, computed once at module scope, not per-instance/per-render, since a
page's platform never changes mid-session) prefers `navigator.userAgentData` (Client Hints, so far
Chromium-only) when available, falling back through `navigator.platform` (long-deprecated) and
finally a `navigator.userAgent` substring check — all three are deprecated/non-standard to varying
degrees but remain, in combination, the practical cross-browser way to answer "is this macOS" today.
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
virtual element), `for` (a same-root id), then the first element assigned to the `anchor` slot.

**Properties:**
- `active: boolean = false` (reflected) — whether the popup renders and positions. Nothing else
  changes when it flips.
- `anchor: Element | string | VirtualAnchor | null = null`, `for: string = ''` (reflected), and
  `virtualAnchor` (property only) — the non-slot anchors, in the precedence order above
- `placement: Placement = 'top'` (reflected) — the full Floating UI vocabulary, mirrored
  under RTL
- `strategy: 'absolute' | 'fixed' = 'absolute'` (reflected) — the CSS positioning scheme. `fixed`
  escapes every ancestor transform/filter/containment context; `absolute` positions against the
  nearest positioned ancestor, so the popup scrolls with its containing content
- `distance: number = 0` — offset from the anchor along the placement axis, in px
- `skidding: number = 0` — offset along the anchor's edge, in px
- `flip: boolean = false` (reflected), with `flipFallbackPlacements: string = ''` (attribute
  `flip-fallback-placements` — a
  space-delimited placement list `flip` tries in order instead of just the opposite side;
  unrecognized entries are dropped rather than forwarded), `flipFallbackStrategy: 'best-fit' |
  'initial' | 'initial-placement' = 'best-fit'` (attribute `flip-fallback-strategy` — what `flip` settles on
  when no candidate fits: the least-overflowing one, or `placement` as written),
  `flipBoundary: PlaceBoundary | null = null` (property only — element(s) to measure overflow
  against instead of the popup's clipping ancestors) and `flipPadding: number = 0` (attribute
  `flip-padding`)
- `boundary: 'viewport' | 'scroll' = 'viewport'` (reflected) — shared overflow boundary for flip,
  shift, and auto-size; each middleware-specific boundary below overrides it independently
- `shift: boolean = false` (reflected), with
  `shiftBoundary: PlaceBoundary | null = null` (property only) and
  `shiftPadding: number = 0` (attribute `shift-padding`)
- `padding: number = 0` — boundary padding kept clear by `shift` and by the available-size
  measurement
- `autoSize: 'horizontal' | 'vertical' | 'both' | null = null` (attribute `auto-size`), with
  `autoSizeBoundary: PlaceBoundary | null = null` (property only) and
  `autoSizePadding: number = 0` (attribute `auto-size-padding`). The popup is *always* capped by the
  available space it publishes as `--lr-positioner-available-inline-size` /
  `--lr-positioner-available-block-size`; `auto-size` re-measures the named axes against
  `auto-size-boundary`/`auto-size-padding` instead of the shared `padding`, so it narrows or widens
  that cap rather than introducing one. An unrecognized value is inert rather than half-applied.
- `sync: 'width' | 'height' | 'both' | null = null` — copies the anchor's inline size, block size,
  or both onto the popup. An unrecognized value is inert, for the same reason.
- `hoverBridge: boolean = false` (attribute `hover-bridge`, reflected) — renders an invisible quad
  across the `distance` gap, so a pointer travelling between anchor and popup never leaves both at
  once. Purely geometric: this element owns no hover policy of its own, the component built on top
  reads the hover.
- `arrow: boolean = false` (reflected), `arrowPlacement: 'anchor'|'start'|'end'|'center' = 'anchor'`
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
resize and layout change; useful after moving a virtual anchor imperatively.

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

**Properties:**
- `open: boolean = false` (reflected) — assigning it runs the same `lr-show`/`lr-hide` lifecycle as
  `show()`/`hide()`, so the property, the reflected attribute and the two methods can never disagree
- `placement: Placement = 'top'` (reflected) — the full Floating UI vocabulary, mirrored
  under RTL
- `distance: number = 8` — anchor-offset distance in px (Floating UI's main-axis `offset()`). May
  legitimately be negative to overlap the trigger; a non-finite value falls back to the default.
- `skidding: number = 0` — offset *along* the anchor's edge, in px (Floating UI's cross-axis
  offset). New in 8.0.0.
- `for: string = ''` (reflected) — id of an element to position against instead of the slotted
  trigger, resolved in this element's own root so it works inside a shadow tree where a plain idref
  could not cross the boundary. The trigger keeps owning the click and the ARIA relationship, so a
  popover can be anchored to an element it does not contain. A `showAt()` virtual anchor still wins.
  Assigning `null` is the mapped setter-only clearing spelling: it removes the attribute and the
  getter continues to return `''`
- `anchor: Element | null = null` (property only) — direct anchor, taking priority over `for` and
  the slotted trigger; a `showAt()` virtual anchor still wins
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
- `accessibleLabel: string = ''` (attribute **`aria-label`**) — names the popup; falls back to the
  localized "Popover" (or "Menu" when `popupRole` is `menu`)
- `popupRole: 'dialog'|'menu' = 'dialog'` (attribute `popup-role`)

To preserve the previous Lyra-shaped defaults explicitly, use
`placement="bottom-start" distance="4" without-arrow`; origin-aware migration emits those tokens.

The slotted trigger receives `aria-haspopup`, `aria-expanded`, and `aria-controls`.
`aria-controls` targets the public `lr-popover` host (which receives a stable generated `id` when
the consumer did not supply one), rather than the shadow-private popup, so the relationship
resolves from a native light-DOM trigger. `lr-button` and `lr-icon-button` additionally reflect
that host onto their focused shadow-internal controls through `ariaControlsElements`; supporting
browsers intentionally serialize the internal control's `aria-controls` content attribute as an
empty string after that assignment.
**Methods:** `show(): Promise<void>` opens the popover programmatically — identical to
`el.open = true`, including the veto point — and resolves after `lr-after-show`. A no-op or vetoed
transition returns an already-resolved promise.
`showAt(rect: { x, y, width?, height?, contextElement? }, options?: { returnFocusTo?:
HTMLElement })` opens the popover anchored to an arbitrary rectangle instead of the slotted
`trigger` — for a graph node, a canvas pixel, a chart datum, or any other non-DOM location
(`width`/`height` default to `0`, a point). Escape and light-dismiss return focus to
`options.returnFocusTo` when supplied, or skip focus-return entirely otherwise, since a virtual
anchor has no `.focus()`. The virtual anchor has no DOM node of its own for `autoUpdate()` to
track ancestor scroll/resize against — pass `rect.contextElement` (a real, still-connected element
near the virtual point) when one is available to give it something to observe; otherwise, or when
the anchor point moves on its own (e.g. a graph pan/zoom tick), re-call `showAt()` with fresh
coordinates to re-anchor — the popover stays open across such a call. A popover that never calls
`showAt()` behaves exactly as before. Non-finite coordinates or dimensions are a no-op and leave
the current open/anchor state unchanged.
`hide(options?: { focusTrigger?: boolean }): Promise<void>` programmatically closes the popover and
resolves after `lr-after-hide`; pass
`{ focusTrigger: false }` to opt out of focus restoration. By default, `hide()`, Escape, light
dismiss, and a bare `el.open = false` all return focus to the slotted trigger, or to a virtual
anchor's explicit `returnFocusTo`; a virtual anchor with no return target closes without moving
focus. No-op when already closed.
**Events:** `lr-show` (cancelable), `lr-after-show`, `lr-hide` (cancelable), `lr-after-hide` — none
carries a detail, and the two `lr-after-*` events are never cancelable. Neither pair fires for
markup that renders open from the start, nor when only `placement`/`distance` change on an
already-open popover.

**Breaking in 8.0.0:** `lr-show`/`lr-hide` now fire *before* the state changes and are cancelable —
`preventDefault()` on `lr-show` leaves the popover closed for the trigger click, `show()` and
`open = true` alike, and on `lr-hide` keeps it open for every dismissal path (Escape, light dismiss,
`hide()`, `open = false`). Reading `el.open` inside such a handler therefore returns the *old*
value; in 7.x these events fired after the fact and were purely informational. That is exactly the
timing `wa-show`/`wa-hide` always had, so the `wa-*` → `lr-*` migration table's "mechanical rename"
promise now holds for these names too — which also means 7.x Lyra code that read `el.open` in the
handler was relying on the *opposite* polarity and must be re-read. `lr-after-show`/`lr-after-hide`
are new in 8.0.0 and settle after the public `popover.show` / `popover.hide` registry animation.
Per-element overrides win over page defaults; keyframes-only overrides retain the popup's
`--show-duration` / `--hide-duration` and shared easing. Reduced motion flattens timing to zero, and
a `null` registration skips interpolation, but neither path skips the after-event or its
method-promise settlement.

**Slots:** `trigger` (the interactive element that toggles the popover), default (popover content).

**CSS parts:** `trigger`; `popup dialog popup__popup`; `content body`; and
`arrow popup__arrow` (rendered unless suppressed). Names grouped together are aliases on the same
node. The arrow's part attribute also carries the **resolved side** as a second token — `arrow-top`,
`arrow-bottom`, `arrow-left`, `arrow-right` — so `::part(arrow arrow-top)` styles one side.
`::part(arrow)[data-side]` and `::part(arrow) .inner` are invalid selectors that silently never
match; the state is in the part name.

**Themeable custom properties:** mapped `--max-width`, `--arrow-size`, `--show-duration`, and
`--hide-duration`, with retained `--lr-overlay-max-inline-size` and `--lr-overlay-arrow-size`
fallbacks. Arrow size is half the square's width. Rendering the arrow switches `[part~="popup"]` to
`overflow: visible` so it is not clipped, moving the scroll container onto `[part~="content"]`.

```html
<lr-popover arrow arrow-placement="center" placement="bottom" distance="8" skidding="12">
  <button slot="trigger" type="button">Details</button>
  <p>Anchored content.</p>
</lr-popover>
<script type="module">
  import '@aceshooting/lyra-ui/components/overlays/overlay/popover.js';

  const popover = document.querySelector('lr-popover');
  let ready = false;
  popover.addEventListener('lr-show', (event) => {
    // vetoes the open; popover.open is still false inside this handler
    if (!ready) event.preventDefault();
  });
  popover.addEventListener('lr-after-show', () => console.log('fully open'));
</script>
```

## `lr-tooltip`

A tooltip for a consumer-owned trigger, positioned with the shared Floating UI positioner. Which
interactions open it is configurable as of 8.0.0; by default it is still hover and focus.

**Properties:**
- `open: boolean = false` (reflected) — assigning it runs the same lifecycle as `show()`/`hide()`.
  Assigning `false` also cancels a delayed open that has not fired yet, even when the tooltip is
  already closed, so a pending timer can't reopen it behind the caller's back.
- `trigger: string = 'hover focus'` — **new in 8.0.0.** A *space-separated* list of `hover`,
  `focus`, `click` and `manual`. `manual` (or an empty list) leaves the tooltip entirely under
  programmatic control. Note the name collision: this string property and the `trigger` *slot* are
  different things — the slot holds the element, this property says which of its interactions count.
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
- `for: string = ''` (reflected) — id of an element in this tooltip's own root to position against
  instead of the slotted trigger; the trigger keeps owning the interaction listeners and
  `aria-describedby`. New in 8.0.0. Assigning `null` clears the attribute to the canonical `''`
  read value; the getter itself remains non-nullable
- `anchor: Element | null = null` (property only) — direct anchor, taking priority over `for` and
  the active trigger
- `disabled: boolean = false` (reflected) — prevents both interaction and programmatic opening;
  setting it while open closes the tooltip
- `hoist: boolean = false` (reflected) — switches the mapped absolute positioning default to fixed
- `arrow: boolean = true` (reflected), `withoutArrow: boolean = false` (attribute `without-arrow`,
  reflected), `arrowPlacement: 'anchor'|'start'|'end'|'center' = 'anchor'`
  (attribute `arrow-placement`) and `arrowPadding: number = 0` (attribute `arrow-padding`) — the
  same arrow trio `<lr-popover>` documents above, new in 8.0.0
- `content: string = ''` — plain-text tooltip content, used when nothing is slotted
- `accessibleLabel: string = ''` (attribute **`aria-label`**)

To preserve the previous Lyra-shaped visual defaults explicitly, use `distance="6" without-arrow`;
origin-aware migration emits those tokens.

**Methods:**
- `show(): Promise<void>` — open immediately, bypassing `show-delay` and interaction policy, then
  resolve after `lr-after-show`
- `hide(): Promise<void>` — close immediately, bypassing `hide-delay`, then resolve after
  `lr-after-hide`
- `showAt(rect: { x, y, width?, height?, contextElement? }, options?: { returnFocusTo?: HTMLElement })`
  — same virtual-anchor contract as `lr-popover.showAt()` above (anchors to an arbitrary rectangle
  instead of the slotted `trigger`, `width`/`height` default to `0`, `contextElement` gives
  `autoUpdate()` something to observe, Escape returns focus to `options.returnFocusTo` or skips
  focus-return, re-call with fresh coordinates to re-anchor a moving point). Opens immediately,
  bypassing `show-delay`/`trigger`/`manual` (all are interaction-debounce concerns for a slotted
  trigger, not a deliberate programmatic call); close it with `hide()` or `open = false`. Non-finite
  coordinates or dimensions are a no-op.

**Events:** `lr-show` (cancelable), `lr-after-show`, `lr-hide` (cancelable), `lr-after-hide` — the
same four-event contract, timing and veto semantics `<lr-popover>` documents above, and all four are
new to this component in 8.0.0. A vetoed `lr-show` leaves the tooltip closed whether the delay
elapsed, `show()` was called, or `open` was assigned.

Tooltip motion resolves `tooltip.show` / `tooltip.hide` through the public animation registry.
The same per-element/global precedence, RTL keyframe selection, token-timing fallback,
reduced-motion flattening, and null-disable lifecycle rules documented for `lr-popover` apply.

**Slots:** both mapped shapes are supported. Web Awesome uses named `trigger` plus default tooltip
content. Shoelace uses the default slot for the trigger and `slot="content"` (or the `content`
property) for tooltip content. A named trigger always selects the first shape; without one, an
explicit content source makes the default slot unambiguously the trigger.

**CSS parts:** `popup base tooltip base__popup` are aliases on the same wrapper; `trigger`; `body`;
and `arrow base__arrow` (rendered unless suppressed). The arrow also carries the resolved side —
`arrow-top`, `arrow-bottom`, `arrow-left`, or `arrow-right`.

**Themeable custom properties:** mapped `--max-width`, `--show-delay`, `--hide-delay`, and
`--arrow-size`; retained `--lr-tooltip-max-inline-size`, `--lr-tooltip-background`,
`--lr-tooltip-color`, and `--lr-tooltip-arrow-size` remain fallbacks. A tooltip popup has no inner
scroll wrapper to move overflow onto, so its default arrow trades internal scrolling for a visible
arrow — use `<lr-popover>` when a floating surface needs both.

```html
<lr-tooltip trigger="hover focus click" show-delay="0" hide-delay="400" arrow placement="right">
  Copied to clipboard
  <button slot="trigger" type="button">Copy</button>
</lr-tooltip>

<!-- Shoelace-compatible shape: default trigger, named content. -->
<lr-tooltip content="Save your changes">
  <button type="button">Save</button>
</lr-tooltip>
```

While open, trigger `aria-describedby` points to a hidden text proxy in the tooltip's light DOM,
not the shadow-private popup. Native triggers resolve that ID directly. A description is only
announced on the node that actually holds focus, so when the trigger is a custom element the same
proxy is applied to the first focusable descendant as well — across slots and nested open shadow
roots — which covers `lr-select`, `lr-switch`, `lr-chip` and any consumer-authored wrapper, not
just the components that forward their own host `aria-describedby`. A descendant in the same tree
receives the serialized ID; one inside a shadow root is linked through `ariaDescribedByElements`,
whose explicit element-reference assignment intentionally leaves that control's serialized
`aria-describedby` value empty in supporting browsers. Existing author-provided descriptions —
including a control's own internal hint/error text — are merged while open and restored when the
tooltip closes, the trigger is replaced, or the tooltip disconnects.

Plain content keeps `role="tooltip"`. If actionable content appears anywhere in the assigned
default-slot subtree — including inside a nested custom element's open shadow root — the popup
promotes to a named `role="dialog"` and remains open while pointer or focus is within it. Escape
from either the trigger or popup closes it; Escape from popup content returns focus to the trigger.
While open, rootless custom-element content receives a bounded initialization grace period for an
upgrade or newly attached open shadow root; later observable content mutations start a fresh
grace period. This catches normal lazy initialization without scheduling perpetual animation-frame
work for a legitimate custom element that intentionally has no shadow root. Use `lr-popover` when
click-to-open ownership is desired.

**`showAt()` composed with `lr-graph`** — anchoring a popover to a clicked graph node. Note:
`lr-graph.getNodePosition()` and the `lr-node-click` event's `{ x, y }` are in the graph's own
*local drawing space* (pre pan/zoom), not viewport pixels, so they can't be passed to `showAt()`
directly. For `renderer="svg"` (the default), read the clicked node's own rendered element instead,
whose `getBoundingClientRect()` is already viewport-relative; for `renderer="canvas"` (no per-node
DOM element), use the click event's own `clientX`/`clientY`.

```js
const graph = document.querySelector('lr-graph');
const detail = document.querySelector('lr-popover'); // no slotted trigger needed for showAt()

graph.addEventListener('click', (event) => {
  const nodeEl = event.composedPath().find((el) => el instanceof Element && el.matches('[part="node"]'));
  if (!nodeEl) return; // clicked empty canvas/background, not a node
  const rect = nodeEl.getBoundingClientRect();
  detail.showAt({ x: rect.left + rect.width / 2, y: rect.top, width: rect.width, height: rect.height });
});
```

## `lr-dropdown`

The complete mapped action-menu component. The public element remains a Popover-style trigger plus
positioned popup; inside that popup it owns the same contained interaction engine as `lr-menu`, so
direct `lr-dropdown-item`/`lr-menu-item` children get roving focus, disabled skipping, type-ahead,
nested submenu keyboard/pointer intent, and focus return without a second public popup. A
consumer-supplied `lr-menu` in the default slot becomes that contained engine instead of being
wrapped in another menu. This supports both Web Awesome's direct-item shape and Shoelace's
consumer-menu shape.

**Direct mapped items.** `<lr-dropdown-item>` is the Web Awesome-compatible name for the same row
implementation as `<lr-menu-item>`. Direct mapped items receive this dropdown's `size` and use its
contained roving-focus, type-ahead, disabled-skipping, selection, and submenu controller; a
consumer-supplied `<lr-menu>` uses that controller directly. This preserves both Web Awesome's
direct-item composition and Shoelace's consumer-menu composition. The canonical item properties,
methods, events, slots, parts, and theme variables are documented in the layout-family
`lr-menu` / `lr-menu-item` section.

**Properties:**
- `open: boolean = false` (reflected), `placement: Placement = 'bottom-start'`,
  `distance: number = 0`, `skidding: number = 0`, and `for: string = ''` — the same positioning
  vocabulary as `lr-popover`, except the mapped dropdown sits flush against its trigger by default.
  An explicit distance still wins, and generic `lr-popover` keeps its own default of `8`.
- `size: LyraSize = 'm'` (reflected) — propagated to directly owned mapped items. Accepts the
  six-step Lyra ladder and `small`/`medium`/`large` aliases.
- `disabled: boolean = false` (reflected) — prevents pointer/keyboard/programmatic opening and
  dismisses an already-open dropdown when enabled.
- `stayOpenOnSelect: boolean = false` (attribute `stay-open-on-select`, reflected) — suppresses the
  default selection close for direct and nested selections.
- `hoist: boolean = false` (reflected) — uses viewport-fixed positioning; otherwise the popup uses
  the containing-block (`absolute`) strategy.
- `sync?: 'width'|'height'|'both'` (reflected) — copies the trigger dimension(s) onto the popup.
- `containingElement?: HTMLElement` (property only) — an external element that counts as inside for
  light-dismiss handling.
- `arrow`, `withoutArrow` (`without-arrow`), `arrowPlacement`, `arrowPadding`, `accessibleLabel`
  (`aria-label`) and `popupRole` are retained from `lr-popover` for existing Lyra consumers; the
  popup role defaults to `menu` and its accessible-name fallback is the localized "Menu".

**Methods:** `show(): Promise<void>` and
`hide(options?: { focusTrigger?: boolean }): Promise<void>` use the same cancelable before-events,
after-events, focus return, and settlement rules as `lr-popover`. `reposition(): void` immediately
recomputes placement after an imperative anchor/layout change. `showAt()` remains available for
Lyra's virtual-anchor compatibility surface.

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
`lr-menu`). **CSS parts:** `trigger`; `popup dialog popup__popup base base__popup panel` (all six
tokens on the positioned popup, preserving the popover, Web Awesome and Shoelace wrapper names on
the same node); `menu` (the contained controller); `content body`; and the retained optional
`arrow popup__arrow` token set.

**Themeable custom properties:** `--show-duration` and `--hide-duration` (both default
`var(--lr-transition-fast)`), mapped `--max-width` and `--arrow-size`, plus retained
`--lr-overlay-max-inline-size` and `--lr-overlay-arrow-size` fallbacks.

```html
<lr-dropdown aria-label="File actions" size="small">
  <button slot="trigger">Actions</button>
  <lr-dropdown-item value="rename"><span slot="details">⌘R</span>Rename</lr-dropdown-item>
  <lr-dropdown-item>
    Share
    <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
    <lr-dropdown-item slot="submenu" value="link">Copy link</lr-dropdown-item>
  </lr-dropdown-item>
  <lr-dropdown-item value="delete" variant="danger">Delete</lr-dropdown-item>
</lr-dropdown>
<script type="module">
  document.querySelector('lr-dropdown').addEventListener('lr-select', (event) => {
    console.log(event.detail.item.value);
  });
</script>
```

## `lr-spinner`

An indeterminate busy indicator with a localized `role="status"` name.

**Properties:** `labelPlacement: 'none' | 'after' = 'none'` (attribute `label-placement`, reflected)
and `accessibleLabel: string | null = null` (attribute **`aria-label`**, not `accessible-label`) —
names `[part="base"]`'s `role="status"`; unset falls back to the localized "Loading…".

**Events:** none.

**Slots:** default — optional label text. `label-placement="after"` renders it inline next to the
indicator and its text becomes the status name unless `aria-label` overrides it. `'none'` (the
default) applies the native `hidden` state to the label wrapper, removing it from both rendering and
the accessibility tree; the status then uses `aria-label` or the localized "Loading…" fallback.

**CSS parts:** `base` and `spinner` are aliases on the same `role="status"` outer wrapper;
`spinner-indicator` is the animated `aria-hidden` ring, and `label` is the default-slot wrapper.

**Themeable custom properties:** `--lr-spinner-size` (default `var(--lr-size-1-25rem)` — both
dimensions), `--lr-spinner-track-width` (default `var(--lr-border-width-medium)` — ring thickness),
`--lr-spinner-duration` (default `var(--lr-transition-ambient)` — the duration *and* easing of one
full rotation; the animation is dropped entirely under `prefers-reduced-motion: reduce`). The ring
colors come from `--lr-color-brand`/`-brand-quiet`. Upstream aliases are `--track-width`,
`--track-color`, `--indicator-color`, and `--speed`.

## `lr-progress-bar`

A determinate or indeterminate progress bar with an independently visible label and optional
formatted percentage.

**Properties:** `value` (reflected), `max`, `indeterminate`, `variant`, `showValue` (`show-value`), and
`label` (mapped accessible-name property), plus the Lyra compatibility alias `accessibleLabel`
(`accessible-label`). Host `aria-label` has highest precedence.
The rendered progressbar exposes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` when
determinate. Slotted label content is always visible and names the progressbar unless an explicit
label overrides it; `show-value` controls only whether the locale-formatted percentage is appended.
Live label mutations stay synchronized.

**Slots:** default — label content; `label` — compatibility alias for the default slot.
**CSS parts:** `base` and `progress-bar` are aliases on the same progressbar; `track`, `indicator`,
`label`.
**Themeable custom properties:** `--lr-progress-track-height` (default
`var(--lr-progress-height, var(--lr-size-1rem))`; `--lr-progress-height` is the legacy fallback),
`--lr-progress-track-color` (default `var(--lr-color-brand-quiet)`),
`--lr-progress-indicator-color` (default `var(--lr-color-brand)`), and
`--lr-progress-label-color` (default `var(--lr-color-text)`). Upstream aliases are `--height` and
`--track-height`, plus `--track-color`, `--indicator-color`, and `--label-color`.

**Additional API surface:**

- `--lr-progress-duration` — Indeterminate sweep timing. Default: `var(--lr-transition-ambient)`.

## `lr-progress-ring`

A circular progress indicator with the same value contract as `lr-progress-bar`.

**Properties:** `value: number = 0` (reflected), `max: number = 100`, `indeterminate: boolean = false`
(reflected), `label: string = ''` (the mapped accessible-name property), and
`accessibleLabel: string = ''` (attribute `accessible-label`; Lyra compatibility alias). Host
`aria-label` takes precedence; otherwise the name falls back to `label`, `accessibleLabel`, the
visible default-slot text when supplied, then the localized "Progress". Non-finite/out-of-range
`value`/`max` are normalized (`max <= 0` falls
back to `100`, `value` clamps to `[0, max]`) rather than producing NaN geometry.
**Slots:** default — replaces the built-in center label, which otherwise renders the rounded
percentage (and nothing at all while `indeterminate`).
**CSS parts:** `base` and `progress-ring` are aliases on the same progressbar; `track`, `indicator`,
`label`.
**Themeable custom properties:** `--lr-progress-ring-size` (default `var(--lr-size-2-5rem)` — the
ring's inline and block size), `--lr-progress-ring-track-width` (default `var(--lr-size-4px)`),
`--lr-progress-ring-track-color` (default `var(--lr-color-brand-quiet)`),
`--lr-progress-ring-indicator-width` (defaulting to the track width),
`--lr-progress-ring-indicator-color` (default `var(--lr-color-brand)`),
`--lr-progress-ring-indicator-transition-duration` (default `var(--lr-transition-base)`), and
`--lr-progress-duration` (default
`var(--lr-transition-ambient)` — the indeterminate spin period, the same token and the same default
as `lr-progress-bar`'s sweep, so it flattens under `prefers-reduced-motion: reduce` with the rest of
the ambient motion).
Upstream aliases are `--size`, `--track-width`, `--track-color`, `--indicator-width`,
`--indicator-color`, and `--indicator-transition-duration`.

## `lr-badge` and `lr-tag`

Compact status labels. `LyraTag` extends `LyraBadge`, so the two share one visual contract; `lr-tag`
adds tag semantics and an optional remove affordance.

**Visual break in 8.0.0 — a badge is no longer a pill by default.** Both components used to render
fully-rounded ends unconditionally. `--lr-badge-radius` now defaults to `var(--lr-radius)` (a rounded
rectangle) and the pill treatment moved behind the new opt-in `pill` boolean. Existing markup keeps
its corner radius only if you add `pill`, or set `--lr-badge-radius: var(--lr-radius-pill)` once at
the app level.

**Properties** (all are declared by `lr-badge` and inherited by `lr-tag`; `lr-tag` adds the
`variant="text"` write alias plus `withRemove` / `removable`):
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected) — the
  semantic palette. Both components accept the upstream `primary` setter/attribute alias and
  normalize it to the canonical `brand` read value. `lr-tag` additionally accepts `text`, renders
  the neutral plain treatment, and reads back the canonical `neutral` variant.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — the same visual-density scale
  `<lr-chip>` uses, for typography/padding/minimum block size; `m` preserves the original badge
  dimensions. The setters also accept `small` / `medium` / `large` and normalize reads to
  `s` / `m` / `l`.
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
- `pulse: boolean = false` (reflected) — upstream-compatible shorthand for the pulse attention
  treatment. Lyra's intentional `variant="neutral"` and `appearance="filled-outlined"` defaults
  remain unchanged because the two pinned upstreams disagree on both defaults.
- `withRemove: boolean = false` (attribute `with-remove`, reflected) — **`lr-tag` only, new in
  8.0.0.** Renders the remove affordance. `lr-badge` never renders one, even if the attribute is
  present on the markup.
- `removable: boolean = false` (attribute `removable`) — **`lr-tag` only.** Shoelace-compatible
  alias for `withRemove`; reading or assigning either property reaches the same state.

**Events:** `lr-remove` — cancelable, no detail, bubbles and composes. Emitted by `lr-tag` only (a
badge emits nothing at all) when the remove button is activated by click or by Enter/Space while
focused; it is a real native `<button>`, so both come for free. Only rendered, and therefore only
fired, while `withRemove` / `removable` is set, and the event's `target` is the tag itself.

Unlike `<lr-chip>` — a deliberately controlled component that only ever *announces* a remove request
— a removable `lr-tag` removes **itself** from the DOM on activation. `lr-remove` is the veto point
for that: call `preventDefault()` to keep the tag mounted and own the removal from your own state.

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
others. All of them are declared by `lr-badge` and reach `lr-tag` unchanged.

*Overrides* — undeclared by default, so they still inherit from a consumer's own ancestor rule, and
win over whatever `variant`/`appearance` resolved: `--lr-badge-background` (falls back to
`--lr-badge-fill`), `--lr-badge-border` (falls back to `--lr-badge-stroke`), `--lr-badge-color`
(falls back to `--lr-badge-text`).

*Palette — what `variant` chooses* (new in 8.0.0): `--lr-badge-tint` (default
`var(--lr-color-surface)`, the quiet fill; each non-neutral variant sets it to
`var(--lr-color-fill-quiet)`, which the shared variants sheet has already re-pointed at that
variant's row of the semantic grid), `--lr-badge-solid` (default `var(--lr-color-fill-loud)`, the
loud fill used by `appearance="accent"`), `--lr-badge-edge` (default `var(--lr-color-border)`, the
border color), `--lr-badge-ink` (default `var(--lr-color-text)`, the text color) and
`--lr-badge-on-solid` (default `var(--lr-color-on-loud)`, the text color that stays legible on
`--lr-badge-solid`). Neutral is the only variant whose border and text colors differ, which is why
`-edge` and `-ink` are separate slots rather than one loud color.

*Surface — what `appearance` routes onto the box* (new in 8.0.0): `--lr-badge-fill` (default
`var(--lr-badge-tint)`), `--lr-badge-stroke` (default `var(--lr-badge-edge)`) and `--lr-badge-text`
(default `var(--lr-badge-ink)`). Set one of these to retune a single appearance without touching the
palette.

*Density and shape:* `--lr-badge-font-size` (default `var(--lr-font-size-sm)`),
`--lr-badge-padding-inline` (default `var(--lr-space-s)`) and `--lr-badge-min-height` (default
`var(--lr-size-1-25rem)`) — the trio each `:host([size])` rule rewrites to that step's font size,
inline padding and minimum block size; the `m` defaults above exactly reproduce the pre-`size` fixed
badge treatment. `--lr-badge-gap` (default `var(--lr-space-2xs)`, new in 8.0.0) is the space between
the `start` slot, the label and the `end` slot — it collapses on its own when a wrapper is empty,
because the empty wrapper is `display: none` rather than zero-width. `--lr-badge-radius` (default
`var(--lr-radius)`; `pill` raises it to `var(--lr-radius-pill)`) is `[part='base']`'s corner radius,
retunable without a `::part(base)` rule and, unlike the density trio, does not vary by `size` — the
same `--lr-button-radius` pattern.

*Attention* (all new in 8.0.0): `--lr-badge-attention-duration` (default
`var(--lr-duration-ambient)` — one cycle of the animation), `--lr-badge-attention-easing` (default
`var(--lr-easing-emphasized)` — kept a separate token from the duration so the `animation` shorthand
expands to exactly one timing function), `--lr-badge-pulse-color` (default
`color-mix(in srgb, currentColor 40%, transparent)` — the expanding ring's color; upstream alias
`--pulse-color`),
`--lr-badge-pulse-spread` (default `var(--lr-size-0-25rem)` — how far the ring expands) and
`--lr-badge-bounce-distance` (default `var(--lr-size-0-1875rem)` — the hop's peak travel).

*`lr-tag`'s own two* (new in 8.0.0): `--lr-tag-remove-radius` (default `var(--lr-badge-radius)`, so
retuning the tag's corner retunes the remove button's with it) and
`--lr-tag-remove-hover-background` (default `color-mix(in srgb, currentColor 16%, transparent)` —
the remove button's `:hover` fill).

**Known gotchas:**
- The remove button's hit target meets the shared `--lr-icon-button-size` minimum in both axes while
  the visible glyph stays compact; the extra growth is pulled back with a matching negative margin
  on every side, so the enlarged hit area overhangs the pill's padding instead of inflating the
  row's layout box.
- Its accessible name is computed from the default slot's own text ("Remove {label}", localized;
  bare "Remove" for a label-less tag) and re-derived live when that text changes. Text inside the
  decorative `start`/`end` slots never leaks into it, and a host `aria-label` wins outright.
- `appearance` and `variant` are orthogonal: `appearance="plain"` on `variant="danger"` still reads
  as danger, because the palette is chosen before the surface routing.

```html
<lr-badge variant="success" appearance="accent" pill size="s">
  <svg slot="start" aria-hidden="true" width="12" height="12"><!-- icon --></svg>
  Live
</lr-badge>

<lr-tag variant="brand" appearance="outlined" with-remove>Design</lr-tag>
<script type="module">
  import '@aceshooting/lyra-ui/components/overlays/badge/badge.js';
  import '@aceshooting/lyra-ui/components/overlays/badge/tag.js';

  document.querySelector('lr-tag').addEventListener('lr-remove', (e) => {
    e.preventDefault(); // keep it mounted; drive removal from your own state instead
  });
</script>
```

## `lr-alert`

A closed-by-default alert that exactly carries the pinned Shoelace alert surface under the `lr-`
prefix. Use `lr-callout` for Lyra/Web Awesome's always-open inline callout contract; use `lr-alert`
when migrated markup relies on `open`, timed dismissal, countdown, or identity-preserving
`toast()` behavior.

**Properties:**

- `open: boolean = false` (reflected) — controls visibility. Initial `open` markup establishes
  state silently; later property or attribute changes run the full lifecycle below.
- `closable: boolean = false` (reflected) — renders a localized close action.
- `variant: 'primary' | 'success' | 'neutral' | 'warning' | 'danger' = 'primary'` (reflected) —
  `primary` resolves through Lyra's shared brand semantic tokens.
- `duration: number = Infinity` — milliseconds before automatic dismissal. `Infinity` stays open;
  hover or focus pauses the timer, and leaving interaction restarts the full duration.
- `countdown: 'rtl' | 'ltr' | undefined` (reflected, unset by default) — adds a decorative visual
  bar that empties in the requested physical direction. Its motion is removed under
  `prefers-reduced-motion: reduce`.

**Methods:** `show(): Promise<void>` and `hide(): Promise<void>` resolve after their respective
after-event. `toast(): Promise<void>` moves the same alert instance into Lyra's singleton logical
top-end toast region, shows it, and resolves after it hides and is removed. Keep the reference to
reuse the same identity with another `toast()` call.

**Events:** `lr-show`, `lr-after-show`, `lr-hide`, and `lr-after-hide` all bubble, compose, carry no
detail, and are noncancelable. A transition interrupted by the opposite state does not emit the
stale after-event.

**Slots:** default message content; `icon` for the optional leading icon.

**CSS parts:** `base`, `icon`, `message`, and `close-button` / `close-button__base` on the same
native close button. The pinned surface exposes no component CSS custom properties, custom states,
form association, native-event relays, or delegated native methods.

The rendered message surface has `role="alert"`. The close action's accessible name uses Lyra's
localized `close` string. Layout uses logical properties, wraps unbroken content at 320px, and the
toast path reuses the existing Lyra toast layer instead of creating a second placement system.

```html
<lr-alert id="session-alert" closable duration="10000" countdown="rtl" variant="warning">
  <svg slot="icon" aria-hidden="true"><!-- warning icon --></svg>
  Your session will expire soon.
</lr-alert>
<button type="button" onclick="document.querySelector('#session-alert').show()">Show alert</button>

<script type="module">
  import '@aceshooting/lyra-ui/components/overlays/alert/alert.js';

  const alert = document.querySelector('#session-alert');
  alert.addEventListener('lr-after-hide', () => console.log('Alert is hidden'));
</script>
```

## `lr-callout`

An inline status, warning, or error surface. Set `inline` for lightweight reactive form or mutation
errors without panel chrome.

**Properties:** `variant: 'neutral'|'brand'|'success'|'warning'|'danger' = 'brand'` (reflected when
explicit — an unset nested callout inherits its ancestor's semantic colour context without
materializing a `variant` attribute. Explicitly writing even the same-default `brand` materializes
the attribute and pins the local brand palette; removing the attribute restores contextual
inheritance. The property value still picks `[part="base"]`'s role: `alert` for `danger`, `status`
otherwise),
`appearance: 'accent'|'filled'|'outlined'|'plain'|'filled-outlined'` (reflected, with no explicit
default — when set, controls how much of the active variant palette is spent on fill, border, and
text; leaving it unset preserves the established quiet-fill/loud-edge treatment),
`size: LyraSize = 'm'` (reflected when explicit — **new in 8.0.0**; visual density on the library's shared ladder,
accepting both spellings of the aliased tiers (`s`/`small`, `m`/`medium`, `l`/`large`) so markup migrated
from `wa-callout` needs no attribute rewrite. An unset nested callout inherits its ancestor's size
context; standalone fallback is `m`. Explicitly writing even the same-default `m` pins the local
medium mapping, and removing the attribute restores contextual inheritance), `heading: string = ''`,
`closable: boolean = false` (reflected), `inline: boolean = false` (reflected), `open: boolean = true`
(reflected as a presence attribute — `open="false"` is accepted in plain markup; `false` removes the
semantic content and hides the host surface), and `accessibleLabel: string = ''`
(`accessible-label`; falls back to a plain host `aria-label` attribute when unset).

**Events:** cancelable `lr-close` (no detail); the callout sets `open = false` after the event
unless a listener calls `preventDefault()`.

**Slots:** default message, `heading` (rendered alongside the `heading` property), `icon`.

**CSS parts:** `base` (the transparent semantic grid wrapper inside the host-owned surface), `icon`
(hidden while the `icon` slot is empty), `content`, `heading`,
`message` (wrapper around the default slot), `close-button` (the close control's hit target, always
at least `--lr-icon-button-size` in both the panel and `inline` treatments), `close-icon` (the
visible "×" glyph inside it — this is what shrinks under `inline`, so the hit target never does).

The surface chrome lives on the custom-element host, not inside `base`. Ordinary host
`background`, `border`, `border-radius`, `color`, `padding`, and `margin` declarations therefore
work directly and take normal author precedence. `inline` removes the host's border, background,
and padding.

**Themeable custom properties:** `--lr-callout-background`, `--lr-callout-color`, and
`--lr-callout-border` read the inherited generic semantic quiet/loud slots, with brand quiet/loud
as their standalone fallback. An explicit `variant` maps all generic slots locally; leaving it
unset preserves an ancestor's mapping. Explicit `appearance` works with either source and uses the
same brand fallback when there is no surrounding context. `--lr-callout-close-hover-bg`
(default `var(--lr-color-brand-quiet)`) — the close button's `:hover` background, deliberately
decoupled from `--lr-callout-background` (which every explicit `variant`, including `neutral`,
retargets for the panel itself) so a consumer can retint the hover fill — e.g. to keep it visibly distinct from a
`variant="brand"` panel, which shares the same default token — without a collateral effect on the
panel background, and vice versa.

Three more, all new in 8.0.0: `--lr-callout-font-size` (default
`var(--lr-form-control-font-size, var(--lr-font-size-m))` — the callout's text size; each explicit
`size` tier maps it from the shared ladder), `--lr-callout-padding` (default
`var(--lr-form-control-padding-inline, var(--lr-space-m))` — the
panel's padding on *both* axes; each `size` tier sets it from the ladder's inline-padding knob,
because a panel's block rhythm is generous like a control's inline padding rather than tight like
its block padding, which only exists to fit text inside a fixed control height; `inline` removes it
entirely) and `--lr-callout-gap` (default `var(--lr-space-s)` — the space between the icon, the
content and the close action. It deliberately does *not* vary by `size`: it separates three adjacent
boxes rather than setting the panel's density, and shrinking it at the small tiers only crowds
them).

Initial content and initially distributed slots render while `aria-live="off"`. After that first
render/slot distribution settles, the region arms as `polite` (`assertive` for `danger`) before
later heading or message updates. Reconnection repeats the same initial-content staging.

## `lr-rating`

A keyboard-accessible star rating control with slider semantics. It is a **form-associated control**
that lives in this family rather than in `components/forms/` — if you came looking for it among the
form controls, this is its section. Everything the "Form association" section says about `name`,
submission, validity and the `user-*` custom states applies to it.

It is form-associated through `ElementInternals` directly rather than through the shared
`FormAssociated` mixin, because its `value` is a number and the mixin's contract assumes a plain
string — routing through it would force every consumer into string round-tripping for what is
natively a numeric score. The submitted entry is the clamped value stringified (`"0"` while
unrated), and `required` reports `valueMissing` until a rating above zero is set. As on a native
`<input>`, the `value` *content attribute* is the reset default that `form.reset()` restores, while
the `value` IDL property is the live score and is deliberately not reflected. The mapped
`default-value` attribute is accepted as a compatibility spelling for that same reset default.

**Properties:** live, non-reflecting `value: number = 0`; reflected
`defaultValue: number = 0` (attribute `value`, the current reset default; `default-value` is an
accepted compatibility alias); `customError: string |
null` (attribute `custom-error`); `max: number = 5`; `precision: number = 1`;
`readonly: boolean = false` (reflected), `disabled`, `required`, `name`,
`size: '2xs'|'xs'|'s'|'m'|'l'|'xl' = 'm'` (reflected — rewrites `--lr-rating-size` from a type ramp
rather than the shared control ladder, since a rating has no control frame to size; the `m` default
reproduces the treatment this component had before `size` existed; setters also accept
`small`/`medium`/`large` and normalize reads to `s`/`m`/`l`), plus two separate naming knobs:
`accessibleLabel: string = ''` (attribute **`aria-label`**) and `label: string = ''` (attribute
`label`). `label` is an accessible-name fallback used when the host carries no `aria-label` — it is
*not* visible label text, since a rating is a bare row of symbols with no field frame of its own;
wrap the element in your own layout for a labelled field, exactly as `<lr-slider>` does.

Assigning `null` to `name` is accepted for mapped source compatibility; it removes the attribute and
clears to the canonical `''` read value rather than creating a nullable state.

`getSymbol?: (value: number, selected: boolean) => unknown` (property only, no attribute) — **new in
8.0.0.** Renders a consumer-supplied symbol per position instead of the built-in star. It is called
*twice per position*: once for the empty backdrop (`selected` false) and once for the overlay
clipped to that position's filled fraction (`selected` true), which is what keeps a fractional
`precision` rendering a partial fill. Return any Lit-renderable value; a plain string renders as
text, never as markup. Left unset, the built-in star outline/solid pair is unchanged.

**Events:**
- `change` — a native `Event` (bubbling, composed, non-cancelable, and carrying no `detail`) emitted
  when a user commits a genuinely new value. It fires immediately before `lr-change`; read the
  numeric score from `event.target.value`. Programmatic `value`/`defaultValue` writes, reset/state
  restore, and gestures that clamp to the current value are silent.
- `lr-change` — `detail: { value }`. The rating was committed to a new value. Not emitted when the
  clamped value is unchanged, nor on a programmatic `value` write. It fires immediately after the
  native `change` event for the same user commit.
- `lr-hover` — **new in 8.0.0.** `detail: { phase: 'start' | 'move' | 'end', value }`, where `value`
  is the rating that committing the current pointer position *would* produce — enough to render a
  live description of what is being hovered without waiting for a click. Fires only while the rating
  is settable (neither `disabled`, fieldset-disabled, nor `readonly`). `start` also covers a pointer
  that reaches the symbols without a `pointerenter` the component saw; `end` fires on
  `pointerleave` **and** on `pointercancel` (a touch drag taken over by scrolling, palm rejection),
  so an interrupted gesture never leaves the preview frozen. A disconnect or a disablement drops the
  preview silently, with no `end` phase — that teardown wasn't user-driven.
- `focus` / `blur` — re-dispatched from the internal rating control as bubbling, composed host
  events, because the native ones do not cross the shadow boundary.
- `lr-focus` / `lr-blur` — prefixed compatibility aliases (no detail), each fired immediately after
  its unprefixed counterpart.
- `lr-invalid` — no detail; fired when a validity check finds the rating invalid.

**Methods:** `focus()`, `blur()` and `click()` forward to the internal rating control.
`getForm()` returns the browser-resolved owning form. `checkValidity()` and `reportValidity()`
behave as on a native form control — `reportValidity()`
additionally shows the browser's validation UI, and counts as interaction, so a failed submit is
what starts `user-invalid` matching. `setCustomValidity(message: string)` sets a consumer-supplied
rejection no client-side constraint can express ("you have already rated this item"): a non-empty
message raises `customError` and becomes `validationMessage`, so the control fails
`checkValidity()`, blocks submission and matches `:state(invalid)`. It is caller-supplied content,
so it is used verbatim and never localized. `setCustomValidity('')` clears it and restores the
control's *computed* validity rather than forcing it valid — a `required` control that is still
unrated stays `valueMissing`. Like a native control, the custom error survives every intrinsic
recomputation in between (each `value`/`max`/`required` change re-runs validation) and a
`form.reset()`; `setCustomValidity('')` or `resetValidity()` clears it.

**Reset and state restore.** A live `value` write marks the rating dirty, so later
`defaultValue`/`value`-attribute/`default-value`-attribute mutations update the reset target without
overwriting the live score. `form.reset()` restores that current default, drops any
in-flight hover preview, and returns the control to pristine, so the `user-valid`/`user-invalid`
states stop matching even though a required-and-unrated control is still `invalid`. Browser session
restore (`formStateRestoreCallback`) reinstates the previously submitted numeric value; a
non-string restored state falls back to `0` rather than producing NaN geometry.

**Custom states:** `required`, `optional`, `valid`, `invalid`, `user-valid`, `user-invalid` —
`lr-rating:state(user-invalid)` is the one to paint red. Plain `invalid` matches a pristine
`required` rating that has never been set.

**CSS parts:** `base` (compatibility name for the slider-like control; use `rating`),
`rating` (the `role="slider"` control; it is the same node as `base`), `star` (each rendered symbol), `star-fill` (the
filled overlay inside each symbol, clipped to that symbol's filled fraction — 0%, a partial
percentage under a fractional `precision`, or 100%).

**Themeable custom properties:** `--lr-rating-fill` (default `--lr-color-warning` — filled-symbol
color), `--lr-rating-empty-color` (default `--lr-color-border` — unfilled-symbol color, also
retained during hover preview), and `--lr-rating-size` (default `--lr-font-size-xl` — symbol size;
each `size` step rewrites it). The mapped compatibility hooks are `--symbol-color` (inactive
symbols), `--symbol-color-active` (filled symbols), `--symbol-size` (symbol size), and
`--symbol-spacing` (the gap around symbols). The Lyra-prefixed color and size names win if both a
Lyra property and its compatibility alias are set. `--symbol-size` otherwise feeds the active
`size` step, while `--symbol-spacing` defaults to `--lr-space-xs`.

Pointer selection resolves the position within the clicked star and snaps upward to `precision`
(with the physical fraction mirrored under RTL), so half/quarter-star precision applies to pointer
input as well as keyboard/value updates. The semantic slider's base keeps a 40×40px minimum
activation area even for the degenerate `max=0`/`max=1` cases; larger ratings naturally grow wider.

```html
<lr-rating
  name="score"
  label="Overall rating"
  default-value="2"
  max="5"
  precision="0.5"
  size="l"
  style="--symbol-color-active: var(--lr-color-success); --symbol-size: var(--lr-font-size-2xl); --symbol-spacing: var(--lr-space-s)"
></lr-rating>
<p id="preview"></p>
<script type="module">
  import '@aceshooting/lyra-ui/components/overlays/rating/rating.js';

  const rating = document.querySelector('lr-rating');
  const preview = document.getElementById('preview');
  rating.getSymbol = (value, selected) => (selected ? '♥' : '♡');
  rating.addEventListener('lr-hover', (event) => {
    const { phase, value } = event.detail;
    preview.textContent = phase === 'end' ? '' : `Rate ${value}`;
  });
  rating.addEventListener('change', (event) => console.log('native commit', event.target.value));
  rating.addEventListener('lr-change', (event) => console.log('committed', event.detail.value));
</script>
```
