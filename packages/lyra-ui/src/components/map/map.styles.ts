import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    block-size: 24rem;
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='container'] {
    position: absolute;
    inset: 0;
  }
  [part='legend'] {
    position: absolute;
    inset-block-end: var(--lyra-space-s);
    inset-inline-start: var(--lyra-space-s);
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    font-size: 0.75rem;
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  [part='legend-swatch'] {
    inline-size: 0.75rem;
    block-size: 0.75rem;
    border-radius: 2px;
    flex: 0 0 auto;
  }
`;
