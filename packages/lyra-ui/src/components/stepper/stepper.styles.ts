import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    gap: var(--lr-space-m);
    overflow-x: auto;
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    overflow-x: visible;
  }
  /* orientationBreakpoint's live axis -- only present while that feature is opted into (see
     stepper.ts's updateEffectiveOrientation()), so it can override the authored orientation rules
     above by source order alone (equal specificity) whenever the effective axis diverges from it. */
  :host([data-effective-orientation='vertical']) [part='base'] {
    flex-direction: column;
    overflow-x: visible;
  }
  :host([data-effective-orientation='horizontal']) [part='base'] {
    flex-direction: row;
    overflow-x: auto;
  }
  [part='step'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
    padding: var(--lr-space-2xs);
    border-radius: var(--lr-radius);
  }
  [part='step'][aria-disabled='true'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='step']:hover:not([aria-disabled='true']) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-text);
  }
  [part='step']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='step'][data-state='current'] {
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='step'][data-state='error'] {
    color: var(--lr-color-danger);
  }
  [part='step-index'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    flex: 0 0 auto;
  }
  [part='step'][data-state='current'] [part='step-index'] {
    background: var(--lr-color-brand);
    color: var(--lr-color-surface);
  }
  [part='step-check'] {
    color: var(--lr-color-success);
    flex: 0 0 auto;
  }
  [part='step-label'] {
    white-space: nowrap;
  }
`;
