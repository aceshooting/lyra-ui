import { css } from 'lit';

/** Explicit semantic rows shared by the defaulting and context-inheriting variant sheets. */
export const semanticVariantRows = css`
  :host([variant='success']) {
    --lr-color-fill-quiet: var(--lr-color-success-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-success-fill-normal);
    --lr-color-fill-loud: var(--lr-color-success-fill-loud);
    --lr-color-border-quiet: var(--lr-color-success-border-quiet);
    --lr-color-border-normal: var(--lr-color-success-border-normal);
    --lr-color-border-loud: var(--lr-color-success-border-loud);
    --lr-color-on-quiet: var(--lr-color-success-on-quiet);
    --lr-color-on-normal: var(--lr-color-success-on-normal);
    --lr-color-on-loud: var(--lr-color-success-on-loud);
  }
  :host([variant='warning']) {
    --lr-color-fill-quiet: var(--lr-color-warning-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-warning-fill-normal);
    --lr-color-fill-loud: var(--lr-color-warning-fill-loud);
    --lr-color-border-quiet: var(--lr-color-warning-border-quiet);
    --lr-color-border-normal: var(--lr-color-warning-border-normal);
    --lr-color-border-loud: var(--lr-color-warning-border-loud);
    --lr-color-on-quiet: var(--lr-color-warning-on-quiet);
    --lr-color-on-normal: var(--lr-color-warning-on-normal);
    --lr-color-on-loud: var(--lr-color-warning-on-loud);
  }
  :host([variant='danger']) {
    --lr-color-fill-quiet: var(--lr-color-danger-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-danger-fill-normal);
    --lr-color-fill-loud: var(--lr-color-danger-fill-loud);
    --lr-color-border-quiet: var(--lr-color-danger-border-quiet);
    --lr-color-border-normal: var(--lr-color-danger-border-normal);
    --lr-color-border-loud: var(--lr-color-danger-border-loud);
    --lr-color-on-quiet: var(--lr-color-danger-on-quiet);
    --lr-color-on-normal: var(--lr-color-danger-on-normal);
    --lr-color-on-loud: var(--lr-color-danger-on-loud);
  }
`;
