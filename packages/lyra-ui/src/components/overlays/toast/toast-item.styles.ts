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
  /* One rule for all four non-neutral variants, in place of the four one-declaration blocks that
     stood here: the shared variants sheet has already re-pointed --lr-color-fill-* at the active
     variant's row of the semantic grid, so the toast reads a generic slot and never names a
     variant. Neutral is excluded rather than mapped, so its private default keeps the plain
     --lr-color-border accent -- an ordinary informational toast must not read as a grey
     status bar. Matching [variant] as well as :not([variant='neutral']) keeps a host that has not
     yet reflected its default attribute on that same neutral value. */
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
    /* Modal-layer surface: a toast floats over arbitrary page content at the toast layer, so it
       must not share the page surface token -- in dark mode both resolve to the same near-black
       and the toast loses its edges against whatever it covers. */
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
    /* Resolve each slotted message from its own first strong character. dir="auto" on the
       shadow wrapper cannot inspect assigned light-DOM text in every browser, while plaintext
       participates in the flattened text run and keeps an English message/action ordered inside
       an RTL page (and vice versa for Arabic content in LTR). */
    unicode-bidi: plaintext;
  }
  /* toaster.ts's action option (and the WithIcon/Triggers stories) append a
     plain light-DOM button as a sibling of the message text -- without
     this, it renders with the browser's unstyled default button chrome,
     clashing with the rest of the token-driven design. Styled as an inline
     text action (matching the toast's own accent color) rather than a
     boxed button, since it sits directly after the message inside the
     content part rather than in its own layout slot. */
  ::slotted(button) {
    display: inline-block;
    /* Symmetric logical spacing remains on the correct side when plaintext bidi resolution makes
       the slotted content's reading direction differ from the page direction. */
    margin-inline: var(--lr-space-s);
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
  /* Pressed adds the fill the hover deliberately withholds: the resting button is background:none,
     so mixing that transparent base toward --lr-color-mix-partner lands the partner colour at the
     active share -- a scrim that darkens on a light toast and lightens on a dark one, following
     the text colour either way. The ink change is restated because keyboard activation raises
     :active with no :hover, and the disabled guard is carried over so a dismiss-blocked toast
     stays visibly inert under a click. */
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
