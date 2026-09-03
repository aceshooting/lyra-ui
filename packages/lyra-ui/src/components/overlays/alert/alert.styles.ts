import { css } from 'lit';

export const styles = css`
  :host {
    display: none;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  :host([open]),
  :host([data-alert-showing]),
  :host([data-alert-hiding]) {
    display: block;
  }

  /* Shoelace calls its brand/default tone "primary". Re-point the shared semantic slots instead
     of introducing a second colour vocabulary for this compatibility component. */
  :host([variant='primary']) {
    --lr-color-fill-quiet: var(--lr-color-brand-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-brand-fill-normal);
    --lr-color-fill-loud: var(--lr-color-brand-fill-loud);
    --lr-color-border-quiet: var(--lr-color-brand-border-quiet);
    --lr-color-border-normal: var(--lr-color-brand-border-normal);
    --lr-color-border-loud: var(--lr-color-brand-border-loud);
    --lr-color-on-quiet: var(--lr-color-brand-on-quiet);
    --lr-color-on-normal: var(--lr-color-brand-on-normal);
    --lr-color-on-loud: var(--lr-color-brand-on-loud);
  }

  [part='base'] {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--lr-space-s);
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    box-sizing: border-box;
    overflow: hidden;
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-normal);
    border-radius: var(--lr-radius);
    background: var(--lr-color-fill-quiet);
    color: var(--lr-color-on-quiet);
    box-shadow: var(--lr-shadow-s);
    opacity: 1;
    transform: none;
    transition:
      opacity var(--lr-duration-fast) var(--lr-easing-standard),
      transform var(--lr-duration-fast) var(--lr-easing-standard);
  }

  /* A queued alert renders its base with both hidden and inert. inert is platform-enforced, but
     hidden did nothing: the display: grid above is author origin and beats the UA
     "[hidden] { display: none }" whatever their specificities, leaving the surface laid out. The
     queue path also hides the host from <lr-toast>'s side, so nothing looked wrong; this keeps the
     alert's own half of the contract true, matching the [part='icon'][hidden] guard below. */
  [part='base'][hidden] {
    display: none;
  }

  :host([data-alert-showing]) [part='base'],
  :host([data-alert-hiding]) [part='base'] {
    opacity: 0;
    transform: translateY(var(--lr-size-neg-8px));
  }

  [part='icon'] {
    display: inline-flex;
    grid-column: 1;
    color: var(--lr-color-fill-loud);
    font-size: var(--lr-font-size-lg);
    line-height: var(--lr-line-height-none);
    min-inline-size: 0;
    max-inline-size: var(--lr-icon-button-size);
    overflow: hidden;
  }

  [part='icon'] ::slotted(*) {
    max-inline-size: 100%;
  }

  [part='icon'][hidden] {
    display: none;
  }

  [part='message'] {
    grid-column: 2;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    unicode-bidi: plaintext;
  }

  [part~='close-button'] {
    display: inline-flex;
    grid-column: 3;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-block: calc(-1 * var(--lr-space-xs));
    margin-inline-end: calc(-1 * var(--lr-space-xs));
    padding: var(--lr-space-xs);
    border: 0;
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  [part~='close-button']:where(:hover) {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }

  [part~='close-button']:where(:active) {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part~='close-button']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  .countdown {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    block-size: var(--lr-size-4px);
    background: var(--lr-color-fill-loud);
    transform: scaleX(1);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'] {
      transition: none;
    }

    .countdown {
      display: none;
    }
  }
`;
