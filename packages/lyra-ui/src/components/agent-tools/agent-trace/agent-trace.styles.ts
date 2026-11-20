import { activeFill, focusRing, hoverFill, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { containerHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${containerHost}
  }

  :host([frame='card']) [part='base'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
  }

  :host(:is([size='2xs'], [size='xs'], [size='s'], [size='small'])) [part='base'] { gap: var(--lr-space-xs); }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    max-inline-size: 100%;
    box-sizing: border-box;
  }

  [part='limit'] {
    margin: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  [part='filter'] {
    max-inline-size: 100%;
  }

  [part='handoffs'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    box-sizing: border-box;
    max-inline-size: 100%;
  }

  [part='handoff'] {
    display: block;
    inline-size: 100%;
    ${iconHitTarget}
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
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  /* The handoff button has no fill of its own, so both states tint the transparent surface toward
     --lr-color-mix-partner, which follows the text colour: darker in a light theme, lighter in a
     dark one. Not the former hand-rolled 8% mix against --lr-color-text -- a literal no consumer
     could retune, at a strength no other control in the library shared. */
  [part='handoff']:hover {
    background: var(--lr-agent-trace-handoff-hover-bg, ${hoverFill('transparent')});
  }
  [part='handoff']:active {
    background: var(--lr-agent-trace-handoff-pressed-bg, ${activeFill('var(--lr-agent-trace-handoff-hover-bg, transparent)')});
  }
  [part='handoff']:focus-visible {
    ${focusRing}
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
    background: ${activeFill('var(--lr-agent-trace-handoff-active-bg, var(--lr-color-brand-quiet))')};
  }

  [part='tree'] {
    max-inline-size: 100%;
  }
`;
