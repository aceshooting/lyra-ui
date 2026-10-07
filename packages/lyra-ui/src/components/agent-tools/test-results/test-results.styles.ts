import { focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='summary'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    padding-block-end: var(--lr-space-s);
  }
  [part='count'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
  }
  [part='count'][data-status='passed'] { color: var(--lr-test-results-passed-color, var(--lr-color-success)); }
  [part='count'][data-status='failed'] { color: var(--lr-test-results-failed-color, var(--lr-color-danger)); }
  [part='count'][data-status='skipped'] { color: var(--lr-test-results-skipped-color, var(--lr-color-text-quiet)); }
  [part='count'][data-status='running'] { color: var(--lr-test-results-running-color, var(--lr-color-brand)); }
  [part='filter'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    padding-block-end: var(--lr-space-s);
  }
  [part='filter-toggle'] {
    font-size: var(--lr-font-size-xs);
    --_lr-agent-action-hover-base: var(--lr-color-brand-quiet);
    --_lr-agent-action-selected-fill: var(--lr-test-results-filter-active-bg, var(--lr-color-brand-quiet));
    --_lr-agent-action-selected-border: var(--lr-test-results-filter-active-border, var(--lr-color-brand));
    --_lr-agent-action-selected-color: var(--lr-test-results-filter-active-color, var(--lr-color-brand));
  }
  [part='test-name']:focus-visible {
    ${focusRing}
  }
  [part='test-name']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='test-name']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='suite'] + [part='suite'] {
    margin-block-start: var(--lr-space-s);
  }
  [part='suite-header'] {
    font-weight: var(--lr-font-weight-semibold);
    padding-block: var(--lr-space-xs);
    overflow-wrap: anywhere;
  }
  [part='test'] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    padding-block: var(--lr-space-xs);
  }
  [part='test-status'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
  }
  [part='test-status'] lr-spinner {
    --lr-spinner-size: var(--lr-test-results-spinner-size, var(--lr-size-1em));
  }
  [part='test-status'][data-status='passed'] { color: var(--lr-test-results-passed-color, var(--lr-color-success)); }
  [part='test-status'][data-status='failed'] { color: var(--lr-test-results-failed-color, var(--lr-color-danger)); }
  [part='test-status'][data-status='skipped'] { color: var(--lr-test-results-skipped-color, var(--lr-color-text-quiet)); }
  [part='test-status'][data-status='running'] { color: var(--lr-test-results-running-color, var(--lr-color-brand)); }
  [part='test-name'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    background: none;
    border: none;
    font: inherit;
    color: var(--lr-color-text);
    cursor: pointer;
    text-align: start;
    padding: 0;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part='test-duration'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    overflow-wrap: anywhere;
  }
  [part='test-expand-toggle'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    --_lr-agent-action-hover-base: var(--lr-color-brand-quiet);
    --_lr-agent-action-padding-inline: var(--lr-space-xs);
  }
  [part='failure'] {
    flex-basis: 100%;
    margin-block-start: var(--lr-space-xs);
  }
  [part='failure'][hidden] {
    display: none;
  }
  [part='failure-message'] {
    unicode-bidi: plaintext;
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--lr-test-results-failed-color, var(--lr-color-danger));
  }

  [part='limit'] {
    margin-block: var(--lr-space-s) 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
`;
