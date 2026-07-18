import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    min-inline-size: 0;
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='title'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    font-size: var(--lyra-font-size-md);
    font-weight: var(--lyra-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  [part='description'] {
    margin: 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='properties'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
`;
