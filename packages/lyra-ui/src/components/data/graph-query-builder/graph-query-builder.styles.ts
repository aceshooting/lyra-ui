import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }
  [part='label'] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='hint'],
  [part='error'] {
    margin-block-start: calc(var(--lr-space-m) * -1);
    font-size: var(--lr-font-size-sm);
  }
  [part='hint'] {
    color: var(--lr-color-text-quiet);
  }
  [part='error'] {
    color: var(--lr-color-danger);
  }
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }

  [part='path-fields'] {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--lr-space-m);
  }
  [part='path-fields'] > * {
    flex: 1 1 var(--lr-size-10rem);
    min-inline-size: 0;
  }
  [part='min-hops'],
  [part='max-hops'] {
    flex-basis: var(--lr-size-7rem);
  }

  [part='filter-group'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='relationship-picker'],
  [part='node-type-picker'],
  [part='direction'] {
    max-inline-size: var(--lr-size-24rem);
  }
  [part='relationship-chips'],
  [part='node-type-chips'] {
    min-block-size: 0;
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    flex-wrap: wrap;
  }

  [part='run-button'],
  [part='save-button'] {
    font: inherit;
    border-radius: var(--lr-radius);
    padding: var(--lr-space-xs) var(--lr-space-m);
    cursor: pointer;
    border: var(--lr-border-width-thin) solid;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='run-button'] {
    background: var(--lr-graph-query-builder-run-bg, var(--lr-color-brand));
    border-color: var(--lr-graph-query-builder-run-border-color, var(--lr-color-brand));
    color: var(--lr-graph-query-builder-run-color, var(--lr-color-on-brand));
  }
  [part='save-button'] {
    background: var(--lr-graph-query-builder-save-bg, var(--lr-color-surface));
    border-color: var(--lr-graph-query-builder-save-border-color, var(--lr-color-border));
    color: var(--lr-graph-query-builder-save-color, var(--lr-color-text));
  }
  /* The resting fill mixed toward --lr-color-mix-partner (which follows the text colour) rather
     than multiplied channel-wise by filter: brightness(): a filter lightens a dark brand and
     darkens a light one only by accident, does nothing at all to a pure white or pure black one,
     and applies to the whole subtree, so it shifted this button's label too. */
  [part='run-button']:hover {
    background: var(
      --lr-graph-query-builder-run-hover-bg,
      color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-hover))
    );
  }
  [part='run-button']:active {
    background: var(
      --lr-graph-query-builder-run-active-bg,
      color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part='save-button']:hover {
    background: var(--lr-graph-query-builder-save-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='save-button']:active {
    background: var(
      --lr-graph-query-builder-save-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part='run-button']:disabled,
  [part='save-button']:disabled,
  [part='saved-load-button']:disabled,
  [part='saved-delete-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='run-button']:focus-visible,
  [part='save-button']:focus-visible,
  [part='saved-load-button']:focus-visible,
  [part='saved-delete-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='saved-queries'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding-block-start: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='saved-queries-label'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='save-row'] {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--lr-space-s);
  }
  [part='save-row'] > [part='save-name-input'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }

  [part='saved-list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part='saved-item'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border-radius: var(--lr-radius);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='saved-load-button'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: start;
    font: inherit;
    color: var(--lr-graph-query-builder-saved-load-color, var(--lr-color-text));
    background: none;
    border: none;
    padding: var(--lr-space-2xs);
    cursor: pointer;
    border-radius: var(--lr-radius-xs);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='saved-load-button']:hover {
    text-decoration: underline;
  }
  /* The pressed tint mixes from the row's surface fill, not the button's own transparent
     background; an underline alone cannot get more underlined, and loading a saved query replaces
     the whole form, which is worth acknowledging. */
  [part='saved-load-button']:active {
    background: var(
      --lr-graph-query-builder-saved-load-active-bg,
      color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
    text-decoration: underline;
  }
  [part='saved-delete-button'] {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-space-2xl);
    block-size: var(--lr-space-2xl);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    color: var(--lr-graph-query-builder-saved-delete-color, var(--lr-color-text-quiet));
    background: none;
    border: none;
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
  }
  [part='saved-delete-button'] svg {
    inline-size: var(--lr-size-1em);
    block-size: var(--lr-size-1em);
  }
  [part='saved-delete-button']:hover {
    color: var(--lr-graph-query-builder-saved-delete-hover-color, var(--lr-color-danger));
  }
  /* Pressed adds the quiet danger fill behind the already-red glyph rather than only deepening the
     glyph: a colour step on an icon this small is easy to miss, and this is the row's destructive
     control. */
  [part='saved-delete-button']:active {
    color: var(
      --lr-graph-query-builder-saved-delete-active-color,
      color-mix(in oklab, var(--lr-color-danger), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
    background: var(--lr-graph-query-builder-saved-delete-active-bg, var(--lr-color-danger-quiet));
  }

  [part='saved-empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }
`;
