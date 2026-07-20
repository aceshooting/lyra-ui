import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* The 'm' defaults exactly reproduce the original fixed badge treatment -- mirrors
       <lr-chip>'s identical --lr-chip-font-size/-padding-inline/-min-height trio so a consumer
       moving between the two sibling components finds the same size vocabulary. */
    --lr-badge-font-size: var(--lr-font-size-sm);
    --lr-badge-padding-inline: var(--lr-space-s);
    --lr-badge-min-height: var(--lr-size-1-25rem);
  }
  [part='base'] { display: inline-flex; align-items: center; min-block-size: var(--lr-badge-min-height); padding-inline: var(--lr-badge-padding-inline); border: var(--lr-border-width-thin) solid var(--lr-badge-border, var(--lr-color-border)); border-radius: var(--lr-radius-pill); background: var(--lr-badge-background, var(--lr-color-surface)); color: var(--lr-badge-color, var(--lr-color-text)); font-size: var(--lr-badge-font-size); font-weight: var(--lr-font-weight-medium); line-height: var(--lr-line-height-compact); white-space: nowrap; }
  :host([variant='brand']) { --lr-badge-background: var(--lr-color-brand-quiet); --lr-badge-color: var(--lr-color-brand); --lr-badge-border: var(--lr-color-brand); }
  :host([variant='success']) { --lr-badge-background: var(--lr-color-success-quiet); --lr-badge-color: var(--lr-color-success); --lr-badge-border: var(--lr-color-success); }
  :host([variant='warning']) { --lr-badge-background: var(--lr-color-warning-quiet); --lr-badge-color: var(--lr-color-warning); --lr-badge-border: var(--lr-color-warning); }
  :host([variant='danger']) { --lr-badge-background: var(--lr-color-danger-quiet); --lr-badge-color: var(--lr-color-danger); --lr-badge-border: var(--lr-color-danger); }
  :host([size='2xs']) { --lr-badge-font-size: var(--lr-font-size-2xs); --lr-badge-padding-inline: var(--lr-space-2xs); --lr-badge-min-height: var(--lr-size-0-9375rem); }
  :host([size='xs']) { --lr-badge-font-size: var(--lr-font-size-xs); --lr-badge-padding-inline: var(--lr-space-xs); --lr-badge-min-height: var(--lr-size-1rem); }
  :host([size='s']) { --lr-badge-font-size: var(--lr-font-size-xs); --lr-badge-padding-inline: var(--lr-size-0-375rem); --lr-badge-min-height: var(--lr-size-1-1rem); }
  :host([size='l']) { --lr-badge-font-size: var(--lr-font-size-m); --lr-badge-padding-inline: var(--lr-space-m); --lr-badge-min-height: var(--lr-size-1-5rem); }
  :host([size='xl']) { --lr-badge-font-size: var(--lr-font-size-lg); --lr-badge-padding-inline: var(--lr-space-l); --lr-badge-min-height: var(--lr-size-1-75rem); }
`;
