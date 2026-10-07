import { css } from 'lit';

/** Maps `[data-status]` to `--_lr-flow-status-paint`, the one status palette every flow surface reads. */
export const flowStatusPaint = css`
  [data-status='pending'] {
    --_lr-flow-status-paint: var(--lr-flow-status-pending-color, var(--lr-color-border-strong));
  }
  [data-status='running'] {
    --_lr-flow-status-paint: var(--lr-flow-status-running-color, var(--lr-color-brand));
  }
  [data-status='success'] {
    --_lr-flow-status-paint: var(--lr-flow-status-success-color, var(--lr-color-success));
  }
  [data-status='error'] {
    --_lr-flow-status-paint: var(--lr-flow-status-error-color, var(--lr-color-danger));
  }
  [data-status='denied'] {
    --_lr-flow-status-paint: var(--lr-flow-status-denied-color, var(--lr-color-warning));
  }
`;
