import { css } from 'lit';

/** Independently promoted surfaces start a material root; ordinary contained surfaces keep nesting guards. */
export const glassIndependentRootStyles = css`
  :host(:popover-open),
  :host([data-native-modal-active]),
  [popover]:popover-open,
  dialog[data-native-modal-carrier]:modal {
    --_lr-glass-parent-opacity: initial;
    --_lr-glass-blocker: initial;
  }
`;
