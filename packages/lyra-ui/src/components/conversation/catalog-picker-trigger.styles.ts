import { css } from 'lit';

/** The provider badge and truncating label every catalog-picker trigger shares. */
export const catalogPickerTriggerLabel = css`
  [part='provider-badge'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-inline-end: var(--lr-space-xs);
    margin-inline-end: var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trigger-label[data-placeholder] {
    color: var(--lr-color-text-quiet);
  }
`;
