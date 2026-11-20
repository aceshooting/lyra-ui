import { outlinedActionStyles } from '../../../internal/icon-action.styles.js';
import { activeFill, focusRingInsetOffset, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { containerHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${containerHost}
  }
  [part='base'] {
    min-inline-size: 0;
  }
  [part='overlap'] {
    margin: 0 0 var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='sets'] {
    display: grid;
    grid-auto-columns: minmax(var(--lr-size-16rem), 1fr);
    grid-auto-flow: column;
    gap: var(--lr-space-m);
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
  }
  [part='set'] {
    min-inline-size: 0;
  }
  [part='set-heading'] {
    margin: 0 0 var(--lr-space-s);
    font-size: var(--lr-font-size-m);
  }
  [part='chunks'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part~='chunk'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--lr-space-xs) var(--lr-space-s);
    inline-size: 100%;
    box-sizing: border-box;
    ${iconHitTarget}
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
    ${interactiveTransition}
  }
  [part~='chunk']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part~='chunk']:active {
    background: ${activeFill('var(--lr-color-surface-raised)')};
  }
  [part~='chunk']:focus-visible {
    ${focusRingInsetOffset}
  }
  [part~='chunk-selected'] {
    border-color: var(--lr-retrieval-compare-selected-border, var(--lr-color-brand));
  }
  @media (forced-colors: active) {
    [part~='chunk-selected'] {
      outline: var(--lr-border-width-medium) solid Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
  }
  [part='chunk-rank'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part='chunk-title'],
  [part='chunk-text'],
  [part='scores'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='chunk-text'],
  [part='scores'] {
    grid-column: 1 / -1;
  }
  [part='chunk-text'] {
    font-size: var(--lr-font-size-sm);
  }
  [part='scores'] {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--lr-space-2xs) var(--lr-space-s);
  }
  [part='score'] {
    display: flex;
    justify-content: space-between;
    gap: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  @container ${compactContainerQuery} {
    [part='sets'] {
      grid-auto-columns: minmax(var(--lr-size-14rem), 100%);
    }
    [part='scores'] {
      grid-template-columns: 1fr;
    }
  }
  :host(:is([size='2xs'], [size='xs'], [size='s'], [size='small'])) [part~='chunk'] {
    padding: var(--lr-space-xs);
  }
  :host([frame='plain']) [part~='chunk'] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  :host([frame='plain']) [part~='chunk-selected'] {
    outline: var(--lr-border-width-medium) solid var(--lr-retrieval-compare-selected-border, var(--lr-color-brand));
    outline-offset: calc(-1 * var(--lr-border-width-medium));
  }
  [part='pagination'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    margin-block: var(--lr-space-s);
  }
  ${outlinedActionStyles("[part='page-button']")}
  [part='page-status'],
  [part='input-limit'],
  [part='result-limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    margin-block: var(--lr-space-xs);
  }
`;
