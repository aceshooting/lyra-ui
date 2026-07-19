import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-tool-timeline-gap: var(--lr-space-l);
    --lr-tool-timeline-marker-size: var(--lr-size-0-625rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-tool-timeline-gap);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part='entry'] {
    display: grid;
    grid-template-columns: var(--lr-tool-timeline-marker-size) 1fr;
    column-gap: var(--lr-space-m);
  }

  [part='entry-marker'] {
    grid-column: 1;
    grid-row: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  [part='entry-marker']::before {
    content: '';
    flex: 0 0 auto;
    inline-size: var(--lr-tool-timeline-marker-size);
    block-size: var(--lr-tool-timeline-marker-size);
    margin-block-start: var(--lr-size-0-3em);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-text-quiet);
  }
  [part='entry']:not(:last-child) [part='entry-marker']::after {
    content: '';
    flex: 1 1 auto;
    inline-size: var(--lr-border-width-thin);
    min-block-size: var(--lr-space-l);
    margin-block-start: var(--lr-space-2xs);
    background: var(--lr-color-border);
  }
  [part='entry'][data-status='running'] [part='entry-marker']::before {
    background: var(--lr-color-brand);
  }
  [part='entry'][data-status='success'] [part='entry-marker']::before {
    background: var(--lr-color-success);
  }
  [part='entry'][data-status='error'] [part='entry-marker']::before {
    background: var(--lr-color-danger);
  }
  [part='entry'][data-status='denied'] [part='entry-marker']::before {
    background: var(--lr-color-warning);
  }

  [part='entry-body'] {
    grid-column: 2;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }

  [part='entry-header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
  }

  [part='entry'][data-pending-approval='true'] [part='entry-body'] {
    padding-inline-start: var(--lr-space-s);
    border-inline-start: var(--lr-border-width-medium) solid var(--lr-color-warning);
  }

  [part='entry-timestamp'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }

  lr-tool-call-chip {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='entry-retries'] {
    display: inline-flex;
    align-items: baseline;
    gap: var(--lr-size-0-3em);
    padding: var(--lr-size-0-1rem) var(--lr-space-xs);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface-raised);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='entry-retries-count'] {
    font-variant-numeric: tabular-nums;
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }

  [part='entry-approval-status'] {
    flex: 0 0 auto;
    padding: var(--lr-size-0-1rem) var(--lr-space-xs);
    border-radius: var(--lr-radius-pill);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-03em);
  }
  [part='entry-approval-status'][data-decision='approved'] {
    background: var(--lr-color-success-quiet);
    color: var(--lr-color-success);
  }
  [part='entry-approval-status'][data-decision='denied'] {
    background: var(--lr-color-danger-quiet);
    color: var(--lr-color-danger);
  }

  [part='entry-redacted-indicator'] {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
  }
  [part='entry-redacted-indicator'] svg {
    inline-size: var(--lr-size-0-875em);
    block-size: var(--lr-size-0-875em);
  }

  [part='entry-details'] {
    font-size: var(--lr-font-size-sm);
  }

  [part='entry-error'] {
    margin: 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
    white-space: pre-wrap;
  }
`;
