import { css } from 'lit';

// A pressed link uses a token-derived fill so it tints its inherited surface without assuming a
// particular surface token. The current-page color uses an inline fallback so a consumer can set it
// on the item or an ancestor without a host declaration shadowing that override.
export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="separator"] {
    color: var(--lr-color-text-quiet);
    flex: 0 0 auto;
  }
  :host([data-lr-breadcrumb-first]) [part="separator"] {
    display: none;
  }
  [part="base"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    color: var(--lr-color-text);
    text-decoration: none;
    border-radius: var(--lr-radius);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  button[part="base"] {
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  :where(a, button)[part="base"] {
    justify-content: center;
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
  }
  [part~="start"],
  [part~="end"] {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
  }
  [part~="start"][hidden],
  [part~="end"][hidden] {
    display: none;
  }
  [part="label"] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  :where(a, button)[part="base"]:hover {
    text-decoration: underline;
  }
  :where(a, button)[part="base"]:active {
    text-decoration: underline;
    background: var(
      --lr-breadcrumb-item-active-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="base"][aria-current="page"] {
    color: var(--lr-breadcrumb-current-color, var(--lr-color-text-quiet));
    font-weight: var(--lr-font-weight-semibold);
  }
`;
