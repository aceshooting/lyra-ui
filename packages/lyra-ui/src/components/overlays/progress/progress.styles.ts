import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    color: var(--lr-color-brand);
    /* Palette slot: the color the active 'variant' contributes to the indicator, from the shared
       semantic grid's loud fill ('variants', imported alongside this sheet in the class file's
       static styles). It sits *inside* the two consumer-facing override names below, so an
       explicit --lr-progress-indicator-color or the upstream --indicator-color alias still wins
       outright. The standalone brand default is what this indicator rendered before variants. */
    --_lr-progress-indicator-variant-color: var(--lr-color-brand);
    /* The track-thickness size ladder's private default. The unconditional value here IS the 'm'
       tier (1rem, unchanged from before the size property existed); the tiered rules below only
       override it for every other step. See the size property's own doc comment in
       progress-bar.class.ts. */
    --_lr-progress-track-height: var(--lr-size-1rem);
  }
  /* [variant] is always present ('variant' reflects its 'brand' default on first render), but the
     bare :host default above still guards a not-yet-updated element. */
  :host([variant]) {
    --_lr-progress-indicator-variant-color: var(--lr-color-fill-loud);
  }
  /* The track-thickness size ladder. Both spellings of every non-'m' tier are matched, matching
     internal/sizes.styles.ts's own convention; 'm'/'medium' need no rule of their own since the
     unconditional --_lr-progress-track-height above already IS that tier. */
  :host([size='2xs']) {
    --_lr-progress-track-height: var(--lr-size-0-25rem);
  }
  :host([size='xs']) {
    --_lr-progress-track-height: var(--lr-size-0-375rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-progress-track-height: var(--lr-size-0-625rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-progress-track-height: var(--lr-size-1-25rem);
  }
  :host([size='xl']) {
    --_lr-progress-track-height: var(--lr-size-1-5rem);
  }
  [part~="base"] {
    display: block;
  }
  [part="track"] {
    overflow: hidden;
    inline-size: 100%;
    block-size: var(
      --lr-progress-track-height,
      var(
        --lr-progress-height,
        var(--track-height, var(--height, var(--_lr-progress-track-height)))
      )
    );
    border-radius: var(--lr-radius-pill);
    background: var(
      --lr-progress-track-color,
      var(--track-color, var(--lr-color-brand-quiet))
    );
  }
  [part="indicator"] {
    block-size: 100%;
    border-radius: inherit;
    background: var(
      --lr-progress-indicator-color,
      var(
        --indicator-color,
        var(
          --lr-progress-indicator-variant-color,
          var(--_lr-progress-indicator-variant-color)
        )
      )
    );
    transition: inline-size var(--lr-transition-base);
  }
  :host([indeterminate]) [part="indicator"] {
    animation: lr-progress-slide
      var(--lr-progress-duration, var(--lr-transition-ambient)) infinite
      alternate;
  }
  [part="label"] {
    display: flex;
    min-inline-size: 0;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--lr-space-s);
    overflow-wrap: anywhere;
    margin-block-end: var(--lr-space-xs);
    color: var(
      --lr-progress-label-color,
      var(--label-color, var(--lr-color-text))
    );
    font-size: var(--lr-font-size-sm);
  }
  [part="label"][hidden] {
    display: none;
  }
  @keyframes lr-progress-slide {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
  /* The determinate fill mirrors for free -- a block box anchors to the inline-start edge, the
     physical right under RTL -- but translateX is physical, so the indeterminate sweep needs
     mirrored keyframes to travel end-to-start: right-anchored there, just-off-screen is +100%
     (right) through -250% (left). */
  :host([indeterminate]:dir(rtl)) [part="indicator"] {
    animation-name: lr-progress-slide-rtl;
  }
  @keyframes lr-progress-slide-rtl {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(-250%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part="indicator"] {
      transition: none;
      animation: none !important;
    }
  }
`;

export const ringStyles = css`
  :host {
    display: inline-block;
    color: var(--lr-color-brand);
    /* Palette slot: the color the active 'variant' contributes to the indicator, from the shared
       semantic grid's loud fill ('variants', imported alongside this sheet in the class file's
       static styles). It sits *inside* the two consumer-facing override names below, so an
       explicit --lr-progress-ring-indicator-color or the upstream --indicator-color alias still
       wins outright. The standalone brand default is what this rendered before variants. */
    --_lr-progress-ring-indicator-variant-color: var(--lr-color-brand);
    /* The diameter size ladder's private default. The unconditional value here IS the 'm' tier
       (2.5rem, unchanged from before the size property existed); the tiered rules below only
       override it for every other step. See the size property's own doc comment in
       progress-ring.class.ts. */
    --_lr-progress-ring-size: var(--lr-size-2-5rem);
  }
  /* [variant] is always present ('variant' reflects its 'brand' default on first render), but the
     bare :host default above still guards a not-yet-updated element. */
  :host([variant]) {
    --_lr-progress-ring-indicator-variant-color: var(--lr-color-fill-loud);
  }
  /* The diameter size ladder. Both spellings of every non-'m' tier are matched, matching
     internal/sizes.styles.ts's own convention; 'm'/'medium' need no rule of their own since the
     unconditional --_lr-progress-ring-size above already IS that tier. Only the diameter scales --
     matching sibling <lr-progress-bar>'s own size, which likewise scales exactly one dimension --
     so the track/indicator stroke width and the center label's font size are untouched by this
     ladder. */
  :host([size='2xs']) {
    --_lr-progress-ring-size: var(--lr-size-1-25rem);
  }
  :host([size='xs']) {
    --_lr-progress-ring-size: var(--lr-size-1-75rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-progress-ring-size: var(--lr-size-2-25rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-progress-ring-size: var(--lr-size-3rem);
  }
  :host([size='xl']) {
    --_lr-progress-ring-size: var(--lr-size-3-5rem);
  }
  [part~="base"] {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(
      --lr-progress-ring-size,
      var(--size, var(--_lr-progress-ring-size))
    );
    block-size: var(
      --lr-progress-ring-size,
      var(--size, var(--_lr-progress-ring-size))
    );
  }
  svg {
    inline-size: 100%;
    block-size: 100%;
    transform: rotate(-90deg);
  }
  circle {
    fill: none;
    stroke-linecap: round;
  }
  [part="track"] {
    stroke: var(
      --lr-progress-ring-track-color,
      var(--track-color, var(--lr-color-brand-quiet))
    );
    stroke-width: var(
      --lr-progress-ring-track-width,
      var(--track-width, var(--lr-theme-border-width-thick, var(--lr-size-4px)))
    );
  }
  [part="indicator"] {
    stroke: var(
      --lr-progress-ring-indicator-color,
      var(
        --indicator-color,
        var(
          --lr-progress-ring-indicator-variant-color,
          var(--_lr-progress-ring-indicator-variant-color)
        )
      )
    );
    stroke-width: var(
      --lr-progress-ring-indicator-width,
      var(
        --indicator-width,
        var(
          --lr-progress-ring-track-width,
          var(--track-width, var(--lr-theme-border-width-thick, var(--lr-size-4px)))
        )
      )
    );
    transition: stroke-dashoffset
      var(
        --lr-progress-ring-indicator-transition-duration,
        var(--indicator-transition-duration, var(--lr-transition-base))
      );
  }
  :host([indeterminate]) [part="indicator"] {
    transform-box: fill-box;
    transform-origin: center;
    animation: lr-progress-ring-spin
      var(--lr-progress-duration, var(--lr-transition-ambient)) infinite;
  }
  [part="label"] {
    position: absolute;
    inset-inline: 0;
    padding-inline: var(--lr-space-2xs);
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }
  @keyframes lr-progress-ring-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part="indicator"] {
      transition: none;
      animation: none !important;
    }
  }
`;
