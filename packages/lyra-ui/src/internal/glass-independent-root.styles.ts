import { css } from 'lit';

/** Independently promoted surfaces start a material root; ordinary contained surfaces keep nesting guards. */
export const glassIndependentRootStyles = css`
  :host(:popover-open),
  :host([data-native-modal-active]),
  [popover]:popover-open,
  dialog[data-native-modal-carrier]:modal {
    /* Inner important declarations outrank nesting guards written on a shadow host from outside. */
    --_lr-glass-parent-opacity: initial !important;
    --_lr-glass-blocker: var(--_lr-surface-root-filter, initial) !important;
  }
`;
