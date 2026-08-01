import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    max-inline-size: 100%;
    box-sizing: border-box;
  }

  [part='filter'] {
    max-inline-size: 100%;
  }

  [part='handoffs'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    box-sizing: border-box;
    max-inline-size: 100%;
  }

  [part='handoff'] {
    display: block;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    text-align: start;
    color: inherit;
    cursor: pointer;
    border-radius: var(--lr-radius-xs);
  }
  /* The handoff button has no fill of its own, so both states tint the transparent surface toward
     --lr-color-mix-partner (which follows the text colour): it darkens in a light theme, lightens in
     a dark one. Previously a hand-rolled 8% mix against --lr-color-text -- same idea, but a literal
     no consumer could retune and a strength no other control in the library shared. */
  [part='handoff']:hover {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part='handoff']:active {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='handoff']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='handoff'][data-active] {
    background: var(--lr-agent-trace-handoff-active-bg, var(--lr-color-brand-quiet));
  }

  [part='tree'] {
    max-inline-size: 100%;
  }
`;
