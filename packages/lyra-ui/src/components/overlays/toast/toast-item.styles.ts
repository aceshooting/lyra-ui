import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-toast-accent-width: var(--accent-width, var(--lr-size-4px));
    --_lr-toast-show-duration: var(
      --show-duration,
      var(--lr-transition-base, 180ms ease-out)
    );
    --_lr-toast-hide-duration: var(
      --hide-duration,
      var(--lr-transition-base, 180ms ease-out)
    );
    --_lr-toast-padding: var(--padding, var(--lr-space-m));
    --_lr-toast-font-size: var(--lr-font-size-m);
    --_lr-toast-accent-color: var(--lr-color-border);
  }
  /* One rule for all four non-neutral variants: the shared variants sheet already points
     --lr-color-fill-* at the active variant's semantic-grid row. Neutral is excluded, not mapped,
     keeping the plain --lr-color-border accent -- an informational toast must not read as a grey
     status bar. [variant] joins :not([variant='neutral']) so an unreflected default stays
     neutral. */
  :host([variant]:not([variant="neutral"])) {
    --_lr-toast-accent-color: var(--lr-color-fill-loud);
  }
  :host([data-effective-size="2xs"]) {
    --_lr-toast-padding: var(--padding, var(--lr-space-2xs));
    --_lr-toast-font-size: var(--lr-font-size-2xs);
  }
  :host([data-effective-size="xs"]) {
    --_lr-toast-padding: var(--padding, var(--lr-space-xs));
    --_lr-toast-font-size: var(--lr-font-size-xs);
  }
  :host([data-effective-size="s"]) {
    --_lr-toast-padding: var(--padding, var(--lr-space-s));
    --_lr-toast-font-size: var(--lr-font-size-md-sm);
  }
  :host([data-effective-size="m"]) {
    --_lr-toast-padding: var(--padding, var(--lr-space-m));
    --_lr-toast-font-size: var(--lr-font-size-m);
  }
  :host([data-effective-size="l"]) {
    --_lr-toast-padding: var(--padding, var(--lr-space-l));
    --_lr-toast-font-size: var(--lr-font-size-lg);
  }
  :host([data-effective-size="xl"]) {
    --_lr-toast-padding: var(--padding, calc(var(--lr-space-l) * 1.5));
    --_lr-toast-font-size: var(--lr-font-size-xl);
  }

  [part="toast-item"] {
    position: relative;
    display: flex;
    align-items: start;
    gap: var(--lr-toast-item-gap, var(--lr-space-s));
    inline-size: 100%;
    padding: var(--lr-toast-padding, var(--_lr-toast-padding));
    padding-inline-start: calc(
      var(--lr-toast-padding, var(--_lr-toast-padding)) +
        var(--lr-toast-accent-width, var(--_lr-toast-accent-width))
    );
    font-size: var(--lr-toast-font-size, var(--_lr-toast-font-size));
    /* Modal-layer surface: a toast floats over arbitrary page content and cannot share the page
       surface token -- in dark mode both resolve to the same near-black and it loses its edges.
       */
    background: var(--lr-color-surface-overlay);
    color: var(--lr-color-text);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-toast-item-radius, var(--lr-radius));
    /* Modal layer, but a small unscrimmed float rather than a page-blocking panel -- the lower of
       the two modal steps. */
    box-shadow: var(--lr-shadow-l);
    opacity: 0;
    transform: translateY(var(--lr-size-neg-8px));
    transition: opacity
        var(--lr-toast-show-duration, var(--_lr-toast-show-duration)),
      transform var(--lr-toast-show-duration, var(--_lr-toast-show-duration));
  }
  [part="toast-item"][hidden] {
    display: none;
  }
  :host([data-hiding]) [part="toast-item"] {
    transition: opacity
        var(--lr-toast-hide-duration, var(--_lr-toast-hide-duration)),
      transform var(--lr-toast-hide-duration, var(--_lr-toast-hide-duration));
  }
  :host([data-visible]) [part="toast-item"] {
    opacity: 1;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="toast-item"] {
      transition-duration: 0.01ms !important;
    }
  }

  [part="accent"] {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: var(--lr-toast-accent-width, var(--_lr-toast-accent-width));
    background: var(--lr-toast-accent-color, var(--_lr-toast-accent-color));
    border-start-start-radius: var(--lr-toast-item-radius, var(--lr-radius));
    border-end-start-radius: var(--lr-toast-item-radius, var(--lr-radius));
  }
  [part="icon"] {
    display: inline-flex;
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: var(--lr-icon-button-size);
    overflow: hidden;
    color: var(--lr-toast-accent-color, var(--_lr-toast-accent-color));
  }
  [part="icon"] ::slotted(*) {
    max-inline-size: 100%;
  }
  [part="content"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    /* Resolves each slotted message from its own first strong character: dir="auto" on the shadow
       wrapper cannot inspect assigned light-DOM text in every browser, while plaintext joins the
       flattened text run, keeping an English message/action ordered inside an RTL page and Arabic
       inside LTR. */
    unicode-bidi: plaintext;
  }
  /* toaster.ts's action option and the WithIcon/Triggers stories append a plain light-DOM button
     beside the message text; unstyled it takes the browser's default button chrome. An inline
     text action in the toast's accent color, not a boxed button, since it sits inside the content
     part rather than its own layout slot. */
  ::slotted(button) {
    display: inline-block;
    /* Symmetric logical spacing survives plaintext bidi giving the slotted content a reading
       direction differing from the page. !important is load-bearing: a consumer's own page-level
       CSS can select this plain light-DOM button directly, and a ::slotted() rule from this
       shadow root loses to an unrelated global reset in a CSS layer (Tailwind Preflight's
       margin-zeroing universal selector, say) though that reset never names it and this rule is
       unlayered. */
    margin-inline: var(--lr-space-s) !important;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: var(--lr-font-weight-bold);
    color: var(--lr-toast-accent-color, var(--_lr-toast-accent-color));
    text-decoration: underline;
    cursor: pointer;
  }
  ::slotted(button:hover) {
    color: var(--lr-color-text);
  }
  ::slotted(button:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The display above is author-origin, outranking the UA '[hidden] { display: none }', so a
     caller hiding toaster.ts's light-DOM action button -- an undo already taken, say -- would
     otherwise still see it painted and clickable. The find-in-page carve-out matches the
     library's other ::slotted([hidden]) overrides. */
  ::slotted([hidden]:not([hidden="until-found" i])) {
    display: none;
  }
  [part="close-button"] {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    margin-inline-start: auto;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-size-1em);
    line-height: var(--lr-line-height-none);
    padding: var(--lr-space-xs);
    border-radius: var(--lr-radius);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part="progress-ring"] {
    position: relative;
    display: inline-grid;
    place-items: center;
    inline-size: var(--lr-size-24px);
    block-size: var(--lr-size-24px);
    pointer-events: none;
  }
  [part="progress-ring__base"] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
    fill: none;
    transform: rotate(-90deg);
  }
  [part="progress-ring__track"],
  [part="progress-ring__indicator"] {
    fill: none;
    stroke-width: var(--lr-border-width-medium);
  }
  [part="progress-ring__track"] {
    stroke: var(--lr-color-border);
  }
  [part="progress-ring__indicator"] {
    stroke: var(--lr-toast-accent-color, var(--_lr-toast-accent-color));
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }
  :host([data-visible]) [part="progress-ring__indicator"] {
    animation-name: lr-toast-progress;
  }
  /* no-pressed-state: :hover and :focus-within only mirror the timer's paused state on its
     decorative progress indicator; the close button owns the actual press treatment below. */
  :host(:hover) [part="progress-ring__indicator"],
  :host(:focus-within) [part="progress-ring__indicator"] {
    animation-play-state: paused;
  }
  [part="progress-ring__label"],
  [part="close-icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  [part="close-icon__svg"] {
    display: block;
  }
  /* Keep each pointer-state value as an inline fallback: inherited hooks then retheme only the
     close control without changing the toast surface or the region's stack spacing. */
  [part="close-button"]:where(:hover):where(:not([aria-disabled="true"])) {
    background: var(--lr-toast-close-button-hover-bg, transparent);
    color: var(--lr-toast-close-button-hover-color, var(--lr-color-text));
  }
  /* Pressed adds the fill hover withholds: the resting button is background:none, so mixing that
     transparent base toward --lr-color-mix-partner lands the partner colour at the active share
     -- a scrim following the text colour, darker on a light toast, lighter on a dark one. The ink
     change is restated because keyboard activation raises :active with no :hover; the disabled
     guard keeps a dismiss-blocked toast visibly inert. */
  [part="close-button"]:where(:active):where(:not([aria-disabled="true"])) {
    color: var(--lr-toast-close-button-active-color, var(--lr-color-text));
    background: var(
      --lr-toast-close-button-active-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="close-button"][aria-disabled="true"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="close-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  @keyframes lr-toast-progress {
    to {
      stroke-dashoffset: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part="progress-ring__indicator"] {
      animation: none !important;
      stroke-dashoffset: 1;
    }
  }
`;
