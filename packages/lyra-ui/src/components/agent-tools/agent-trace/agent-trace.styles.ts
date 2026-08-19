import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
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
     --lr-color-mix-partner, which follows the text colour: darker in a light theme, lighter in a
     dark one. Not the former hand-rolled 8% mix against --lr-color-text -- a literal no consumer
     could retune, at a strength no other control in the library shared. */
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
  /* The active entry's own held state: the [data-active] rule directly above ties the generic
     :hover/:active arms at (0,2,0) and, written after them, takes the background back, so without
     this the active entry acknowledges nothing when clicked. Losing the hover tint there is
     deliberate, the active fill being the point; losing the press is not. Mixes from
     --lr-agent-trace-handoff-active-bg rather than transparent, so a retinted active fill gets a
     deeper tier of itself. */
  [part='handoff'][data-active]:active {
    background: color-mix(
      in oklab,
      var(--lr-agent-trace-handoff-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part='tree'] {
    max-inline-size: 100%;
  }
`;
