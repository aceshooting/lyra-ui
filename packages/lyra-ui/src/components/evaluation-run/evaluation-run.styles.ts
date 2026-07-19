import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s) var(--lr-space-m);
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
  }
  [part='header-label'] {
    flex: 0 0 auto;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }
  [part='progress'] {
    flex: 1 1 12rem;
    min-inline-size: 0;
  }
  [part='summary'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='counts'] {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }
  [part='examples'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }
  [part='example-summary'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='example-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='input-section'],
  [part='output-section'],
  [part='grounding-section'],
  [part='tool-trace-section'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-s);
  }
  [part='section-heading'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text-quiet);
  }
`;
