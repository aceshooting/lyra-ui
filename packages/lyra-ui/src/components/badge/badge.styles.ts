import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; }
  [part='base'] { display: inline-flex; align-items: center; min-block-size: var(--lr-size-1-25rem); padding-inline: var(--lr-space-s); border: var(--lr-border-width-thin) solid var(--lr-badge-border, var(--lr-color-border)); border-radius: var(--lr-radius-pill); background: var(--lr-badge-background, var(--lr-color-surface)); color: var(--lr-badge-color, var(--lr-color-text)); font-size: var(--lr-font-size-sm); font-weight: var(--lr-font-weight-medium); line-height: var(--lr-line-height-compact); white-space: nowrap; }
  :host([variant='brand']) { --lr-badge-background: var(--lr-color-brand-quiet); --lr-badge-color: var(--lr-color-brand); --lr-badge-border: var(--lr-color-brand); }
  :host([variant='success']) { --lr-badge-background: var(--lr-color-success-quiet); --lr-badge-color: var(--lr-color-success); --lr-badge-border: var(--lr-color-success); }
  :host([variant='warning']) { --lr-badge-background: var(--lr-color-warning-quiet); --lr-badge-color: var(--lr-color-warning); --lr-badge-border: var(--lr-color-warning); }
  :host([variant='danger']) { --lr-badge-background: var(--lr-color-danger-quiet); --lr-badge-color: var(--lr-color-danger); --lr-badge-border: var(--lr-color-danger); }
`;
