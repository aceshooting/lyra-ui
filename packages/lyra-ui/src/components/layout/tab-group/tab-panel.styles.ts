import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* The owning slot supplies the size in fill mode. Start fresh for nested panel hosts. */
    --_lr-tab-panel-block-size: initial;
  }
  :host(:not([active])) {
    display: none;
  }
  [part~='base'] {
    padding: var(--padding, 0);
    block-size: var(--_lr-tab-panel-block-size, auto);
    box-sizing: border-box;
  }
`;
