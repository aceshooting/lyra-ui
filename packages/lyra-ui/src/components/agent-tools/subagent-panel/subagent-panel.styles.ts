import { css } from 'lit';

export const styles = css`
  :host { display: block; container-type: inline-size; contain-intrinsic-inline-size: var(--lr-size-20rem); }
  [part='list'] { display: flex; flex-direction: column; gap: var(--lr-space-xs); margin: 0; padding: 0; list-style: none; }
  [part~='run'] { margin-inline-start: calc(var(--lr-subagent-depth, 0) * var(--lr-space-l)); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); overflow: hidden; }
  [part~='run-selected'] {
    border-color: var(--lr-subagent-panel-selected-border, var(--lr-color-brand));
  }
  [part='run-row'] { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
  [part='run-trigger'] {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--lr-space-xs); min-inline-size: 0; min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-s); border: 0; background: var(--lr-color-surface); color: var(--lr-color-text); font: inherit; text-align: start; cursor: pointer;
  }
  [part='run-trigger']:hover, [part='cancel']:hover, [part='retry']:hover { background: var(--lr-color-surface-raised); }
  /* Pressed is the hover tint pushed a further --lr-color-mix-active toward --lr-color-mix-partner,
     which follows the text colour -- a distinctly deeper step in both light and dark themes. */
  [part='run-trigger']:active, [part='cancel']:active, [part='retry']:active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='run-trigger']:focus-visible, [part='cancel']:focus-visible, [part='retry']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: calc(var(--lr-focus-ring-offset) * -1); }
  [part='label'], [part='task'], [part='model'] { min-inline-size: 0; overflow-wrap: break-word; }
  [part='task'], [part='model'] { grid-column: 1 / -1; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='progress'] {
    grid-column: 1 / -1;
    block-size: var(--lr-size-0-25rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-subagent-panel-progress-track, var(--lr-color-border));
    overflow: hidden;
  }
  [part='progress'] > span {
    display: block;
    block-size: 100%;
    background: var(--lr-subagent-panel-progress-fill, var(--lr-color-brand));
  }
  [part='actions'] { display: flex; }
  [part='cancel'], [part='retry'] { min-block-size: var(--lr-icon-button-size); min-inline-size: var(--lr-icon-button-size); padding: var(--lr-space-xs); border: 0; border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border); background: var(--lr-color-surface); color: var(--lr-color-text); font: inherit; cursor: pointer; }
  @container (max-inline-size: 20rem) {
    [part~='run'] { margin-inline-start: calc(var(--lr-subagent-depth, 0) * var(--lr-space-s)); }
    [part='run-trigger'] { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    [part='status'] { min-inline-size: 0; max-inline-size: 100%; }
    [part='run-row'] { grid-template-columns: 1fr; }
    [part='actions'] { border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  }
`;
