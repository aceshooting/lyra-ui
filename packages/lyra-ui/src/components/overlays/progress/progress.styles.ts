import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    color: var(--lr-color-brand);
    /* Palette slot: which color the active 'variant' contributes to the indicator, read from the
       shared semantic grid's loud fill (imported alongside this sheet as 'variants' in the class
       file's static styles). It sits *inside* the two consumer-facing override names below in the
       fallback chain -- an explicit --lr-progress-indicator-color or the upstream --indicator-color
       alias still wins outright, exactly as before this token existed. The standalone default here
       (brand) matches the value this indicator always rendered before variant support existed. */
    --lr-progress-indicator-variant-color: var(--lr-color-brand);
  }
  /* [variant] is always present -- 'variant' reflects its 'brand' property default on first
     render -- but the bare :host default above still guards a not-yet-updated element. */
  :host([variant]) {
    --lr-progress-indicator-variant-color: var(--lr-color-fill-loud);
  }
  [part~='base'] { display: block; }
  [part='track'] { overflow: hidden; inline-size: 100%; block-size: var(--lr-progress-track-height, var(--lr-progress-height, var(--track-height, var(--height, var(--lr-size-1rem))))); border-radius: var(--lr-radius-pill); background: var(--lr-progress-track-color, var(--track-color, var(--lr-color-brand-quiet))); }
  [part='indicator'] { block-size: 100%; border-radius: inherit; background: var(--lr-progress-indicator-color, var(--indicator-color, var(--lr-progress-indicator-variant-color))); transition: inline-size var(--lr-transition-base); }
  :host([indeterminate]) [part='indicator'] { animation: lr-progress-slide var(--lr-progress-duration, var(--lr-transition-ambient)) infinite alternate; }
  [part='label'] { display: flex; min-inline-size: 0; flex-wrap: wrap; justify-content: space-between; gap: var(--lr-space-s); overflow-wrap: anywhere; margin-block-end: var(--lr-space-xs); color: var(--lr-progress-label-color, var(--label-color, var(--lr-color-text))); font-size: var(--lr-font-size-sm); }
  [part='label'][hidden] { display: none; }
  @keyframes lr-progress-slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
  /* The determinate fill mirrors for free (a block box anchors to the inline-start edge, the
     physical right under RTL), but translateX is physical, so the indeterminate sweep needs
     mirrored keyframes to travel end-to-start under RTL: the indicator's static position is
     right-anchored there, so just-off-screen is +100% (right) through -250% (left). */
  :host([indeterminate]:dir(rtl)) [part='indicator'] { animation-name: lr-progress-slide-rtl; }
  @keyframes lr-progress-slide-rtl { from { transform: translateX(100%); } to { transform: translateX(-250%); } }
  @media (prefers-reduced-motion: reduce) { [part='indicator'] { transition: none; animation: none !important; } }
`;

export const ringStyles = css`
  :host { display: inline-block; color: var(--lr-color-brand); }
  [part~='base'] { position: relative; display: inline-flex; align-items: center; justify-content: center; inline-size: var(--lr-progress-ring-size, var(--size, var(--lr-size-2-5rem))); block-size: var(--lr-progress-ring-size, var(--size, var(--lr-size-2-5rem))); }
  svg { inline-size: 100%; block-size: 100%; transform: rotate(-90deg); }
  circle { fill: none; stroke-linecap: round; }
  [part='track'] { stroke: var(--lr-progress-ring-track-color, var(--track-color, var(--lr-color-brand-quiet))); stroke-width: var(--lr-progress-ring-track-width, var(--track-width, var(--lr-size-4px))); }
  [part='indicator'] { stroke: var(--lr-progress-ring-indicator-color, var(--indicator-color, var(--lr-color-brand))); stroke-width: var(--lr-progress-ring-indicator-width, var(--indicator-width, var(--lr-progress-ring-track-width, var(--track-width, var(--lr-size-4px))))); transition: stroke-dashoffset var(--lr-progress-ring-indicator-transition-duration, var(--indicator-transition-duration, var(--lr-transition-base))); }
  :host([indeterminate]) [part='indicator'] { transform-box: fill-box; transform-origin: center; animation: lr-progress-ring-spin var(--lr-progress-duration, var(--lr-transition-ambient)) infinite; }
  [part='label'] { position: absolute; color: var(--lr-color-text); font-size: var(--lr-font-size-sm); }
  @keyframes lr-progress-ring-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { [part='indicator'] { transition: none; animation: none !important; } }
`;
