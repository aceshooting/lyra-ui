import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    --_lr-span-waterfall-name-width: var(--lr-size-8rem);
  }

  [part="base"] {
    display: flex;
    flex-direction: column;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }

  [part="axis"] {
    position: relative;
    block-size: var(--lr-size-1-25rem);
    margin-inline-start: calc(
      var(--lr-span-waterfall-name-width, var(--_lr-span-waterfall-name-width)) +
        var(--lr-space-xs)
    );
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow: hidden;
  }
  [part="tick"] {
    position: absolute;
    inset-block-start: 0;
    inset-block-end: 0;
    border-inline-start: var(--lr-border-width-thin) solid
      var(--lr-color-border);
  }
  [part="tick-label"] {
    position: absolute;
    inset-inline-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-2xs);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part="tick"][data-edge="end"] [part="tick-label"] {
    inset-inline-start: auto;
    inset-inline-end: var(--lr-space-xs);
  }

  [part="row"] {
    display: grid;
    grid-template-columns:
      var(--lr-span-waterfall-name-width, var(--_lr-span-waterfall-name-width))
      1fr;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-2xs);
    min-block-size: var(--lr-size-1-75rem);
  }
  [part="row"][data-active] {
    background: var(
      --lr-span-waterfall-row-active-bg,
      var(--lr-color-brand-quiet)
    );
  }

  [part="name"] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part="bar-track"] {
    position: relative;
    /* The bar is the sole click/keyboard target for lr-span-select. Give its track the shared
       icon-button block size so the required two-axis target floor remains contained. */
    block-size: var(--lr-icon-button-size);
  }
  [part="bar"] {
    position: absolute;
    inset-block: 0;
    /* A narrow time slice still needs the shared icon-button target, but using min-inline-size
       alone lets an endpoint target widen past the track. Size first, cap it to the track, then
       clamp the logical start against that actual size so the same rule mirrors under RTL. */
    --_lr-span-waterfall-target-width: min(
      100%,
      max(var(--_lr-span-waterfall-width), var(--lr-icon-button-size))
    );
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    inline-size: var(--_lr-span-waterfall-target-width);
    inset-inline-start: min(
      var(--_lr-span-waterfall-start),
      calc(100% - var(--_lr-span-waterfall-target-width))
    );
    border: none;
    border-radius: var(--lr-radius-xs);
    padding: 0;
    cursor: pointer;
  }
  [part="bar"][hidden] {
    display: none;
  }
  /* The hover/pressed tint is a veil on a pseudo-element, not a background swap: a bar's fill is
     one of five things -- four solid tones, a striped gradient for running, a transparent dashed
     box for pending -- and no single background declaration tints all five, while one translucent
     overlay does. Mixing toward --lr-color-mix-partner (which follows the text colour) darkens the
     veil in a light theme and lightens it in a dark one; the filter: brightness() this replaces
     managed that only by luck, multiplying every channel, so it moved a mid-tone bar, did nothing
     to a pure white or pure black one, and applied to the whole subtree. */
  [part="bar"]::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: transparent;
  }
  [part="bar"]:hover::after {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="bar"]:active::after {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="bar"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="bar"][data-tone="success"] {
    background: var(--lr-span-waterfall-success-color, var(--lr-color-success));
  }
  [part="bar"][data-tone="danger"] {
    background: var(--lr-span-waterfall-error-color, var(--lr-color-danger));
  }
  [part="bar"][data-tone="warning"] {
    background: var(--lr-span-waterfall-denied-color, var(--lr-color-warning));
  }
  [part="bar"][data-tone="accent"] {
    background-image: repeating-linear-gradient(
      45deg,
      var(--lr-span-waterfall-running-color, var(--lr-color-brand)) 0
        var(--lr-size-6px),
      var(--lr-span-waterfall-running-stripe-color, var(--lr-color-brand-quiet))
        var(--lr-size-6px) calc(var(--lr-size-6px) * 2)
    );
    background-size: 200% 100%;
    animation: lr-span-waterfall-stripe
      var(--lr-span-waterfall-stripe-speed, var(--lr-duration-ambient)) linear
      infinite;
  }
  [part="bar"][data-tone="neutral"] {
    background: transparent;
    border: var(--lr-border-width-thin) dashed
      var(
        --lr-span-waterfall-pending-border-color,
        var(--lr-color-border-strong)
      );
  }
  /* background-position is physical, so the stripe crawl does not mirror under RTL; play the same
     keyframes backwards there. animation-direction rather than a second animation-name keeps the
     reduced-motion 'animation: none' override below effective -- this rule's higher specificity
     would otherwise win the animation-name longhand back. */
  :host(:dir(rtl)) [part="bar"][data-tone="accent"] {
    animation-direction: reverse;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="bar"][data-tone="accent"] {
      animation: none;
    }
  }
  @keyframes lr-span-waterfall-stripe {
    to {
      background-position: calc(var(--lr-size-24px) * -1) 0;
    }
  }

  [part="meta"] {
    display: none;
  }

  [part="status-text"] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part="duration"] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part="empty"] {
    padding: var(--lr-space-l);
  }

  [part="limit"] {
    margin: var(--lr-space-s) 0 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  @container (max-inline-size: 479.98px) {
    [part="axis"] {
      margin-inline-start: 0;
    }
    [part="row"] {
      grid-template-columns: 1fr;
    }
    [part="meta"] {
      display: flex;
      gap: var(--lr-space-s);
    }
  }
`;
