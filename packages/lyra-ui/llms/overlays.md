## `lr-toast` / `lr-toast-item` / `toast()`

Stacking toast/notification region. Mirrors `<wa-toast>`/`<wa-toast-item>` under `lr-`.

### `lr-toast`

One per page recommended — the region.

**Properties:**
- `placement: ToastPlacement = 'top-end'` (reflected) — one of `'top-start'|'top-center'|'top-end'|
  'bottom-start'|'bottom-center'|'bottom-end'`

**Methods:** `async create(message: string, options?: ToastCreateOptions): Promise<LyraToastItem>` —
`ToastCreateOptions = { variant?, duration?, size?, withIcon? }`

**Events:** none.

**Slots:** default (`<lr-toast-item>` children)

**CSS parts:** `stack`

**Themeable custom properties:** `--lr-toast-gap` (default `var(--lr-space-s)`),
`--lr-toast-width` (default `28rem`) — set directly on the `<lr-toast>` element.

**Optional peer deps:** none.

### `lr-toast-item`

A single notification.

**Properties:**
- `duration: number = 5000` (ms; `Infinity` or `<= 0` disables auto-dismiss)
- `size: 'xs'|'s'|'m'|'l'|'xl' = 'm'` (reflected — drives both `--lr-toast-padding` and the toast's own
  font-size via `:host([size=...])`, from a compact `xs` up to a roomier `xl`)
- `variant: 'brand'|'success'|'warning'|'danger'|'neutral' = 'neutral'` (reflected)
- `withIcon: boolean = false` (attribute `with-icon`)

**Methods:** `async hide(): Promise<void>` — plays the hide animation, then removes itself from the
DOM.

**Events:** `lr-show`, `lr-after-show`, `lr-hide`, `lr-after-hide`

**Slots:** default (message), `icon`

**CSS parts:** `toast-item`, `accent`, `icon`, `content`, `close-button`

**Themeable custom properties:** `--lr-toast-accent-width` (4px),
`--lr-toast-show-duration`/`--lr-toast-hide-duration`
(`var(--lr-transition-base, 180ms ease-out)` — 180ms by default, matching the JS-side show/hide
animation timer, which is not itself reading this token), `--lr-toast-padding`
(`var(--lr-space-m)`), `--lr-toast-font-size` (`1rem`) — both are auto-swapped per `size`, from a
compact `xs` up to a roomier `xl` — `--lr-toast-accent-color` (defaults to `--lr-color-border`,
auto-swapped per `variant` to `--lr-color-brand/-success/-warning/-danger`).

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
and `ToastHandle = { item: Promise<LyraToastItem>; dismiss: () => void }`. Lazily mounts (and
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
- possible nested live-region double-announcement: the stack region is
  `role="status" aria-live="polite"` **and** each `lr-toast-item` independently self-assigns its
  own `role` (`status`/`alert`) — nesting live regions can cause some screen readers to announce a
  new toast twice. Plausible from the code, unverified against real AT.
- the close button's accessible name is derived from the toast's own message text (`"Close: <first
  40 chars>…"`, falling back to bare `"Close"` only when the toast has no text content) rather than
  a bare `"Close"` on every instance — useful when several toasts are stacked and a screen-reader or
  switch-access user needs to tell their close buttons apart without activating one first.
- pause/resume-on-hover/focus (the component's main accessibility differentiator), including the
  independent-hover-vs-focus pause reasons above, now has regression test coverage.
- `hide()` is idempotent (a second call while already hiding is a no-op) and `[part="close-button"]`
  gets `aria-disabled="true"` once hiding starts, so a stray extra click/Enter during the hide
  animation can't re-enter it.
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

Loading placeholder (`text`/`circle`/`rect` shapes, `pulse`/`sheen` effects).

**Properties:**
- `variant: 'text'|'circle'|'rect' = 'text'` (reflected)
- `effect: 'pulse'|'sheen' = 'pulse'` (reflected)
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

**CSS parts:** `base`

**Themeable custom properties:** `--lr-skeleton-w`, `--lr-skeleton-h` (set/cleared by the
`width`/`height` properties; default `100%` / `1em`) and shared `--lr-transition-ambient` for
the pulse/sheen timing.

**Optional peer deps:** none.

```html
<lr-skeleton variant="circle" width="3rem" height="3rem"></lr-skeleton>
<lr-skeleton variant="text" label="Loading name"></lr-skeleton>
```

**Known gotchas:**
- Each instance announces by default. In a repeated skeleton layout, provide one parent status and
  set `announce="false"` on the decorative child placeholders to avoid duplicate announcements.
- no `lines`/`count` shorthand for "N lines of skeleton text" — stamp out N elements
  yourself.
- Respects `prefers-reduced-motion` (both effects) — safe to leave as-is for that concern.

---

## `lr-drawer`

A modal panel anchored to one edge of the viewport. It inherits the dialog overlay contract:
focus trapping, Escape and optional backdrop dismissal, document scroll locking, overlay stacking,
accessible naming, and the cancelable `lr-dialog-close` event.

**Properties:**
- `open: boolean = false` (attribute `open`, reflected) — controls visibility
- `placement: 'start'|'end'|'top'|'bottom' = 'start'` (attribute `placement`, reflected)
- `heading?: string`, `label: string`, `closable: boolean`, and `noLightDismiss: boolean` — inherited
  dialog naming and dismissal options. A plain `aria-label` attribute on the host is honored too,
  with the same priority-over-everything semantics documented under `lr-dialog` below

**Events:** `lr-dialog-close` (`detail: DialogCloseReason`) — inherited unchanged from `lr-dialog`.

**Slots:** default (drawer body), `footer` — inherited from `lr-dialog`.

**CSS parts:** `backdrop`, `panel`, `header`, `heading`, `close-button`, `label`, `body`, `footer`.

**Themeable custom properties:** `--lr-drawer-width` (default `--lr-size-24rem`; used by
`placement="start"|"end"`, capped at `100%`), `--lr-drawer-height` (default `--lr-size-24rem`;
used by `placement="top"|"bottom"`), `--lr-drawer-enter-x` / `--lr-drawer-enter-y` (the panel's
entrance-animation translate offset — `-x` for start/end, `-y` for top/bottom; both default to
`±--lr-size-1rem` and are set per `placement`, with `-x` explicitly flipped under `:dir(rtl)` since
`translateX` is physical. Override to lengthen/shorten the slide-in; the animation is dropped
entirely under `prefers-reduced-motion: reduce`). It also inherits `<lr-dialog>`'s own tokens —
`--lr-dialog-overlay-color`, `--lr-dialog-width` and `--lr-dialog-max-width` — since `LyraDrawer`
extends `LyraDialog`; the drawer's own width tokens take precedence for its panel.

```html
<lr-drawer open placement="end" heading="Filters" closable>
  <lr-checkbox label="Only active"></lr-checkbox>
</lr-drawer>
```

---

## `lr-dialog` / `confirm()`

General-purpose modal/overlay plus a promise-based confirmation helper built on top of it.

### `lr-dialog`

A modal/overlay: `role="dialog"`, focus-trapped while open, dismissible via Escape or a backdrop
click, and scroll-locks the document for as long as it's open. Chrome stays minimal by default — no
built-in title bar or close button; a consumer supplies a heading and any close affordance itself via
the default/`footer` slots. `heading`/`closable` are an opt-in convenience for the common case where
hand-building that chrome isn't worth it.

**Properties:**
- `open: boolean = false` (reflected) — there is no separate `show()`/`hide()` pair; set this (or
  call `close()`)
- `label: string = ''` — accessible name used only when no heading is slotted and `heading` is unset
  (see below)
- `heading?: string` — visible header text (rendered in `[part="header"]`/`[part="heading"]`), used
  only when no light-DOM heading is slotted into the default slot; has no effect (renders nothing)
  when a heading element *is* slotted, which keeps working completely unchanged either way
- `closable: boolean = false` (attribute `closable`) — renders a built-in close (X) button in the
  header row (creating one, with no heading text, if `heading` is unset), wired to the same
  `close()` path Escape/backdrop-dismiss already use, with reason `'close-button'`
- `noLightDismiss: boolean = false` (attribute `no-light-dismiss`) — prevents a backdrop click from
  closing the dialog; Escape and explicit `close()` calls remain available

Also settable as a plain `aria-label` attribute (not a public JS property): overrides the panel's
computed accessible name outright, winning over every other source below (a slotted heading,
`heading`, `label`) — matching `<lr-date-input>`'s `accessibleLabel` pattern. Left unset, the
existing three-tier fallback below is unchanged.

**Methods:** `close(reason: DialogCloseReason = 'api'): void` — closes the dialog, emits
`lr-dialog-close` with `reason`, and returns focus to whatever had it right before the dialog
opened. `DialogCloseReason = 'escape' | 'backdrop' | 'close-button' | 'api' | 'unmount' | string` —
`'escape'`/`'backdrop'` are emitted by the dialog's own built-in dismiss triggers; `'close-button'`
by the built-in header close button (rendered when `closable` is set); `'unmount'` is emitted
automatically if the dialog is removed from the DOM while still `open` by anything other than its
own `close()` (a consumer's own cleanup code, a parent re-render that drops it); any other string is
whatever a caller passes (e.g. a footer Cancel button calling `dlg.close('cancel')`, or `confirm()`'s
own `'confirm'`/`'cancel'`).

**Events:** `lr-dialog-close` (`detail: DialogCloseReason`) — fired on every dismissal path
(Escape, backdrop click, any `close()` call, or an `'unmount'` removal as above).

**Stacking:** participates in the shared per-document overlay stack described above. A dialog can be
stacked with another dialog or any other modal family; only the visually topmost overlay receives
Escape, Tab trapping, or backdrop dismissal, while overlays beneath remain open until the top one
closes.

**Slots:** default (the dialog body), `footer` (action buttons, rendered in a bottom row, hidden
entirely when empty)

**CSS parts:** `backdrop` (the full-viewport scrim), `panel` (the dialog panel, `role="dialog"`
while open; its max-inline-size is controlled by `--lr-dialog-max-width`), `header` (the header
row, rendered when `heading` is set — and no heading is slotted — and/or `closable` is `true`),
`heading` (the visible `heading`-text element inside `header`, rendered only when `heading` is set
and no heading is slotted), `close-button` (the built-in close button inside `header`, rendered only
when `closable` is `true`), `label` (the invisible label-text element used for `aria-labelledby`
when no heading is slotted and `heading` is unset), `body` (wrapper around the default slot),
`footer` (wrapper around the `footer` slot)

**Themeable custom properties:** `--lr-dialog-overlay-color` (default `rgb(0 0 0 / 0.5)` — the
backdrop scrim color; component-specific since no shared `--lr-*` overlay token exists),
`--lr-dialog-width` (default unset/`auto` — the panel shrink-wraps to content, unchanged; set it
for an assertive width instead), `--lr-dialog-max-width` (default `32rem` — the panel's
max-inline-size cap, via `min(var(--lr-dialog-max-width, var(--lr-dialog-width, 32rem)), 100%)`;
when `--lr-dialog-width` is set but `--lr-dialog-max-width` is left at its default, the cap falls
back to the requested width itself — not the `32rem` default — so an assertive width isn't silently
clipped; the viewport is still a hard limit either way), plus shared tokens `--lr-space-l/-m/-s`,
`--lr-color-surface/-border`, `--lr-radius`, `--lr-shadow`.

**Optional peer deps:** none.

```html
<lr-dialog id="dlg">
  <h2>Delete item?</h2>
  <p>This cannot be undone.</p>
  <div slot="footer">
    <button id="cancel">Cancel</button>
    <button id="confirm">Delete</button>
  </div>
</lr-dialog>
<script type="module">
  const dlg = document.getElementById('dlg');
  dlg.open = true;
  dlg.addEventListener('lr-dialog-close', (e) => console.log('closed:', e.detail));
  document.getElementById('cancel').addEventListener('click', () => dlg.close('cancel'));
</script>
```

Accessible name / visible header, in priority order: (0) if the host element itself has an
`aria-label` attribute set, its value becomes `aria-label` on the panel outright, overriding every
source below (including a slotted heading) and suppressing the visible header/`heading` row and the
sr-only `label` element from rendering at all — the standard ARIA convention for a consumer that
wants full control over the announced name regardless of whatever `heading`/`label` props are also
set; (1) otherwise, if a heading element (`h1`–`h6` or
`[role="heading"]`) is a *direct child* (not inside `slot="footer"`), its text content becomes
`aria-label` on the panel — takes priority over `heading` below so an existing consumer that already
slots its own heading keeps rendering it exactly as before; (2) otherwise, when `heading` is set, a
visible header row (`[part="header"]`) renders containing that text (`[part="heading"]`), which
becomes the `aria-labelledby` target; (3) otherwise, when `label` is set, an invisible (`.sr-only`,
exposed as the `label` part) element carrying that text is rendered inside the panel and
`aria-labelledby` points at it instead. Only one of cases 2/3 ever renders at a time. `label` itself
never renders visible chrome on its own — `::part(label)` can be restyled to make the sr-only text
visible, or `heading` can be set instead, for visible chrome without slotting a real heading element.
The slotted-heading case (1) deliberately uses `aria-label` (a copied string) rather than
`aria-labelledby` pointing at the heading's `id`, because the heading is light-DOM content while
`[part="panel"]` lives in shadow DOM and an ID-reference attribute can't resolve across that
boundary; cases 2/3 use `aria-labelledby` safely since their target renders inside the same shadow
root it labels.

**Known gotchas:**
- `role="dialog"`/`aria-modal="true"` are only present on `[part="panel"]` while `open` is `true` —
  inspecting closed markup won't show them.
- Heading detection only rescans on `slotchange`, not on every render — mutating an already-slotted
  heading's `textContent` in place (rather than replacing the node) won't retroactively update
  `aria-label`; set `label` instead for a title that needs to change live.
- Only *direct* children are scanned for a heading — one nested several layers deep, or inside a
  slotted custom element's own shadow root, is left to the consumer to label explicitly via `label`.
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
button all resolve `false`. Mounts a transient `<lr-dialog>` on `document.body` for the duration
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
  `.remove()` itself.
- The neutral confirm button pairs `--lr-color-on-brand` with `--lr-color-brand`; the danger
  tone pairs `--lr-color-on-danger` with `--lr-color-danger`. Each token chains through Web
  Awesome's matching `*-on-loud` semantic role and has contrast-tested standalone light/dark
  fallbacks.
- Importing `confirm` alone is enough to register `<lr-dialog>` — `confirm.ts` imports
  `./dialog.js` for its side effect, so a consumer doesn't need a separate import for the dialog
  element.

---

## `lr-chip` / `lr-chip-group`

A small, content-agnostic pill for a short label: a tag, an active-filter/scope indicator, etc.
Distinct from `<lr-attachment-chip>` (specifically file-shaped, with a thumbnail/size/upload-
progress) — this pair carries no domain assumptions at all. `<lr-chip>` is a controlled component:
clicking its remove (×) button only fires `lr-remove` — the chip never removes itself from the DOM
on its own interaction, the same contract `<lr-attachment-chip>`/`<lr-conversation-item>`
already follow.

### `lr-chip`

**Properties:**
- `size: '3xs' | '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — standard visual-density
  scale for typography, padding, gap, and icon size; `m` preserves the original chip dimensions
- `tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected — tints the
  whole pill using a loud-color-on-quiet-tint convention; `neutral` has no dedicated token pair, so
  it falls back to a plain bordered-surface look)
- `removable: boolean = false` (reflected — shows the remove (×) button)
- `selected: boolean = false` (reflected) — opt-in toggle/pressed mode: when set, `[part='base']`
  itself becomes focusable and keyboard-activatable (Enter/Space, mirroring native `<button>`
  behavior), reflects `aria-pressed` (explicitly `"false"`, not omitted, whenever toggle mode is
  active but unpressed), and toggles on click/activation, emitting `lr-chip-select`.
  Has no effect (no interactive semantics added to `[part='base']`) when combined with `removable`,
  since the remove button already nests inside `[part='base']` — a focusable descendant of a
  `role="button"` ancestor isn't allowed there, and this component's two real use cases (a
  chart-series visibility toggle, a category filter chip) never need both at once. `false` (the
  default, with `toggleable` also left at its default) reproduces the exact passive-label-pill
  output.
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
(`detail: { value, selected }` — fired on click, or Enter/Space while focused, when `selected` mode
is active and `removable` is not set; the chip has already toggled its own `selected` state by the
time this fires)

**Slots:** default (the chip's label content), `icon` (optional leading icon or status dot; nothing
reserved for it — no extra gap — when left empty)

**CSS parts:** `base` (the pill's root container), `icon` (wrapper around the `icon` slot; hidden
entirely while empty), `label` (wrapper around the default slot), `remove-button` (the remove (×)
affordance, only rendered while `removable`)

**Themeable custom properties:** `--lr-chip-accent`, `--lr-chip-bg`, `--lr-chip-border`
(component-local trio swapped per `tone` rather than repeating background/color/border per part per
tone; default `var(--lr-color-text)` / `var(--lr-color-surface)` / `var(--lr-color-border)` —
mirrors the same accent/bg/border vocabulary `<lr-tool-call-chip>`/`<lr-attachment-chip>` use),
`--lr-chip-pressed-border` (border color while pressed/selected — falls back to
`--lr-chip-accent`), `--lr-chip-pressed-bg` (background color while pressed/selected — falls
back to `--lr-chip-bg`), the density quintet `--lr-chip-font-size`, `--lr-chip-padding-block`,
`--lr-chip-padding-inline`, `--lr-chip-gap`, `--lr-chip-icon-size` (all five are rewritten by each
`:host([size])` rule, so setting one directly on the element overrides that step of the scale; the
`m` defaults are `--lr-font-size-sm` / `--lr-size-0-25rem` / `--lr-space-s` / `--lr-space-xs` /
`--lr-font-size-sm`), the height pair `--lr-chip-min-height` / `--lr-chip-height` (below),
`--lr-chip-radius` (default `--lr-radius-pill`, the corner radius of both `[part='base']` and
`[part='remove-button']` — retunable without a `::part()` rule, and unlike the density quintet
above does not vary by `size`; the same `--lr-button-radius` pattern),
plus shared tokens (`--lr-space-xs`, `--lr-space-s`,
`--lr-color-brand`/`-brand-quiet`, `--lr-color-success`/`-success-quiet`,
`--lr-color-warning`/`-warning-quiet`, `--lr-color-danger`/`-danger-quiet`,
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

**Themeable custom properties:** shared tokens only (`--lr-space-xs`, `--lr-space-s`,
`--lr-color-border`, `--lr-color-surface`, `--lr-color-text-quiet`, `--lr-color-text`,
`--lr-color-brand`, `--lr-focus-ring-width`, `--lr-focus-ring-color`,
`--lr-focus-ring-offset`, `--lr-transition-fast`).

**Optional peer deps:** none.

```html
<lr-chip-group max-visible="3">
  <lr-chip removable value="draft">Draft</lr-chip>
  <lr-chip tone="success" removable value="reviewed">Reviewed</lr-chip>
  <lr-chip tone="warning">Needs input</lr-chip>
  <lr-chip tone="danger">Blocked</lr-chip>
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
than a stylesheet-only solution.

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
word: string }` — one resolved token's rendered glyph and spelled-out word.
`shortcutTokenLabel(rawToken: string, isMac: boolean): KbdKeyLabel` — resolves a single token,
parameterized on `isMac` so both platform branches are unit-testable without spoofing `navigator`.
`parseShortcut(keys: string, isMac: boolean): KbdKeyLabel[]` — splits and resolves a full `keys`
string.

**Events:** none — purely presentational.

**Slots:** default — an escape hatch for fully custom key-cap content (e.g. an icon instead of a
text glyph). When it has any real (non-whitespace) content, it replaces the `keys`-driven rendering
entirely and this component stops *computing* its own `aria-label` from `keys`, leaving the slotted
content to carry its own accessible name — a host-supplied `aria-label` attribute is still forwarded
onto the rendered chip in either mode, custom content included.

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

## `lr-popover`

A click-triggered, light-dismiss floating surface positioned with the shared Floating UI positioner.

**Properties:** `open`, `placement`, `distance`, `accessibleLabel` (`aria-label`), and `popupRole` (`popup-role`).
**Methods:** `showAt(rect: { x, y, width?, height?, contextElement? }, options?: { returnFocusTo?:
HTMLElement })` opens the popover anchored to an arbitrary rectangle instead of the slotted
`trigger` — for a graph node, a canvas pixel, a chart datum, or any other non-DOM location
(`width`/`height` default to `0`, a point). Escape and light-dismiss return focus to
`options.returnFocusTo` when supplied, or skip focus-return entirely otherwise, since a virtual
anchor has no `.focus()`. The virtual anchor has no DOM node of its own for `autoUpdate()` to
track ancestor scroll/resize against — pass `rect.contextElement` (a real, still-connected element
near the virtual point) when one is available to give it something to observe; otherwise, or when
the anchor point moves on its own (e.g. a graph pan/zoom tick), re-call `showAt()` with fresh
coordinates to re-anchor — the popover stays open across such a call. A popover that never calls
`showAt()` behaves exactly as before.
`hide(options?: { focusTrigger?: boolean })` programmatically closes the popover; pass
`{ focusTrigger: true }` to return focus to the slotted trigger (as Escape does), or omit it to
close without moving focus (as a bare `el.open = false` does). No-op when already closed.
**Events:** `lr-show`, `lr-hide`. **Slots:** `trigger`, default content. **CSS parts:** `trigger`,
`popup`, `content`. **Themeable custom properties:** `--lr-overlay-max-inline-size` (default
`--lr-size-20rem` — maximum inline size of the popup).

## `lr-tooltip`

A hover/focus tooltip positioned with the shared Floating UI positioner.

**Properties:** `open`, `manual`, `delay`, `placement`, `distance`, `content`, and
`accessibleLabel` (`aria-label`). **Methods:** `showAt(rect: { x, y, width?, height?,
contextElement? }, options?: { returnFocusTo?: HTMLElement })` — same virtual-anchor contract as
`lr-popover.showAt()` above (anchors to an arbitrary rectangle instead of the slotted `trigger`,
`width`/`height` default to `0`, `contextElement` gives `autoUpdate()` something to observe,
Escape returns focus to `options.returnFocusTo` or skips focus-return, re-call with fresh
coordinates to re-anchor a moving point). Opens immediately, bypassing `delay`/`manual` (both are
hover-debounce concerns for a slotted trigger, not a deliberate programmatic call); close it the
same way any tooltip closes, by setting `open = false`. **Slots:** `trigger`, default content.
**CSS parts:** `trigger`, `popup`. **Themeable custom properties:** `--lr-tooltip-max-inline-size`
(default `--lr-size-20rem`), `--lr-tooltip-background` (default `--lr-color-neutral`), and
`--lr-tooltip-color` (default `--lr-color-on-neutral`).

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

A menu-role popover for consumer-supplied action content. Compose `lr-menu` when full roving
menu-item behavior is needed.

**Properties:** `open`, `placement`, `distance`, `accessibleLabel` (`aria-label`), and `popupRole` (`popup-role`).
`popupRole` is seeded to `'menu'` in the constructor — that is the only difference from `lr-popover`,
whose whole surface (including `showAt()`) is inherited unchanged.
**Events:** `lr-show`, `lr-hide` — inherited from `lr-popover`; neither fires for the initial render.
**Slots:** `trigger`, default menu content. **CSS parts:** `trigger`, `popup`, `content`.
**Themeable custom properties:** `--lr-overlay-max-inline-size` (default `--lr-size-20rem` —
maximum inline size of the popup).

## `lr-spinner`

An indeterminate busy indicator with a localized `role="status"` name.

**Properties:** `labelPlacement: 'none' | 'after' = 'none'` (attribute `label-placement`, reflected)
and `accessibleLabel: string | null = null` (attribute **`aria-label`**, not `accessible-label`) —
names `[part="base"]`'s `role="status"`; unset falls back to the localized "Loading…".

**Events:** none.

**Slots:** default — optional label text. `label-placement="after"` renders it inline next to the
indicator; `'none'` (the default) keeps it visually clipped but still in the DOM.

**CSS parts:** `base` (the `role="status"` wrapper), `spinner` (the animated ring; `aria-hidden`),
`label` (the default-slot wrapper).

**Themeable custom properties:** `--lr-spinner-size` (default `--lr-size-1-25rem` — both
dimensions), `--lr-spinner-track-width` (default `--lr-border-width-medium` — ring thickness),
`--lr-spinner-duration` (default `800ms` — one full rotation; the animation is dropped entirely
under `prefers-reduced-motion: reduce`). The ring colors come from `--lr-color-brand`/`-brand-quiet`.

## `lr-progress-bar`

A determinate or indeterminate progress bar.

**Properties:** `value`, `max`, `indeterminate`, `variant`, `showValue` (`show-value`), and
`accessibleLabel` (`accessible-label`).
The rendered progressbar exposes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` when
determinate.

**Slots:** `label`. **CSS parts:** `base`, `track`, `indicator`, `label`.
**Themeable custom properties:** `--lr-progress-height` (default `var(--lr-size-0-5rem)`) — the
block size of the progress track.

## `lr-progress-ring`

A circular progress indicator with the same value contract as `lr-progress-bar`.

**Properties:** `value: number = 0`, `max: number = 100`, `indeterminate: boolean = false`
(reflected), and `accessibleLabel: string = ''` (attribute `accessible-label`; unset falls back to
the localized "Progress"). Non-finite/out-of-range `value`/`max` are normalized (`max <= 0` falls
back to `100`, `value` clamps to `[0, max]`) rather than producing NaN geometry.
**Slots:** default — replaces the built-in center label, which otherwise renders the rounded
percentage (and nothing at all while `indeterminate`).
**CSS parts:** `base`, `track`, `indicator`, `label`.
**Themeable custom properties:** `--lr-progress-ring-size` (default `--lr-size-2-5rem` — the
ring's inline and block size) and `--lr-progress-duration` (default `1.2s` — the indeterminate spin
period, shared with `lr-progress-bar`'s sweep).

## `lr-badge` and `lr-tag`

Compact status labels. Both expose `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'`
and `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` (reflected) — the same visual-density scale
`<lr-chip>` uses, for typography/padding/minimum block size; `m` preserves the original badge
dimensions. `lr-tag` inherits `size` unchanged from `lr-badge` rather than redeclaring it.
The two tags share the same visual contract; `lr-tag` is a semantic alias for migration-friendly
markup.

**Slots:** default content. **CSS parts:** `base`.

**Themeable custom properties:** `--lr-badge-background`, `--lr-badge-color`, `--lr-badge-border`
— the trio each `:host([variant])` rule rewrites (`neutral` defaults to
`--lr-color-surface`/`-text`/`-border`; the other four to the matching `*-quiet` fill with the loud
color for text and border). Set one directly on the element for a tint outside the five variants.
`--lr-badge-font-size` (default `var(--lr-font-size-sm)`), `--lr-badge-padding-inline` (default
`var(--lr-space-s)`), and `--lr-badge-min-height` (default `var(--lr-size-1-25rem)`) — the density
trio each `:host([size])` rule rewrites to that step's font size, inline padding, and minimum block
size; the `m` defaults above exactly reproduce the pre-`size` fixed badge treatment.
`--lr-badge-radius` (default `--lr-radius-pill`) is `[part='base']`'s corner radius, retunable
without a `::part(base)` rule and, unlike the density trio, does not vary by `size` — the same
`--lr-button-radius` pattern; `lr-tag` inherits it unchanged, the same as `size`.

## `lr-callout`

An inline status, warning, or error surface. Set `inline` for lightweight reactive form or mutation
errors without panel chrome.

**Properties:** `variant: 'neutral'|'brand'|'success'|'warning'|'danger' = 'neutral'` (reflected —
also picks `[part="base"]`'s role: `alert` for `danger`, `status` otherwise), `heading: string = ''`,
`closable: boolean = false` (reflected), `inline: boolean = false` (reflected), `open: boolean = true`
(reflected — `false` renders nothing at all), and `accessibleLabel: string = ''`
(`accessible-label`; falls back to a plain host `aria-label` attribute when unset).

**Events:** cancelable `lr-close` (no detail); the callout sets `open = false` after the event
unless a listener calls `preventDefault()`.

**Slots:** default message, `heading` (rendered alongside the `heading` property), `icon`.

**CSS parts:** `base`, `icon` (hidden while the `icon` slot is empty), `content`, `heading`,
`message` (wrapper around the default slot), `close-button` (the close control's hit target, always
at least `--lr-icon-button-size` in both the panel and `inline` treatments), `close-icon` (the
visible "×" glyph inside it — this is what shrinks under `inline`, so the hit target never does).

**Themeable custom properties:** `--lr-callout-background`, `--lr-callout-color`,
`--lr-callout-border` — the trio each `:host([variant])` rule rewrites (same
surface/text/border → `*-quiet`/loud/loud scheme as `lr-badge`). `inline` drops the border,
background, and panel padding regardless of what these are set to. `--lr-callout-close-hover-bg`
(default `var(--lr-color-brand-quiet)`) — the close button's `:hover` background, deliberately
decoupled from `--lr-callout-background` (which every non-neutral `variant` also retargets for the
panel itself) so a consumer can retint the hover fill — e.g. to keep it visibly distinct from a
`variant="brand"` panel, which shares the same default token — without a collateral effect on the
panel background, and vice versa.

## `lr-rating`

A keyboard-accessible star rating control with slider semantics. **Properties:** `value`, `max`,
`precision`, `readonly`, `disabled`, and `accessibleLabel` (`aria-label`). **Events:**
`lr-change` with `{ value }`. **CSS parts:** `base`, `star`, `star-fill` (the filled overlay
inside each star, clipped to the fractional `precision` value). **Themeable custom properties:**
`--lr-rating-fill` (default `--lr-color-warning` — filled-star color), `--lr-rating-empty-color`
(default `--lr-color-border` — unfilled-star color), and `--lr-rating-size` (default
`--lr-font-size-xl` — star size).
