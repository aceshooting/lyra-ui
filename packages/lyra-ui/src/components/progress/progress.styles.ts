import { css } from 'lit';

export const styles = css`
  :host { display: block; color: var(--lyra-color-brand); }
  [part='base'] { display: block; }
  [part='track'] { overflow: hidden; inline-size: 100%; block-size: var(--lyra-progress-height, var(--lyra-size-0-5rem)); border-radius: var(--lyra-radius-pill); background: var(--lyra-color-brand-quiet); }
  [part='indicator'] { block-size: 100%; border-radius: inherit; background: var(--lyra-color-brand); transition: inline-size var(--lyra-transition-base); }
  :host([indeterminate]) [part='indicator'] { animation: lyra-progress-slide var(--lyra-progress-duration, 1.2s) ease-in-out infinite alternate; }
  [part='label'] { display: flex; justify-content: space-between; gap: var(--lyra-space-s); margin-block-end: var(--lyra-space-xs); color: var(--lyra-color-text); font-size: var(--lyra-font-size-sm); }
  [part='label'][hidden] { display: none; }
  @keyframes lyra-progress-slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
  /* The determinate fill mirrors for free (a block box anchors to the inline-start edge, the
     physical right under RTL), but translateX is physical, so the indeterminate sweep needs
     mirrored keyframes to travel end-to-start under RTL: the indicator's static position is
     right-anchored there, so just-off-screen is +100% (right) through -250% (left). */
  :host([indeterminate]:dir(rtl)) [part='indicator'] { animation-name: lyra-progress-slide-rtl; }
  @keyframes lyra-progress-slide-rtl { from { transform: translateX(100%); } to { transform: translateX(-250%); } }
  @media (prefers-reduced-motion: reduce) { [part='indicator'] { transition: none; animation: none !important; } }
`;

export const ringStyles = css`
  :host { display: inline-block; color: var(--lyra-color-brand); }
  [part='base'] { position: relative; display: inline-flex; align-items: center; justify-content: center; inline-size: var(--lyra-progress-ring-size, var(--lyra-size-2-5rem)); block-size: var(--lyra-progress-ring-size, var(--lyra-size-2-5rem)); }
  svg { inline-size: 100%; block-size: 100%; transform: rotate(-90deg); }
  circle { fill: none; stroke-linecap: round; }
  [part='track'] { stroke: var(--lyra-color-brand-quiet); }
  [part='indicator'] { stroke: var(--lyra-color-brand); transition: stroke-dashoffset var(--lyra-transition-base); }
  :host([indeterminate]) [part='indicator'] { transform-box: fill-box; transform-origin: center; animation: lyra-progress-ring-spin var(--lyra-progress-duration, 1.2s) linear infinite; }
  [part='label'] { position: absolute; color: var(--lyra-color-text); font-size: var(--lyra-font-size-sm); }
  @keyframes lyra-progress-ring-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { [part='indicator'] { transition: none; animation: none !important; } }
`;
