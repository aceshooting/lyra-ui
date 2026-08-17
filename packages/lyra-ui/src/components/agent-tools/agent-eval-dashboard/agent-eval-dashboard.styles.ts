import { css } from 'lit';
export const styles = css`
  :host { display: block; min-inline-size: 0; max-inline-size: 100%; container-type: inline-size; contain-intrinsic-inline-size: var(--lr-size-20rem); }
  [part='base'] { display: flex; min-inline-size: 0; max-inline-size: 100%; flex-direction: column; gap: var(--lr-space-m); }
  [part='heading'], [part='runs-heading'] { margin: 0; min-inline-size: 0; max-inline-size: 100%; overflow-wrap: break-word; font-size: var(--lr-font-size-lg); font-weight: var(--lr-font-weight-semibold); }
  [part='metrics'] { display: grid; min-inline-size: 0; max-inline-size: 100%; grid-template-columns: repeat(auto-fit, minmax(var(--lr-size-10rem), 1fr)); gap: var(--lr-space-s); }
  [part='metric'], [part='chart'] { min-inline-size: 0; }
  [part='metric'] {
    inline-size: 100%;
    padding: 0;
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='metric']:hover { background: var(--lr-color-surface-raised); }
  [part='metric']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='metric'][aria-pressed='true'] {
    border-color: var(--lr-agent-eval-dashboard-active-border, var(--lr-color-brand));
    background: var(--lr-agent-eval-dashboard-active-background, var(--lr-color-brand-quiet));
  }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover in both light and dark themes. It must stay after the [aria-pressed='true'] rule: the
     two selectors are both (0,2,0), so source order alone decides whether pressing an
     already-selected metric shows any feedback at all. */
  [part='metric']:active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='runs'] { display: flex; min-inline-size: 0; max-inline-size: 100%; flex-direction: column; gap: var(--lr-space-xs); }
  [part='run'] { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--lr-space-xs); align-items: center; padding-block: var(--lr-space-xs); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); inline-size: 100%; background: transparent; color: var(--lr-color-text); font: inherit; text-align: start; cursor: pointer; }
  [part='run']:hover { background: var(--lr-color-surface-raised); }
  [part='run']:active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='run']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='run-label'] { min-inline-size: 0; max-inline-size: 100%; overflow-wrap: break-word; }
  [part='run-meta'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-2xs); align-items: center; justify-content: flex-end; }
  [part='empty'] { color: var(--lr-color-text-quiet); }
  @container (max-inline-size: 319.98px) { [part='metrics'] { grid-template-columns: 1fr; } [part='run'] { grid-template-columns: 1fr; } [part='run-meta'] { justify-content: flex-start; } }
`;
