import { css } from 'lit';

/**
 * The one per-appearance fill and border pairing every text-field sibling paints, resolved onto the
 * private `--_lr-form-control-fill` / `--_lr-form-control-border-color`; adopters map their own
 * `--_lr-<tag>-fill-default` / `-border-color-default` to these.
 */
export const formControlAppearance = css`
  :host {
    --_lr-form-control-fill: var(--lr-color-surface);
    --_lr-form-control-border-color: var(--lr-color-border);
  }
  :host([appearance='filled-outlined']) {
    --_lr-form-control-fill: var(--lr-color-surface-raised);
  }
  :host([appearance='filled']),
  :host([filled]) {
    --_lr-form-control-fill: var(--lr-color-surface-raised);
    --_lr-form-control-border-color: transparent;
  }
  :host([appearance='plain']) {
    --_lr-form-control-fill: transparent;
    --_lr-form-control-border-color: transparent;
  }
  :host([appearance='accent']) {
    --_lr-form-control-fill: var(--lr-color-brand-quiet);
    --_lr-form-control-border-color: var(--lr-color-brand);
  }
`;
