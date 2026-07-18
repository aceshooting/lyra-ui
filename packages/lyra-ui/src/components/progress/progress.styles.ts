import { css } from 'lit';

export const styles = css`
  :host { display: block; color: var(--lr-color-brand); }
  [part='base'] { display: block; }
  [part='track'] { overflow: hidden; inline-size: 100%; block-size: var(--lr-progress-height, var(--lr-size-0-5rem)); border-radius: var(--lr-radius-pill); background: var(--lr-color-brand-quiet); }
  [part='indicator'] { block-size: 100%; border-radius: inherit; background: var(--lr-color-brand); transition: inline-size var(--lr-transition-base); }
  :host([indeterminate]) [part='indicator'] { animation: lr-progress-slide var(--lr-progress-duration, 1.2s) ease-in-out infinite alternate; }
  [part='label'] { display: flex; justify-content: space-between; gap: var(--lr-space-s); margin-block-end: var(--lr-space-xs); color: var(--lr-color-text); font-size: var(--lr-font-size-sm); }
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
  [part='base'] { position: relative; display: inline-flex; align-items: center; justify-content: center; inline-size: var(--lr-progress-ring-size, var(--lr-size-2-5rem)); block-size: var(--lr-progress-ring-size, var(--lr-size-2-5rem)); }
  svg { inline-size: 100%; block-size: 100%; transform: rotate(-90deg); }
  circle { fill: none; stroke-linecap: round; }
  [part='track'] { stroke: var(--lr-color-brand-quiet); }
  [part='indicator'] { stroke: var(--lr-color-brand); transition: stroke-dashoffset var(--lr-transition-base); }
  :host([indeterminate]) [part='indicator'] { transform-box: fill-box; transform-origin: center; animation: lr-progress-ring-spin var(--lr-progress-duration, 1.2s) linear infinite; }
  [part='label'] { position: absolute; color: var(--lr-color-text); font-size: var(--lr-font-size-sm); }
  @keyframes lr-progress-ring-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { [part='indicator'] { transition: none; animation: none !important; } }
`;
