import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    overflow: hidden;
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-size-1px) solid var(--lr-color-border);
    font-size: var(--lr-font-size-sm);
  }
  [part='url'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text-quiet);
  }
  [part='status'] {
    font-size: var(--lr-font-size-xs);
  }
  [part='controller-badge'] {
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-browser-frame-controller-background, var(--lr-color-brand-quiet));
    color: var(--lr-browser-frame-controller-color, var(--lr-color-brand));
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='take-over-button'],
  [part='stop-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    cursor: pointer;
    min-inline-size: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  [part='take-over-button']:hover,
  [part='stop-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='viewport'] {
    position: relative;
    aspect-ratio: var(--lr-browser-frame-aspect-ratio, 16 / 9);
    background: var(--lr-color-surface-raised);
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
    inline-size: var(--lr-size-16px);
    block-size: var(--lr-size-16px);
    translate: -50% -50%;
    border-radius: var(--lr-radius-pill);
    border: var(--lr-size-2px) solid var(--lr-color-brand);
    pointer-events: none;
  }
  [part='ping'][data-kind='click'] {
    border-color: var(--lr-browser-frame-ping-click-color, var(--lr-color-brand));
  }
  [part='ping'][data-kind='type'] {
    border-color: var(--lr-browser-frame-ping-type-color, var(--lr-color-success));
  }
  [part='ping'][data-kind='scroll'] {
    border-color: var(--lr-browser-frame-ping-scroll-color, var(--lr-color-warning));
  }
  [part='ping'][data-kind='move'] {
    border-color: var(--lr-browser-frame-ping-move-color, var(--lr-color-text-quiet));
  }
  @container (max-inline-size: 20rem) {
    [part='url'] {
      flex-basis: 100%;
    }
  }
`;
