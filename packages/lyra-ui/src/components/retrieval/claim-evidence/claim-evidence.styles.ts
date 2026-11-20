import { activeFill, focusRingInwardOffset, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { containerHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${containerHost}
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part~='claim'] {
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius-container);
    background: var(--lr-color-surface);
  }
  [part~='claim-selected'] {
    border-color: var(--lr-color-brand);
  }
  @media (forced-colors: active) {
    [part~='claim-selected'] {
      outline: var(--lr-border-width-medium) solid Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
  }
  /* Density escape -- same convention as lr-source-card's and lr-entity-card's dense size tier. The
     tuned values sit in inline var() fallbacks, not a :host declaration (re-declared by every instance,
     shadowing ancestor values), so a list retunes every claim at once from outside; the fallbacks
     are the pre-existing values scaled down one step, so an unset claim renders unchanged. */
  :host(:is([size='2xs'], [size='xs'], [size='s'], [size='small'])) [part='claim-trigger'] {
    padding: var(--lr-claim-evidence-compact-padding, var(--lr-space-xs));
    gap: var(--lr-claim-evidence-compact-gap, var(--lr-space-xs));
  }
  /* Strips the claim-row chrome for a claim nested inside an already-bordered or -backgrounded
     container -- the same escape hatch as sibling lr-source-card's and lr-entity-card's identical
     frame='plain' rule. */
  :host([frame='plain']) [part~='claim'] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  :host([frame='plain']) [part~='claim-selected'] {
    outline: var(--lr-border-width-medium) solid var(--lr-color-brand);
    outline-offset: calc(-1 * var(--lr-border-width-medium));
  }
  [part='claim-trigger'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--lr-space-s);
    align-items: center;
    inline-size: 100%;
    box-sizing: border-box;
    ${iconHitTarget}
    padding: var(--lr-space-s);
    border: 0;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
    ${interactiveTransition}
  }
  [part='claim-trigger']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part='claim-trigger']:active {
    background: ${activeFill('var(--lr-color-surface-raised)')};
  }
  [part='claim-trigger']:focus-visible {
    ${focusRingInwardOffset}
  }
  [part='claim-text'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='confidence'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    white-space: nowrap;
  }
  [part='explanation'] {
    margin: 0;
    padding: 0 var(--lr-space-s) var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='evidence'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    align-items: center;
    padding: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part='evidence'] q {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  @container ${compactContainerQuery} {
    [part='claim-trigger'] {
      grid-template-columns: 1fr;
    }
  }
  [part='limit'] {
    margin: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
`;
