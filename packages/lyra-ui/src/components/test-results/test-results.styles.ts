import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='summary'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-s);
    padding-block-end: var(--lyra-space-s);
  }
  [part='count'] {
    font-size: var(--lyra-font-size-sm);
    font-weight: var(--lyra-font-weight-medium);
  }
  [part='count'][data-status='passed'] { color: var(--lyra-color-success); }
  [part='count'][data-status='failed'] { color: var(--lyra-color-danger); }
  [part='count'][data-status='skipped'] { color: var(--lyra-color-text-quiet); }
  [part='count'][data-status='running'] { color: var(--lyra-color-brand); }
  [part='filter'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-xs);
    padding-block-end: var(--lyra-space-s);
  }
  [part='filter-toggle'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    cursor: pointer;
  }
  [part='filter-toggle'][aria-pressed='true'] {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
  }
  [part='filter-toggle']:focus-visible,
  [part='test-name']:focus-visible,
  [part='test-expand-toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='suite'] + [part='suite'] {
    margin-block-start: var(--lyra-space-s);
  }
  [part='suite-header'] {
    font-weight: var(--lyra-font-weight-semibold);
    padding-block: var(--lyra-space-xs);
  }
  [part='test'] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--lyra-space-xs);
    border-block-start: var(--lyra-size-1px) solid var(--lyra-color-border);
    padding-block: var(--lyra-space-xs);
  }
  [part='test-status'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-2xs);
    flex: 0 0 auto;
    font-size: var(--lyra-font-size-xs);
  }
  [part='test-status'] lyra-spinner {
    --lyra-spinner-size: var(--lyra-size-1em);
  }
  [part='test-status'][data-status='passed'] { color: var(--lyra-color-success); }
  [part='test-status'][data-status='failed'] { color: var(--lyra-color-danger); }
  [part='test-status'][data-status='skipped'] { color: var(--lyra-color-text-quiet); }
  [part='test-status'][data-status='running'] { color: var(--lyra-color-brand); }
  [part='test-name'] {
    flex: 1 1 auto;
    min-inline-size: var(--lyra-size-6ch);
    background: none;
    border: none;
    font: inherit;
    color: var(--lyra-color-text);
    cursor: pointer;
    text-align: start;
    padding: 0;
  }
  [part='test-duration'] {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
  }
  [part='test-expand-toggle'] {
    flex: 0 0 auto;
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    background: none;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
    padding: var(--lyra-space-2xs) var(--lyra-space-xs);
  }
  [part='failure'] {
    flex-basis: 100%;
    margin-block-start: var(--lyra-space-xs);
  }
  [part='failure'][hidden] {
    display: none;
  }
  [part='failure-message'] {
    font-family: var(--lyra-font-mono);
    font-size: var(--lyra-font-size-sm);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--lyra-color-danger);
  }
`;
