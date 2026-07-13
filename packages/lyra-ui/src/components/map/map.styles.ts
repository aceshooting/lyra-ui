import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    block-size: var(--lyra-size-24rem);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  lyra-skeleton {
    --lyra-skeleton-w: 100%;
    --lyra-skeleton-h: 100%;
  }
  [part='container'] {
    position: absolute;
    inset: 0;
  }
  [part='legend'] {
    position: absolute;
    inset-block-end: var(--lyra-space-s);
    inset-inline-start: var(--lyra-space-s);
    z-index: var(--lyra-layer-content);
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    font-size: var(--lyra-font-size-xs);
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='legend-swatch'] {
    inline-size: var(--lyra-size-0-75rem);
    block-size: var(--lyra-size-0-75rem);
    border-radius: var(--lyra-size-2px);
    flex: 0 0 auto;
  }
`;
