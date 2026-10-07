import { nativeSearchStyles } from '../../../internal/native-search.styles.js';
import { iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='search-field'] {
    position: relative;
    display: flex;
    min-inline-size: 0;
  }
  [part='search-field'] {
    --_search-height: max(var(--lr-icon-button-size), var(--lr-node-palette-search-min-height, var(--lr-input-control-height, var(--lr-input-control-min-height, var(--lr-form-control-height, var(--lr-icon-button-size))))));
    --_search-padding-block: var(--lr-node-palette-search-padding-block, var(--lr-input-padding-block, var(--lr-form-control-padding-block, var(--lr-space-xs))));
    --_search-padding-inline: var(--lr-node-palette-search-padding-inline, var(--lr-input-padding-inline, var(--lr-form-control-padding-inline, var(--lr-space-s))));
    --_search-radius: var(--lr-node-palette-search-radius, var(--lr-input-radius, var(--lr-form-control-radius, var(--lr-radius))));
    --_search-font-size: var(--lr-node-palette-search-font-size, var(--lr-input-font-size, var(--lr-form-control-font-size, inherit)));
  }
  [part='search-field'] { --_search-end-padding: calc(var(--lr-icon-button-size) + var(--lr-space-2xs)); }
  ${nativeSearchStyles}
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    overflow-y: auto;
    overflow-x: clip;
    min-inline-size: 0;
  }
  [part='group-header'] {
    padding: var(--lr-space-2xs) var(--lr-space-s);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text-quiet);
    text-transform: uppercase;
  }
  [part='item'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    box-sizing: border-box;
    ${iconHitTarget}
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    cursor: grab;
    transition: background-color var(--lr-transition-fast);
  }
  [part='item'][aria-disabled='true'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  /* :where() zeroes the wrapped attribute-selector and pseudo-class, leaving :hover/:focus-visible
     alone at (0,1,0). Unwrapped, [part='item']:not([aria-disabled='true']):hover is (0,3,0) and
     out-ranks the source-later :active rule below, leaving a dragged item with no pressed fill. */
  /* --lr-color-neutral-fill-quiet, not --lr-color-border: a draggable palette item's own
     hover/press fill is a neutral tint on top of the surface it sits on, not a border color
     borrowed as a fill -- the same class of fix as this release's lr-avatar/lr-skeleton/lr-empty
     sweep. */
  :where([part='item']):hover:where(:not([aria-disabled='true'])),
  :where([part='item']):focus-visible:where(:not([aria-disabled='true'])) {
    background: var(--lr-color-surface-hover, var(--lr-color-neutral-fill-quiet));
  }
  /* These items are drag sources (cursor: grab above), so the press is the moment the drag starts:
     deeper fill plus the grabbing cursor. Same :where() shape as the hover rule, so the two tie at
     (0,1,0) and source order hands this one the press. */
  :where([part='item']):active:where(:not([aria-disabled='true'])) {
    background: color-mix(in oklab, var(--lr-color-surface-hover, var(--lr-color-neutral-fill-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    cursor: grabbing;
  }
  [part='item']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='item-label'] {
    font-weight: var(--lr-font-weight-medium);
  }
  [part='item-description'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='empty'] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    text-align: center;
  }
`;
