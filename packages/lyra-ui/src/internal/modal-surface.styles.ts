import { css, unsafeCSS, type CSSResult } from 'lit';

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

/**
 * The full-host scrim behind a dialog panel, tinted by the component's public
 * `--lr-<name>-overlay-color` over its private `--_lr-<name>-overlay-color` default. `name` is the
 * author-controlled tag stem, never user input.
 */
export function dialogBackdrop(name: string): CSSResult {
  return unsafeCSS(`[part="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(--lr-${name}-overlay-color, var(--_lr-${name}-overlay-color));
  }`);
}
