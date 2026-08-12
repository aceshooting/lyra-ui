import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-12rem);
    --_lr-time-input-border-color-default: var(--lr-color-border);
    --_lr-time-input-fill-default: transparent;
    --_lr-time-input-color-default: var(--lr-color-text);
  }

  [part~='form-control-label'] {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  [part~='form-control-label'][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}

  [part~='time-input'] {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: var(--lr-form-control-height);
    gap: var(--lr-time-input-gap, var(--lr-form-control-gap));
    padding-inline: var(--lr-form-control-padding-inline);
    border: var(--lr-border-width-thin) solid
      var(--lr-time-input-border-color, var(--_lr-time-input-border-color-default));
    border-radius: var(--lr-time-input-radius, var(--lr-form-control-radius));
    background: var(--lr-time-input-fill, var(--_lr-time-input-fill-default));
    color: var(--lr-time-input-color, var(--_lr-time-input-color-default));
    font: inherit;
    font-size: var(--lr-form-control-font-size);
  }
  :host([appearance='filled']) {
    --_lr-time-input-border-color-default: transparent;
    --_lr-time-input-fill-default: var(--lr-color-surface-raised);
  }
  :host([appearance='filled-outlined']) {
    --_lr-time-input-fill-default: var(--lr-color-surface-raised);
  }
  :host([appearance='plain']) {
    --_lr-time-input-border-color-default: transparent;
  }
  :host([appearance='accent']) {
    --_lr-time-input-border-color-default: transparent;
    --_lr-time-input-fill-default: var(--lr-color-brand);
    --_lr-time-input-color-default: var(--lr-color-on-brand);
  }
  :host([pill]) [part~='time-input'] {
    border-radius: var(--lr-time-input-radius, var(--lr-radius-pill));
  }
  :host([open]) [part~='time-input'],
  [part~='time-input']:focus-within {
    border-color: var(--lr-time-input-focus-border-color, var(--lr-color-brand));
  }
  :host(:disabled) [part~='time-input'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='start'],
  [part='end'] {
    flex: 0 1 auto;
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 50%;
    overflow: hidden;
    color: var(--lr-color-text-quiet);
  }
  [part='start'] slot,
  [part='end'] slot,
  [part='start'] slot::slotted(*),
  [part='end'] slot::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='start'][hidden],
  [part='end'][hidden] {
    display: none;
  }
  :host([appearance='accent']) [part='start'],
  :host([appearance='accent']) [part='end'] {
    color: inherit;
  }

  [part='input'] {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: baseline;
    min-inline-size: 0;
    outline: none;
  }
  [part='segment'] {
    display: inline-flex;
    justify-content: center;
    min-inline-size: var(--lr-size-2-5ch);
    padding-block: var(--lr-space-2xs);
    padding-inline: var(--lr-space-2xs);
    border-radius: var(--lr-radius-xs);
    color: inherit;
    cursor: text;
    font-variant-numeric: tabular-nums;
    user-select: none;
  }
  /* :host(:not(:disabled)), not [part='segment']:not(:disabled) -- a segment is
     <span part="segment" role="spinbutton">, which can never itself match :disabled. This is a
     form-associated custom element (static formAssociated = true), so the UA computes its
     disabled state (and therefore :disabled/:enabled matching on the host) from its own disabled
     content attribute *or* an ancestor <fieldset disabled>'s cascade, the same way lr-time-range's
     [part^='handle']:hover is gated. */
  :host(:not(:disabled)) [part='segment']:hover {
    background: var(--lr-time-input-segment-hover-bg, var(--lr-color-brand-quiet));
  }
  :host(:not(:disabled)) [part='segment']:active {
    background: var(
      --lr-time-input-segment-active-bg,
      color-mix(
        in oklab,
        var(--lr-time-input-segment-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part='segment']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    background: var(--lr-time-input-segment-focus-bg, var(--lr-time-input-segment-hover-bg, var(--lr-color-brand-quiet)));
  }
  [part='segment'][data-empty] {
    color: var(--lr-time-input-action-color, var(--lr-color-text-quiet));
  }
  :host([appearance='accent']) [part='segment'][data-empty] {
    color: inherit;
  }
  :host(:disabled) [part='segment'] {
    cursor: not-allowed;
  }
  [part='segment-literal'] {
    color: var(--lr-color-text-quiet);
    user-select: none;
  }
  :host([appearance='accent']) [part='segment-literal'] {
    color: inherit;
  }

  [part='clear-button'],
  [part='expand-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-2xs);
    border: none;
    border-radius: var(--lr-form-control-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    font: inherit;
    line-height: var(--lr-line-height-none);
  }
  [part='clear-button']:hover,
  [part='expand-button']:hover {
    color: var(--lr-time-input-action-hover-color, var(--lr-color-text));
    background: var(--lr-time-input-action-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='clear-button']:active,
  [part='expand-button']:active {
    background: var(
      --lr-time-input-action-active-bg,
      color-mix(
        in oklab,
        var(--lr-time-input-action-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part='clear-button']:focus-visible,
  [part='expand-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='clear-button']:disabled,
  [part='expand-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host([appearance='accent']) [part='clear-button'],
  :host([appearance='accent']) [part='expand-button'] {
    color: inherit;
  }
  [part='expand-icon'] {
    display: inline-flex;
    transform: rotate(90deg);
    transition: transform var(--lr-transition-fast);
  }
  :host([open]) [part='expand-icon'] {
    transform: rotate(-90deg);
  }

  [part='popup'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-block-size: var(--lr-positioner-available-block-size);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    box-shadow: var(--lr-shadow-m);
    color: var(--lr-color-text);
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
    transition-property: opacity, transform, visibility;
    transition-duration: var(--show-duration, var(--lr-duration-fast));
    transition-timing-function: var(--lr-easing-standard);
  }
  [part='popup'][data-hidden] {
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    visibility: hidden;
    pointer-events: none;
    transition-duration: var(--hide-duration, var(--lr-duration-fast));
  }
  [part='columns'] {
    display: flex;
    align-items: stretch;
    gap: var(--lr-space-xs);
  }
  [part='column'] {
    display: flex;
    flex-direction: column;
    inline-size: var(--column-width, var(--lr-size-3rem));
    max-block-size: calc(var(--column-item-height, var(--lr-size-2-25rem)) * 6);
    overflow-block: auto;
    overflow-inline: hidden;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  [part~='column-item'] {
    flex: 0 0 var(--column-item-height, var(--lr-size-2-25rem));
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-xs);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-variant-numeric: tabular-nums;
  }
  :where([part~='column-item']):hover {
    background: var(--lr-time-input-column-hover-bg, var(--lr-color-brand-quiet));
  }
  :where([part~='column-item']):active {
    background: var(
      --lr-time-input-column-active-bg,
      color-mix(
        in oklab,
        var(--lr-time-input-column-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  :where([part~='column-item']):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part~='column-item-selected'] {
    background: var(--lr-time-input-column-selected-bg, var(--lr-color-brand));
    color: var(--lr-time-input-column-selected-color, var(--lr-color-on-brand));
    font-weight: var(--lr-time-input-column-selected-font-weight, var(--lr-font-weight-semibold));
  }
  :where([part~='column-item-selected']):hover {
    background: var(
      --lr-time-input-column-selected-hover-bg,
      color-mix(
        in oklab,
        var(--lr-time-input-column-selected-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-hover)
      )
    );
  }
  :where([part~='column-item-selected']):active {
    background: var(
      --lr-time-input-column-selected-active-bg,
      color-mix(
        in oklab,
        var(--lr-time-input-column-selected-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part='now-button'] {
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    margin-block-start: var(--lr-space-s);
    padding-block: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  [part='now-button']:hover {
    background: var(--lr-time-input-action-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='now-button']:active {
    background: var(
      --lr-time-input-action-active-bg,
      color-mix(
        in oklab,
        var(--lr-time-input-action-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part='now-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='hint'],
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
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

  @container (max-width: 20rem) {
    [part='popup'] {
      max-inline-size: var(--lr-positioner-available-inline-size);
    }
    [part='columns'] {
      gap: var(--lr-space-2xs);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='popup'],
    [part='expand-icon'] {
      transition-duration: var(--lr-duration-fast);
    }
  }
`;
