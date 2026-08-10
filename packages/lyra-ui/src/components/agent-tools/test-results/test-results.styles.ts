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
    font: inherit;
    font-size: var(--lr-font-size-xs);
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    cursor: pointer;
  }
  [part='filter-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='filter-toggle'][aria-pressed='true'] {
    background: var(--lr-test-results-filter-active-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-test-results-filter-active-border, var(--lr-color-brand));
    color: var(--lr-test-results-filter-active-color, var(--lr-color-brand));
  }
  [part='filter-toggle']:where([aria-pressed='true']):hover {
    background: color-mix(
      in oklab,
      var(--lr-test-results-filter-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover rather than repeating it. It must stay after the [aria-pressed='true'] rule: the two
     selectors are both (0,2,0), so source order alone decides whether pressing an already-selected
     filter shows any feedback at all. */
  [part='filter-toggle']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='filter-toggle']:focus-visible,
  [part='test-name']:focus-visible,
  [part='test-expand-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='test-name']:hover,
  [part='test-expand-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='test-name']:active,
  [part='test-expand-toggle']:active {
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
    border-block-start: var(--lr-size-1px) solid var(--lr-color-border);
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
    --lr-spinner-size: var(--lr-size-1em);
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
  }
  [part='test-duration'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    overflow-wrap: anywhere;
  }
  [part='test-expand-toggle'] {
    flex: 0 0 auto;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    padding: var(--lr-space-2xs) var(--lr-space-xs);
  }
  [part='failure'] {
    flex-basis: 100%;
    margin-block-start: var(--lr-space-xs);
  }
  [part='failure'][hidden] {
    display: none;
  }
  [part='failure-message'] {
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--lr-test-results-failed-color, var(--lr-color-danger));
  }
`;
