import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lr-reorder-item-gap, var(--lr-space-xs));
  }
  [part='move-up-button'],
  [part='move-down-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: none;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md);
    cursor: pointer;
    border-radius: var(--lr-radius);
  }
  /* chevronIcon() renders a right-pointing chevron with no baked-in rotation (see icons.ts) --
     rotate the whole button, matching lr-tree-node's identical [part='toggle'] rotation approach. */
  [part='move-up-button'] {
    transform: rotate(-90deg);
  }
  [part='move-down-button'] {
    transform: rotate(90deg);
  }
  [part='move-up-button']:hover,
  [part='move-down-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='move-up-button']:focus-visible,
  [part='move-down-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='move-up-button']:disabled,
  [part='move-down-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
    background: none;
    color: var(--lr-color-text-quiet);
  }
  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='move-up-button'],
    [part='move-down-button'] {
      transition: none !important;
    }
  }
`;
