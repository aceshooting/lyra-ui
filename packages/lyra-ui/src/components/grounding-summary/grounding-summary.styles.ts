import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }
  [part='stats'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-m);
  }
  [part='stats'] > lr-stat {
    flex: 1 1 var(--lr-size-10rem);
    min-inline-size: 0;
  }
  [part='warnings'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-inline-start: var(--lr-border-width-thick) solid var(--lr-color-warning);
    border-radius: var(--lr-radius);
    background: var(--lr-color-warning-quiet);
  }
  [part='warnings-heading'] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='warnings-count'] {
    margin-inline-start: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-medium);
  }
  [part='warnings-list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    margin: 0;
    padding-inline-start: var(--lr-space-l);
  }
  [part='warning'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }
  [part='evidence'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }
  [part='evidence-heading'] {
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
  [part='evidence-count'] {
    margin-inline-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='evidence-item'] {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
  }
  [part='evidence-item'] + [part='evidence-item'] {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='evidence-label'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }
  [part='evidence-span'] {
    font-size: var(--lr-font-size-sm);
    font-family: var(--lr-font-mono);
    color: var(--lr-color-text-quiet);
  }
`;
