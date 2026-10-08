import { iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';

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
  }

  [part='timeline'] {
    display: block;
  }

  [part='evidence-list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }

  [part='evidence-row'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius-container);
    overflow: hidden;
  }
  [part='evidence-row'][data-active] {
    border-color: var(--lr-retrieval-trace-active-border, var(--lr-color-brand));
  }

  [part='evidence-toggle'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    ${iconHitTarget}
    inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }
  [part='evidence-toggle']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part='evidence-toggle']:active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='evidence-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part='evidence-toggle-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--lr-color-text-quiet);
  }
  [part='evidence-toggle'][aria-expanded='true'] [part='evidence-toggle-icon'] svg {
    transform: rotate(90deg);
  }
  /* Mirrors this family's own chevron-mirroring convention (see lr-trace-tree): rotation is
     physical, so a collapsed chevron under RTL points the opposite way from LTR. */
  :host(:dir(rtl)) [part='evidence-toggle']:not([aria-expanded='true']) [part='evidence-toggle-icon'] svg {
    transform: rotate(180deg);
  }

  [part='evidence-body'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    padding-block-start: 0;
  }
  [part='evidence-body'][hidden] {
    display: none;
  }

  [part='evidence-text'] {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }

  [part~='evidence-metadata'] {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    margin: 0;
    font-size: var(--lr-font-size-xs);
  }
  [part~='evidence-metadata-row'] {
    display: contents;
  }
  [part~='evidence-metadata-key'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }
  [part~='evidence-metadata-value'] {
    margin: 0;
    color: var(--lr-color-text);
    word-break: break-word;
  }

  @container ${compactContainerQuery} {
    [part='evidence-toggle'] {
      font-size: var(--lr-font-size-xs);
    }
    [part~='evidence-metadata'] {
      grid-template-columns: 1fr;
    }
  }
  :host(:is([size='2xs'], [size='xs'], [size='s'], [size='small'])) [part='evidence-toggle'] {
    padding-block: var(--lr-space-2xs);
  }
  :host(:is([size='2xs'], [size='xs'], [size='s'], [size='small'])) [part='evidence-body'] {
    padding: var(--lr-space-xs);
    padding-block-start: 0;
  }
  :host([frame='plain']) [part='evidence-row'] {
    border: 0;
    border-radius: 0;
  }
`;
