import { css } from 'lit';

/**
 * The centered, safe-area-padded frame every full-viewport dialog host paints inside its own
 * `:host` rule, after the popover reset (`modalHostStyles`). Declarations, not a rule set, so the
 * component's host stays readable in one file.
 */
export const dialogChrome = css`
  align-items: center;
  justify-content: center;
  padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
  padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
  padding-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
  padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
`;

/** Shows the host while it is open. */
export const dialogOpenHost = css`
  :host([open]) {
    display: flex;
  }
`;
