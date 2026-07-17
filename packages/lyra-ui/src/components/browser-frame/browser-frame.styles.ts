import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    overflow: hidden;
  }
  [part='toolbar'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: var(--lyra-size-1px) solid var(--lyra-color-border);
    font-size: var(--lyra-font-size-sm);
  }
  [part='url'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lyra-color-text-quiet);
  }
  [part='status'] {
    font-size: var(--lyra-font-size-xs);
  }
  [part='controller-badge'] {
    font-size: var(--lyra-font-size-xs);
    padding: var(--lyra-space-2xs) var(--lyra-space-xs);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='take-over-button'],
  [part='stop-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    background: none;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    cursor: pointer;
  }
  [part='viewport'] {
    position: relative;
    aspect-ratio: var(--lyra-browser-frame-aspect-ratio, 16 / 9);
    background: var(--lyra-color-surface-raised);
  }
  [part='frame'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
  }
  ::slotted(*) {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
  }
  [part='ping'] {
    position: absolute;
    inline-size: var(--lyra-size-16px);
    block-size: var(--lyra-size-16px);
    translate: -50% -50%;
    border-radius: var(--lyra-radius-pill);
    border: var(--lyra-size-2px) solid var(--lyra-color-brand);
    pointer-events: none;
  }
  [part='ping'][data-kind='click'] {
    border-color: var(--lyra-color-brand);
  }
  [part='ping'][data-kind='type'] {
    border-color: var(--lyra-color-success);
  }
  [part='ping'][data-kind='scroll'] {
    border-color: var(--lyra-color-warning);
  }
  [part='ping'][data-kind='move'] {
    border-color: var(--lyra-color-text-quiet);
  }
`;
