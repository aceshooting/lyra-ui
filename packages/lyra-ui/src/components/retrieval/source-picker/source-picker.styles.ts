import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part="select-all"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="select-all-control"] {
    --lr-checkbox-checked-bg: var(
      --lr-source-picker-checked-bg,
      var(--lr-color-brand-quiet)
    );
    --lr-checkbox-checked-border: var(
      --lr-source-picker-checked-border,
      var(--lr-color-brand)
    );
  }
  [part="select-all-control"][indeterminate] {
    --lr-checkbox-checked-bg: var(
      --lr-source-picker-mixed-bg,
      color-mix(in srgb, var(--lr-color-brand) 50%, var(--lr-color-surface))
    );
  }
  [part="summary"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part="item"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-4px) var(--lr-space-xs);
    /* Per-level indent computed in CSS from the plain depth number the component writes inline,
       not a pre-formatted dimension: that keeps the step a retheme-able token and lets the indent
       be capped, so a deeply nested tree cannot push its labels off-screen. Same shape as
       lr-tree-item. */
    padding-inline-start: calc(
      var(--lr-space-xs) +
        min(
          var(--lr-source-picker-depth, 0) *
            var(--lr-source-picker-indent-size, var(--lr-size-1-25rem)),
          var(--lr-size-8rem)
        )
    );
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
  }
  [part="disclosure"] {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    inline-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part="disclosure"]:hover {
    background: color-mix(in srgb, var(--lr-color-text) 6%, transparent);
  }
  [part="disclosure"]:active {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="item"]:hover {
    background: color-mix(in srgb, var(--lr-color-text) 6%, transparent);
  }
  /* The row itself is the control -- clicking anywhere in it toggles the source, and the
     [part='checkbox'] inside is a painted div, not a focusable target -- so the row earns its own
     pressed state rather than deferring to something nested. */
  [part="item"]:active {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="item"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part="checkbox"] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
  }
  [part="checkbox"][data-state="true"] {
    background: var(--lr-source-picker-checked-bg, var(--lr-color-brand));
    border-color: var(--lr-source-picker-checked-border, var(--lr-color-brand));
  }
  [part="checkbox"][data-state="mixed"] {
    background: var(
      --lr-source-picker-mixed-bg,
      color-mix(in srgb, var(--lr-color-brand) 50%, var(--lr-color-surface))
    );
    border-color: var(--lr-source-picker-checked-border, var(--lr-color-brand));
  }
  [part="label"] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="empty"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part="error"] {
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part="limit"] {
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
`;
