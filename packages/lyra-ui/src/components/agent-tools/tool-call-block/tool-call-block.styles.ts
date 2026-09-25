import { css } from 'lit';

// The disclosure shape (chevron first, rotated when expanded, mirrored only while collapsed under
// RTL, brand hover) follows lr-thinking-panel, the sibling disclosure in the same message. The
// pressed colour, the focus-ring inset and the header transition deliberately diverge from it:
// the pressed text stays readable on the deeper mix, the ring stays inside the card's clip, and
// the hover repaint animates like every other pointer target.
export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    min-inline-size: 0;
    --_lr-tool-call-block-accent: var(--lr-color-text-quiet);
  }
  :host(:where([status='running'])) {
    --_lr-tool-call-block-accent: var(--lr-color-brand);
  }
  :host(:where([status='success'])) {
    --_lr-tool-call-block-accent: var(--lr-color-success);
  }
  :host(:where([status='error'])) {
    --_lr-tool-call-block-accent: var(--lr-color-danger);
  }
  /* A denial is a policy rejection, not a runtime failure: the warning tone keeps it distinct. */
  :host(:where([status='denied'])) {
    --_lr-tool-call-block-accent: var(--lr-color-warning);
  }

  /* The clip only rounds the corners of the header's hover fill; every inline-overflowing
     descendant is contained by a section scroller below. */
  [part='base'] {
    border: var(--lr-border-width-thin) solid
      var(--lr-tool-call-block-border-color, var(--lr-color-border));
    border-radius: var(--lr-tool-call-block-radius, var(--lr-radius));
    background: var(--lr-tool-call-block-background, var(--lr-color-surface));
    overflow: clip;
  }

  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: none;
    background: none;
    font: inherit;
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
    text-align: start;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }

  [part='status-text'],
  [part='duration'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-normal);
    color: var(--lr-color-text-quiet);
  }
  [part='duration'] {
    font-variant-numeric: tabular-nums;
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-6ch);
    overflow-wrap: anywhere;
  }

  /* All header text turns brand on hover: the quiet text colour fails contrast on the brand tint. */
  :where([part='header']):hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  :where([part='header']):hover :is([part='status-text'], [part='duration']) {
    color: inherit;
  }
  /* Pressed text returns to the body colour: brand text on the deeper mix fails contrast. */
  :where([part='header']):active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-color-text);
  }
  :where([part='header']):active :is([part='status-text'], [part='duration']) {
    color: inherit;
  }
  /* Inset by the ring's own width so the card's clip can never cut it. */
  :where([part='header']):focus-visible,
  :where([part='result']):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--lr-tool-call-block-accent, var(--_lr-tool-call-block-accent));
  }
  [part='icon'] svg {
    display: block;
  }
  /* A three-quarter arc spins; a full ring would look identical at every frame. */
  :host(:where([status='running'])) [part='icon'] svg {
    animation: lr-tool-call-block-spin var(--lr-transition-ambient) infinite;
  }
  :host(:where([status='pending'])) [part='icon'] svg {
    animation: lr-tool-call-block-pulse var(--lr-transition-ambient) infinite;
  }

  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lr-transition-fast);
  }
  :host(:where([expanded])) [part='toggle'] {
    transform: rotate(90deg);
  }
  /* Only the collapsed chevron mirrors: rotating the asymmetric glyph already points it down. */
  :host(:where(:not([expanded]):dir(rtl))) [part='toggle'] {
    transform: scaleX(-1);
  }

  [part='body'] {
    border-block-start: var(--lr-border-width-thin) solid
      var(--lr-tool-call-block-border-color, var(--lr-color-border));
    padding: var(--lr-space-s) var(--lr-space-m);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--lr-space-s);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='body'][hidden] {
    display: none;
  }

  [part='args'],
  [part='result'],
  [part='error'] {
    min-inline-size: 0;
  }
  /* A wide registered renderer scrolls inside its own section instead of being clipped. */
  [part='args'],
  [part='result'] {
    overflow-x: auto;
  }

  [part='args-label'],
  [part='result-label'],
  [part='error-label'] {
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text-quiet);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-03em);
  }

  [part='error'] {
    color: var(--lr-tool-call-block-error-color, var(--lr-color-danger));
  }
  [part='error'] p,
  [part='empty'] {
    margin: 0;
  }

  @container (max-inline-size: 319.98px) {
    [part='header'],
    [part='body'] {
      padding: var(--lr-space-xs) var(--lr-space-s);
    }
  }

  @keyframes lr-tool-call-block-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes lr-tool-call-block-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='icon'] svg {
      animation: none !important;
    }
    [part='toggle'] {
      transition: none !important;
    }
  }

  @media (forced-colors: active) {
    :where([part='header']):hover {
      outline: var(--lr-border-width-thin) solid Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-thin));
    }
  }
`;
