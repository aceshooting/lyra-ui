import { css } from 'lit';

// Re-points nine GENERIC colour slots at the active variant's row of the 45-slot semantic grid, so a
// component styles itself once against `--lr-color-fill-loud` (etc.) instead of declaring one block
// per variant. `lr-button` alone carried five near-identical blocks of six declarations for this.
//
// The nine names mirror the grid's own shape -- {fill,border,on} x {quiet,normal,loud} -- because
// the grid's promise is that `on-<e>` is legible on `fill-<e>`, and renaming the tiers on the way
// through would make that promise unreadable at the call site. `scripts/check-contrast.mjs` proves
// the pairing for all five variants in both modes.
//
// Import this sheet only in components that actually take a `variant`; it is ~45 declarations per
// shadow root, which is real bytes against the tree-shaking budget for a component that would never
// read them.
export const variants = css`
  :host {
    --lr-color-fill-quiet: var(--lr-color-neutral-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-neutral-fill-normal);
    --lr-color-fill-loud: var(--lr-color-neutral-fill-loud);
    --lr-color-border-quiet: var(--lr-color-neutral-border-quiet);
    --lr-color-border-normal: var(--lr-color-neutral-border-normal);
    --lr-color-border-loud: var(--lr-color-neutral-border-loud);
    --lr-color-on-quiet: var(--lr-color-neutral-on-quiet);
    --lr-color-on-normal: var(--lr-color-neutral-on-normal);
    --lr-color-on-loud: var(--lr-color-neutral-on-loud);
  }
  :host([variant='neutral']) {
    --lr-color-fill-quiet: var(--lr-color-neutral-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-neutral-fill-normal);
    --lr-color-fill-loud: var(--lr-color-neutral-fill-loud);
    --lr-color-border-quiet: var(--lr-color-neutral-border-quiet);
    --lr-color-border-normal: var(--lr-color-neutral-border-normal);
    --lr-color-border-loud: var(--lr-color-neutral-border-loud);
    --lr-color-on-quiet: var(--lr-color-neutral-on-quiet);
    --lr-color-on-normal: var(--lr-color-neutral-on-normal);
    --lr-color-on-loud: var(--lr-color-neutral-on-loud);
  }
  :host([variant='brand']) {
    --lr-color-fill-quiet: var(--lr-color-brand-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-brand-fill-normal);
    --lr-color-fill-loud: var(--lr-color-brand-fill-loud);
    --lr-color-border-quiet: var(--lr-color-brand-border-quiet);
    --lr-color-border-normal: var(--lr-color-brand-border-normal);
    --lr-color-border-loud: var(--lr-color-brand-border-loud);
    --lr-color-on-quiet: var(--lr-color-brand-on-quiet);
    --lr-color-on-normal: var(--lr-color-brand-on-normal);
    --lr-color-on-loud: var(--lr-color-brand-on-loud);
  }
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
